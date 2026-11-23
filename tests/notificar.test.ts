// Pruebas de los avisos por Telegram a Felipe (Telegram simulado, sin red).
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearNotificador, textoAvisoNuevo, textoBusquedaNueva, tokenDe } from "../server/notificar.ts";
import type { TelegramApi } from "../server/bot/telegram.ts";

const aviso = { rubro: "inmuebles" as const, operacion: "alquiler" as const, titulo: "Casa 2 dormitorios con patio", precio: 450000, moneda: "ARS" as const, pueblo: "Chabás", nombre: "Laura", telefono: "03464 15 555123" };

function simulado(falla = false) {
  const enviados: { chat: number; texto: string }[] = [];
  const tg: TelegramApi = {
    getUpdates: async () => [],
    sendMessage: async (chat, texto) => {
      if (falla) throw new Error("Telegram sendMessage: error 401");
      enviados.push({ chat, texto });
    },
    descargar: async () => Buffer.alloc(0),
  };
  return { tg, enviados };
}

test("el mensaje de aviso nuevo trae lo necesario para decidir", () => {
  const t = textoAvisoNuevo(aviso, 42, "https://vidrierachabas.ar");
  assert.match(t, /Casa 2 dormitorios/);
  assert.match(t, /Alquiler · Chabás/);
  assert.match(t, /\$ 450\.000/);
  assert.match(t, /wa\.me\/5493464555123/);
  assert.match(t, /n\.° 42/);
  assert.match(t, /https:\/\/vidrierachabas\.ar\/#admin/);
  assert.match(textoAvisoNuevo({ ...aviso, precio: null }, 1, ""), /a consultar/);
});

test("el mensaje de búsqueda no deja renglones vacíos de más", () => {
  const t = textoBusquedaNueva({ rubro: "vehiculos", que: "Busco auto chico hasta 2015", presupuesto: "", nombre: "Juan", telefono: "3464555000" }, "https://x.ar");
  assert.match(t, /Busco auto chico/);
  assert.doesNotMatch(t, /Presupuesto/);
  assert.doesNotMatch(t, /\n\n\n/);
});

test("manda a todos los destinos y respeta el tope por hora", async () => {
  const { tg, enviados } = simulado();
  let reloj = 0;
  const n = crearNotificador(tg, [1, 2], () => reloj);
  for (let i = 0; i < 25; i++) n.avisoNuevo(aviso, i, "");
  await new Promise((r) => setImmediate(r));
  assert.equal(enviados.length, 40); // 20 mensajes x 2 destinos
  reloj = 3_700_000;
  n.busquedaNueva({ rubro: "", que: "algo", presupuesto: "", nombre: "", telefono: "" }, "");
  await new Promise((r) => setImmediate(r));
  assert.match(enviados.at(-1)!.texto, /no te mandé 5 avisos/);
});

test("si Telegram falla, no rompe nada", async () => {
  const { tg } = simulado(true);
  const n = crearNotificador(tg, [1]);
  const original = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => n.avisoNuevo(aviso, 1, ""));
    await new Promise((r) => setImmediate(r));
  } finally {
    console.error = original;
  }
});

test("el token se reconoce aunque se haya pegado con texto de más", () => {
  const t = "123456789:AAbbCCddEEffGGhhIIjjKKllMMnnOOppQQ_-";
  assert.equal(tokenDe(t), t);
  assert.equal(tokenDe(` ${t}\n`), t);
  assert.equal(tokenDe(`TELEGRAM_BOT_TOKEN=${t}\nTELEGRAM_USER_ID=5\nSITE_URL=https://x.ar`), t);
  assert.equal(tokenDe("cualquier cosa"), "");
});
