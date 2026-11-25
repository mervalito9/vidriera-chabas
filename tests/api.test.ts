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

const aviso = (extra: Record<string, unknown> = {}) => ({ rubro: "vehiculos", tipo: "Auto", titulo: "Gol Trend 2015", precio: "9500", moneda: "USD", pueblo: "Chabás", nombre: "Laura", telefono: "3464 555123", fotos: [PNG], ...extra });

test("lista los ejemplos sin teléfonos", async () => {
  const r = await (await fetch(`${URL_BASE}/api/avisos?rubro=vehiculos&tipo=Moto`)).json();
  assert.equal(r.total, 2);
  assert.equal(r.soloEjemplos, true);
  assert.ok(!("telefono" in r.avisos[0]));
});

test("filtra por palabra, precio y operación", async () => {
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos?q=pala`)).json()).total, 1);
  // "Hasta USD 20.000" también trae lo que está en pesos y cuesta menos que eso (con el dólar de referencia).
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos?max=20000&moneda=USD`)).json()).total, 10);
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos?max=1000000&moneda=ARS`)).json()).total, 4);
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos?rubro=inmuebles&op=alquiler`)).json()).total, 4);
});

test("filtro de pueblo: filtra y se combina con los demás filtros", async () => {
  const total = async (q: string) => (await (await fetch(`${URL_BASE}/api/avisos?${q}`)).json()).total as number;
  const todos = await total("");
  assert.equal(todos, 13);
  const porPueblo = await Promise.all(["Chabás", "Casilda", "Firmat", "Sanford", "Villada"].map((p) => total(`pueblo=${encodeURIComponent(p)}`)));
  assert.deepEqual(porPueblo, [7, 2, 2, 1, 1]);
  assert.equal(porPueblo.reduce((a, b) => a + b, 0), todos, "cada aviso está en un pueblo");
  assert.equal(await total(`pueblo=${encodeURIComponent("Chabás")}&rubro=inmuebles&op=alquiler`), 2);
  assert.equal(await total(`pueblo=${encodeURIComponent("Chabás")}&rubro=vehiculos&tipo=Moto`), 1);
  assert.equal(await total(`pueblo=Sanford&rubro=inmuebles&op=alquiler`), 1);
  assert.equal(await total(`pueblo=Sanford&rubro=vehiculos`), 0);
  assert.equal(await total(`pueblo=Firmat&max=20000&moneda=USD`), 1);
  assert.equal(await total(`pueblo=Casilda&max=20000&moneda=USD`), 2);
  assert.equal(await total(`pueblo=${encodeURIComponent("Chabás")}&q=galpon`), 1);
  assert.equal(await total("pueblo=otro"), 0);
  assert.equal(await total("pueblo=Inventado"), 13, "un pueblo desconocido no filtra");
  const sanford = (await (await fetch(`${URL_BASE}/api/avisos?pueblo=Sanford`)).json()).avisos[0];
  assert.equal(sanford.pueblo, "Sanford");
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
  const r1 = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: H, body: JSON.stringify(aviso({ titulo: "", telefono: "1", pueblo: "" })) });
  assert.equal(r1.status, 422);
  const campos = (await r1.json()).campos.map((c: { campo: string }) => c.campo);
  assert.deepEqual(campos.sort(), ["pueblo", "telefono", "titulo"]);
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

