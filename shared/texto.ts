/** Deja solo dígitos. */
export const soloDigitos = (s: unknown): string => String(s ?? "").replace(/\D+/g, "");

/** Saca caracteres de control y recorta a un largo máximo. */
export const recortar = (s: unknown, max: number): string =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

/** "Galpón o local" -> "galpon-o-local" */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** 68000 -> "68.000" */
export const fmtNum = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const fmtFecha = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;
