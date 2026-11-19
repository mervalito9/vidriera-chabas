// Actividad del servidor (como el panel de Netlify): todos los pedidos, con recargas y robots,
// errores, velocidad, datos enviados, gente en línea ahora y salud del disco.
// Se cuenta en memoria y se guarda una vez por minuto, así no frena el sitio. No guarda IPs.
import { readdirSync, statSync, statfsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { DATA_DIR, FOTOS_DIR, db } from "./db.ts";
import { esRobot, idVisitante } from "./estad.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS act_hora (
  hora   TEXT PRIMARY KEY,           -- "2026-11-18T23" (hora de Argentina)
  datos  TEXT NOT NULL               -- JSON con los contadores
);
CREATE TABLE IF NOT EXISTS act_errores (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha   TEXT NOT NULL,
  metodo  TEXT NOT NULL,
  ruta    TEXT NOT NULL,
  estado  INTEGER NOT NULL,
  mensaje TEXT NOT NULL DEFAULT '',
  robot   INTEGER NOT NULL DEFAULT 0
);
`);

/** Contadores de una hora. */
export interface Cuenta {
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
const vacia = (): Cuenta => ({ pedidos: 0, paginas: 0, fotos: 0, api: 0, archivos: 0, robots: 0, e4: 0, e5: 0, bytes: 0, ms: 0, lentos: 0, loginMal: 0 });
const sumarCuentas = (a: Cuenta, b: Partial<Cuenta>): Cuenta => {
  const r = { ...a };
  for (const k of Object.keys(r) as (keyof Cuenta)[]) r[k] += Number(b[k] ?? 0) || 0;
  return r;
};

const fmtHora = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
/** "2026-11-18T23" en hora de Argentina */
export function horaDe(d = new Date()): string {
  const p = Object.fromEntries(fmtHora.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}`;
}

// --- En memoria, se vuelca a la base cada minuto
let pendiente = new Map<string, Cuenta>();
const sumar = (c: Partial<Cuenta>) => {
  const h = horaDe();
  pendiente.set(h, sumarCuentas(pendiente.get(h) ?? vacia(), c));
};

export function guardar(): void {
  if (!pendiente.size) return;
  const lote = pendiente;
  pendiente = new Map();
  const leer = db.prepare("SELECT datos FROM act_hora WHERE hora = ?");
  const escribir = db.prepare("INSERT INTO act_hora (hora, datos) VALUES (?, ?) ON CONFLICT (hora) DO UPDATE SET datos = excluded.datos");
  for (const [h, c] of lote) {
    const f = leer.get(h) as { datos: string } | undefined;
    escribir.run(h, JSON.stringify(sumarCuentas(f ? (JSON.parse(f.datos) as Cuenta) : vacia(), c)));
  }
  // Se guardan 120 días por hora; lo más viejo se borra.
  db.prepare("DELETE FROM act_hora WHERE hora < ?").run(horaDe(new Date(Date.now() - 120 * 864e5)));
}
setInterval(() => { try { guardar(); } catch (e) { console.error("actividad:", e); } }, 60_000).unref();
for (const s of ["SIGTERM", "SIGINT"] as const) process.once(s, () => { try { guardar(); } catch { /* nada */ } process.exit(0); });

export const contarLoginMal = (): void => sumar({ loginMal: 1 });

/** Se llama al empezar cada pedido; cuenta todo cuando termina la respuesta. */
export function medirPedido(req: IncomingMessage, res: ServerResponse, ruta: string): void {
  if (ruta === "/api/latido") return; // los latidos de "en vivo" no son actividad
  const inicio = performance.now();
  const bytesAntes = req.socket.bytesWritten;
  res.once("finish", () => {
    const ms = performance.now() - inicio;
    const robot = esRobot(req);
    const tipo: Partial<Cuenta> =
      ruta === "/" || ruta === "/index.html" || /^\/a\/\d+\/?$/.test(ruta) ? { paginas: 1 }
      : ruta.startsWith("/fotos/") ? { fotos: 1 }
      : ruta.startsWith("/api/") ? { api: 1 }
      : { archivos: 1 };
    const s = res.statusCode;
    // El panel (que se actualiza solo cada 10 s) no es actividad del sitio; sus errores sí se anotan.
    const delPanel = ruta.startsWith("/api/admin/") && ruta !== "/api/admin/login";
    if (!delPanel) sumar({
      pedidos: 1, ...tipo, robots: robot ? 1 : 0,
      e4: s >= 400 && s < 500 ? 1 : 0, e5: s >= 500 ? 1 : 0,
      bytes: Math.max(0, req.socket.bytesWritten - bytesAntes), ms, lentos: ms > 1000 ? 1 : 0,
    });
    if (s >= 400) {
      const mensaje = String((res as ServerResponse & { mensajeError?: string }).mensajeError ?? "").slice(0, 120);
      db.prepare("INSERT INTO act_errores (fecha, metodo, ruta, estado, mensaje, robot) VALUES (?, ?, ?, ?, ?, ?)")
        .run(new Date().toISOString(), (req.method ?? "").slice(0, 8), ruta.slice(0, 100), s, mensaje, robot ? 1 : 0);
      db.prepare("DELETE FROM act_errores WHERE id <= (SELECT MAX(id) FROM act_errores) - 300").run();
    }
  });
}

