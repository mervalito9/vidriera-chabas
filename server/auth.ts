// Acceso al panel: una sola contraseña de administrador (guardada como hash scrypt en una variable de entorno)
// y sesiones con un token al azar que se guarda hasheado en la base.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db } from "./db.ts";
import { ErrorHttp, leerCookie } from "./http.ts";

const COOKIE = "vidriera_sesion";
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

/** Genera el hash para ADMIN_PASSWORD_HASH. Formato: scrypt:<sal hex>:<hash hex> (sin "$" para que no lo rompa Docker) */
export function hashearClave(clave: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(clave, sal, 64);
  return `scrypt:${sal.toString("hex")}:${hash.toString("hex")}`;
}

export function claveCorrecta(clave: string): boolean {
  const guardado = process.env.ADMIN_PASSWORD_HASH ?? "";
  const [alg, salHex, hashHex] = guardado.split(":");
  if (alg !== "scrypt" || !salHex || !hashHex || hashHex.length < 64) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = scryptSync(clave, Buffer.from(salHex, "hex"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

/** El token se guarda hasheado junto con la contraseña actual: si cambiás la contraseña, todas las sesiones viejas dejan de servir. */
const sha = (t: string): string => createHash("sha256").update(t).update("|").update(process.env.ADMIN_PASSWORD_HASH ?? "").digest("hex");

export function iniciarSesion(res: ServerResponse): void {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DURACION_MS).toISOString();
  db.prepare("DELETE FROM sesiones WHERE expira < ?").run(new Date().toISOString());
  db.prepare("INSERT INTO sesiones (token_hash, expira) VALUES (?, ?)").run(sha(token), expira);
  const seguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${DURACION_MS / 1000}${seguro}`);
}

export function cerrarSesion(req: IncomingMessage, res: ServerResponse): void {
  const token = leerCookie(req, COOKIE);
  if (token) db.prepare("DELETE FROM sesiones WHERE token_hash = ?").run(sha(token));
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`);
}

export function exigirAdmin(req: IncomingMessage): void {
  const token = leerCookie(req, COOKIE);
  if (!token) throw new ErrorHttp(401, "Tenés que entrar al panel.");
  const fila = db.prepare("SELECT expira FROM sesiones WHERE token_hash = ?").get(sha(token)) as { expira: string } | undefined;
  if (!fila || fila.expira < new Date().toISOString()) throw new ErrorHttp(401, "La sesión venció. Entrá de nuevo.");
}
