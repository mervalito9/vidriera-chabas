// Avisos de vacaciones: el precio puede ser por noche, semana, quincena o mes, y lo que más pesa es de dónde son
// los dueños (gente del pueblo = confianza). Los dos datos viajan como etiquetas en `datos` ("Precio por noche",
// "Dueños de Chabás"); acá se leen para mostrarlos aparte y se sacan de la lista de chips.
import type { AvisoPublico } from "./tipos.ts";

type ConDatos = Pick<AvisoPublico, "rubro" | "operacion" | "precio" | "datos">;

const POR = /^precio por (noche|semana|quincena|mes)$/i;
const DUENOS = /^dueños de (.+)$/i;

/** "por noche", "por mes"… o "" si no corresponde. */
export function sufijoPrecio(a: ConDatos): string {
  if (a.operacion !== "alquiler" || a.precio === null) return "";
  if (a.rubro !== "vacaciones") return "por mes";
  const t = a.datos.find((d) => POR.test(d.trim()));
  return t ? `por ${(POR.exec(t.trim())?.[1] ?? "").toLowerCase()}` : "";
}

/** "Chabás" si el aviso dice "Dueños de Chabás"; "" si no lo dice. */
export function duenosDe(a: Pick<AvisoPublico, "rubro" | "datos">): string {
  if (a.rubro !== "vacaciones") return "";
  const t = a.datos.find((d) => DUENOS.test(d.trim()));
  return t ? (DUENOS.exec(t.trim())?.[1] ?? "").trim() : "";
}

/** Los datos para mostrar como chips (sin el precio-por ni los dueños, que van aparte). */
export function datosVisibles(a: Pick<AvisoPublico, "rubro" | "datos">): string[] {
  if (a.rubro !== "vacaciones") return a.datos;
  return a.datos.filter((d) => !POR.test(d.trim()) && !DUENOS.test(d.trim()));
}
