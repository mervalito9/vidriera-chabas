// Avisos de ejemplo: se vuelven a cargar cada vez que arranca el servidor, así siempre coinciden con shared/ejemplos.ts.
// No tocan los avisos reales. Se muestran solo mientras no haya ningún aviso real publicado.
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EJEMPLOS } from "../shared/ejemplos.ts";
import type { NuevoAviso } from "../shared/tipos.ts";
import { crearAviso, db, FOTOS_DIR } from "./db.ts";

const IMG = join(process.cwd(), "web", "public", "assets", "img");

export function sincronizarEjemplos(): number {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM avisos WHERE ejemplo = 1").run();
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  for (const e of EJEMPLOS) {
    const origen = join(IMG, e.foto);
    if (existsSync(origen)) copyFileSync(origen, join(FOTOS_DIR, e.foto));
    const { foto, dias, ...resto } = e;
    const aviso: NuevoAviso = { zona: "", datos: [], permuta: false, financia: false, descripcion: "", anunciante: "", condiciones: null, lat: null, lng: null, ...resto, nombre: "", telefono: "", fotos: [] };
    crearAviso(aviso, [foto], { estado: "publicado", ejemplo: true, publicadoEn: new Date(Date.now() - dias * 864e5).toISOString() });
  }
  return EJEMPLOS.length;
}
