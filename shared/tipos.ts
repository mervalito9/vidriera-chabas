// Tipos compartidos entre el backend (server/) y la web (web/).
// Solo sintaxis "borrable" de TypeScript: Node 24 los ejecuta sin compilar.

export type RubroId = "inmuebles" | "vehiculos" | "agro";
export type Operacion = "venta" | "alquiler";
export type Moneda = "USD" | "ARS";
export type Estado = "pendiente" | "publicado" | "rechazado" | "vendido";

/** Lo que ve cualquier visitante. Nunca incluye el teléfono ni el nombre del dueño. */
export interface AvisoPublico {
  id: number;
  rubro: RubroId;
  tipo: string;
  operacion: Operacion;
  titulo: string;
  precio: number | null;
  moneda: Moneda;
  pueblo: string;
  zona: string;
  descripcion: string;
  datos: string[];
  permuta: boolean;
  financia: boolean;
  fotos: string[];
  ejemplo: boolean;
  /** ISO 8601 */
  publicadoEn: string;
  /** ISO 8601 */
  venceEn: string;
  /** Precio anterior, si bajó o subió (historial de precios) */
  precioAnterior: number | null;
}

/** Lo que ve el administrador en el panel. */
export interface AvisoAdmin extends AvisoPublico {
  estado: Estado;
  nombre: string;
  telefono: string;
  vistas: number;
  contactos: number;
  creadoEn: string;
}

export interface ListaAvisos {
  avisos: AvisoPublico[];
  total: number;
  /** true si todavía no hay ningún aviso real y se muestran los de ejemplo */
  soloEjemplos: boolean;
  /** cantidad de avisos reales vigentes por rubro */
  conteo: Record<RubroId, number>;
}

/** Datos que manda el formulario de publicar (y el panel al cargar un aviso). */
export interface NuevoAviso {
  rubro: RubroId;
  tipo: string;
  operacion: Operacion;
  titulo: string;
  precio: number | null;
  moneda: Moneda;
  zona: string;
  descripcion: string;
  datos: string[];
  permuta: boolean;
  financia: boolean;
  nombre: string;
  telefono: string;
  /** Fotos como data URL (image/jpeg, image/png o image/webp), ya achicadas en el navegador */
  fotos: string[];
}

export interface NuevaBusqueda {
  rubro: string;
  que: string;
  presupuesto: string;
  nombre: string;
  telefono: string;
}

export interface Busqueda extends NuevaBusqueda {
  id: number;
  creadoEn: string;
}

export interface Filtros {
  rubro: "" | RubroId;
  q: string;
  tipo: string;
  op: "" | Operacion;
  max: string;
  moneda: Moneda;
  permuta: boolean;
  financia: boolean;
  orden: "" | "barato" | "caro";
}

export interface Rubro {
  id: RubroId;
  nombre: string;
  ruta: RubroId;
  descripcion: string;
  resumen: string;
  tipos: readonly string[];
  placeholder: string;
}

export interface Pueblo {
  slug: string;
  nombre: string;
}

export interface ErrorCampo {
  campo: string;
  msg: string;
}
