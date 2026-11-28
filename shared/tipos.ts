// Tipos compartidos entre el backend (server/) y la web (web/).
// Solo sintaxis "borrable" de TypeScript: Node 24 los ejecuta sin compilar.
import type { CondicionesAlquiler } from "./alquiler.ts";

export type RubroId = "inmuebles" | "vehiculos" | "agro" | "vacaciones";
export type Operacion = "venta" | "alquiler";
export type Moneda = "USD" | "ARS";
/** Quién publica: el dueño, o un negocio que lo ofrece. "" = no se sabe (avisos viejos). */
export type Quien = "dueno" | "inmobiliaria" | "agencia" | "";
export type Estado = "pendiente" | "publicado" | "rechazado" | "vendido";

/** Lo que ve cualquier visitante. Nunca incluye el teléfono ni el nombre del dueño. */
/** Punto de la foto de tapa que tiene que quedar a la vista cuando se recorta (0 a 100, desde arriba a la izquierda). */
export interface Foco {
  x: number;
  y: number;
}

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
  /** Si es el dueño o un negocio */
  quien: Quien;
  /** Nombre que se muestra como "Publica: …" (el negocio, o el nombre del dueño). Vacío = no se muestra. */
  publica: string;
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
  /** Solo alquileres: garantía, depósito, contrato, mascotas… (null si no completó nada o es venta) */
  condiciones: CondicionesAlquiler | null;
  /** Ubicación exacta en el mapa (opcional) */
  lat: number | null;
  lng: number | null;
  /** Encuadre de la foto de tapa al recortarla. null = centrada. */
  foco: Foco | null;
}

/** Lo que ve el administrador en el panel. */
/** Lo que propone el asistente para un aviso que mandó un vecino (ver server/mejorar.ts). */
export interface PropuestaMejora {
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
  /** Las fotos del aviso en el orden sugerido (índices del orden original; siempre están todas). */
  ordenFotos: number[];
  notasFotos: string;
  /** Lo que conviene pedirle al dueño. */
  faltan: { que: string; pregunta: string }[];
  /** Mensaje de WhatsApp listo para mandarle al dueño pidiendo lo que falta. */
  mensajeDueno: string;
  /** Información general que no dijo el vecino: Felipe la confirma antes de usarla. */
  sugerencias: string[];
  /** Qué cambió, en frases cortas. */
  cambios: string[];
}

export interface Mejora {
  estado: "trabajando" | "lista" | "error" | "usada" | "descartada";
  propuesta: PropuestaMejora | null;
  error: string;
  fecha: string;
}

export interface AvisoAdmin extends AvisoPublico {
  /** Propuesta del asistente para los avisos que mandan los vecinos (null = no hay). */
  mejora: Mejora | null;
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
  /** pesos por dólar con que se comparan precios en USD y en $ (al ordenar o filtrar por precio) */
  dolar: number;
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
  /** Nombre del negocio que publica (lo pone el panel; el formulario público lo deja vacío). */
  anunciante: string;
  /** Dueño, inmobiliaria o agencia (el formulario público siempre es "dueno"). */
  quien: Quien;
  zona: string;
  descripcion: string;
  datos: string[];
  permuta: boolean;
  financia: boolean;
  nombre: string;
  telefono: string;
  /** Fotos como data URL (image/jpeg, image/png o image/webp), ya achicadas en el navegador */
  fotos: string[];
  /** Solo alquileres (ver shared/alquiler.ts) */
  condiciones: CondicionesAlquiler | null;
  /** Ubicación exacta en el mapa (opcional) */
  lat: number | null;
  lng: number | null;
  /** Encuadre de la foto de tapa (opcional; sin esto, se deja como estaba o centrada). */
  foco?: Foco | null;
}

export interface NuevaBusqueda {
  rubro: string;
  que: string;
  presupuesto: string;
  nombre: string;
  telefono: string;
  /** Aceptó que su búsqueda se muestre en «Se buscan», sin nombre ni teléfono. */
  permiso?: boolean;
}

export interface Busqueda extends NuevaBusqueda {
  id: number;
  creadoEn: string;
  permiso: boolean;
  /** Lo que se muestra en «Se buscan» (vacío = no tiene título propio). */
  titulo: string;
  detalle: string;
  directo: boolean;
  /** Desde cuándo se muestra en el sitio; null = no se muestra. */
  publicaDesde: string | null;
}

/** Una búsqueda tal como la ve el público: sin nombre ni teléfono. Las iguales se juntan. */
export interface SeBusca {
  rubro: string;
  titulo: string;
  detalle: string;
  directo: boolean;
  cuantas: number;
  /** Desde cuándo se muestra (la más nueva, si hay varias iguales). ISO 8601. */
  desde: string;
}

/** Lo que Felipe carga o cambia desde el panel para mostrar una búsqueda. */
export interface BusquedaPublica {
  rubro: RubroId;
  titulo: string;
  detalle: string;
  directo: boolean;
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
  /** Gente que entró por la portada y, de esa, cuántos abrieron después otra pantalla (se mide desde el 25/11/2026). */
  portada: { entran: number; siguen: number };
  /** Campanita de novedades (desde el 27/11/2026): cuántos la vieron con número, cuántos la abrieron y qué tocaron. */
  novedades: { ven: number; abren: number; toques: { que: string; n: number }[] };
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
