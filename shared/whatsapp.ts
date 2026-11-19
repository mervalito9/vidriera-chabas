import { soloDigitos } from "./texto.ts";

/**
 * Lleva un celular argentino escrito "como sale" a los 10 dígitos de siempre (código de área + número).
 * Acepta lo que escribe la gente: "03464 15 40-1234", "+54 9 3464 401234", "3464-401234", "(011) 15 4567-8901".
 * Devuelve "" si no tiene código de área o no es un celular argentino.
 */
export function telefonoArgentino(texto: string): string {
  let d = soloDigitos(texto);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54") && d.length >= 12) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  // "3464 15 401234": el 15 va después del código de área (2, 3 o 4 dígitos) y no forma parte del número.
  if (d.length === 12) {
    for (const area of [4, 3, 2]) {
      if (d.slice(area, area + 2) === "15") { d = d.slice(0, area) + d.slice(area + 2); break; }
    }
  }
  return /^[1-9]\d{9}$/.test(d) ? d : "";
}

// Códigos de área de 3 dígitos (el resto, salvo el 11, tiene 4).
const AREAS_DE_3 = new Set("220 221 223 230 236 237 249 260 261 263 264 266 280 291 294 297 299 341 342 343 345 348 351 353 358 362 364 370 376 379 380 381 383 385 387 388".split(" "));

/** "3464401234" → "3464 40-1234" (para mostrar). */
export function formatearTelefono(texto: string): string {
  const d = telefonoArgentino(texto);
  if (!d) return texto;
  const area = d.startsWith("11") ? 2 : AREAS_DE_3.has(d.slice(0, 3)) ? 3 : 4;
  const resto = d.slice(area);
  return `${d.slice(0, area)} ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}

/** Número para wa.me (549 + 10 dígitos). "" si no sirve. */
export function numeroWA(n: string): string {
  const d = telefonoArgentino(n);
  return d ? `549${d}` : "";
}

/** Arma un link a wa.me con el texto codificado. Devuelve "" si el número no sirve. */
export function linkWA(numero: string, texto: string): string {
  const d = numeroWA(numero);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(texto)}` : "";
}
