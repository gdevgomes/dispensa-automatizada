import { Palette } from '@/constants/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpiryInfo = {
  days: number;
  label: string;
  color: string;
  background: string;
  glyph: string;
};

/** Último dia do mês (1–12) às 23:59:59, em ISO. */
export function monthEndIso(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59).toISOString();
}

export function formatMonthYear(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function expiryInfo(iso: string): ExpiryInfo {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.floor(diff / DAY_MS);
  if (diff < 0) return { days, label: 'Vencido', color: Palette.error, background: Palette.errorLight, glyph: '!' };
  if (days < 30) return { days, label: 'Vence em breve', color: Palette.warning, background: Palette.warningLight, glyph: '!' };
  return { days, label: 'Válido', color: Palette.success, background: Palette.successLight, glyph: '✓' };
}

/** Linha de data exibida nos cartões da lista. */
export function expiryDateLine(iso: string, info: ExpiryInfo) {
  const date = formatDate(iso);
  if (info.days < 0) return `Venceu em ${date}`;
  if (info.days < 30) {
    const rel = info.days === 0 ? 'hoje' : info.days === 1 ? 'amanhã' : `em ${info.days} dias`;
    return `Vence em ${date} · ${rel}`;
  }
  return `Validade ${date}`;
}