// --- En vivo: cada página abierta (y visible) avisa cada 30 s
const enLinea = new Map<string, { t: number; pagina: string }>();
const VENTANA_MS = 70_000;
export function latido(req: IncomingMessage, pagina: string): void {
  if (esRobot(req)) return;
  enLinea.set(idVisitante(req), { t: Date.now(), pagina: pagina.slice(0, 40) });
  if (enLinea.size > 2000) limpiar();
}
function limpiar() {
  const corte = Date.now() - VENTANA_MS;
  for (const [k, v] of enLinea) if (v.t < corte) enLinea.delete(k);
}

const NOMBRES: Record<string, string> = { inicio: "Portada", buscar: "Buscando", inmuebles: "Inmuebles", vehiculos: "Vehículos", agro: "Maquinaria agro", publicar: "Publicando un aviso", busco: "Avisame cuando aparezca", "como-funciona": "Cómo funciona", terminos: "Términos", privacidad: "Privacidad", pueblo: "Avisos de un pueblo" };
function nombrePagina(p: string): string {
  const [n, param] = p.split("--");
  if (n === "aviso" && /^\d+$/.test(param ?? "")) {
    const f = db.prepare("SELECT titulo FROM avisos WHERE id = ?").get(Number(param)) as { titulo: string } | undefined;
    return f ? `Aviso: ${f.titulo}` : "Un aviso";
  }
  return NOMBRES[n ?? ""] ?? (n || "Portada");
}

// --- Salud: tamaño de la base y de las fotos (se recalcula como mucho cada 2 minutos)
let disco: { t: number; base: number; fotos: number; cantFotos: number } | null = null;
function medirDisco() {
  if (disco && Date.now() - disco.t < 120_000) return disco;
  let fotos = 0, cantFotos = 0, base = 0;
  try { for (const f of readdirSync(FOTOS_DIR)) { try { fotos += statSync(join(FOTOS_DIR, f)).size; cantFotos++; } catch { /* nada */ } } } catch { /* sin carpeta */ }
  for (const f of ["vidriera.db", "vidriera.db-wal", "vidriera.db-shm"]) { try { base += statSync(join(DATA_DIR, f)).size; } catch { /* nada */ } }
  disco = { t: Date.now(), base, fotos, cantFotos };
  return disco;
}

export interface Actividad {
  enVivo: { total: number; paginas: { nombre: string; n: number }[] };
  periodo: "24h" | "7d" | "30d";
  serie: { x: string; c: Cuenta }[];
  total: Cuenta;
  errores: { fecha: string; metodo: string; ruta: string; estado: number; mensaje: string; robot: boolean }[];
  salud: { arranque: string; memoriaMB: number; baseMB: number; fotosMB: number; cantFotos: number; limiteMB: number; libreMB: number | null };
}

export function resumen(periodo: "24h" | "7d" | "30d"): Actividad {
  guardar();
  limpiar();
  const porPagina = new Map<string, number>();
  // Se agrupa por el nombre que se muestra ("publicar" y "publicar--autos" son la misma página para Felipe).
  for (const v of enLinea.values()) { const n = nombrePagina(v.pagina); porPagina.set(n, (porPagina.get(n) ?? 0) + 1); }
  const paginas = [...porPagina].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n);

  const ahora = Date.now();
  const horas = periodo === "24h" ? 24 : periodo === "7d" ? 24 * 7 : 24 * 30;
  const desde = horaDe(new Date(ahora - (horas - 1) * 3600e3));
  const filas = new Map((db.prepare("SELECT hora, datos FROM act_hora WHERE hora >= ?").all(desde) as { hora: string; datos: string }[]).map((f) => [f.hora, JSON.parse(f.datos) as Cuenta]));
  const serie: { x: string; c: Cuenta }[] = [];
  if (periodo === "24h") {
    for (let i = 23; i >= 0; i--) { const h = horaDe(new Date(ahora - i * 3600e3)); serie.push({ x: h, c: filas.get(h) ?? vacia() }); }
  } else {
    const dias = periodo === "7d" ? 7 : 30;
    for (let i = dias - 1; i >= 0; i--) {
      const dia = horaDe(new Date(ahora - i * 864e5)).slice(0, 10);
      let c = vacia();
      for (const [h, v] of filas) if (h.startsWith(dia)) c = sumarCuentas(c, v);
      serie.push({ x: dia, c });
    }
  }
  const total = serie.reduce((a, s) => sumarCuentas(a, s.c), vacia());

  const errores = (db.prepare("SELECT fecha, metodo, ruta, estado, mensaje, robot FROM act_errores ORDER BY id DESC LIMIT 50").all() as { fecha: string; metodo: string; ruta: string; estado: number; mensaje: string; robot: number }[])
    .map((e) => ({ ...e, robot: e.robot === 1 }));

  const d = medirDisco();
  let libreMB: number | null = null;
  try { const s = statfsSync(DATA_DIR); libreMB = Math.round((s.bavail * s.bsize) / 1048576); } catch { /* nada */ }
  const MB = (b: number) => Math.round((b / 1048576) * 10) / 10;
  return {
    enVivo: { total: [...enLinea.values()].length, paginas },
    periodo, serie, total, errores,
    salud: {
      arranque: new Date(ahora - process.uptime() * 1000).toISOString(),
      memoriaMB: MB(process.memoryUsage().rss),
      baseMB: MB(d.base), fotosMB: MB(d.fotos), cantFotos: d.cantFotos,
      limiteMB: Number(process.env.VOLUMEN_MB) || 500,
      libreMB,
    },
  };
}
