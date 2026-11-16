// Carga los avisos de ejemplo (solo si la base está vacía). Uso: npm run ejemplos
// Los ejemplos se ocultan solos en cuanto haya un aviso real publicado.
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import type { NuevoAviso } from "../shared/tipos.ts";
import { EJEMPLOS } from "../shared/ejemplos.ts";
import { contarAvisos, crearAviso, FOTOS_DIR } from "./db.ts";

const IMG = join(process.cwd(), "web", "public", "assets", "img");

if (contarAvisos() > 0) {
  console.log("La base ya tiene avisos: no se cargan ejemplos.");
} else {
  for (const e of EJEMPLOS) {
    copyFileSync(join(IMG, e.foto), join(FOTOS_DIR, e.foto));
    const { foto, dias, ...resto } = e;
    const aviso: NuevoAviso = { zona: "", datos: [], permuta: false, financia: false, descripcion: "", ...resto, nombre: "", telefono: "", fotos: [] };
    crearAviso(aviso, [foto], { estado: "publicado", ejemplo: true, publicadoEn: new Date(Date.now() - dias * 864e5).toISOString() });
  }
  console.log(`Listo: ${EJEMPLOS.length} avisos de ejemplo cargados.`);
}
