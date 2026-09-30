export type ScrapedNfceItem = {
  description: string;
  qty?: string;
  unit?: string;
  price?: string;
};

export type ScrapedNfceResult = {
  items: ScrapedNfceItem[];
  total?: string;
  rawTextSample?: string;
  error?: string;
};

/**
 * Script injetado dentro da WebView que carrega a página pública da NFC-e.
 * Roda no HTML real renderizado pelo portal da SEFAZ (sem CORS/bloqueio de bot,
 * já que sai do navegador do próprio dispositivo) e devolve os dados via postMessage.
 *
 * Como o layout varia por estado, usa duas estratégias em cascata:
 * 1) a tabela de itens conhecida de portais que reaproveitam o template padrão (#myTable);
 * 2) uma heurística genérica: qualquer linha de tabela/lista com um valor em formato de dinheiro.
 * Se nada for encontrado, devolve uma amostra do texto da página para inspeção manual.
 */
export const NFCE_SCRAPE_SCRIPT = `
(function () {
  try {
    function text(el) {
      return el ? el.textContent.replace(/\\s+/g, ' ').trim() : '';
    }

    function parseMoney(str) {
      if (!str) return undefined;
      var match = str.match(/(\\d{1,3}(?:\\.\\d{3})*,\\d{2})/);
      return match ? match[1] : undefined;
    }

    var items = [];

    var knownTable = document.querySelector('#myTable') || document.querySelector('table#tabResult');
    if (knownTable) {
      var knownRows = knownTable.querySelectorAll('tr');
      knownRows.forEach(function (row) {
        var cells = row.querySelectorAll('td');
        var description = cells[0] ? text(cells[0]) : '';
        if (description) {
          items.push({
            description: description,
            qty: cells[1] ? text(cells[1]) : undefined,
            unit: cells[2] ? text(cells[2]) : undefined,
            price: cells[3] ? text(cells[3]) : undefined,
          });
        }
      });
    }

    if (items.length === 0) {
      var candidates = document.querySelectorAll('table tr, li');
      candidates.forEach(function (row) {
        var rowText = text(row);
        var money = parseMoney(rowText);
        if (money && rowText.length > 3 && rowText.length < 200) {
          items.push({ description: rowText, price: money });
        }
      });
    }

    var bodyText = text(document.body);
    var totalMatch = bodyText.match(/valor\\s+(?:total|a pagar)[^\\d]{0,15}(\\d{1,3}(?:\\.\\d{3})*,\\d{2})/i);

    var payload = {
      items: items.slice(0, 200),
      total: totalMatch ? totalMatch[1] : undefined,
      rawTextSample: items.length === 0 ? bodyText.slice(0, 4000) : undefined,
    };

    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ items: [], error: String(e) }));
  }
  true;
})();
`;

export function parseScrapeMessage(raw: string): ScrapedNfceResult {
  try {
    const data = JSON.parse(raw);
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'string' ? data.total : undefined,
      rawTextSample: typeof data.rawTextSample === 'string' ? data.rawTextSample : undefined,
      error: typeof data.error === 'string' ? data.error : undefined,
    };
  } catch {
    return { items: [], error: 'Falha ao interpretar os dados recebidos da página' };
  }
}
