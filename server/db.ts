// Base de datos: SQLite incorporado en Node 24 (node:sqlite). Un solo archivo, sin servidor aparte.
import { liberarRubro } from "./migraciones.ts";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { limpiarCondiciones, type CondicionesAlquiler } from "../shared/alquiler.ts";
import { DIAS_SE_BUSCAN, DIAS_VIGENCIA, OTRO_PUEBLO, PUEBLOS, RUBROS } from "../shared/config.ts";
import type { AvisoAdmin, AvisoPublico, Busqueda, BusquedaPublica, Estado, Filtros, Foco, ListaAvisos, NuevaBusqueda, NuevoAviso, Quien, RubroId, SeBusca, Mejora } from "../shared/tipos.ts";
import { slug } from "../shared/texto.ts";
import { limpiarCalendario, type Calendario } from "../shared/vacaciones.ts";
import { dolar } from "./dolar.ts";

export const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "datos");
export const FOTOS_DIR = join(DATA_DIR, "fotos");
mkdirSync(FOTOS_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, "vidriera.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

db.exec(`
CREATE TABLE IF NOT EXISTS avisos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','publicado','rechazado','vendido')),
  rubro           TEXT NOT NULL,
  tipo            TEXT NOT NULL,
  operacion       TEXT NOT NULL CHECK (operacion IN ('venta','alquiler')),
  titulo          TEXT NOT NULL,
  precio          INTEGER,
  moneda          TEXT NOT NULL CHECK (moneda IN ('USD','ARS')),
  pueblo          TEXT NOT NULL DEFAULT 'Chabás',
  zona            TEXT NOT NULL DEFAULT '',
  descripcion     TEXT NOT NULL DEFAULT '',
  datos           TEXT NOT NULL DEFAULT '[]',
  permuta         INTEGER NOT NULL DEFAULT 0,
  financia        INTEGER NOT NULL DEFAULT 0,
  nombre          TEXT NOT NULL DEFAULT '',
  telefono        TEXT NOT NULL DEFAULT '',
  ejemplo         INTEGER NOT NULL DEFAULT 0,
  vistas          INTEGER NOT NULL DEFAULT 0,
  contactos       INTEGER NOT NULL DEFAULT 0,
  creado_en       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  publicado_en    TEXT,
  actualizado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS avisos_estado ON avisos (estado, publicado_en);
CREATE INDEX IF NOT EXISTS avisos_rubro ON avisos (rubro, tipo);

CREATE TABLE IF NOT EXISTS fotos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  aviso_id  INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  archivo   TEXT NOT NULL,
  orden     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS fotos_aviso ON fotos (aviso_id, orden);

-- Historial de precios: cada vez que cambia el precio de un aviso queda registrado.
CREATE TABLE IF NOT EXISTS precios (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  aviso_id  INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  precio    INTEGER,
  moneda    TEXT NOT NULL,
  fecha     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS precios_aviso ON precios (aviso_id, fecha);

CREATE TABLE IF NOT EXISTS busquedas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rubro        TEXT NOT NULL,
  que          TEXT NOT NULL,
  presupuesto  TEXT NOT NULL DEFAULT '',
  nombre       TEXT NOT NULL,
  telefono     TEXT NOT NULL,
  creado_en    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash  TEXT PRIMARY KEY,
  expira      TEXT NOT NULL
);
`);

// Columnas agregadas después de crear la base: se suman solas si faltan.
// Preparado para cuentas de usuario: por ahora nadie inicia sesión, pero cada aviso ya puede quedar atado a uno.
db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT NOT NULL,
  telefono   TEXT NOT NULL DEFAULT '',
  creado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
for (const [col, def] of [
  ["pueblo", "TEXT NOT NULL DEFAULT 'Chabás'"],
  ["reservado", "INTEGER NOT NULL DEFAULT 0"],
  ["destacado", "INTEGER NOT NULL DEFAULT 0"],
  ["anunciante", "TEXT NOT NULL DEFAULT ''"],
  ["condiciones", "TEXT NOT NULL DEFAULT ''"],
  ["foco", "TEXT NOT NULL DEFAULT ''"],
  ["calendario", "TEXT NOT NULL DEFAULT ''"],
  ["quien", "TEXT NOT NULL DEFAULT ''"],
  ["lat", "REAL"],
  ["lng", "REAL"],
  ["usuario_id", "INTEGER REFERENCES usuarios(id) ON DELETE SET NULL"],
  ["mejora", "TEXT NOT NULL DEFAULT ''"],
] as const) {
  const hay = (db.prepare("PRAGMA table_info(avisos)").all() as { name: string }[]).some((c) => c.name === col);
  if (!hay) db.exec(`ALTER TABLE avisos ADD COLUMN ${col} ${def}`);
}
db.exec("CREATE INDEX IF NOT EXISTS avisos_pueblo ON avisos (pueblo);");
// Bases creadas antes del 28/11/2026 tenían un CHECK que solo aceptaba tres rubros: se saca una sola vez
// (con respaldo previo en DATA_DIR) para poder sumar Vacaciones. Ver server/migraciones.ts.
if (liberarRubro(db, join(DATA_DIR, "respaldo-antes-de-vacaciones.db"))) console.log(new Date().toISOString(), "base: se migró la tabla avisos (rubros libres). Respaldo en respaldo-antes-de-vacaciones.db");
// «Se buscan»: las búsquedas que Felipe elige mostrar en el sitio (sin nombre ni teléfono).
for (const [col, def] of [
  ["publica_desde", "TEXT"],
  ["titulo", "TEXT NOT NULL DEFAULT ''"],
  ["detalle", "TEXT NOT NULL DEFAULT ''"],
  ["directo", "INTEGER NOT NULL DEFAULT 0"],
  ["permiso", "INTEGER NOT NULL DEFAULT 0"],
] as const) {
  const hay = (db.prepare("PRAGMA table_info(busquedas)").all() as { name: string }[]).some((c) => c.name === col);
  if (!hay) db.exec(`ALTER TABLE busquedas ADD COLUMN ${col} ${def}`);
}

type Fila = Record<string, unknown>;
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown): number => Number(v ?? 0);

