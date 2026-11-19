// Estadísticas propias, sin cookies ni servicios externos.
// - Cada visitante se reconoce SOLO durante el día, con un código hecho de (sal del día + IP + navegador).
//   La sal cambia cada día y se borra, así que no se puede seguir a nadie de un día para otro.
// - Se guardan solo totales por día (tabla estad). Los códigos del día (estad_vis) se borran al día siguiente.
// - No cuenta robots ni a Felipe mientras tenga el panel abierto.
import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { db } from "./db.ts";
import { ipDe } from "./http.ts";
import { slug } from "../shared/texto.ts";
import type { ResumenEstadisticas } from "../shared/tipos.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS estad (
  fecha  TEXT NOT NULL,
  clave  TEXT NOT NULL,
  valor  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, clave)
);
CREATE TABLE IF NOT EXISTS estad_vis (
  fecha  TEXT NOT NULL,
  marca  TEXT NOT NULL,
  PRIMARY KEY (fecha, marca)
);
CREATE TABLE IF NOT EXISTS estad_sal (
  fecha  TEXT PRIMARY KEY,
  sal    TEXT NOT NULL
);
`);

const ZONA = "America/Argentina/Buenos_Aires";
const fmtFecha = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
/** Fecha de Argentina, "2026-11-18". */
export const hoy = (d = new Date()): string => fmtFecha.format(d);

const ROBOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|curl|wget|python|node-fetch|axios|monitor|uptime/i;
export const esRobot = (req: IncomingMessage): boolean => {
  const ua = req.headers["user-agent"] ?? "";
  return !ua || ROBOT.test(ua);
};

let salActual: { fecha: string; sal: string } | null = null;
function sal(fecha: string): string {
  if (salActual?.fecha === fecha) return salActual.sal;
  const f = db.prepare("SELECT sal FROM estad_sal WHERE fecha = ?").get(fecha) as { sal: string } | undefined;
  const s = f?.sal ?? randomBytes(16).toString("hex");
  if (!f) {
    db.prepare("INSERT OR IGNORE INTO estad_sal (fecha, sal) VALUES (?, ?)").run(fecha, s);
    // Lo de días anteriores ya no sirve: se borra (así no queda forma de reconocer a nadie).
    db.prepare("DELETE FROM estad_sal WHERE fecha < ?").run(fecha);
    db.prepare("DELETE FROM estad_vis WHERE fecha < ?").run(fecha);
  }
  salActual = { fecha, sal: s };
  return s;
}

/** Código anónimo de quien pide, válido solo por hoy. */
export const idVisitante = (req: IncomingMessage): string => visitante(req, hoy());

function visitante(req: IncomingMessage, fecha: string): string {
  return createHash("sha256").update(`${sal(fecha)}|${ipDe(req)}|${req.headers["user-agent"] ?? ""}`).digest("hex").slice(0, 20);
}

/** true si es la primera vez hoy que pasa `marca` (visitante, visitante+aviso, etc.). */
function primeraVez(fecha: string, marca: string): boolean {
  return db.prepare("INSERT OR IGNORE INTO estad_vis (fecha, marca) VALUES (?, ?)").run(fecha, marca).changes === 1;
}

const sumarSt = db.prepare("INSERT INTO estad (fecha, clave, valor) VALUES (?, ?, 1) ON CONFLICT (fecha, clave) DO UPDATE SET valor = valor + 1");
const sumar = (fecha: string, ...claves: string[]) => { for (const c of claves) sumarSt.run(fecha, c.slice(0, 80)); };

const ORIGENES: Record<string, string> = { wa: "WhatsApp", ig: "Instagram", fb: "Facebook", redes: "Redes (tarjeta)", qr: "Cartel / QR", tg: "Telegram" };
/** De dónde vino: primero la marca del link (?de=wa), si no, la página anterior. */
export function origenDe(de: string, ref: string, propio: string): string {
  if (ORIGENES[de]) return ORIGENES[de];
  if (!ref) return "Directo";
  let host = "";
  try { host = new URL(ref).hostname.replace(/^www\./, ""); } catch { return "Directo"; }
  if (!host || host === propio || host.endsWith(".railway.app")) return "Directo";
  if (/whatsapp|wa\.me/.test(host)) return "WhatsApp";
  if (/instagram/.test(host)) return "Instagram";
  if (/facebook|fb\.|messenger/.test(host)) return "Facebook";
  if (/google\./.test(host)) return "Google";
  if (/^t\.co$|twitter|x\.com/.test(host)) return "X (Twitter)";
  if (/bing|duckduckgo|yahoo/.test(host)) return "Otros buscadores";
  return "Otros sitios";
}

interface InfoAviso { id: number; rubro: string; pueblo: string }
const infoAviso = (id: number): InfoAviso | null =>
  (db.prepare("SELECT id, rubro, pueblo FROM avisos WHERE id = ? AND ejemplo = 0").get(id) as InfoAviso | undefined) ?? null;

/** Una página vista. Devuelve si contó una visita nueva a un aviso (para el contador del aviso). */
export function registrarPagina(req: IncomingMessage, d: { avisoId: number | null; de: string; ref: string; propio: string }): void {
  const fecha = hoy();
  const v = visitante(req, fecha);
  if (primeraVez(fecha, v)) sumar(fecha, "personas", `de:${origenDe(d.de, d.ref, d.propio)}`);
  sumar(fecha, "paginas");
  if (d.avisoId) {
    const a = infoAviso(d.avisoId);
    if (a && primeraVez(fecha, `${v}:a${a.id}`)) {
      sumar(fecha, "vistas", `a:${a.id}:v`, `r:${a.rubro}:v`, `p:${a.pueblo}:v`);
      db.prepare("UPDATE avisos SET vistas = vistas + 1 WHERE id = ?").run(a.id);
    }
  }
}

/** Un clic en "Hablar por WhatsApp". Una vez por persona, aviso y día. Devuelve si contó. */
export function registrarContacto(req: IncomingMessage, avisoId: number): boolean {
  const fecha = hoy();
  const a = infoAviso(avisoId);
  if (!a || !primeraVez(fecha, `${visitante(req, fecha)}:c${a.id}`)) return false;
  sumar(fecha, "contactos", `a:${a.id}:c`, `r:${a.rubro}:c`, `p:${a.pueblo}:c`);
  return true;
}

/** Lo que alguien buscó y cuántos resultados encontró. */
export function registrarBusqueda(req: IncomingMessage, q: string, resultados: number): void {
  const texto = slug(q).replace(/-/g, " ").trim().slice(0, 40);
  if (texto.length < 3 || /\d{6,}/.test(texto.replace(/\s/g, ""))) return; // nada de teléfonos ni restos de tipeo
  const fecha = hoy();
  if (!primeraVez(fecha, `${visitante(req, fecha)}:b${texto}`)) return;
  sumar(fecha, `b:${texto}`);
  if (resultados === 0) sumar(fecha, `b0:${texto}`);
}

// ---------- Resumen para el panel ----------


export function resumen(dias: number): ResumenEstadisticas {
  const hasta = new Date();
  const fechas: string[] = [];
  for (let i = dias - 1; i >= 0; i--) fechas.push(hoy(new Date(hasta.getTime() - i * 864e5)));
  const desde = fechas[0]!;
  const antDesde = hoy(new Date(hasta.getTime() - (dias * 2 - 1) * 864e5));
  const filas = db.prepare("SELECT fecha, clave, valor FROM estad WHERE fecha >= ?").all(antDesde) as { fecha: string; clave: string; valor: number }[];
  const actual = filas.filter((f) => f.fecha >= desde);
  const previo = filas.filter((f) => f.fecha < desde);

  const por = (lista: typeof filas, clave: string) => lista.filter((f) => f.clave === clave).reduce((s, f) => s + f.valor, 0);
  const agrupar = (prefijo: string, sufijo = "") => {
    const m = new Map<string, number>();
    for (const f of actual) if (f.clave.startsWith(prefijo) && f.clave.endsWith(sufijo)) {
      const k = f.clave.slice(prefijo.length, sufijo ? -sufijo.length : undefined);
      m.set(k, (m.get(k) ?? 0) + f.valor);
    }
    return m;
  };
  const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);

  const serie = fechas.map((fecha) => {
    const del = actual.filter((f) => f.fecha === fecha);
    return { fecha, personas: por(del, "personas"), vistas: por(del, "vistas"), contactos: por(del, "contactos") };
  });

  const vAv = agrupar("a:", ":v"), cAv = agrupar("a:", ":c");
  const ids = [...new Set([...vAv.keys(), ...cAv.keys()])].map(Number).filter(Number.isFinite);
  const titulos = new Map<number, { titulo: string; estado: string }>();
  for (const id of ids) {
    const f = db.prepare("SELECT titulo, estado FROM avisos WHERE id = ?").get(id) as { titulo: string; estado: string } | undefined;
    if (f) titulos.set(id, f);
  }
  const avisos = ids.filter((id) => titulos.has(id))
    .map((id) => ({ id, titulo: titulos.get(id)!.titulo, estado: titulos.get(id)!.estado, vistas: vAv.get(String(id)) ?? 0, contactos: cAv.get(String(id)) ?? 0 }))
    .sort((a, b) => b.contactos - a.contactos || b.vistas - a.vistas).slice(0, 15);

  const cruzar = (pref: string) => {
    const v = agrupar(pref, ":v"), c = agrupar(pref, ":c");
    return [...new Set([...v.keys(), ...c.keys()])].map((nombre) => ({ nombre, vistas: v.get(nombre) ?? 0, contactos: c.get(nombre) ?? 0 })).sort((a, b) => b.vistas - a.vistas);
  };

  const hayPrevio = previo.some((f) => f.clave === "personas");
  const primera = db.prepare("SELECT MIN(fecha) AS f FROM estad WHERE clave = 'personas'").get() as { f: string | null };
  const estados = Object.fromEntries((db.prepare("SELECT estado, COUNT(*) AS n FROM avisos WHERE ejemplo = 0 GROUP BY estado").all() as { estado: string; n: number }[]).map((f) => [f.estado, f.n]));

  return {
    dias,
    serie,
    total: { personas: por(actual, "personas"), vistas: por(actual, "vistas"), contactos: por(actual, "contactos"), paginas: por(actual, "paginas") },
    anterior: hayPrevio ? { personas: por(previo, "personas"), vistas: por(previo, "vistas"), contactos: por(previo, "contactos") } : null,
    avisos,
    origenes: top(agrupar("de:"), 10).map(([nombre, n]) => ({ nombre, n })),
    busquedas: top(agrupar("b:"), 15).map(([texto, n]) => ({ texto, n })),
    sinResultados: top(agrupar("b0:"), 15).map(([texto, n]) => ({ texto, n })),
    rubros: cruzar("r:"),
    pueblos: cruzar("p:"),
    avisosEstado: estados,
    desde: primera.f,
  };
}
