// Avisos de vacaciones: el precio puede ser por noche, semana, quincena o mes, y lo que más pesa es de dónde son
// los dueños (gente del pueblo = confianza). Los dos datos viajan como etiquetas en `datos` ("Precio por noche",
// "Dueños de Chabás"); acá se leen para mostrarlos aparte y se sacan de la lista de chips.
import type { AvisoPublico } from "./tipos.ts";

type ConDatos = Pick<AvisoPublico, "rubro" | "operacion" | "precio" | "datos">;

const POR = /^precio por (noche|semana|quincena|mes)$/i;
const DUENOS = /^dueños de (.+)$/i;
const LIBRE = /^libre: (.+)$/i;

/** Fechas libres que marcó el dueño ("1ª quincena de enero"…), en el orden de la temporada. */
export function fechasLibres(a: Pick<AvisoPublico, "rubro" | "datos">): string[] {
  if (a.rubro !== "vacaciones") return [];
  return a.datos.map((d) => LIBRE.exec(d.trim())?.[1] ?? "").filter(Boolean);
}

/** "1ª quincena de enero" → "1ª ene" (para la tarjeta, donde no hay lugar). */
export const fechaCorta = (f: string): string => f.replace(/quincena de /i, "").replace(/enero/i, "ene").replace(/febrero/i, "feb").replace(/diciembre/i, "dic").replace(/marzo/i, "mar");

/** Región de un destino conocido, para filtrar. Los que no están en la lista van a "Otros destinos". */
const REGIONES: [string, RegExp][] = [
  ["Costa Atlántica", /gesell|mar del plata|pinamar|san bernardo|mar de aj[oó]|santa teresita|miramar|necochea|monte hermoso|san clemente|costa (del este|esmeralda|azul)|cariló|valeria|las toninas|mar de las pampas|claromec[oó]|orense|reta/i],
  ["Sierras de Córdoba", /carlos paz|general belgrano|calamuchita|mina clavero|la cumbre|capilla del monte|la falda|cosqu[ií]n|nono|alta gracia|los reartes|tanti|c[oó]rdoba/i],
  ["Entre Ríos", /federaci[oó]n|col[oó]n|gualeguaych[uú]|concordia|chajar[ií]|victoria|paran[aá]|diamante|entre r[ií]os/i],
  ["San Luis y Mendoza", /merlo|potrero de los funes|san luis|mendoza|uspallata|malarg[uü]e/i],
  ["Patagonia", /bariloche|san mart[ií]n de los andes|villa la angostura|el bols[oó]n|las grutas|puerto madryn|esquel/i],
  ["Santa Fe", /rosario|santa fe|funes|rold[aá]n|granadero baigorria|melincu[eé]/i],
];
export function regionDe(destino: string): string {
  return REGIONES.find(([, re]) => re.test(destino))?.[0] ?? "Otros destinos";
}

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

/** Los datos para mostrar como chips (sin el precio-por, los dueños ni las fechas libres, que van aparte). */
export function datosVisibles(a: Pick<AvisoPublico, "rubro" | "datos">): string[] {
  if (a.rubro !== "vacaciones") return a.datos;
  return a.datos.filter((d) => !POR.test(d.trim()) && !DUENOS.test(d.trim()) && !LIBRE.test(d.trim()));
}

/** Temporada de vacaciones: de noviembre a marzo la sección se destaca en la portada y en la barra del celular. */
export const enTemporada = (d = new Date()): boolean => d.getMonth() >= 10 || d.getMonth() <= 2;

/** Los períodos de la temporada, para el almanaque y el filtro «¿Cuándo te vas?». */
export const ALMANAQUE: { mes: string; periodos: { nombre: string; corto: string }[] }[] = [
  { mes: "Diciembre", periodos: [{ nombre: "diciembre", corto: "Todo el mes" }] },
  { mes: "Enero", periodos: [{ nombre: "1ª quincena de enero", corto: "1 al 15" }, { nombre: "2ª quincena de enero", corto: "16 al 31" }] },
  { mes: "Febrero", periodos: [{ nombre: "1ª quincena de febrero", corto: "1 al 15" }, { nombre: "2ª quincena de febrero", corto: "16 al 28" }] },
  { mes: "Marzo", periodos: [{ nombre: "marzo", corto: "Todo el mes" }] },
];
