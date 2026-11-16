import { soloDigitos } from "./texto.ts";

/** Normaliza un número de WhatsApp argentino. 10 dígitos (área + número) -> agrega 549 adelante. */
export function numeroWA(n: string): string {
  let d = soloDigitos(n);
  if (d.length === 10) d = `549${d}`;
  return /^\d{10,15}$/.test(d) ? d : "";
}

/** Arma un link a wa.me con el texto codificado. Devuelve "" si el número no sirve. */
export function linkWA(numero: string, texto: string): string {
  const d = numeroWA(numero);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(texto)}` : "";
}
