// Pruebas del agente de Telegram con una IA simulada: memoria entre reinicios, fotos que no se pierden,
// publicar, sumar fotos a un aviso existente y editar avisos reales en una base temporal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = mkdtempSync(join(tmpdir(), "vidriera-agente-"));
process.env.DATA_DIR = join(base, "datos");
mkdirSync(join(process.env.DATA_DIR, "fotos"), { recursive: true });

const { crearAgente } = await import("../server/bot/agente.ts");
const { crearAccesoSitio } = await import("../server/bot/sitio.ts");
const datos = await import("../server/db.ts");
type MensajeIA = import("../server/bot/agente.ts").MensajeIA;
type RespuestaIA = import("../server/bot/agente.ts").RespuestaIA;
type AccesoSitio = import("../server/bot/agente.ts").AccesoSitio;

const FELIPE = 111;
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);

let nLlamada = 0;
const usar = (name: string, args: Record<string, unknown>): RespuestaIA => ({ texto: "", llamadas: [{ id: `c${++nLlamada}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
const decirIA = (texto: string): RespuestaIA => ({ texto, llamadas: [] });

/** IA de mentira: un guion que decide según lo que ve. Guarda todo lo que recibió. */
type Guion = (msgs: MensajeIA[], ultimoUsuario: string, yaUso: string[]) => RespuestaIA;

function montar(guion: Guion, opciones: { dir?: string; sitio?: Partial<AccesoSitio> } = {}) {
  const dir = opciones.dir ?? mkdtempSync(join(base, "bot-"));
  const dichos: string[] = [];
  const vistos: MensajeIA[][] = [];
  const publicados: { titulo: string; fotos: string[] }[] = [];
  const sumadas: { id: number; fotos: string[] }[] = [];
  const sitio: AccesoSitio = {
    publicar: (a, fotos) => (publicados.push({ titulo: a.titulo, fotos }), 77),
    buscar: () => ({ total: 0, avisos: [] }),
    ver: () => ({}),
    editar: () => "ok",
    agregarFotos: (id, fotos) => (sumadas.push({ id, fotos }), `ok: el aviso ${id} tiene ${fotos.length} fotos más`),
    estadisticas: () => ({ enVivo: 3 }),
    ...opciones.sitio,
  };
  const ag = crearAgente({
    tg: { getUpdates: async () => [], sendMessage: async (_c, t) => void dichos.push(t), descargar: async () => JPG },
    modelo: async (msgs) => {
      vistos.push(structuredClone(msgs));
      const ultimo = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
      // Solo cuentan las herramientas usadas en este turno (después del último mensaje de Felipe).
      const desde = msgs.map((m) => m.role).lastIndexOf("user");
      const enEsteTurno = msgs.slice(desde).flatMap((m) => (m.role === "assistant" && m.tool_calls ? m.tool_calls.map((t) => t.function.name) : []));
      return guion(msgs, String(ultimo), enEsteTurno);
    },
    sitio,
    permitidos: new Set([FELIPE]),
    propio: { nombre: "Felipe", telefono: "5493464626380" },
    urlSitio: "https://vidrierachabas.ar",
    dir,
    esperaTextoMs: 5,
    esperaFotoMs: 5,
  });
  let n = 0;
  const enviar = async (texto: string, de = FELIPE) => {
    await ag.manejar({ update_id: ++n, message: { message_id: n, from: { id: de }, chat: { id: de, type: "private" }, text: texto } });
  };
  const foto = async (caption?: string) => {
    await ag.manejar({ update_id: ++n, message: { message_id: n, from: { id: FELIPE }, chat: { id: FELIPE, type: "private" }, caption, photo: [{ file_id: "g", width: 1280, height: 960, file_size: 200_000 }] } });
  };
  return { ag, dir, enviar, foto, dichos, vistos, publicados, sumadas, esperar: () => ag.esperar() };
}

const PUNTO = { rubro: "vehiculos", tipo: "Auto", operacion: "venta", titulo: "Fiat Punto Essence 1.6 · 2016", precio: 14500000, moneda: "ARS", pueblo: "Chabás", descripcion: "Fiat Punto Essence 1.6, 2016, 98.000 km.", datos: ["Año 2016", "98.000 km"], nombre: "Leo", telefono: "3464401299", faltan: [] };

/** Guion de la charla del Punto. */
const guionPunto: Guion = (_msgs, todo, hechas) => {
  const u = todo.split("Mensajes nuevos de Felipe:").pop() ?? "";
  if (/Fiat Punto/.test(u) && !hechas.includes("actualizar_borrador")) return usar("actualizar_borrador", PUNTO);
  if (hechas.includes("actualizar_borrador")) return decirIA("Te armé la ficha del Punto. ¿La publico?");
  if (/publicalo/i.test(u) && !hechas.includes("publicar_borrador")) return usar("publicar_borrador", {});
  if (hechas.includes("publicar_borrador")) return decirIA("Publicado ✅");
  return decirIA("¿Qué necesitás?");
};

test("ignora a cualquiera que no sea Felipe", async () => {
  const t = montar(guionPunto);
  await t.enviar("hola", 999);
  await t.esperar();
  assert.deepEqual(t.dichos, []);
  assert.equal(t.vistos.length, 0);
});

test("16 fotos + datos: guarda todas, arma la ficha una sola vez (espera la ráfaga) y la muestra", async () => {
  const t = montar(guionPunto);
  for (let i = 0; i < 16; i++) await t.foto();
  await t.enviar("Vendo Fiat Punto Essence 2016, 98 mil km, $14.500.000, Leo 3464401299");
  await t.esperar();
  assert.equal(readdirSync(join(t.dir, "fotos")).length, 16);
  assert.equal(t.vistos.length, 2, "una vuelta con la herramienta y otra para contestar");
  const ficha = t.dichos.find((d) => d.startsWith("📝 FICHA"));
  assert.ok(ficha);
  assert.match(ficha, /Fotos: 16/);
  assert.match(t.dichos[t.dichos.length - 1] ?? "", /¿La publico\?/);
});

test("después de un reinicio se acuerda del borrador, las fotos y la charla", async () => {
  const t = montar(guionPunto);
  for (let i = 0; i < 16; i++) await t.foto();
  await t.enviar("Vendo Fiat Punto Essence 2016, $14.500.000, Leo 3464401299");
  await t.esperar();

  // Se reinicia el servidor: otro agente, misma carpeta.
  const t2 = montar((_m, u) => decirIA(u.includes('"fotos":16') ? "Sí, el Punto tiene las 16 fotos." : "no sé"), { dir: t.dir });
  await t2.enviar("ya cambié el límite, poné las 16 fotos en el anuncio que estábamos armando");
  await t2.esperar();
  const msgs = t2.vistos[0] ?? [];
  const todo = msgs.map((m) => ("content" in m ? m.content : "")).join("\n");
  assert.match(todo, /Vendo Fiat Punto/, "el historial viejo llega a la IA");
  assert.match(todo, /Fiat Punto Essence 1\.6 · 2016/, "el borrador llega en el estado");
  assert.equal(t2.dichos[t2.dichos.length - 1], "Sí, el Punto tiene las 16 fotos.");
});

test("publica con todas las fotos solo después de mostrar la ficha", async () => {
  const t = montar(guionPunto);
  for (let i = 0; i < 16; i++) await t.foto();
  await t.enviar("Vendo Fiat Punto Essence 2016, $14.500.000, Leo 3464401299");
  await t.esperar();
  await t.enviar("publicalo");
  await t.esperar();
  assert.equal(t.publicados.length, 1);
  assert.equal(t.publicados[0]?.fotos.length, 16);
  assert.equal(t.dichos[t.dichos.length - 1], "Publicado ✅");
  assert.equal(readdirSync(join(t.dir, "fotos")).length, 0, "las fotos del bot se limpian al publicar");
});

test("no publica algo que Felipe no vio: si lo cambia y publica en el mismo turno, se frena", async () => {
  const t = montar((_m, _u, hechas) => {
    if (!hechas.length) return usar("actualizar_borrador", PUNTO);
    if (hechas.length === 1) return usar("publicar_borrador", {});
    return decirIA("Te muestro la ficha primero.");
  });
  await t.foto();
  await t.enviar("Vendo Fiat Punto y publicalo de una");
  await t.esperar();
  assert.equal(t.publicados.length, 0);
  const respuestaHerramienta = t.vistos[2]?.find((m) => m.role === "tool" && /no vio la ficha/.test(m.content));
  assert.ok(respuestaHerramienta);
});

test("suma las fotos nuevas a un aviso ya publicado", async () => {
  const t = montar((_m, u, hechas) => (/sumalas/.test(u) && !hechas.length ? usar("agregar_fotos_a_aviso", { id: 15 }) : decirIA("Listo, sumé las 8 fotos al Punto.")));
  for (let i = 0; i < 8; i++) await t.foto();
  await t.enviar("sumalas al punto, el 15");
  await t.esperar();
  assert.equal(t.sumadas[0]?.id, 15);
  assert.equal(t.sumadas[0]?.fotos.length, 8);
  assert.equal(readdirSync(join(t.dir, "fotos")).length, 0);
});

test("si la IA falla, avisa sin perder lo que mandó Felipe", async () => {
  let falla = true;
  const t = montar(() => {
    if (falla) throw new Error("OpenRouter respondió con error 402 (sin crédito)");
    return decirIA("Ahora sí.");
  });
  await t.enviar("¿cuánta gente hay?");
  await t.esperar();
  assert.match(t.dichos[0] ?? "", /sin crédito/);
  falla = false;
  await t.enviar("seguí");
  await t.esperar();
  const todo = (t.vistos[1] ?? []).map((m) => ("content" in m ? m.content : "")).join("\n");
  assert.match(todo, /cuánta gente/);
});

test("/nuevo borra el borrador y sus fotos", async () => {
  const t = montar(guionPunto);
  await t.foto();
  await t.enviar("/nuevo");
  await t.esperar();
  assert.match(t.dichos[t.dichos.length - 1] ?? "", /borré el borrador/);
  assert.equal(readdirSync(join(t.dir, "fotos")).length, 0);
});

test("acceso al sitio real: publica, busca, edita y suma fotos en la base", () => {
  const sitio = crearAccesoSitio("https://vidrierachabas.ar");
  const tmpFotos = mkdtempSync(join(base, "f-"));
  const rutas = Array.from({ length: 3 }, (_, i) => {
    const r = join(tmpFotos, `${i}.jpg`);
    writeFileSync(r, JPG);
    return r;
  });
  const id = sitio.publicar(
    { rubro: "vehiculos", tipo: "Auto", operacion: "venta", titulo: "Fiat Punto Essence 2016", precio: 14500000, moneda: "ARS", pueblo: "Chabás", anunciante: "", quien: "dueno", zona: "", descripcion: "Punto.", datos: [], permuta: false, financia: false, nombre: "Leo", telefono: "3464401299", fotos: [], condiciones: null, lat: null, lng: null },
    rutas,
  );
  assert.equal(datos.archivosDe(id).length, 3);
  const b = sitio.buscar("punto", "") as { avisos: { id: number }[] };
  assert.ok(b.avisos.some((a) => a.id === id));
  assert.match(sitio.editar(id, { precio: 13900000, reservado: true }), /^ok/);
  const a = datos.obtenerAdmin(id);
  assert.equal(a?.precio, 13900000);
  assert.equal(a?.reservado, true);
  assert.equal(a?.fotos.length, 3);
  assert.match(sitio.agregarFotos(id, rutas.slice(0, 2), false), /ahora tiene 5 fotos/);
  assert.equal(datos.archivosDe(id).length, 5);
  assert.match(sitio.editar(9999, { precio: 1 }), /^error/);
});

test("cliente de OpenRouter: manda las herramientas y lee las llamadas", async () => {
  const { crearModeloOpenRouter, HERRAMIENTAS } = await import("../server/bot/agente.ts");
  let cuerpo: Record<string, unknown> = {};
  const f = (async (_url: string, init: RequestInit) => {
    cuerpo = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: "x1", type: "function", function: { name: "ver_estadisticas", arguments: "" } }] } }] }), { status: 200 });
  }) as typeof fetch;
  const r = await crearModeloOpenRouter("k", "anthropic/claude-haiku-5.5", f)([{ role: "user", content: "hola" }], HERRAMIENTAS);
  assert.equal(cuerpo.tool_choice, "auto");
  assert.equal((cuerpo.tools as unknown[]).length, HERRAMIENTAS.length);
  assert.deepEqual(r.llamadas.map((l) => [l.id, l.function.name, l.function.arguments]), [["x1", "ver_estadisticas", "{}"]]);
  const mal = (async () => new Response("no", { status: 402 })) as typeof fetch;
  await assert.rejects(crearModeloOpenRouter("k", "m", mal)([], []), /sin crédito/);
});

test("cliente de OpenRouter: caché automática y modelo de respaldo", async () => {
  const { crearModeloOpenRouter } = await import("../server/bot/agente.ts");
  let cuerpo: Record<string, unknown> = {};
  const f = (async (_url: string, init: RequestInit) => {
    cuerpo = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ model: "deepseek/deepseek-v4.1-flash", choices: [{ message: { content: "hola" } }] }), { status: 200 });
  }) as typeof fetch;
  const r = await crearModeloOpenRouter("k", "anthropic/claude-haiku-5.5", f, undefined, "deepseek/deepseek-v4.1-flash")([{ role: "user", content: "hola" }], []);
  assert.deepEqual(cuerpo.models, ["anthropic/claude-haiku-5.5", "deepseek/deepseek-v4.1-flash"]);
  assert.deepEqual(cuerpo.cache_control, { type: "ephemeral" });
  assert.equal(r.texto, "hola");
  await crearModeloOpenRouter("k", "m", f)([{ role: "user", content: "x" }], []);
  assert.equal(cuerpo.models, undefined, "sin respaldo no manda la lista");
});

test("notas de voz: se pasan a texto y el agente las lee como un mensaje más", async () => {
  const { crearAgente, crearTranscriptorOpenRouter } = await import("../server/bot/agente.ts");
  const dichos: string[] = [];
  const vistos: string[] = [];
  let pedido: Record<string, unknown> = {};
  const f = (async (_u: string, init: RequestInit) => {
    pedido = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ text: "vendo un Punto a catorce millones" }), { status: 200 });
  }) as typeof fetch;
  const mk = (transcribir?: ReturnType<typeof crearTranscriptorOpenRouter>) =>
    crearAgente({
      tg: { getUpdates: async () => [], sendMessage: async (_c, t) => void dichos.push(t), descargar: async () => JPG },
      transcribir,
      modelo: async (msgs) => (vistos.push(msgs.map((m) => ("content" in m ? String(m.content) : "")).join("\n")), decirIA("ok")),
      sitio: { publicar: () => 1, buscar: () => ({}), ver: () => ({}), editar: () => "ok", agregarFotos: () => "ok", estadisticas: () => ({}) },
      permitidos: new Set([FELIPE]), propio: { nombre: "Felipe", telefono: "1" }, urlSitio: "", dir: mkdtempSync(join(base, "voz-")), esperaTextoMs: 5,
    });
  const voz = { update_id: 1, message: { message_id: 1, from: { id: FELIPE }, chat: { id: FELIPE, type: "private" }, voice: { file_id: "v", duration: 8, mime_type: "audio/ogg" } } };

  const sin = mk();
  await sin.manejar(voz);
  assert.match(dichos[0] ?? "", /Todavía no entiendo audios/);

  const con = mk(crearTranscriptorOpenRouter("k", "openai/whisper-large-v3", f));
  await con.manejar(voz);
  await con.esperar();
  assert.equal(pedido.model, "openai/whisper-large-v3");
  assert.equal((pedido.input_audio as { format: string }).format, "ogg");
  assert.match(vistos[0] ?? "", /\[audio\] vendo un Punto a catorce millones/);

  const larga = { ...voz, message: { ...voz.message, voice: { file_id: "v", duration: 900 } } };
  await con.manejar(larga);
  assert.match(dichos[dichos.length - 1] ?? "", /muy largo/);
});