test("Don Roberto vive en Chabás y publica la casa de Sanford; otro publica en un pueblo fuera de la lista", async () => {
  const login = await fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: CLAVE }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  // Escribe "sanford" en minúscula: queda guardado como "Sanford" (el de la lista)
  const casa = aviso({ rubro: "inmuebles", tipo: "Casa", titulo: "Casa que era de mi madre", precio: "45000", pueblo: "sanford", nombre: "Roberto", telefono: "3464 400000" });
  const r1 = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: H, body: JSON.stringify(casa) });
  assert.equal(r1.status, 201);
  const id1 = (await r1.json()).id;
  const r2 = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: H, body: JSON.stringify(aviso({ titulo: "Auto en Arequito", pueblo: "Arequito" })) });
  const id2 = (await r2.json()).id;
  for (const id of [id1, id2]) {
    const ok = await fetch(`${URL_BASE}/api/admin/avisos/${id}`, { method: "PATCH", headers: { ...H, cookie }, body: JSON.stringify({ estado: "publicado" }) });
    assert.equal(ok.status, 200);
  }
  const ficha = await (await fetch(`${URL_BASE}/api/avisos/${id1}`)).json();
  assert.equal(ficha.pueblo, "Sanford");
  const total = async (q: string) => (await (await fetch(`${URL_BASE}/api/avisos?${q}`)).json()).total as number;
  assert.equal(await total("pueblo=Sanford"), 1);
  assert.equal(await total("pueblo=Sanford&rubro=vehiculos"), 0);
  assert.equal(await total(`pueblo=${encodeURIComponent("Chabás")}`), 1, "el auto del test anterior");
  const otros = await (await fetch(`${URL_BASE}/api/avisos?pueblo=otro`)).json();
  assert.equal(otros.total, 1);
  assert.equal(otros.avisos[0].pueblo, "Arequito");
  // la búsqueda por palabra también encuentra el pueblo
  assert.equal(await total("q=sanford"), 1);
});

test("el panel edita todo: datos, y fotos (sacar, agregar, reordenar)", async () => {
  const login = await fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: CLAVE }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const HA = { ...H, cookie };
  const creado = await (await fetch(`${URL_BASE}/api/admin/avisos`, { method: "POST", headers: HA, body: JSON.stringify(aviso({ titulo: "Para editar", fotos: [PNG, PNG] })) })).json();
  assert.equal(creado.fotos.length, 2);
  const [f1, f2] = creado.fotos as string[];

  // reordena, saca ninguna y agrega una nueva; cambia título, zona y datos
  const r = await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}`, {
    method: "PUT", headers: HA,
    body: JSON.stringify(aviso({ titulo: "Editado completo", zona: "Barrio Norte", datos: ["Impecable"], precio: "7000", fotos: [f2, PNG, f1] })),
  });
  assert.equal(r.status, 200);
  const e = await r.json();
  assert.equal(e.titulo, "Editado completo");
  assert.equal(e.zona, "Barrio Norte");
  assert.deepEqual(e.datos, ["Impecable"]);
  assert.equal(e.fotos.length, 3);
  assert.equal(e.fotos[0], f2);
  assert.equal(e.fotos[2], f1);

  // saca dos fotos: las viejas se borran del disco
  const r2 = await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}`, { method: "PUT", headers: HA, body: JSON.stringify(aviso({ titulo: "Editado completo", fotos: [f1] })) });
  const e2 = await r2.json();
  assert.deepEqual(e2.fotos, [f1]);
  assert.equal((await fetch(`${URL_BASE}${f1}`)).status, 200);
  assert.equal((await fetch(`${URL_BASE}${f2}`)).status, 404);

  // no se pueden "robar" fotos de otro aviso ni sin sesión
  const otra = await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}`, { method: "PUT", headers: HA, body: JSON.stringify(aviso({ fotos: ["/fotos/vehiculo-ejemplo.jpg"] })) });
  assert.equal(otra.status, 400);
  assert.equal((await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}`, { method: "PUT", headers: H, body: JSON.stringify(aviso()) })).status, 401);
});

