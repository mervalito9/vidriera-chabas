// Pruebas del backend: levanta el servidor con una base temporal y prueba la API de punta a punta.
// Uso: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashearClave } from "../server/auth.ts";

const PUERTO = 3917;
const URL_BASE = `http://127.0.0.1:${PUERTO}`;
const CLAVE = "clave-de-prueba-larga";
const dir = mkdtempSync(join(tmpdir(), "vidriera-test-"));
let servidor: ChildProcess;
const env = { ...process.env, DATA_DIR: dir, PORT: String(PUERTO), ADMIN_PASSWORD_HASH: hashearClave(CLAVE), NODE_ENV: "test" };
const H = { "x-vidriera": "1", "content-type": "application/json" };
const PNG = `data:image/png;base64,${readFileSync(join(import.meta.dirname, "..", "web", "public", "assets", "img", "favicon-32.png")).toString("base64")}`;

before(async () => {
  await new Promise<void>((ok, mal) => {
    const s = spawn(process.execPath, ["server/seed.ts"], { env, stdio: "ignore" });
    s.on("exit", (c) => (c === 0 ? ok() : mal(new Error("seed falló"))));
  });
  servidor = spawn(process.execPath, ["server/index.ts"], { env, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${URL_BASE}/api/salud`)).ok) return;
    } catch { /* todavía arrancando */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("el servidor no arrancó");
});
after(() => {
  servidor.kill();
  rmSync(dir, { recursive: true, force: true });
});

const aviso = (extra: Record<string, unknown> = {}) => ({ rubro: "vehiculos", tipo: "Auto", titulo: "Gol Trend 2015", precio: "9500", moneda: "USD", nombre: "Laura", telefono: "3464 555123", fotos: [PNG], ...extra });

test("lista los ejemplos sin teléfonos", async () => {
  const r = await (await fetch(`${URL_BASE}/api/avisos?rubro=vehiculos&tipo=Moto`)).json();
  assert.equal(r.total, 2);
  assert.equal(r.soloEjemplos, true);
  assert.ok(!("telefono" in r.avisos[0]));
});

test("filtra por palabra, precio y operación", async () => {
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos?q=pala`)).json()).total, 1);
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos?max=20000&moneda=USD`)).json()).total, 4);
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos?rubro=inmuebles&op=alquiler`)).json()).total, 3);
});

test("los ejemplos no se pueden contactar", async () => {
  const r = await fetch(`${URL_BASE}/api/avisos/1/contacto`, { method: "POST", headers: H });
  assert.equal(r.status, 404);
});

test("rechaza pedidos que cambian datos sin la cabecera propia (CSRF)", async () => {
  const r = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(aviso()) });
  assert.equal(r.status, 403);
});

test("valida los datos y las fotos", async () => {
  const r1 = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: H, body: JSON.stringify(aviso({ titulo: "", telefono: "1" })) });
  assert.equal(r1.status, 422);
  const campos = (await r1.json()).campos.map((c: { campo: string }) => c.campo);
  assert.deepEqual(campos.sort(), ["telefono", "titulo"]);
  const svgDisfrazado = "data:image/png;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64");
  const r2 = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: H, body: JSON.stringify(aviso({ fotos: [svgDisfrazado] })) });
  assert.equal(r2.status, 400);
});

test("publicar → pendiente → aprobar → aparece y oculta los ejemplos", async () => {
  const r = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: H, body: JSON.stringify(aviso()) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.equal((await fetch(`${URL_BASE}/api/avisos/${id}`)).status, 404, "pendiente no se ve");

  assert.equal((await fetch(`${URL_BASE}/api/admin/avisos`, { headers: H })).status, 401);
  assert.equal((await fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: "mala" }) })).status, 401);
  const login = await fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: CLAVE }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  assert.match(cookie, /^vidriera_sesion=/);
  assert.match(login.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Strict/);

  const ok = await fetch(`${URL_BASE}/api/admin/avisos/${id}`, { method: "PATCH", headers: { ...H, cookie }, body: JSON.stringify({ estado: "publicado" }) });
  assert.equal((await ok.json()).estado, "publicado");
  await fetch(`${URL_BASE}/api/admin/avisos/${id}`, { method: "PATCH", headers: { ...H, cookie }, body: JSON.stringify({ precio: "8900" }) });

  const lista = await (await fetch(`${URL_BASE}/api/avisos`)).json();
  assert.equal(lista.soloEjemplos, false);
  assert.equal(lista.total, 1);
  const publico = await (await fetch(`${URL_BASE}/api/avisos/${id}`)).json();
  assert.equal(publico.precio, 8900);
  assert.equal(publico.precioAnterior, 9500, "historial de precios");

  const contacto = await (await fetch(`${URL_BASE}/api/avisos/${id}/contacto`, { method: "POST", headers: H })).json();
  assert.match(contacto.url, /^https:\/\/wa\.me\/5493464555123\?text=/);
});

test("no deja salir de las carpetas públicas", async () => {
  const r = await fetch(`${URL_BASE}/fotos/..%2Fvidriera.db`);
  assert.equal(r.status, 404);
});

test("manda cabeceras de seguridad", async () => {
  const r = await fetch(`${URL_BASE}/api/salud`);
  assert.match(r.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
});
