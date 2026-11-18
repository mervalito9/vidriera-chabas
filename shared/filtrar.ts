// Filtro en memoria. Lo usa la vista previa sin servidor; el backend hace lo mismo con SQL.
import { OTRO_PUEBLO, PUEBLOS } from "./config.ts";
import type { AvisoPublico, Filtros } from "./tipos.ts";
import { slug } from "./texto.ts";

export function filtrarAvisos(avisos: AvisoPublico[], f: Filtros): AvisoPublico[] {
  const palabras = slug(f.q).split("-").filter(Boolean);
  const max = Number(f.max);
  const res = avisos.filter((a) => {
    if (f.rubro && a.rubro !== f.rubro) return false;
    if (f.pueblo === OTRO_PUEBLO ? PUEBLOS.includes(a.pueblo) : f.pueblo && a.pueblo !== f.pueblo) return false;
    if (f.tipo && a.tipo !== f.tipo) return false;
    if (f.op && a.operacion !== f.op) return false;
    if (f.permuta && !a.permuta) return false;
    if (f.financia && !a.financia) return false;
    if (f.max && max > 0 && !(a.moneda === f.moneda && a.precio !== null && a.precio <= max)) return false;
    if (palabras.length) {
      const texto = slug([a.titulo, a.tipo, a.descripcion, a.zona, a.datos.join(" ")].join(" ")).replace(/-/g, " ");
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    return true;
  });
  if (f.orden) {
    res.sort((x, y) => {
      if (x.moneda !== y.moneda) return x.moneda === "USD" ? 1 : -1;
      const px = x.precio ?? 0;
      const py = y.precio ?? 0;
      return f.orden === "barato" ? px - py : py - px;
    });
  }
  return res;
}
