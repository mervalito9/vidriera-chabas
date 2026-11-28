import { sufijoPrecio } from "../../shared/vacaciones.ts";
import type { AvisoPublico } from "../../shared/tipos.ts";
import { fmtNum } from "../../shared/texto.ts";

export function precioTexto(a: Pick<AvisoPublico, "precio" | "moneda">): string {
  if (a.precio === null || a.precio <= 0) return "Consultar precio";
  return `${a.moneda === "ARS" ? "$" : "USD"} ${fmtNum(a.precio)}`;
}

/** Lo que va después del precio: "por mes" en alquileres, "por noche"/"por semana"… en vacaciones, "" en ventas. */
export const sufijo = (a: Pick<AvisoPublico, "rubro" | "operacion" | "precio" | "datos">): string => sufijoPrecio(a);
/** @deprecated usar sufijo(): queda para el panel (redes). */
export const porMes = (a: Pick<AvisoPublico, "rubro" | "operacion" | "precio" | "datos">): boolean => sufijoPrecio(a) !== "";

/** Solo se muestran fotos propias del sitio (nunca de otras páginas). */
export function fotoSegura(ruta: string): string {
  return /^\/?(fotos|assets\/img)\/[A-Za-z0-9_\-]+\.(jpe?g|png|webp|svg)$/i.test(ruta) ? ruta : "";
}

/** "Hoy", "Ayer", "Hace 5 días", "Hace 3 semanas", "Hace 2 meses". */
export function hace(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const dias = Math.floor((Date.now() - t) / 864e5);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 14) return `Hace ${dias} días`;
  if (dias < 60) return `Hace ${Math.floor(dias / 7)} semanas`;
  return `Hace ${Math.floor(dias / 30)} meses`;
}
