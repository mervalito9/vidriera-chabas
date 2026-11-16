// Utilidades HTTP: respuestas JSON, lectura del cuerpo con límite, cookies, límite de pedidos y cabeceras de seguridad.
import type { IncomingMessage, ServerResponse } from "node:http";

export class ErrorHttp extends Error {
  readonly status: number;
  readonly campos: { campo: string; msg: string }[];
  constructor(status: number, mensaje: string, campos: { campo: string; msg: string }[] = []) {
    super(mensaje);
    this.status = status;
    this.campos = campos;
  }
}

export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

export function cabecerasSeguridad(res: ServerResponse): void {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000");
  if (process.env.NOINDEX !== "0") res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

export function json(res: ServerResponse, status: number, cuerpo: unknown): void {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(texto);
}

/** Lee el cuerpo JSON con un tope de bytes. Corta la conexión si se pasa. */
export async function leerJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const tipo = req.headers["content-type"] ?? "";
  if (!tipo.startsWith("application/json")) throw new ErrorHttp(415, "Se esperaba JSON.");
  const largo = Number(req.headers["content-length"] ?? 0);
  if (largo > maxBytes) throw new ErrorHttp(413, "El envío es demasiado grande.");
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    const b = parte as Buffer;
    total += b.length;
    if (total > maxBytes) {
      req.destroy();
      throw new ErrorHttp(413, "El envío es demasiado grande.");
    }
    partes.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown;
  } catch {
    throw new ErrorHttp(400, "JSON inválido.");
  }
}

export function leerCookie(req: IncomingMessage, nombre: string): string {
  for (const par of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = par.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return "";
}

/** IP del visitante. Detrás de un proxy (Caddy, Nginx, Cloudflare) poné TRUST_PROXY=1. */
export function ipDe(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === "1") {
    const xf = req.headers["x-forwarded-for"];
    const primera = (Array.isArray(xf) ? xf[0] : xf)?.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return req.socket.remoteAddress ?? "?";
}

/** Límite simple de pedidos por IP, en memoria (alcanza para un solo servidor). */
export function crearLimitador(maximo: number, ventanaMs: number) {
  const golpes = new Map<string, { n: number; desde: number }>();
  setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of golpes) if (ahora - v.desde > ventanaMs) golpes.delete(k);
  }, ventanaMs).unref();
  return (clave: string): void => {
    const ahora = Date.now();
    const g = golpes.get(clave);
    if (!g || ahora - g.desde > ventanaMs) {
      golpes.set(clave, { n: 1, desde: ahora });
      return;
    }
    g.n += 1;
    if (g.n > maximo) throw new ErrorHttp(429, "Demasiados pedidos seguidos. Probá de nuevo en un rato.");
  };
}

/** Los pedidos que cambian datos tienen que venir de nuestra propia página (protección CSRF). */
export function exigirMismoOrigen(req: IncomingMessage): void {
  if (req.headers["x-vidriera"] !== "1") throw new ErrorHttp(403, "Pedido no permitido.");
  const origen = req.headers.origin;
  const host = req.headers.host;
  if (origen && host && new URL(origen).host !== host) throw new ErrorHttp(403, "Pedido no permitido.");
}
