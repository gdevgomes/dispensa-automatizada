const UF_BY_CODE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

const TIPO_EMISSAO: Record<string, string> = {
  '1': 'Normal',
  '2': 'Contingência FS-IA',
  '3': 'SCAN',
  '4': 'EPEC',
  '5': 'Contingência FS-DA',
  '6': 'Contingência SVC-AN',
  '7': 'Contingência SVC-RS',
  '8': 'Contingência off-line',
  '9': 'Contingência off-line',
};

export type NfceKey = {
  raw: string;
  uf: string;
  ano: number;
  mes: number;
  cnpj: string;
  modelo: string;
  serie: number;
  numero: number;
  tipoEmissao: string;
  codigoNumerico: string;
  digitoVerificador: string;
  digitoValido: boolean;
};

/** Extrai a chave de acesso de 44 dígitos de dentro do conteúdo bruto do QR Code da NFC-e. */
export function extractAccessKey(rawData: string): string | null {
  const match = rawData.match(/\d{44}/);
  return match ? match[0] : null;
}

/** Calcula o dígito verificador (módulo 11) dos 43 primeiros dígitos da chave de acesso. */
function calculateCheckDigit(first43Digits: string): number {
  let sum = 0;
  let weight = 2;

  for (let i = first43Digits.length - 1; i >= 0; i--) {
    sum += Number(first43Digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/** Decodifica os campos da chave de acesso da NFC-e (posições definidas pelo layout da SEFAZ). */
export function decodeAccessKey(key: string): NfceKey | null {
  if (!/^\d{44}$/.test(key)) return null;

  const cUF = key.slice(0, 2);
  const aamm = key.slice(2, 6);
  const cnpj = key.slice(6, 20);
  const modelo = key.slice(20, 22);
  const serie = key.slice(22, 25);
  const nNF = key.slice(25, 34);
  const tpEmis = key.slice(34, 35);
  const cNF = key.slice(35, 43);
  const cDV = key.slice(43, 44);

  const expectedDV = calculateCheckDigit(key.slice(0, 43));

  return {
    raw: key,
    uf: UF_BY_CODE[cUF] ?? `UF ${cUF}`,
    ano: 2000 + Number(aamm.slice(0, 2)),
    mes: Number(aamm.slice(2, 4)),
    cnpj: formatCnpj(cnpj),
    modelo,
    serie: Number(serie),
    numero: Number(nNF),
    tipoEmissao: TIPO_EMISSAO[tpEmis] ?? `Tipo ${tpEmis}`,
    codigoNumerico: cNF,
    digitoVerificador: cDV,
    digitoValido: Number(cDV) === expectedDV,
  };
}

/** Recebe o conteúdo bruto lido do QR Code da NFC-e e devolve a chave decodificada, se válida. */
export function parseNfceQrCode(rawData: string): NfceKey | null {
  const key = extractAccessKey(rawData);
  if (!key) return null;
  return decodeAccessKey(key);
}
