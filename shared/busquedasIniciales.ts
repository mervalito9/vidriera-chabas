// Las búsquedas activas que Felipe mostraba en Instagram (27/11). El servidor las carga una vez (server/semillas.ts)
// y la vista previa sin servidor las muestra tal cual.
import type { BusquedaPublica } from "./tipos.ts";

export const BUSQUEDAS_INICIALES: BusquedaPublica[] = [
  { rubro: "inmuebles", titulo: "Alquiler de local", detalle: "Preferencia en esquina", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa o dpto", detalle: "2 habitaciones", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa o dpto", detalle: "1 habitación · Hasta $300.000", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa", detalle: "Hasta $400.000", directo: true },
  { rubro: "inmuebles", titulo: "Alquiler de casa", detalle: "2 habitaciones y patio · Hasta $500.000", directo: true },
];