test("baja todas las fotos de un aviso en un zip, solo con sesión", async () => {
  const login = await fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: CLAVE }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const creado = await (await fetch(`${URL_BASE}/api/admin/avisos`, { method: "POST", headers: { ...H, cookie }, body: JSON.stringify(aviso({ fotos: [PNG, PNG, PNG] })) })).json();
  assert.equal((await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}/fotos.zip`)).status, 401);
  const r = await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}/fotos.zip`, { headers: { cookie } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/zip");
  const zip = Buffer.from(await r.arrayBuffer());
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(zip.length - 22 + 10), 3, "3 fotos adentro");
  assert.ok(zip.includes(Buffer.from(`aviso-${creado.id}-foto-1.png`)));
});

test("la copia de seguridad trae la base y las fotos, solo con sesión", async () => {
  assert.equal((await fetch(`${URL_BASE}/api/admin/copia`)).status, 401);
  const login = await fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: CLAVE }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const r = await fetch(`${URL_BASE}/api/admin/copia`, { headers: { cookie } });
  assert.equal(r.status, 200);
  const zip = Buffer.from(await r.arrayBuffer());
  assert.ok(zip.includes(Buffer.from("vidriera.db")));
  assert.ok(zip.includes(Buffer.from("SQLite format 3")));
  assert.ok(zip.readUInt16LE(zip.length - 22 + 10) > 5, "base + fotos");
});

test("pedidos raros no rompen el servidor", async () => {
  assert.equal((await fetch(`${URL_BASE}/fotos/%E0%A4%A`)).status, 404);
  assert.equal((await fetch(`${URL_BASE}/api/admin/sesion`, { headers: { cookie: "vidriera_sesion=%E0%A4%A" } })).status, 200);
  const r = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: { ...H, origin: "null" }, body: "{}" });
  assert.equal(r.status, 403);
  const otro = await fetch(`${URL_BASE}/api/publicaciones`, { method: "POST", headers: { ...H, origin: "https://otro-sitio.com" }, body: "{}" });
  assert.equal(otro.status, 403);
});