const VIGENTE = `estado = 'publicado' AND publicado_en >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-${DIAS_VIGENCIA} days')`;

function fotosDe(id: number): string[] {
  return db.prepare("SELECT archivo FROM fotos WHERE aviso_id = ? ORDER BY orden, id").all(id).map((f) => `/fotos/${str((f as Fila).archivo)}`);
}

function precioAnterior(id: number, actual: number | null): number | null {
  const filas = db.prepare("SELECT precio FROM precios WHERE aviso_id = ? ORDER BY fecha DESC, id DESC LIMIT 2").all(id) as Fila[];
  const previo = filas[1];
  if (!previo || previo.precio === null || actual === null) return null;
  const p = num(previo.precio);
  return p !== actual ? p : null;
}

const quienDe = (q: string): Quien => (q === "dueno" || q === "inmobiliaria" || q === "agencia" ? q : "");
/** "Publica: …": el negocio si lo hay; si es el dueño, su nombre (solo el primero, por privacidad). */
function nombrePublico(quien: string, anunciante: string, nombre: string): string {
  if (anunciante && quien !== "dueno") return anunciante;
  return quien === "dueno" ? (nombre.trim().split(/\s+/)[0] ?? "") : anunciante;
}

function leerFoco(texto: string): Foco | null {
  const [x, y] = texto.split(",").map(Number);
  return texto && Number.isFinite(x) && Number.isFinite(y) ? { x: Math.min(100, Math.max(0, x as number)), y: Math.min(100, Math.max(0, y as number)) } : null;
}
const textoFoco = (f: Foco | null | undefined): string => (f ? `${f.x},${f.y}` : "");
function leerCalendario(texto: string): Calendario | null {
  if (!texto) return null;
  try {
    return limpiarCalendario(JSON.parse(texto)) ?? null;
  } catch {
    return null;
  }
}
const textoCalendario = (c: Calendario | null | undefined): string => (c ? JSON.stringify(c) : "");

