// Servidor de Vidriera Chabás: API + web + fotos. Node 24, sin dependencias externas.
// Arrancar: node server/index.ts   (ver README.md para las variables de entorno)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
import { join, resolve, extname, sep } from "node:path";
import { LIMITES, RUBROS } from "../shared/config.ts";
import type { Estado, Filtros, RubroId } from "../shared/tipos.ts";
import { recortar, soloDigitos, fmtNum } from "../shared/texto.ts";
import { validarAviso, validarBusqueda } from "../shared/validar.ts";
import { linkWA } from "../shared/whatsapp.ts";
import * as datos from "./db.ts";
import { FOTOS_DIR } from "./db.ts";
import { ErrorHttp, cabecerasSeguridad, crearLimitador, exigirMismoOrigen, ipDe, json, leerJson } from "./http.ts";
import { claveCorrecta, cerrarSesion, exigirAdmin, iniciarSesion } from "./auth.ts";
import { guardarFotos, borrarFotos } from "./imagenes.ts";
import { iniciarBot } from "./bot/index.ts";

const PUERTO = Number(process.env.PORT ?? 3000);
const WEB_DIR = resolve(process.env.WEB_DIR ?? join(process.cwd(), "web", "dist"));
const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const MAX_JSON = 1_000_000;
const MAX_CON_FOTOS = LIMITES.fotos * Math.ceil(LIMITES.fotoBytes * 1.4) + MAX_JSON;

const limiteContacto = crearLimitador(30, 10 * 60_000);
const limitePublicar = crearLimitador(6, 60 * 60_000);
const limiteBusqueda = crearLimitador(10, 60 * 60_000);
const limiteLogin = crearLimitador(8, 15 * 60_000);

const TIPOS_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".ico": "image/x-icon",
};

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function idDe(texto: string | undefined): number {
  const id = Number(texto);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHttp(404, "No encontrado.");
  return id;
}

function filtrosDe(q: URLSearchParams): Filtros {
  const rubro = q.get("rubro") ?? "";
  const op = q.get("op");
  const orden = q.get("orden");
  return {
    rubro: rubro in RUBROS ? (rubro as RubroId) : "",
    q: recortar(q.get("q"), 60),
    tipo: recortar(q.get("tipo"), 40),
    op: op === "venta" || op === "alquiler" ? op : "",
    max: soloDigitos(q.get("max")).slice(0, 12),
    moneda: q.get("moneda") === "ARS" ? "ARS" : "USD",
    permuta: q.get("permuta") === "1",
    financia: q.get("financia") === "1",
    orden: orden === "barato" || orden === "caro" ? orden : "",
  };
}

/** Archivo estático dentro de una carpeta, sin permitir salir de ella. */
function servirArchivo(res: ServerResponse, raiz: string, ruta: string, cache: string): boolean {
  const destino = resolve(raiz, "." + decodeURIComponent(ruta));
  if (!destino.startsWith(raiz + sep) && destino !== raiz) return false;
  if (!existsSync(destino) || !statSync(destino).isFile()) return false;
  res.writeHead(200, { "Content-Type": TIPOS_MIME[extname(destino).toLowerCase()] ?? "application/octet-stream", "Cache-Control": cache });
  createReadStream(destino).pipe(res);
  return true;
}