test("una sesión inventada no entra al panel", async () => {
  const r = await fetch(`${URL_BASE}/api/admin/avisos`, { headers: { ...H, cookie: "vidriera_sesion=inventado123" } });
  assert.equal(r.status, 401);
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

test("estadísticas: cuenta una vez por persona y día, sin robots ni el panel", async () => {
  const login = await fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: CLAVE }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const creado = await (await fetch(`${URL_BASE}/api/admin/avisos`, { method: "POST", headers: { ...H, cookie }, body: JSON.stringify(aviso({ titulo: "Amarok V6 para estadísticas" })) })).json();
  const id = creado.id as number;
  const antes = await (await fetch(`${URL_BASE}/api/admin/estadisticas?dias=7`, { headers: { cookie } })).json();
  const navA = { ...H, "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile" };
  const navB = { ...H, "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1" };
  const m = (h: Record<string, string>, b: unknown) => fetch(`${URL_BASE}/api/m`, { method: "POST", headers: h, body: JSON.stringify(b) });
  // Persona A entra desde WhatsApp, ve el aviso dos veces y lo contacta dos veces
  assert.equal((await m(navA, { t: "pv", aviso: null, de: "wa", ref: "" })).status, 204);
  await m(navA, { t: "pv", aviso: id, de: "", ref: "" });
  await m(navA, { t: "pv", aviso: id, de: "", ref: "" });
  await fetch(`${URL_BASE}/api/avisos/${id}/contacto`, { method: "POST", headers: navA });
  await fetch(`${URL_BASE}/api/avisos/${id}/contacto`, { method: "POST", headers: navA });
  // Persona B llega de Google, busca algo que no hay
  await m(navB, { t: "pv", aviso: id, de: "", ref: "https://www.google.com/" });
  await m(navB, { t: "busca", q: "Tractor Hanomag", n: 0 });
  await m(navB, { t: "busca", q: "3464555123", n: 0 }); // un teléfono: no se guarda
  // Un robot y Felipe con el panel abierto: no cuentan
  await m({ ...H, "user-agent": "Googlebot/2.1" }, { t: "pv", aviso: id });
  await m({ ...H, "user-agent": "Mozilla/5.0 Felipe", cookie }, { t: "pv", aviso: id });
  await fetch(`${URL_BASE}/api/avisos/${id}/contacto`, { method: "POST", headers: { ...H, cookie, "user-agent": "Mozilla/5.0 Felipe" } });

  const r = await (await fetch(`${URL_BASE}/api/admin/estadisticas?dias=7`, { headers: { cookie } })).json();
  assert.equal(r.total.personas - antes.total.personas, 2);
  assert.equal(r.total.vistas - antes.total.vistas, 2);
  assert.equal(r.total.contactos - antes.total.contactos, 1);
  const fila = r.avisos.find((a: { id: number }) => a.id === id);
  assert.deepEqual([fila.vistas, fila.contactos], [2, 1]);
  const origen = (n: string) => r.origenes.find((o: { nombre: string }) => o.nombre === n)?.n ?? 0;
  assert.ok(origen("WhatsApp") >= 1 && origen("Google") >= 1);
  assert.deepEqual(r.sinResultados.map((b: { texto: string }) => b.texto), ["tractor hanomag"]);
  assert.equal(r.serie.length, 7);
  // El contador del aviso también se mueve igual
  const adm = (await (await fetch(`${URL_BASE}/api/admin/avisos?estado=publicado`, { headers: { cookie } })).json()).find((a: { id: number }) => a.id === id);
  assert.deepEqual([adm.vistas, adm.contactos], [2, 1]);
  // Sin sesión, no se ven
  assert.equal((await fetch(`${URL_BASE}/api/admin/estadisticas`)).status, 401);
});

test("sitio: comprime, 404 con diseño y vista previa de WhatsApp con links completos", async () => {
  const js = await fetch(`${URL_BASE}/assets/app.js`, { headers: { "accept-encoding": "br" } });
  assert.equal(js.headers.get("content-encoding"), "br");
  assert.equal(js.headers.get("vary"), "Accept-Encoding");
  const nada = await fetch(`${URL_BASE}/no-existe`);
  assert.equal(nada.status, 404);
  assert.match(await nada.text(), /Esta página no existe/);
  const lista = await (await fetch(`${URL_BASE}/api/avisos`)).json();
  const id = lista.avisos[0].id;
  const html = await (await fetch(`${URL_BASE}/a/${id}?de=wa`, { headers: { "x-forwarded-proto": "https", "x-forwarded-host": "vidrierachabas.ar" } })).text();
  assert.match(html, /og:image" content="https:\/\/vidrierachabas\.ar\//);
  assert.match(html, /url=\/\?de=wa#aviso--/);
  const raro = await (await fetch(`${URL_BASE}/a/${id}`, { headers: { "x-forwarded-host": "malo\"><script>" } })).text();
  assert.doesNotMatch(raro, /<script>/);
});

test("listado: ordenar por precio mezcla dólares y pesos con el dólar de referencia", async () => {
  const r = await (await fetch(`${URL_BASE}/api/avisos?orden=barato&limite=100`)).json();
  assert.ok(r.dolar > 0);
  const enPesos = r.avisos.filter((a: { precio: number | null }) => a.precio !== null).map((a: { precio: number; moneda: string }) => (a.moneda === "USD" ? a.precio * r.dolar : a.precio));
  assert.deepEqual(enPesos, [...enPesos].sort((x: number, y: number) => x - y));
});

test("alquiler: las condiciones se guardan, se editan y no quedan en una venta", async () => {
  const cookie = await sesionAdmin();
  const base = { rubro: "inmuebles", tipo: "Casa", titulo: "Casa en alquiler con patio", precio: "450000", moneda: "ARS", pueblo: "Chabás", nombre: "Ana", telefono: "3464401234", fotos: [] };
  const condiciones = { garantias: ["caucion"], deposito: 1, duracion: 24, mascotas: "si", expensas: 0 };
  const creado = await (await fetch(`${URL_BASE}/api/admin/avisos`, { method: "POST", headers: { ...H, cookie }, body: JSON.stringify({ ...base, operacion: "alquiler", condiciones }) })).json();
  assert.deepEqual(creado.condiciones.garantias, ["caucion"]);
  assert.equal(creado.condiciones.expensas, 0);
  const publico = await (await fetch(`${URL_BASE}/api/avisos/${creado.id}`)).json();
  assert.equal(publico.condiciones.mascotas, "si");
  const editado = await (await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}`, { method: "PUT", headers: { ...H, cookie }, body: JSON.stringify({ ...base, operacion: "alquiler", condiciones: { ...condiciones, mascotas: "no" } }) })).json();
  assert.equal(editado.condiciones.mascotas, "no");
  const venta = await (await fetch(`${URL_BASE}/api/admin/avisos/${creado.id}`, { method: "PUT", headers: { ...H, cookie }, body: JSON.stringify({ ...base, operacion: "venta", condiciones }) })).json();
  assert.equal(venta.condiciones, null, "una venta no lleva condiciones de alquiler");
});

test("quién publica: el dueño se ve por su primer nombre y un negocio por su nombre", async () => {
  const cookie = await sesionAdmin();
  const base = { rubro: "vehiculos", tipo: "Auto", operacion: "venta", titulo: "Fiat Palio 2015", precio: "9000000", moneda: "ARS", pueblo: "Chabás", telefono: "3464401234", fotos: [] };
  const negocio = await (await fetch(`${URL_BASE}/api/admin/avisos`, { method: "POST", headers: { ...H, cookie }, body: JSON.stringify({ ...base, nombre: "Carlos", quien: "agencia", anunciante: "Agencia Di Giovanni" }) })).json();
  const pub = await (await fetch(`${URL_BASE}/api/avisos/${negocio.id}`)).json();
  assert.equal(pub.publica, "Agencia Di Giovanni");
  assert.equal(pub.quien, "agencia");
  assert.equal(pub.nombre, undefined, "el nombre completo del contacto no viaja a la página pública");
  const dueno = await (await fetch(`${URL_BASE}/api/admin/avisos`, { method: "POST", headers: { ...H, cookie }, body: JSON.stringify({ ...base, nombre: "María José Pérez", quien: "dueno", anunciante: "" }) })).json();
  assert.equal((await (await fetch(`${URL_BASE}/api/avisos/${dueno.id}`)).json()).publica, "María");
});

test("se buscan: solo se ve lo que Felipe muestra, sin datos de contacto, juntando las iguales y respetando el permiso", async () => {
  const cookie = await sesionAdmin();
  const H2 = { ...H, cookie };
  const lista = async () => (await (await fetch(`${URL_BASE}/api/se-buscan`)).json()) as { titulo: string; detalle: string; directo: boolean; cuantas: number }[];
  assert.deepEqual(await lista(), []); // nada se muestra solo

  // Una búsqueda de un vecino SIN permiso: no se puede mostrar
  const sin = await (await fetch(`${URL_BASE}/api/busquedas`, { method: "POST", headers: H, body: JSON.stringify({ rubro: "Terreno", que: "Terreno cerca del centro", nombre: "Ana", telefono: "3464111222" }) })).json();
  const mostrar = (id: number, publica: boolean) => fetch(`${URL_BASE}/api/admin/busquedas/${id}`, { method: "PATCH", headers: H2, body: JSON.stringify({ publica }) });
  assert.equal((await mostrar(sin.id, true)).status, 409);
  assert.deepEqual(await lista(), []);

  // Con permiso sí; y nunca salen el nombre ni el teléfono
  const con = await (await fetch(`${URL_BASE}/api/busquedas`, { method: "POST", headers: H, body: JSON.stringify({ rubro: "Galpón o local", que: "Local en esquina", nombre: "Beto", telefono: "3464333444", permiso: true }) })).json();
  assert.equal((await mostrar(con.id, true)).status, 200);
  let v = await lista();
  assert.equal(v.length, 1);
  assert.equal(v[0]?.titulo, "Local en esquina");
  assert.ok(!JSON.stringify(v).match(/Beto|3464333444|telefono|nombre/));

  // Felipe carga dos iguales a mano: se juntan en una sola con "2 personas"
  const nueva = { rubro: "inmuebles", titulo: "Alquiler de casa o dpto", detalle: "1 o 2 habitaciones", directo: true };
  for (let i = 0; i < 2; i++) assert.equal((await fetch(`${URL_BASE}/api/admin/busquedas`, { method: "POST", headers: H2, body: JSON.stringify(nueva) })).status, 201);
  v = await lista();
  assert.equal(v.length, 2);
  const casa = v.find((x) => x.titulo === "Alquiler de casa o dpto");
  assert.equal(casa?.cuantas, 2);
  assert.equal(casa?.directo, true);

  // Datos mal puestos y sin sesión
  assert.equal((await fetch(`${URL_BASE}/api/admin/busquedas`, { method: "POST", headers: H2, body: JSON.stringify({ rubro: "inmuebles", titulo: "x" }) })).status, 422);
  assert.equal((await fetch(`${URL_BASE}/api/admin/busquedas`, { method: "POST", headers: H, body: JSON.stringify(nueva) })).status, 401);

  // Ocultar la saca; el panel la sigue viendo
  assert.equal((await mostrar(con.id, false)).status, 200);
  assert.equal((await lista()).length, 1);
  const panel = (await (await fetch(`${URL_BASE}/api/admin/busquedas`, { headers: H2 })).json()) as { id: number; permiso: boolean; publicaDesde: string | null }[];
  assert.equal(panel.find((b) => b.id === con.id)?.publicaDesde, null);
  assert.equal(panel.find((b) => b.id === sin.id)?.permiso, false);
});

test("estadísticas: cuántos pasan de la portada (una vez por persona y día)", async () => {
  const cookie = await sesionAdmin();
  const m = (ua: string, b: unknown) => fetch(`${URL_BASE}/api/m`, { method: "POST", headers: { ...H, "user-agent": ua }, body: JSON.stringify({ t: "pv", aviso: null, de: "", ref: "", ...(b as object) }) });
  const ver = async () => (await (await fetch(`${URL_BASE}/api/admin/estadisticas?dias=7`, { headers: { cookie } })).json()).portada as { entran: number; siguen: number };
  const antes = await ver();
  const uaA = "Mozilla/5.0 (Linux; Android 13) Portada-A", uaB = "Mozilla/5.0 (iPhone) Portada-B", uaC = "Mozilla/5.0 (iPhone) Portada-C";
  // A entra por la portada y abre un listado y un aviso: cuenta una sola vez como "sigue"
  await m(uaA, { p: "inicio", ent: true });
  await m(uaA, { p: "inmuebles", ent: false });
  await m(uaA, { p: "aviso", ent: false });
  // B entra por la portada y se va
  await m(uaB, { p: "inicio", ent: true });
  // C entra directo a un aviso (link de WhatsApp): no cuenta para la portada
  await m(uaC, { p: "aviso", ent: true });
  await m(uaC, { p: "inicio", ent: false });
  const despues = await ver();
  assert.equal(despues.entran - antes.entran, 2);
  assert.equal(despues.siguen - antes.siguen, 1);
});

/** Una sola entrada al panel para las pruebas de abajo (el servidor limita los intentos de login). */
let sesion: Promise<string> | null = null;
function sesionAdmin(): Promise<string> {
  sesion ??= fetch(`${URL_BASE}/api/admin/login`, { method: "POST", headers: H, body: JSON.stringify({ clave: CLAVE }) })
    .then((r) => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "");
  return sesion;
}
