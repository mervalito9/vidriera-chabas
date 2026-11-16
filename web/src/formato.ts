import type { AvisoPublico } from "../../shared/tipos.ts";
import { fmtNum } from "../../shared/texto.ts";

export function precioTexto(a: Pick<AvisoPublico, "precio" | "moneda">): string {
  if (a.precio === null || a.precio <= 0) return "Consultar precio";
  return `${a.moneda === "ARS" ? "$" : "USD"} ${fmtNum(a.precio)}`;
}

export const porMes = (a: Pick<AvisoPublico, "operacion" | "precio">): boolean => a.operacion === "alquiler" && a.precio !== null;

/** Solo se muestran fotos propias del sitio (nunca de otras páginas). */
export function fotoSegura(ruta: string): string {
  return /^\/?(fotos|assets\/img)\/[A-Za-z0-9_\-]+\.(jpe?g|png|webp|svg)$/i.test(ruta) ? ruta : "";
}