/** Página para compartir un aviso: WhatsApp lee la foto y el título; las personas pasan directo al aviso. */
function paginaCompartir(res: ServerResponse, id: number): void {
  const a = datos.obtenerPublico(id, false);
  const destino = `/#aviso--${id}`;
  const titulo = a ? `${a.titulo} · Vidriera Chabás` : "Vidriera Chabás";
  const precio = a?.precio ? `${a.moneda === "ARS" ? "$" : "USD"} ${fmtNum(a.precio)}${a.operacion === "alquiler" ? " por mes" : ""}` : "";
  const desc = a ? [precio, a.tipo, a.pueblo].filter(Boolean).join(" · ") : "Casas, vehículos y maquinaria agro de Chabás.";
  const foto = a?.fotos[0] ? `${SITE_URL}${a.fotos[0]}` : `${SITE_URL}/assets/img/og-vidriera-chabas.png`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
  res.end(`<!DOCTYPE html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><meta property="og:type" content="website"><meta property="og:site_name" content="Vidriera Chabás">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(foto)}">
<meta http-equiv="refresh" content="0; url=${esc(destino)}"><link rel="stylesheet" href="/assets/style.css"></head>
<body><main class="wrap prose"><p><a href="${esc(destino)}">Ver el aviso en Vidriera Chabás</a></p></main></body></html>`);
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const partes = url.pathname.split("/").filter(Boolean); // ["api", ...]
  const [, recurso, a1, a2] = partes;
  const metodo = req.method ?? "GET";
  const ip = ipDe(req);
  if (metodo !== "GET") exigirMismoOrigen(req);

  if (recurso === "salud" && metodo === "GET") return json(res, 200, { ok: true });

  if (recurso === "avisos") {
    if (!a1 && metodo === "GET") {
      const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 12, 1), 60);
      const desde = Math.max(Number(url.searchParams.get("desde")) || 0, 0);
      return json(res, 200, datos.listarPublicos(filtrosDe(url.searchParams), limite, desde));
    }
    const id = idDe(a1);
    if (!a2 && metodo === "GET") {
      const aviso = datos.obtenerPublico(id, true);
      if (!aviso) throw new ErrorHttp(404, "Este aviso ya no está.");
      return json(res, 200, aviso);
    }
    if (a2 === "contacto" && metodo === "POST") {
      limiteContacto(ip);
      const c = datos.telefonoParaContacto(id);
      if (!c) throw new ErrorHttp(404, "Este aviso no se puede contactar.");
      return json(res, 200, { url: linkWA(c.telefono, `Hola! Vi tu aviso «${c.titulo}» en Vidriera Chabás. ¿Sigue disponible?`) });
    }
  }

  if (recurso === "publicaciones" && metodo === "POST" && !a1) {
    limitePublicar(ip);
    const r = validarAviso(await leerJson(req, MAX_CON_FOTOS), { exigirFotos: true });
    if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
    const archivos = guardarFotos(r.valor.fotos);
    const id = datos.crearAviso(r.valor, archivos, { estado: "pendiente" });
    return json(res, 201, { id });
  }

  if (recurso === "busquedas" && metodo === "POST" && !a1) {
    limiteBusqueda(ip);
    const r = validarBusqueda(await leerJson(req, MAX_JSON));
    if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
    return json(res, 201, { id: datos.crearBusqueda(r.valor) });
  }

  if (recurso === "admin") {
    if (a1 === "login" && metodo === "POST") {
      limiteLogin(ip);
      const cuerpo = (await leerJson(req, MAX_JSON)) as { clave?: unknown };
      if (typeof cuerpo.clave !== "string" || !claveCorrecta(cuerpo.clave.slice(0, 200))) throw new ErrorHttp(401, "Contraseña incorrecta.");
      iniciarSesion(res);
      return json(res, 200, { ok: true });
    }
    if (a1 === "logout" && metodo === "POST") {
      cerrarSesion(req, res);
      return json(res, 200, { ok: true });
    }
    if (a1 === "sesion" && metodo === "GET") {
      try {
        exigirAdmin(req);
        return json(res, 200, { ok: true });
      } catch {
        return json(res, 200, { ok: false });
      }
    }
    exigirAdmin(req);
    if (a1 === "avisos") {
      if (!a2 && metodo === "GET") {
        const e = url.searchParams.get("estado") ?? "";
        const estado = (["pendiente", "publicado", "rechazado", "vendido"].includes(e) ? e : "") as Estado | "";
        return json(res, 200, datos.listarAdmin(estado));
      }
      if (!a2 && metodo === "POST") {
        const r = validarAviso(await leerJson(req, MAX_CON_FOTOS), { exigirFotos: false });
        if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
        const id = datos.crearAviso(r.valor, guardarFotos(r.valor.fotos), { estado: "publicado" });
        return json(res, 201, datos.obtenerAdmin(id));
      }
      const id = idDe(a2);
      if (metodo === "PATCH") {
        const c = (await leerJson(req, MAX_JSON)) as Record<string, unknown>;
        const estados: Estado[] = ["pendiente", "publicado", "rechazado", "vendido"];
        const aviso = datos.actualizarAviso(id, {
          estado: estados.includes(c.estado as Estado) ? (c.estado as Estado) : undefined,
          renovar: c.renovar === true,
          titulo: typeof c.titulo === "string" && recortar(c.titulo, LIMITES.titulo).length >= 4 ? recortar(c.titulo, LIMITES.titulo) : undefined,
          descripcion: typeof c.descripcion === "string" ? recortar(c.descripcion, LIMITES.descripcion) : undefined,
          precio: "precio" in c ? (soloDigitos(c.precio) ? Number(soloDigitos(c.precio).slice(0, 12)) : null) : undefined,
          moneda: c.moneda === "ARS" || c.moneda === "USD" ? c.moneda : undefined,
        });
        if (!aviso) throw new ErrorHttp(404, "No encontrado.");
        return json(res, 200, aviso);
      }
      if (metodo === "DELETE") {
        borrarFotos(datos.borrarAviso(id));
        return json(res, 200, { ok: true });
      }
    }
    if (a1 === "busquedas") {
      if (!a2 && metodo === "GET") return json(res, 200, datos.listarBusquedas());
      if (a2 && metodo === "DELETE") {
        datos.borrarBusqueda(idDe(a2));
        return json(res, 200, { ok: true });
      }
    }
  }
  throw new ErrorHttp(404, "No encontrado.");
}

