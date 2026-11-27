// Las búsquedas activas que Felipe mostraba en Instagram (27/11). Se cargan una sola vez, al arrancar, para que aparezcan
// en «Se buscan» sin tener que tipearlas. Después se manejan desde el panel (Búsquedas): se pueden ocultar o cambiar.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BusquedaPublica } from "../shared/tipos.ts";
import { DATA_DIR, crearBusquedaPublica } from "./db.ts";

export const BUSQUEDAS_INICIALES: BusquedaPublica[] = [
  { rubro: "inmuebles", titulo: "Alquiler de local", detalle: "Preferencia en esquina", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa o dpto", detalle: "2 habitaciones", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa o dpto", detalle: "1 habitación · Hasta $300.000", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa", detalle: "Hasta $400.000", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa", detalle: "2 habitaciones y patio · Hasta $500.000", directo: true },
];

export function cargarBusquedasIniciales(): number {
  if (process.env.NODE_ENV === "test") return 0;
  const marca = join(DATA_DIR, "busquedas-iniciales.ok");
  if (existsSync(marca)) return 0;
  // Se escribe la marca primero: si algo falla a la mitad, no se duplica en el próximo arranque.
  writeFileSync(marca, new Date().toISOString());
  for (const b of [...BUSQUEDAS_INICIALES].reverse()) crearBusquedaPublica(b);
  return BUSQUEDAS_INICIALES.length;
}
