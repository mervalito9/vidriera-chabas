// Dólar de referencia: solo sirve para ordenar y filtrar por precio mezclando avisos en USD y en $.
// No tiene que ser exacto. Se toma el oficial (venta) de dolarapi.com cada 6 horas; si falla, queda el último conocido.
// Con la variable DOLAR_REFERENCIA se fija a mano y no se consulta nada.
import { DOLAR_FIJO } from "./config.ts";

const FUENTE = "https://dolarapi.com/v1/dolares/oficial";
const CADA = 6 * 60 * 60_000;
/** Valor inicial y de respaldo (oficial de mediados de noviembre de 2026, redondeado). */
const RESPALDO = 1550;

let actual = DOLAR_FIJO || RESPALDO;

export const dolar = (): number => actual;

async function actualizar(): Promise<void> {
  try {
    const r = await fetch(FUENTE, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`respondió ${r.status}`);
    const venta = Number(((await r.json()) as { venta?: unknown }).venta);
    // Un valor fuera de rango es un error de la fuente: mejor seguir con el anterior.
    if (!Number.isFinite(venta) || venta < 100 || venta > 1_000_000) throw new Error(`valor raro: ${venta}`);
    actual = Math.round(venta);
  } catch (err) {
    console.warn(new Date().toISOString(), "Dólar de referencia: no se pudo actualizar, sigo con", actual, "-", err instanceof Error ? err.message : err);
  }
}

/** Empieza a seguir la cotización (no hace nada si el dólar está fijo o en las pruebas). */
export function seguirDolar(): void {
  if (DOLAR_FIJO || process.env.NODE_ENV === "test") return;
  void actualizar();
  setInterval(() => void actualizar(), CADA).unref();
}
