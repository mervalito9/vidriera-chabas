// Le avisa a Felipe por Telegram cuando alguien publica un aviso o deja una búsqueda.
// Usa el mismo bot que el asistente (TELEGRAM_BOT_TOKEN y TELEGRAM_USER_ID), pero no necesita la clave de Claude.
// Si faltan las variables, no hace nada. Nunca frena ni rompe el pedido del vecino: si Telegram falla, se anota y sigue.
import { RUBROS } from "../shared/config.ts";
import type { AvisoAdmin, NuevaBusqueda, NuevoAviso, PropuestaMejora, RubroId } from "../shared/tipos.ts";
import { numeroWA } from "../shared/whatsapp.ts";
import { crearTelegram, type TelegramApi } from "./bot/telegram.ts";

/** Tope de mensajes por hora: si alguien manda basura en cantidad, el celular no explota. */
const TOPE_POR_HORA = 20;

export interface Notificador {
  avisoNuevo(a: Pick<NuevoAviso, "rubro" | "operacion" | "titulo" | "precio" | "moneda" | "pueblo" | "nombre" | "telefono">, id: number, sitio: string): void;
  busquedaNueva(b: NuevaBusqueda, sitio: string): void;
  mejoraLista(a: AvisoAdmin, p: PropuestaMejora, sitio: string): void;
}

const corto = (s: string, n = 120): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function textoPrecio(precio: number | null, moneda: string): string {
  if (!precio) return "Precio: a consultar";
  return `${moneda === "USD" ? "USD" : "$"} ${precio.toLocaleString("es-AR")}`;
}

function whatsapp(telefono: string): string {
  const d = numeroWA(telefono);
  return d ? `https://wa.me/${d}` : telefono;
}

const OPERACION: Record<string, string> = { venta: "Venta", alquiler: "Alquiler" };

export function textoAvisoNuevo(a: Parameters<Notificador["avisoNuevo"]>[0], id: number, sitio: string): string {
  const rubro = RUBROS[a.rubro as RubroId]?.nombre ?? a.rubro;
  return [
    "📬 Publicaron un aviso nuevo (está pendiente)",
    "",
    `«${corto(a.titulo)}»`,
    `${rubro} · ${OPERACION[a.operacion] ?? a.operacion} · ${a.pueblo}`,
    textoPrecio(a.precio, a.moneda),
    "",
    `De: ${corto(a.nombre, 60)} · ${whatsapp(a.telefono)}`,
    `Aviso n.° ${id}. Aprobalo en ${sitio || "el sitio"}/#admin`,
  ].join("\n");
}

export function textoBusquedaNueva(b: NuevaBusqueda, sitio: string): string {
  const rubro = RUBROS[b.rubro as RubroId]?.nombre ?? b.rubro;
  return [
    "🔎 Alguien dejó una búsqueda",
    "",
    `${rubro ? `${rubro}: ` : ""}${corto(b.que, 300)}`,
    b.presupuesto ? `Presupuesto: ${corto(b.presupuesto, 80)}` : "",
    "",
    `De: ${corto(b.nombre, 60) || "sin nombre"} · ${whatsapp(b.telefono)}`,
    `La ves en ${sitio || "el sitio"}/#admin`,
  ]
    .filter((l, i, todas) => l !== "" || todas[i - 1] !== "")
    .join("\n");
}

export function textoMejoraLista(a: AvisoAdmin, p: PropuestaMejora, sitio: string): string {
  return [
    `✨ Ordené el aviso n.° ${a.id}`,
    "",
    `Antes: «${corto(a.titulo)}»`,
    `Ahora: «${corto(p.titulo)}»`,
    p.cambios.length ? `Cambios: ${corto(p.cambios.join(" · "), 300)}` : "",
    p.faltan.length ? `Falta: ${p.faltan.map((f) => f.que).join(", ")}` : "No falta nada importante.",
    p.notasFotos ? `Fotos: ${corto(p.notasFotos, 200)}` : "",
    "",
    `Revisalo y publicalo en ${sitio || "el sitio"}/#admin--editar-${a.id}`,
  ]
    .filter((l, i, todas) => l !== "" || todas[i - 1] !== "")
    .join("\n");
}

export function crearNotificador(tg: TelegramApi, destinos: number[], ahora: () => number = Date.now): Notificador {
  let ventana = 0;
  let enviados = 0;
  let callados = 0;

  function mandar(texto: string): void {
    const t = ahora();
    if (t - ventana > 3_600_000) {
      if (callados > 0) texto = `(En la última hora no te mandé ${callados} avisos más por el tope. Revisá el panel.)\n\n${texto}`;
      ventana = t;
      enviados = 0;
      callados = 0;
    }
    if (enviados >= TOPE_POR_HORA) {
      callados++;
      return;
    }
    enviados++;
    for (const chat of destinos) {
      tg.sendMessage(chat, texto).catch((err: unknown) => {
        console.error(new Date().toISOString(), "aviso por Telegram:", err instanceof Error ? err.message : "error");
      });
    }
  }

  return {
    avisoNuevo: (a, id, sitio) => mandar(textoAvisoNuevo(a, id, sitio)),
    busquedaNueva: (b, sitio) => mandar(textoBusquedaNueva(b, sitio)),
    mejoraLista: (a, p, sitio) => mandar(textoMejoraLista(a, p, sitio)),
  };
}

const NADA: Notificador = { avisoNuevo: () => {}, busquedaNueva: () => {}, mejoraLista: () => {} };

/** Saca el token aunque la variable traiga texto de más (por ejemplo, si se pegó "TELEGRAM_BOT_TOKEN=..." con otras líneas). */
export function tokenDe(valor: string): string {
  return /\d{6,}:[A-Za-z0-9_-]{30,}/.exec(valor)?.[0] ?? "";
}

function desdeEntorno(): Notificador {
  const token = tokenDe(process.env.TELEGRAM_BOT_TOKEN ?? "");
  const destinos = (process.env.TELEGRAM_USER_ID ?? "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  if (!token || destinos.length === 0 || process.env.NODE_ENV === "test") return NADA;
  console.log("Avisos por Telegram activos.");
  return crearNotificador(crearTelegram(token), destinos);
}

export const notificar: Notificador = desdeEntorno();