/** Las condiciones de un alquiler se guardan como JSON; si algo no cierra, se ignora. */
function leerCondiciones(texto: string): CondicionesAlquiler | null {
  if (!texto) return null;
  try {
    return limpiarCondiciones(JSON.parse(texto));
  } catch {
    return null;
  }
}

function aPublico(f: Fila): AvisoPublico {
  const id = num(f.id);
  const precio = f.precio === null ? null : num(f.precio);
  const publicado = str(f.publicado_en) || str(f.creado_en);
  const vence = new Date(Date.parse(publicado) + DIAS_VIGENCIA * 864e5).toISOString();
  let datos: string[] = [];
  try {
    const d: unknown = JSON.parse(str(f.datos) || "[]");
    if (Array.isArray(d)) datos = d.map(String);
  } catch {
    datos = [];
  }
  return {
    id,
    rubro: str(f.rubro) as RubroId,
    tipo: str(f.tipo),
    operacion: f.operacion === "alquiler" ? "alquiler" : "venta",
    titulo: str(f.titulo),
    precio,
    moneda: f.moneda === "ARS" ? "ARS" : "USD",
    pueblo: str(f.pueblo),
    anunciante: str(f.anunciante),
    quien: quienDe(str(f.quien)),
    publica: nombrePublico(str(f.quien), str(f.anunciante), str(f.nombre)),
    zona: str(f.zona),
    descripcion: str(f.descripcion),
    datos,
    permuta: num(f.permuta) === 1,
    financia: num(f.financia) === 1,
    fotos: fotosDe(id),
    ejemplo: num(f.ejemplo) === 1,
    reservado: num(f.reservado) === 1,
    destacado: num(f.destacado) === 1,
    publicadoEn: publicado,
    venceEn: vence,
    precioAnterior: precioAnterior(id, precio),
    condiciones: f.operacion === "alquiler" ? leerCondiciones(str(f.condiciones)) : null,
    foco: leerFoco(str(f.foco)),
    calendario: leerCalendario(str(f.calendario)),
    lat: f.lat === null || f.lat === undefined ? null : Number(f.lat),
    lng: f.lng === null || f.lng === undefined ? null : Number(f.lng),
  };
}

function leerMejora(x: unknown): Mejora | null {
  if (typeof x !== "string" || !x) return null;
  try {
    const m = JSON.parse(x) as Mejora;
    return m && typeof m.estado === "string" ? m : null;
  } catch {
    return null;
  }
}

/** Guarda lo que propuso el asistente (o en qué anda) para un aviso. */
export function guardarMejora(id: number, m: Mejora): void {
  db.prepare("UPDATE avisos SET mejora = ? WHERE id = ?").run(JSON.stringify(m), id);
}

/** Avisos pendientes que el asistente todavía no miró (por ejemplo, si el servidor se reinició a mitad de camino). */
export function pendientesSinMejora(): number[] {
  return (db.prepare("SELECT id FROM avisos WHERE estado = 'pendiente' AND ejemplo = 0 AND (mejora = '' OR mejora LIKE '{\"estado\":\"trabajando\"%') ORDER BY id").all() as Fila[]).map((f) => num(f.id));
}

function aAdmin(f: Fila): AvisoAdmin {
  return {
    ...aPublico(f),
    estado: str(f.estado) as Estado,
    mejora: leerMejora(f.mejora),
    nombre: str(f.nombre),
    telefono: str(f.telefono),
    vistas: num(f.vistas),
    contactos: num(f.contactos),
    creadoEn: str(f.creado_en),
  };
}

/** Mientras no haya avisos reales vigentes se muestran los de ejemplo; con el primero real, se ocultan solos. */
function hayReales(): boolean {
  const f = db.prepare(`SELECT COUNT(*) AS n FROM avisos WHERE ${VIGENTE} AND ejemplo = 0`).get() as Fila;
  return num(f.n) > 0;
}

