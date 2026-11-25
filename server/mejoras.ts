// Conecta el asistente de avisos (mejorar.ts) con la base, las fotos y Telegram.
// Sin ANTHROPIC_API_KEY queda apagado: los avisos llegan igual y Felipe los revisa a mano.
import { SITE_URL } from "./config.ts";
import * as datos from "./db.ts";
import { FOTOS_DIR } from "./db.ts";
import { crearCola, crearMejorador, leerFotos } from "./mejorar.ts";
import { notificar } from "./notificar.ts";

const clave = process.env.ANTHROPIC_API_KEY ?? "";
export const ASISTENTE_ACTIVO = !!clave && (process.env.NODE_ENV !== "test" || !!process.env.ANTHROPIC_BASE_URL);

const cola = ASISTENTE_ACTIVO
  ? crearCola({
      mejorar: crearMejorador(clave, process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", fetch, process.env.ANTHROPIC_BASE_URL || undefined),
      leer: (id) => {
        const aviso = datos.obtenerAdmin(id);
        return aviso ? { aviso, fotos: leerFotos(FOTOS_DIR, datos.archivosDe(id)) } : null;
      },
      guardar: datos.guardarMejora,
      avisar: (a, p) => notificar.mejoraLista(a, p, SITE_URL),
    })
  : null;

/** Pide que el asistente ordene un aviso (en segundo plano: no frena al que publica). */
export function mejorarEnSegundoPlano(id: number): boolean {
  if (!cola) return false;
  cola.encolar(id);
  return true;
}

/** Al arrancar: los pendientes que quedaron sin mirar (o a medio mirar) vuelven a la fila. */
export function retomarMejoras(): void {
  if (!cola) return;
  const ids = datos.pendientesSinMejora();
  for (const id of ids) cola.encolar(id);
  console.log(`Asistente de avisos activo${ids.length ? ` (${ids.length} por ordenar)` : ""}.`);
}
