// Conecta el asistente de Telegram con el sitio. Corre dentro del mismo servidor: publica directo en la base,
// sin un acceso nuevo al panel. Si falta alguna variable, no arranca y el sitio funciona igual.
import { WA_NUMERO } from "../../shared/config.ts";
import { crearAsistente } from "./asistente.ts";
import { crearClaude } from "./claude.ts";
import { crearTelegram } from "./telegram.ts";
import { crearAviso } from "../db.ts";
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
  const clave = process.env.ANTHROPIC_API_KEY ?? "";
  if (permitidos.size === 0 || !clave) {
    console.warn("Asistente de Telegram: falta TELEGRAM_USER_ID o ANTHROPIC_API_KEY, no se activa (los avisos de novedades andan igual).");
    return false;
  }

  const tg = crearTelegram(token);
  const asistente = crearAsistente({
    tg,
    armar: crearClaude(clave, process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"),
    publicar: (aviso) => crearAviso(aviso, guardarFotos(aviso.fotos), { estado: "publicado" }),
    permitidos,
    propio: { nombre: process.env.BOT_NOMBRE_PROPIO || "Felipe", telefono: process.env.BOT_TELEFONO_PROPIO || WA_NUMERO },
    urlSitio: (process.env.SITE_URL ?? "").replace(/\/$/, ""),
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