const servidor = createServer(async (req, res) => {
  cabecerasSeguridad(res);
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") throw new ErrorHttp(405, "Método no permitido.");
    if (url.pathname === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return void res.end(process.env.NOINDEX === "0" ? "User-agent: *\nDisallow: /api/\n" : "User-agent: *\nDisallow: /\n");
    }
    const compartir = /^\/a\/(\d+)\/?$/.exec(url.pathname);
    if (compartir) return paginaCompartir(res, idDe(compartir[1]));
    if (url.pathname.startsWith("/fotos/") && servirArchivo(res, FOTOS_DIR, url.pathname.slice("/fotos".length), "public, max-age=31536000, immutable")) return;
    if (url.pathname === "/" || url.pathname === "/index.html") {
      if (servirArchivo(res, WEB_DIR, "/index.html", "no-cache")) return;
    } else if (servirArchivo(res, WEB_DIR, url.pathname, url.pathname.startsWith("/assets/") ? "public, max-age=86400" : "no-cache")) return;
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(existsSync(join(WEB_DIR, "404.html")) ? readFileSync(join(WEB_DIR, "404.html")) : "No encontrado");
  } catch (err) {
    if (err instanceof ErrorHttp) return json(res, err.status, { error: err.message, campos: err.campos });
    console.error(new Date().toISOString(), req.method, url.pathname, err);
    if (!res.headersSent) json(res, 500, { error: "Algo salió mal. Probá de nuevo en un rato." });
  }
});

servidor.requestTimeout = 60_000;
servidor.headersTimeout = 15_000;
servidor.listen(PUERTO, () => {
  console.log(`Vidriera Chabás escuchando en http://localhost:${PUERTO}  (web: ${WEB_DIR})`);
  if (!process.env.ADMIN_PASSWORD_HASH) console.warn("Ojo: falta ADMIN_PASSWORD_HASH, el panel no va a dejar entrar. Generalo con: npm run clave");
  iniciarBot();
});
