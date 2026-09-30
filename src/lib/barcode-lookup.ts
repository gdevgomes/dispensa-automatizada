import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProductLookupResult =
  | { status: 'found'; code: string; name: string; brand?: string; category?: string; quantity?: string; imageUrl?: string }
  | { status: 'not-found'; code: string }
  | { status: 'error'; code: string; message: string };

type CacheableResult = Extract<ProductLookupResult, { status: 'found' | 'not-found' }>;
type CacheEntry = { result: CacheableResult; cachedAt: number };

const CACHE_PREFIX = 'barcode-cache:';
// Dados de produto quase não mudam; "não encontrado" expira cedo porque a base pública pode ganhar o produto.
const FOUND_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;

const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ProductLookupResult>>();

function isFresh(entry: CacheEntry) {
  const ttl = entry.result.status === 'found' ? FOUND_TTL_MS : NOT_FOUND_TTL_MS;
  return Date.now() - entry.cachedAt < ttl;
}

async function readCache(code: string): Promise<CacheableResult | null> {
  let entry = memoryCache.get(code);
  if (!entry) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + code);
      if (raw) entry = JSON.parse(raw) as CacheEntry;
    } catch {
      return null;
    }
  }
  if (!entry || !isFresh(entry)) return null;
  memoryCache.set(code, entry);
  return entry.result;
}

async function writeCache(code: string, result: CacheableResult) {
  const entry: CacheEntry = { result, cachedAt: Date.now() };
  memoryCache.set(code, entry);
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + code, JSON.stringify(entry));
  } catch {
    // cache é só otimização; falha de escrita não deve afetar o scanner
  }
}

/**
 * Busca dados do produto pelo código de barras (EAN-13), com cache persistente (AsyncStorage + memória).
 * Só resultados 'found' e 'not-found' são cacheados; erros de rede sempre tentam de novo.
 */
export function lookupProductByBarcode(code: string): Promise<ProductLookupResult> {
  const pending = inFlight.get(code);
  if (pending) return pending;

  const promise = (async () => {
    const cached = await readCache(code);
    if (cached) return cached;

    const result = await fetchProductByBarcode(code);
    if (result.status !== 'error') await writeCache(code, result);
    return result;
  })().finally(() => inFlight.delete(code));

  inFlight.set(code, promise);
  return promise;
}

/** Consulta a API pública do Open Food Facts diretamente do app — sem backend próprio. */
async function fetchProductByBarcode(code: string): Promise<ProductLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { status: 'error', code, message: `Falha na consulta (HTTP ${response.status})` };
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return { status: 'not-found', code };
    }

    const product = data.product;
    const name: string | undefined = product.product_name_pt || product.product_name || product.generic_name;

    if (!name) {
      return { status: 'not-found', code };
    }

    return {
      status: 'found',
      code,
      name,
      brand: product.brands || undefined,
      category: product.categories?.split(',')[0]?.trim() || undefined,
      quantity: product.quantity || undefined,
      imageUrl: product.image_front_small_url || undefined,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Tempo de consulta esgotado' : 'Sem conexão com a internet';
    return { status: 'error', code, message };
  } finally {
    clearTimeout(timeout);
  }
}