export function listarPublicos(filtros: Filtros, limite: number, desde: number): ListaAvisos {
  const reales = hayReales();
  const where: string[] = [VIGENTE, reales ? "ejemplo = 0" : "ejemplo = 1"];
  const args: (string | number)[] = [];
  if (filtros.rubro) { where.push("rubro = ?"); args.push(filtros.rubro); }
  if (filtros.pueblo === OTRO_PUEBLO) { where.push(`pueblo NOT IN (${PUEBLOS.map(() => "?").join(",")})`); args.push(...PUEBLOS); }
  else if (filtros.pueblo) { where.push("pueblo = ?"); args.push(filtros.pueblo); }
  if (filtros.tipo) { where.push("tipo = ?"); args.push(filtros.tipo); }
  if (filtros.op) { where.push("operacion = ?"); args.push(filtros.op); }
  if (filtros.permuta) where.push("permuta = 1");
  if (filtros.financia) where.push("financia = 1");
  // Precio llevado a pesos, para comparar avisos en dólares con avisos en pesos.
  const usd = dolar();
  const enPesos = `(CASE WHEN moneda = 'USD' THEN precio * ${usd} ELSE precio END)`;
  const max = Number(filtros.max);
  if (filtros.max && Number.isFinite(max) && max > 0) {
    where.push(`precio IS NOT NULL AND ${enPesos} <= ?`);
    args.push(filtros.moneda === "USD" ? max * usd : max);
  }
  const orden =
    filtros.orden === "barato" ? `precio IS NULL, ${enPesos} ASC`
    : filtros.orden === "caro" ? `precio IS NULL, ${enPesos} DESC`
    : "destacado DESC, publicado_en DESC, id DESC";

  let filas = db.prepare(`SELECT * FROM avisos WHERE ${where.join(" AND ")} ORDER BY ${orden}`).all(...args) as Fila[];
  // Búsqueda por palabras sin tildes (se hace acá para no depender de extensiones de SQLite)
  const palabras = slug(filtros.q).split("-").filter(Boolean);
  if (palabras.length) {
    filas = filas.filter((f) => {
      const texto = slug([f.titulo, f.tipo, f.descripcion, f.pueblo, f.zona, f.datos].map(str).join(" ")).replace(/-/g, " ");
      return palabras.every((p) => texto.includes(p));
    });
  }
  const conteo = { inmuebles: 0, vehiculos: 0, agro: 0, vacaciones: 0 } as Record<RubroId, number>;
  if (reales) {
    for (const f of db.prepare(`SELECT rubro, COUNT(*) AS n FROM avisos WHERE ${VIGENTE} AND ejemplo = 0 GROUP BY rubro`).all() as Fila[]) {
      const r = str(f.rubro) as RubroId;
      if (r in RUBROS) conteo[r] = num(f.n);
    }
  }
  return { avisos: filas.slice(desde, desde + limite).map(aPublico), total: filas.length, soloEjemplos: !reales, conteo, dolar: usd };
}

/** Un aviso publicado y vigente, como lo ve un visitante (sin teléfono). Las visitas se cuentan aparte (estad.ts). */
export function obtenerPublico(id: number): AvisoPublico | null {
  const f = db.prepare(`SELECT * FROM avisos WHERE id = ? AND ${VIGENTE}`).get(id) as Fila | undefined;
  return f ? aPublico(f) : null;
}

/** Devuelve el teléfono solo de un aviso real vigente (el contacto lo cuenta estad.ts). */
export function telefonoParaContacto(id: number): { telefono: string; titulo: string } | null {
  const f = db.prepare(`SELECT telefono, titulo, ejemplo FROM avisos WHERE id = ? AND ${VIGENTE}`).get(id) as Fila | undefined;
  if (!f || num(f.ejemplo) === 1 || !str(f.telefono)) return null;
  return { telefono: str(f.telefono), titulo: str(f.titulo) };
}

