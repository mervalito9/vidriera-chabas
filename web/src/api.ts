// Cliente del backend. Si no hay servidor (por ejemplo, en la vista previa de Claude),
// pasa solo a "modo vista previa" con los avisos de ejemplo y publica por WhatsApp.
import { DIAS_VIGENCIA } from "../../shared/config.ts";
import { EJEMPLOS } from "../../shared/ejemplos.ts";
import { DOLAR_VISTA_PREVIA, filtrarAvisos } from "../../shared/filtrar.ts";
import type { AvisoAdmin, AvisoPublico, Busqueda, ErrorCampo, Estado, Filtros, ListaAvisos, NuevaBusqueda, NuevoAviso, ResumenActividad, ResumenEstadisticas } from "../../shared/tipos.ts";

export class ErrorApi extends Error {
  readonly status: number;
  readonly campos: ErrorCampo[];
  constructor(status: number, mensaje: string, campos: ErrorCampo[] = []) {
    super(mensaje);
    this.status = status;
    this.campos = campos;
  }
}

/** Se lanza cuando no hay backend: la página ofrece mandar los datos por WhatsApp. */
export class SinServidor extends Error {}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`api/${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: cuerpo === undefined ? { "x-vidriera": "1" } : { "x-vidriera": "1", "content-type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "No hay conexión. Revisá internet y probá de nuevo.");
  }
  const tipo = res.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) throw new SinServidor();
  const datos = (await res.json()) as { error?: string; campos?: ErrorCampo[] };
  if (!res.ok) throw new ErrorApi(res.status, datos.error ?? "Algo salió mal.", datos.campos ?? []);
  return datos as T;
}

// ---------- ¿hay servidor? (se pregunta una sola vez) ----------
/** true solo en la versión "vista previa" (npm run build -- --vista-previa): no intenta hablar con el backend. */
declare const __VISTA_PREVIA__: boolean;
let hayServidor: Promise<boolean> | null = null;
export function conServidor(): Promise<boolean> {
  if (__VISTA_PREVIA__ || window.location.protocol === "file:") return Promise.resolve(false);
  hayServidor ??= pedir<{ ok: boolean }>("GET", "salud").then(
    (r) => r.ok === true,
    () => false,
  );
  return hayServidor;
}

// ---------- datos de la vista previa ----------
let demo: AvisoPublico[] | null = null;
function avisosDemo(): AvisoPublico[] {
  demo ??= EJEMPLOS.map((e, i) => {
    const publicado = new Date(Date.now() - e.dias * 864e5);
    return {
      id: i + 1, rubro: e.rubro, tipo: e.tipo, operacion: e.operacion, titulo: e.titulo, precio: e.precio, moneda: e.moneda,
      pueblo: e.pueblo, zona: e.zona ?? "", descripcion: e.descripcion ?? "", datos: e.datos ?? [], permuta: !!e.permuta, financia: !!e.financia,
      fotos: [`assets/img/${e.foto}`], anunciante: "", ejemplo: true, reservado: false, destacado: false, publicadoEn: publicado.toISOString(),
      venceEn: new Date(publicado.getTime() + DIAS_VIGENCIA * 864e5).toISOString(), precioAnterior: null,
    };
  }).sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn));
  return demo;
}

const aQuery = (f: Partial<Filtros>, limite: number, desde: number): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === true) q.set(k, "1");
    else if (typeof v === "string" && v) q.set(k, v);
  }
  q.set("limite", String(limite));
  q.set("desde", String(desde));
  return q.toString();
};

const FILTROS_VACIOS: Filtros = { rubro: "", pueblo: "", q: "", tipo: "", op: "", max: "", moneda: "USD", permuta: false, financia: false, orden: "" };

export async function listarAvisos(f: Partial<Filtros>, limite: number, desde = 0): Promise<ListaAvisos> {
  if (await conServidor()) return pedir<ListaAvisos>("GET", `avisos?${aQuery(f, limite, desde)}`);
  const res = filtrarAvisos(avisosDemo(), { ...FILTROS_VACIOS, ...f });
  return { avisos: res.slice(desde, desde + limite), total: res.length, soloEjemplos: true, conteo: { inmuebles: 0, vehiculos: 0, agro: 0 }, dolar: DOLAR_VISTA_PREVIA };
}

export async function obtenerAviso(id: number): Promise<AvisoPublico | null> {
  if (await conServidor()) {
    try {
      return await pedir<AvisoPublico>("GET", `avisos/${id}`);
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 404) return null;
      throw e;
    }
  }
  return avisosDemo().find((a) => a.id === id) ?? null;
}

/** Pide al backend el link de WhatsApp del dueño (el teléfono nunca viene en la lista). */
export const linkContacto = (id: number) => pedir<{ url: string }>("POST", `avisos/${id}/contacto`);

export async function publicar(a: NuevoAviso): Promise<{ id: number }> {
  if (!(await conServidor())) throw new SinServidor();
  return pedir("POST", "publicaciones", a);
}

export async function guardarBusqueda(b: NuevaBusqueda): Promise<{ id: number }> {
  if (!(await conServidor())) throw new SinServidor();
  return pedir("POST", "busquedas", b);
}

// ---------- panel ----------
export const admin = {
  entrar: (clave: string) => pedir<{ ok: boolean }>("POST", "admin/login", { clave }),
  salir: () => pedir<{ ok: boolean }>("POST", "admin/logout", {}),
  sesion: () => pedir<{ ok: boolean }>("GET", "admin/sesion"),
  avisos: (estado: Estado | "") => pedir<AvisoAdmin[]>("GET", `admin/avisos?estado=${estado}`),
  crear: (a: NuevoAviso, pendiente = false) => pedir<AvisoAdmin>("POST", pendiente ? "admin/avisos?estado=pendiente" : "admin/avisos", a),
  editar: (id: number, a: NuevoAviso) => pedir<AvisoAdmin>("PUT", `admin/avisos/${id}`, a),
  cambiar: (id: number, c: Record<string, unknown>) => pedir<AvisoAdmin>("PATCH", `admin/avisos/${id}`, c),
  borrar: (id: number) => pedir<{ ok: boolean }>("DELETE", `admin/avisos/${id}`),
  busquedas: () => pedir<Busqueda[]>("GET", "admin/busquedas"),
  actividad: (periodo: string) => pedir<ResumenActividad>("GET", `admin/actividad?periodo=${periodo}`),
  estadisticas: (dias: number) => pedir<ResumenEstadisticas>("GET", `admin/estadisticas?dias=${dias}`),
  borrarBusqueda: (id: number) => pedir<{ ok: boolean }>("DELETE", `admin/busquedas/${id}`),
};
