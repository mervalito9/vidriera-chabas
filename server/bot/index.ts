// Conecta el asistente de Telegram con el sitio. Corre dentro del mismo servidor: publica directo en la base,
// sin un acceso nuevo al panel. Si falta alguna variable, no arranca y el sitio funciona igual.
import { WA_NUMERO } from "../../shared/config.ts";
import { join } from "node:path";
import { crearAgente, crearModeloOpenRouter, crearTranscriptorOpenRouter } from "./agente.ts";
import { crearAsistente } from "./asistente.ts";
import { crearAccesoSitio } from "./sitio.ts";
import { crearClaude, crearOpenRouter } from "./claude.ts";
import { crearConsultasClaude, crearConsultasOpenRouter } from "./consultas.ts";
import { fotoDelSitio } from "./datosSitio.ts";
import { crearTelegram } from "./telegram.ts";
import { crearAviso, DATA_DIR } from "../db.ts";
import { guardarFotos } from "../imagenes.ts";
import { tokenDe } from "../notificar.ts";

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function iniciarBot(): boolean {
  const token = tokenDe(process.env.TELEGRAM_BOT_TOKEN ?? "");
  if (!token) return false; // el bot es opcional

  const permitidos = new Set(
    (process.env.TELEGRAM_USER_ID ?? "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isSafeInteger(n) && n > 0),
  );
  // OpenRouter (la misma clave que el asistente del panel) o la API de Claude directa.
  const claveOR = (process.env.OPENROUTER_API_KEY ?? "").trim();
  const clave = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (permitidos.size === 0 || (!claveOR && !clave)) {
    console.warn("Asistente de Telegram: falta TELEGRAM_USER_ID o la clave de IA (OPENROUTER_API_KEY), no se activa (los avisos de novedades andan igual).");
    return false;
  }

  const tg = crearTelegram(token);
  const urlSitio = (process.env.SITE_URL ?? "https://vidrierachabas.ar").replace(/\/$/, "");
  const propio = { nombre: process.env.BOT_NOMBRE_PROPIO || "Felipe", telefono: process.env.BOT_TELEFONO_PROPIO || WA_NUMERO };
  // Con OpenRouter: el agente completo (charla con memoria y herramientas). Solo con la clave de Claude: el asistente simple.
  const agente = claveOR
    ? crearAgente({
        tg,
        modelo: crearModeloOpenRouter(claveOR, process.env.BOT_MODEL || process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-5.5", fetch, process.env.OPENROUTER_BASE_URL || undefined, process.env.OPENROUTER_RESPALDO ?? "deepseek/deepseek-v4.1-flash"),
        transcribir: crearTranscriptorOpenRouter(claveOR, process.env.BOT_STT_MODEL || "openai/whisper-large-v3", fetch, process.env.OPENROUTER_BASE_URL || undefined),
        sitio: crearAccesoSitio(urlSitio),
        permitidos,
        propio,
        urlSitio,
        dir: join(DATA_DIR, "bot"),
      })
    : null;
  agente?.retomar();
  const asistente = agente ?? crearAsistente({
    tg,
    armar: claveOR
      ? crearOpenRouter(claveOR, process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-5.5", fetch, process.env.OPENROUTER_BASE_URL || undefined)
      : crearClaude(clave, process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"),
    publicar: (aviso) => crearAviso(aviso, guardarFotos(aviso.fotos), { estado: "publicado" }),
    permitidos,
    propio: { nombre: process.env.BOT_NOMBRE_PROPIO || "Felipe", telefono: process.env.BOT_TELEFONO_PROPIO || WA_NUMERO },
    urlSitio: (process.env.SITE_URL ?? "").replace(/\/$/, ""),
    consultar: claveOR
      ? crearConsultasOpenRouter(claveOR, process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-5.5", fetch, process.env.OPENROUTER_BASE_URL || undefined)
      : crearConsultasClaude(clave, process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"),
    datosSitio: fotoDelSitio,
    esperaAutoMs: 6000,
  });

  void (async () => {
    let offset = 0;
    let espera = 1000;
    for (;;) {
      try {
        const novedades = await tg.getUpdates(offset, 30);
        for (const u of novedades) {
          offset = u.update_id + 1;
          try {
            await asistente.manejar(u);
          } catch (err) {
            console.error(new Date().toISOString(), "bot: error con un mensaje:", err instanceof Error ? err.message : "error");
          }
        }
        espera = 1000;
      } catch (err) {
        console.error(new Date().toISOString(), "bot:", err instanceof Error ? err.message : "error");
        await dormir(espera);
        espera = Math.min(espera * 2, 60_000);
      }
    }
  })();

  console.log(`Bot de Telegram activo para ${permitidos.size} usuario(s).`);
  return true;
}
