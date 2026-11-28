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

// ---------- Calendario día por día ----------
// Se guardan solo los días OCUPADOS, como rangos [desde, hasta] (fechas AAAA-MM-DD, las dos incluidas). Si el aviso
// tiene calendario, todo día que no esté en un rango está libre. Si no tiene, se usa lo que haya marcado por quincena.

export interface Calendario {
  ocupado: [string, string][];
  /** Cuándo se tocó por última vez (para mostrar «actualizado hace…»). ISO 8601. */
  actualizado: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esFecha = (x: unknown): x is string => typeof x === "string" && FECHA.test(x) && !Number.isNaN(Date.parse(`${x}T12:00:00Z`));

/** Día siguiente / anterior en AAAA-MM-DD (en UTC, para no depender de la hora del celular). */
export const sumarDias = (f: string, n: number): string => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Une rangos que se tocan o se pisan y los ordena. */
function normalizar(rangos: [string, string][]): [string, string][] {
  const r = rangos.map(([a, b]) => (a <= b ? [a, b] : [b, a]) as [string, string]).sort((x, y) => x[0].localeCompare(y[0]));
  const out: [string, string][] = [];
  for (const [a, b] of r) {
    const ult = out[out.length - 1];
    if (ult && a <= sumarDias(ult[1], 1)) ult[1] = b > ult[1] ? b : ult[1];
    else out.push([a, b]);
  }
  return out;
}

/** Deja solo datos válidos (hasta 80 rangos). undefined = no vino nada (no tocar); null = sin calendario. */
export function limpiarCalendario(x: unknown): Calendario | null | undefined {
  if (x === null) return null;
  if (!x || typeof x !== "object") return undefined;
  const e = x as { ocupado?: unknown; actualizado?: unknown };
  const rangos = (Array.isArray(e.ocupado) ? e.ocupado : [])
    .filter((r): r is [string, string] => Array.isArray(r) && esFecha(r[0]) && esFecha(r[1]))
    .slice(0, 80)
    .map(([a, b]) => [a, b] as [string, string]);
  const actualizado = typeof e.actualizado === "string" && !Number.isNaN(Date.parse(e.actualizado)) ? e.actualizado : new Date().toISOString();
  return { ocupado: normalizar(rangos), actualizado };
}

/** Marca (o libera) los días de `desde` a `hasta`, los dos incluidos. */
export function marcarRango(c: Calendario | null, desde: string, hasta: string, ocupado: boolean): Calendario {
  const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  let rangos = c?.ocupado ?? [];
  if (ocupado) rangos = normalizar([...rangos, [a, b]]);
  else {
    const out: [string, string][] = [];
    for (const [x, y] of rangos) {
      if (y < a || x > b) out.push([x, y]);
      else {
        if (x < a) out.push([x, sumarDias(a, -1)]);
        if (y > b) out.push([sumarDias(b, 1), y]);
      }
    }
    rangos = normalizar(out);
  }
  return { ocupado: rangos, actualizado: new Date().toISOString() };
}

/** Año en que arranca la temporada que corresponde a una fecha (dic 2026 – mar 2027 → 2026). */
export const anioTemporada = (d = new Date()): number => (d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);

/** Días de cada período de quincena, para armar el calendario cuando el dueño solo marcó quincenas. */
function rangoDePeriodo(nombre: string, anio: number): [string, string] | null {
  const s = anio, t = anio + 1;
  const n = nombre.toLowerCase();
  if (n === "diciembre") return [`${s}-12-01`, `${s}-12-31`];
  if (n === "1ª quincena de enero") return [`${t}-01-01`, `${t}-01-15`];
  if (n === "2ª quincena de enero") return [`${t}-01-16`, `${t}-01-31`];
  if (n === "1ª quincena de febrero") return [`${t}-02-01`, `${t}-02-15`];
  if (n === "2ª quincena de febrero") return [`${t}-02-16`, sumarDias(`${t}-03-01`, -1)];
  if (n === "marzo") return [`${t}-03-01`, `${t}-03-31`];
  return null;
}

type ConCalendario = Pick<AvisoPublico, "rubro" | "datos"> & { calendario?: Calendario | null };

/** Estado de un día: "libre", "ocupado" o "" si el aviso no dice nada de esa fecha. */
export function estadoDia(a: ConCalendario, dia: string): "libre" | "ocupado" | "" {
  if (a.rubro !== "vacaciones") return "";
  if (a.calendario) return a.calendario.ocupado.some(([x, y]) => dia >= x && dia <= y) ? "ocupado" : "libre";
  const libres = fechasLibres(a);
  if (!libres.length) return "";
  const anio = Number(dia.slice(0, 4)) - (Number(dia.slice(5, 7)) >= 7 ? 0 : 1);
  const dentro = (n: string) => {
    const r = rangoDePeriodo(n, anio);
    return !!r && dia >= r[0] && dia <= r[1];
  };
  if (libres.some(dentro)) return "libre";
  // Dentro de la temporada (dic–mar) y no marcado como libre: ocupado. Fuera de la temporada: sin dato.
  const temporada = ALMANAQUE.flatMap((m) => m.periodos.map((p) => p.nombre));
  return temporada.some(dentro) ? "ocupado" : "";
}

/** ¿Está libre todas las noches entre llegada y salida? (la noche de la salida no cuenta). */
export function libreEntre(a: ConCalendario, llegada: string, salida: string): boolean {
  if (!esFecha(llegada) || !esFecha(salida) || salida <= llegada) return true;
  for (let d = llegada; d < salida; d = sumarDias(d, 1)) if (estadoDia(a, d) !== "libre") return false;
  return true;
}

/** ¿Tiene algo que mostrar en el calendario? */
export const tieneCalendario = (a: ConCalendario): boolean => a.rubro === "vacaciones" && (!!a.calendario || fechasLibres(a).length > 0);

/** Quincenas/meses de la temporada que están libres enteros (desde el calendario si lo hay; si no, lo que marcó). */
export function periodosLibres(a: ConCalendario): string[] {
  if (a.rubro !== "vacaciones") return [];
  if (!a.calendario) return fechasLibres(a);
  const anio = anioTemporada();
  return ALMANAQUE.flatMap((m) => m.periodos.map((p) => p.nombre)).filter((n) => {
    const r = rangoDePeriodo(n, anio);
    if (!r) return false;
    for (let d = r[0]; d <= r[1]; d = sumarDias(d, 1)) if (estadoDia(a, d) !== "libre") return false;
    return true;
  });
}
