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
  /** Quién publica, tal como se muestra en el aviso (ej. "Inmobiliaria Pérez"). Vacío = no se muestra. */
  anunciante: string;
  ejemplo: boolean;
  /** El dueño lo tiene señado: sigue visible, marcado "Reservado". */
  reservado: boolean;
  /** Fijado arriba por Felipe: aparece primero en la portada y los listados. */
  destacado: boolean;
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
  /** Dónde está lo que se publica (lo elige quien publica). Uno de PUEBLOS o el que escribió en "Otro". */
  pueblo: string;
  /** Quién publica (lo pone el panel; el formulario público lo deja vacío). */
  anunciante: string;
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
  /** "" = todos los pueblos; un nombre de PUEBLOS; o "otro" = pueblos que no están en la lista */
  pueblo: string;
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

export interface ErrorCampo {
  campo: string;
  msg: string;
}

// ---------- Panel: estadísticas y actividad (las arma el servidor, las muestra el panel) ----------

export interface ResumenEstadisticas {
  dias: number;
  serie: { fecha: string; personas: number; vistas: number; contactos: number }[];
  total: { personas: number; vistas: number; contactos: number; paginas: number };
  /** null si en el período anterior no había datos (no se compara contra la nada) */
  anterior: { personas: number; vistas: number; contactos: number } | null;
  avisos: { id: number; titulo: string; estado: string; vistas: number; contactos: number }[];
  origenes: { nombre: string; n: number }[];
  busquedas: { texto: string; n: number }[];
  sinResultados: { texto: string; n: number }[];
  rubros: { nombre: string; vistas: number; contactos: number }[];
  pueblos: { nombre: string; vistas: number; contactos: number }[];
  avisosEstado: Record<string, number>;
  desde: string | null;
}

/** Contadores de una hora. */
export interface CuentaActividad {
  pedidos: number;   // todo lo que llega (menos los "latidos" de en vivo)
  paginas: number;   // cargas del sitio (entrar o recargar) + links /a/:id
  fotos: number;
  api: number;
  archivos: number;  // estilos, scripts, íconos
  robots: number;
  e4: number;        // errores del visitante (4xx)
  e5: number;        // errores del servidor (5xx)
  bytes: number;
  ms: number;        // suma de tiempos de respuesta
  lentos: number;    // más de 1 segundo
  loginMal: number;  // contraseñas incorrectas en el panel
}

export interface ResumenActividad {
  enVivo: { total: number; paginas: { nombre: string; n: number }[] };
  periodo: "24h" | "7d" | "30d";
  serie: { x: string; c: CuentaActividad }[];
  total: CuentaActividad;
  errores: { fecha: string; metodo: string; ruta: string; estado: number; mensaje: string; robot: boolean }[];
  salud: { arranque: string; memoriaMB: number; baseMB: number; fotosMB: number; cantFotos: number; limiteMB: number; libreMB: number | null };
}
