// Configuración del servidor: variables de entorno y topes. Todo lo que se puede ajustar sin tocar código.
import type { IncomingMessage } from "node:http";
import { join, resolve } from "node:path";
import { LIMITES } from "../shared/config.ts";

export const PUERTO = Number(process.env.PORT ?? 3000);
export const WEB_DIR = resolve(process.env.WEB_DIR ?? join(process.cwd(), "web", "dist"));
export const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/$/, "");
/** NOINDEX=0 recién al lanzar: mientras tanto, Google no indexa el sitio. */
export const INDEXAR = process.env.NOINDEX === "0";

/** Pesos por dólar fijos, si se quieren poner a mano (variable DOLAR_REFERENCIA). Sin ella, se usa la cotización oficial (dolar.ts). */
export const DOLAR_FIJO = Math.round(Number(process.env.DOLAR_REFERENCIA)) || 0;

/** Tamaños máximos de lo que se recibe. */
export const MAX_JSON = 1_000_000;
export const MAX_CON_FOTOS = LIMITES.fotos * Math.ceil(LIMITES.fotoBytes * 1.4) + MAX_JSON;

/** Topes para que nadie pueda llenar el disco o la memoria mandando avisos falsos. */
export const MAX_PENDIENTES = 100;
export const MIN_LIBRE_BYTES = 100 * 1024 * 1024; // el volumen de prueba de Railway es de 0,5 GB
export const MAX_SUBIDAS_A_LA_VEZ = 3;

/** Dirección pública del sitio. Si falta SITE_URL, la arma con el pedido (WhatsApp necesita links completos). */
export function sitioDe(req: IncomingMessage): string {
  if (SITE_URL) return SITE_URL;
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return "";
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim() || (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}
