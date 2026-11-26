// Conecta el asistente de avisos (mejorar.ts) con la base, las fotos y Telegram.
// Sin ANTHROPIC_API_KEY queda apagado: los avisos llegan igual y Felipe los revisa a mano.
import { SITE_URL } from "./config.ts";
import * as datos from "./db.ts";
import { FOTOS_DIR } from "./db.ts";
import { crearCola, crearMejorador, crearMejoradorOpenRouter, leerFotos } from "./mejorar.ts";
import { notificar } from "./notificar.ts";

// OpenRouter (OPENROUTER_API_KEY) o la API de Claude directa (ANTHROPIC_API_KEY). Si están las dos, va OpenRouter.
const claveOR = (process.env.OPENROUTER_API_KEY ?? "").trim();
const claveAnthropic = (process.env.ANTHROPIC_API_KEY ?? "").trim();
const clave = claveOR || claveAnthropic;
const base = claveOR ? process.env.OPENROUTER_BASE_URL : process.env.ANTHROPIC_BASE_URL;
export const ASISTENTE_ACTIVO = !!clave && (process.env.NODE_ENV !== "test" || !!base);

const cola = ASISTENTE_ACTIVO
  ? crearCola({
      mejorar: claveOR
        ? crearMejoradorOpenRouter(claveOR, process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-5.5", fetch, base || undefined, process.env.OPENROUTER_RESPALDO ?? "deepseek/deepseek-v4.1-flash")
        : crearMejorador(claveAnthropic, process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", fetch, base || undefined),
      leer: (id) => {
        const aviso = datos.obtenerAdmin(id);
        return aviso ? { aviso, fotos: leerFotos(FOTOS_DIR, datos.archivosDe(id)) } : null;
      },
      guardar: datos.guardarMejora,
      avisar: (a, p) => notificar.mejoraLista(a, p, SITE_URL),
    })
  : null;

/** Pide que el asistente ordene un aviso (en segundo plano: no frena al que publica). */
export function mejorarEnSegundoPlano(id: number, pedidoPorFelipe = false): boolean {
  if (!cola) return false;
  cola.encolar(id, pedidoPorFelipe);
  return true;
}

/** Al arrancar: los pendientes que quedaron sin mirar (o a medio mirar) vuelven a la fila. */
export function retomarMejoras(): void {
  if (!cola) return;
  const ids = datos.pendientesSinMejora();
  for (const id of ids) cola.encolar(id);
  console.log(`Asistente de avisos activo${ids.length ? ` (${ids.length} por ordenar)` : ""}.`);
}