export function crearAviso(a: NuevoAviso, archivos: string[], opciones: { estado: Estado; ejemplo?: boolean; publicadoEn?: string }): number {
  db.exec("BEGIN");
  try {
    const r = db
      .prepare(`INSERT INTO avisos (estado, rubro, tipo, operacion, titulo, precio, moneda, pueblo, anunciante, zona, descripcion, datos, permuta, financia, nombre, telefono, ejemplo, publicado_en, condiciones, lat, lng, quien, foco, calendario)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        opciones.estado, a.rubro, a.tipo, a.operacion, a.titulo, a.precio, a.moneda, a.pueblo, a.anunciante, a.zona, a.descripcion, JSON.stringify(a.datos),
        a.permuta ? 1 : 0, a.financia ? 1 : 0, a.nombre, a.telefono, opciones.ejemplo ? 1 : 0,
        opciones.estado === "publicado" ? (opciones.publicadoEn ?? new Date().toISOString()) : null,
        a.condiciones ? JSON.stringify(a.condiciones) : "", a.lat, a.lng, a.quien, textoFoco(a.foco), textoCalendario(a.calendario),
      );
    const id = Number(r.lastInsertRowid);
    archivos.forEach((archivo, i) => db.prepare("INSERT INTO fotos (aviso_id, archivo, orden) VALUES (?,?,?)").run(id, archivo, i));
    db.prepare("INSERT INTO precios (aviso_id, precio, moneda) VALUES (?,?,?)").run(id, a.precio, a.moneda);
    db.exec("COMMIT");
    return id;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function listarAdmin(estado: Estado | ""): AvisoAdmin[] {
  const filas = (estado
    ? db.prepare("SELECT * FROM avisos WHERE estado = ? ORDER BY COALESCE(publicado_en, creado_en) DESC").all(estado)
    : db.prepare("SELECT * FROM avisos ORDER BY COALESCE(publicado_en, creado_en) DESC").all()) as Fila[];
  return filas.map(aAdmin);
}

export function obtenerAdmin(id: number): AvisoAdmin | null {
  const f = db.prepare("SELECT * FROM avisos WHERE id = ?").get(id) as Fila | undefined;
  return f ? aAdmin(f) : null;
}

export interface CambiosAdmin {
  estado?: Estado;
  renovar?: boolean;
  titulo?: string;
  precio?: number | null;
  moneda?: "USD" | "ARS";
  descripcion?: string;
  reservado?: boolean;
  destacado?: boolean;
}

export function actualizarAviso(id: number, c: CambiosAdmin): AvisoAdmin | null {
  const actual = obtenerAdmin(id);
  if (!actual) return null;
  const sets: string[] = ["actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ','now')"];
  const args: (string | number | null)[] = [];
  if (c.titulo !== undefined) { sets.push("titulo = ?"); args.push(c.titulo); }
  if (c.descripcion !== undefined) { sets.push("descripcion = ?"); args.push(c.descripcion); }
  if (c.precio !== undefined) { sets.push("precio = ?"); args.push(c.precio); }
  if (c.moneda !== undefined) { sets.push("moneda = ?"); args.push(c.moneda); }
  if (c.estado !== undefined) {
    sets.push("estado = ?");
    args.push(c.estado);
    if (c.estado === "publicado" && actual.estado !== "publicado") sets.push("publicado_en = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  }
  if (c.destacado !== undefined) { sets.push("destacado = ?"); args.push(c.destacado ? 1 : 0); }
  if (c.reservado !== undefined) { sets.push("reservado = ?"); args.push(c.reservado ? 1 : 0); }
  if (c.renovar) sets.push("publicado_en = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  db.prepare(`UPDATE avisos SET ${sets.join(", ")} WHERE id = ?`).run(...args, id);
  const precioNuevo = c.precio !== undefined ? c.precio : actual.precio;
  const monedaNueva = c.moneda ?? actual.moneda;
  if (precioNuevo !== actual.precio || monedaNueva !== actual.moneda) {
    db.prepare("INSERT INTO precios (aviso_id, precio, moneda) VALUES (?,?,?)").run(id, precioNuevo, monedaNueva);
  }
  return obtenerAdmin(id);
}

/** Copia consistente de la base (aunque esté en uso) a un archivo. */
export function copiarBase(destino: string): void {
  db.prepare("VACUUM INTO ?").run(destino);
}

export function contarPendientes(): number {
  return num((db.prepare("SELECT COUNT(*) AS n FROM avisos WHERE estado = 'pendiente'").get() as Fila).n);
}

/** Nombres de archivo de las fotos de un aviso (en orden). */
export function archivosDe(id: number): string[] {
  return (db.prepare("SELECT archivo FROM fotos WHERE aviso_id = ? ORDER BY orden, id").all(id) as Fila[]).map((f) => str(f.archivo));
}

/**
 * Edición completa desde el panel: cambia todos los datos y deja las fotos en el orden indicado.
 * Devuelve los archivos que ya no se usan, para borrarlos del disco.
 */
export function editarAviso(id: number, a: NuevoAviso, archivosFinal: string[]): { aviso: AvisoAdmin; quitadas: string[] } | null {
  const actual = obtenerAdmin(id);
  if (!actual) return null;
  const antes = archivosDe(id);
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE avisos SET rubro = ?, tipo = ?, operacion = ?, titulo = ?, precio = ?, moneda = ?, pueblo = ?, anunciante = ?, zona = ?, descripcion = ?, datos = ?,
         permuta = ?, financia = ?, nombre = ?, telefono = ?, condiciones = ?, lat = ?, lng = ?, quien = ?, foco = ?, calendario = ?, actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).run(a.rubro, a.tipo, a.operacion, a.titulo, a.precio, a.moneda, a.pueblo, a.anunciante, a.zona, a.descripcion, JSON.stringify(a.datos), a.permuta ? 1 : 0, a.financia ? 1 : 0, a.nombre, a.telefono, a.condiciones ? JSON.stringify(a.condiciones) : "", a.lat, a.lng, a.quien, a.foco === undefined ? textoFoco(actual.foco) : textoFoco(a.foco), a.calendario === undefined ? textoCalendario(actual.calendario) : textoCalendario(a.calendario), id);
    if (a.precio !== actual.precio || a.moneda !== actual.moneda) {
      db.prepare("INSERT INTO precios (aviso_id, precio, moneda) VALUES (?,?,?)").run(id, a.precio, a.moneda);
    }
    db.prepare("DELETE FROM fotos WHERE aviso_id = ?").run(id);
    archivosFinal.forEach((archivo, i) => db.prepare("INSERT INTO fotos (aviso_id, archivo, orden) VALUES (?,?,?)").run(id, archivo, i));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  const aviso = obtenerAdmin(id);
  if (!aviso) return null;
  return { aviso, quitadas: antes.filter((f) => !archivosFinal.includes(f)) };
}

/** Borra el aviso y devuelve los nombres de archivo de sus fotos para eliminarlas del disco. */
export function borrarAviso(id: number): string[] {
  const archivos = (db.prepare("SELECT archivo FROM fotos WHERE aviso_id = ?").all(id) as Fila[]).map((f) => str(f.archivo));
  db.prepare("DELETE FROM avisos WHERE id = ?").run(id);
  return archivos;
}

export function crearBusqueda(b: NuevaBusqueda): number {
  const r = db.prepare("INSERT INTO busquedas (rubro, que, presupuesto, nombre, telefono, permiso) VALUES (?,?,?,?,?,?)").run(b.rubro, b.que, b.presupuesto, b.nombre, b.telefono, b.permiso ? 1 : 0);
  return Number(r.lastInsertRowid);
}

export function listarBusquedas(): Busqueda[] {
  return (db.prepare("SELECT * FROM busquedas ORDER BY creado_en DESC").all() as Fila[]).map((f) => ({
    id: num(f.id), rubro: str(f.rubro), que: str(f.que), presupuesto: str(f.presupuesto), nombre: str(f.nombre), telefono: str(f.telefono), creadoEn: str(f.creado_en),
    titulo: str(f.titulo), detalle: str(f.detalle), directo: num(f.directo) === 1, publicaDesde: f.publica_desde ? str(f.publica_desde) : null, permiso: num(f.permiso) === 1,
  }));
}

/** Una búsqueda que Felipe carga a mano para mostrarla en el sitio (no tiene nombre ni teléfono). */
export function crearBusquedaPublica(b: BusquedaPublica): number {
  const r = db.prepare("INSERT INTO busquedas (rubro, que, nombre, telefono, titulo, detalle, directo, publica_desde, permiso) VALUES (?,?,?,?,?,?,?,?,1)")
    .run(b.rubro, b.titulo, "Cargada por Felipe", "", b.titulo, b.detalle, b.directo ? 1 : 0, new Date().toISOString());
  return Number(r.lastInsertRowid);
}

/** Muestra u oculta una búsqueda en el sitio, o cambia lo que dice. Mostrar de nuevo la renueva por otros 30 días. */
export function cambiarBusqueda(id: number, c: { publica?: boolean; titulo?: string; detalle?: string; directo?: boolean }): "ok" | "no-esta" | "sin-permiso" {
  const antes = db.prepare("SELECT permiso FROM busquedas WHERE id = ?").get(id) as Fila | undefined;
  if (!antes) return "no-esta";
  // Una búsqueda que dejó un vecino solo se muestra si aceptó que se muestre.
  if (c.publica === true && num(antes.permiso) !== 1) return "sin-permiso";
  if (c.publica === true) {
    db.prepare("UPDATE busquedas SET publica_desde = ?, titulo = CASE WHEN titulo = '' THEN substr(que, 1, 60) ELSE titulo END WHERE id = ?").run(new Date().toISOString(), id);
  } else if (c.publica === false) {
    db.prepare("UPDATE busquedas SET publica_desde = NULL WHERE id = ?").run(id);
  }
  if (c.titulo !== undefined) db.prepare("UPDATE busquedas SET titulo = ? WHERE id = ?").run(c.titulo, id);
  if (c.detalle !== undefined) db.prepare("UPDATE busquedas SET detalle = ? WHERE id = ?").run(c.detalle, id);
  if (c.directo !== undefined) db.prepare("UPDATE busquedas SET directo = ? WHERE id = ?").run(c.directo ? 1 : 0, id);
  return "ok";
}

/** Lo que se ve en «Se buscan»: las que Felipe eligió y todavía no vencieron; las iguales se juntan en una sola. */
export function listarSeBuscan(): SeBusca[] {
  const filas = db.prepare(
    `SELECT rubro, titulo, detalle, directo, COUNT(*) AS cuantas, MAX(publica_desde) AS desde FROM busquedas
     WHERE publica_desde IS NOT NULL AND titulo <> '' AND publica_desde >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-${DIAS_SE_BUSCAN} days')
     GROUP BY rubro, titulo, detalle, directo ORDER BY MAX(publica_desde) DESC, MAX(id) DESC`,
  ).all() as Fila[];
  return filas.map((f) => ({ rubro: str(f.rubro), titulo: str(f.titulo), detalle: str(f.detalle), directo: num(f.directo) === 1, cuantas: num(f.cuantas), desde: str(f.desde) }));
}

export function borrarBusqueda(id: number): void {
  db.prepare("DELETE FROM busquedas WHERE id = ?").run(id);
}

export function contarAvisos(): number {
  return num((db.prepare("SELECT COUNT(*) AS n FROM avisos").get() as Fila).n);
}

export function sumarContacto(id: number): void {
  db.prepare("UPDATE avisos SET contactos = contactos + 1 WHERE id = ?").run(id);
}
