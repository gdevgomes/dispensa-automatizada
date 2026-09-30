import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'shopping-list-items';

export type ListItem = {
  id: string;
  name: string;
  code: string;
  /** Data de criação da lista (ISO). */
  buyDate: string;
  /** Validade escolhida no scanner — último dia do mês selecionado (ISO). */
  expirationDate: string;
  exists: boolean;
};

export type NewListItem = {
  name: string;
  code: string;
  expiryYear: number;
  expiryMonth: number; // 1-12
};

export async function getListItems(): Promise<ListItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ListItem[];
  } catch {
    return [];
  }
}

/** Cria uma nova lista: adiciona os itens aos já existentes, todos com a mesma data de compra. */
export async function appendList(newItems: NewListItem[]): Promise<ListItem[]> {
  const existing = await getListItems();
  const now = new Date();
  const buyDate = now.toISOString();
  const created: ListItem[] = newItems.map((item, index) => ({
    id: `${now.getTime()}-${index}-${item.code}`,
    name: item.name,
    code: item.code,
    buyDate,
    expirationDate: new Date(item.expiryYear, item.expiryMonth, 0, 23, 59, 59).toISOString(),
    exists: true,
  }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...created]));
  return created;
}

export async function setItemExists(id: string, exists: boolean): Promise<void> {
  const items = await getListItems();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items.map((item) => (item.id === id ? { ...item, exists } : item))),
  );
}
