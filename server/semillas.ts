// Las búsquedas activas que Felipe mostraba en Instagram (27/11). Se cargan una sola vez, al arrancar, para que aparezcan
// en «Se buscan» sin tener que tipearlas. Después se manejan desde el panel (Búsquedas): se pueden ocultar o cambiar.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUSQUEDAS_INICIALES } from "../shared/busquedasIniciales.ts";
import { DATA_DIR, crearBusquedaPublica } from "./db.ts";

export { BUSQUEDAS_INICIALES };

export function cargarBusquedasIniciales(): number {
  if (process.env.NODE_ENV === "test") return 0;
  const marca = join(DATA_DIR, "busquedas-iniciales.ok");
  if (existsSync(marca)) return 0;
  // Se escribe la marca primero: si algo falla a la mitad, no se duplica en el próximo arranque.
  writeFileSync(marca, new Date().toISOString());
  for (const b of [...BUSQUEDAS_INICIALES].reverse()) crearBusquedaPublica(b);
  return BUSQUEDAS_INICIALES.length;
}
