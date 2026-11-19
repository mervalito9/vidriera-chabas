// Filtro en memoria. Lo usa la vista previa sin servidor; el backend hace lo mismo con SQL.
import { OTRO_PUEBLO, PUEBLOS } from "./config.ts";
import type { AvisoPublico, Filtros } from "./tipos.ts";
import { slug } from "./texto.ts";

/** Pesos por dólar que usa la vista previa (el servidor usa DOLAR_REFERENCIA). */
export const DOLAR_VISTA_PREVIA = 1550;

/** Precio llevado a pesos, para comparar avisos en USD con avisos en $. null si es "a consultar". */
export const enPesos = (a: Pick<AvisoPublico, "precio" | "moneda">, dolar: number): number | null =>
  a.precio === null ? null : a.moneda === "USD" ? a.precio * dolar : a.precio;

export function filtrarAvisos(avisos: AvisoPublico[], f: Filtros, dolar = DOLAR_VISTA_PREVIA): AvisoPublico[] {
  const palabras = slug(f.q).split("-").filter(Boolean);
  const max = Number(f.max) * (f.moneda === "USD" ? dolar : 1);
  const res = avisos.filter((a) => {
    if (f.rubro && a.rubro !== f.rubro) return false;
    if (f.pueblo === OTRO_PUEBLO ? PUEBLOS.includes(a.pueblo) : f.pueblo && a.pueblo !== f.pueblo) return false;
    if (f.tipo && a.tipo !== f.tipo) return false;
    if (f.op && a.operacion !== f.op) return false;
    if (f.permuta && !a.permuta) return false;
    if (f.financia && !a.financia) return false;
    const precio = enPesos(a, dolar);
    if (f.max && max > 0 && (precio === null || precio > max)) return false;
    if (palabras.length) {
      const texto = slug([a.titulo, a.tipo, a.descripcion, a.zona, a.datos.join(" ")].join(" ")).replace(/-/g, " ");
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    return true;
  });
  if (f.orden) {
    // Los "a consultar" van al final, igual que en el servidor.
    res.sort((x, y) => {
      const px = enPesos(x, dolar);
      const py = enPesos(y, dolar);
      if (px === null || py === null) return (px === null ? 1 : 0) - (py === null ? 1 : 0);
      return f.orden === "barato" ? px - py : py - px;
    });
  }
  return res;
}
