// La web armada (web/dist), las fotos, robots.txt, la 404 y la página para compartir avisos (/a/:id).
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fmtNum } from "../shared/texto.ts";
import { anotarError } from "./actividad.ts";
import { INDEXAR, WEB_DIR, sitioDe } from "./config.ts";
import * as datos from "./db.ts";
import { FOTOS_DIR } from "./db.ts";
import { comprimir, enviar } from "./http.ts";

const TIPOS_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".ico": "image/x-icon",
};
/** Lo que se comprime (las fotos ya vienen comprimidas). */
const TEXTO = new Set([".js", ".css", ".html", ".svg", ".json", ".txt"]);
/** Versiones comprimidas de cada archivo de la web: se hacen una vez (275 KB de código pasan a ~90 KB). */
const comprimidos = new Map<string, { crudo: Buffer; br?: Buffer; gzip?: Buffer }>();

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Archivo dentro de una carpeta, sin permitir salir de ella. false si no existe. */
function servirArchivo(res: ServerResponse, raiz: string, ruta: string, cache: string): boolean {
  let limpia: string;
  try {
    limpia = decodeURIComponent(ruta);
  } catch {
    return false;
  }
  if (limpia.includes("\0")) return false;
  const destino = resolve(raiz, "." + limpia);
  if (!destino.startsWith(raiz + sep) && destino !== raiz) return false;
  if (!existsSync(destino)) return false;
  const info = statSync(destino);
  if (!info.isFile()) return false;
  const ext = extname(destino).toLowerCase();
  const cabeceras = { "Content-Type": TIPOS_MIME[ext] ?? "application/octet-stream", "Cache-Control": cache };
  if (TEXTO.has(ext) && info.size < 5_000_000) {
    const clave = `${destino}:${info.mtimeMs}`;
    const entrada = comprimidos.get(clave) ?? { crudo: readFileSync(destino) };
    comprimidos.set(clave, entrada);
    enviar(res, 200, cabeceras, entrada.crudo, (como) => (entrada[como] ??= comprimir(entrada.crudo, como)));
    return true;
  }
  res.writeHead(200, { ...cabeceras, "Content-Length": String(info.size) });
  createReadStream(destino).pipe(res);
  return true;
}

/** Página para compartir un aviso: WhatsApp lee la foto y el título; las personas pasan directo al aviso. */
function paginaCompartir(req: IncomingMessage, res: ServerResponse, id: number, de: string): void {
  const sitio = sitioDe(req);
  const a = datos.obtenerPublico(id);
  // La marca de origen (?de=wa) pasa al sitio para saber de dónde vino la gente.
  const destino = `/${/^[a-z]{2,6}$/.test(de) ? `?de=${de}` : ""}#aviso--${id}`;
  const titulo = a ? `${a.titulo} · Vidriera Chabás` : "Vidriera Chabás";
  const precio = a?.precio ? `${a.moneda === "ARS" ? "$" : "USD"} ${fmtNum(a.precio)}${a.operacion === "alquiler" ? " por mes" : ""}` : "";
  const desc = a ? [precio, a.tipo, a.pueblo].filter(Boolean).join(" · ") : "Casas, autos y más de Chabás y la zona.";
  const foto = a?.fotos[0] ? `${sitio}${a.fotos[0]}` : `${sitio}/assets/img/og-vidriera-chabas.png`;
  const html = `<!DOCTYPE html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><meta property="og:type" content="website"><meta property="og:site_name" content="Vidriera Chabás">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(foto)}"><meta property="og:url" content="${esc(`${sitio}/a/${id}`)}"><meta name="twitter:card" content="summary_large_image"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${esc(destino)}"><link rel="stylesheet" href="/assets/style.css"></head>
<body><main class="wrap prose"><p><a href="${esc(destino)}">Ver el aviso en Vidriera Chabás</a></p></main></body></html>`;
  enviar(res, 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }, Buffer.from(html));
}

/** Todo lo que no es /api: devuelve siempre una respuesta (la 404 con diseño si no existe). */
export function servirSitio(req: IncomingMessage, res: ServerResponse, url: URL): void {
  const ruta = url.pathname;
  if (ruta === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(INDEXAR ? "User-agent: *\nDisallow: /api/\n" : "User-agent: *\nDisallow: /\n");
    return;
  }
  // Safari, WhatsApp y muchos navegadores piden estos íconos en la raíz aunque la página diga dónde están:
  // se sirven los que ya tenemos (antes daban 404 en cada visita).
  const icono = ruta === "/favicon.ico" ? "/assets/img/favicon-32.png" : /^\/apple-touch-icon(-precomposed)?(-\d+x\d+)?\.png$/.test(ruta) ? "/assets/img/apple-touch-icon.png" : "";
  if (icono && servirArchivo(res, WEB_DIR, icono, "public, max-age=86400")) return;
  const compartir = /^\/a\/(\d{1,9})\/?$/.exec(ruta);
  if (compartir) return paginaCompartir(req, res, Number(compartir[1]), url.searchParams.get("de") ?? "");
  if (ruta.startsWith("/fotos/") && servirArchivo(res, FOTOS_DIR, ruta.slice("/fotos".length), "public, max-age=31536000, immutable")) return;
  if (ruta === "/" || ruta === "/index.html") {
    if (servirArchivo(res, WEB_DIR, "/index.html", "no-cache")) return;
  } else if (servirArchivo(res, WEB_DIR, ruta, ruta.startsWith("/assets/") ? "public, max-age=86400" : "no-cache")) return;
  anotarError(res, "No existe esa dirección");
  const pagina = join(WEB_DIR, "404.html");
  enviar(res, 404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }, existsSync(pagina) ? readFileSync(pagina) : Buffer.from("No encontrado"));
}
