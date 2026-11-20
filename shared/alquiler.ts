// Condiciones de un alquiler: lo que el dueño pide y ofrece (garantía, depósito, contrato, mascotas…).
// Desde el DNU 70/2023 casi todo se pacta libremente, así que cada aviso dice las suyas. Todo es opcional.
// Lo usan el formulario, el servidor (para validar y guardar) y la ficha del aviso (para mostrarlo).

export const GARANTIAS = [
  ["propietaria", "Garantía propietaria"],
  ["recibo", "Recibo de sueldo"],
  ["caucion", "Seguro de caución"],
  ["convenir", "A convenir"],
] as const;
export type Garantia = (typeof GARANTIAS)[number][0];

/** Servicios e impuestos que paga el inquilino aparte del alquiler. */
export const SERVICIOS = [
  ["luz", "Luz"],
  ["gas", "Gas"],
  ["agua", "Agua"],
  ["tasa", "Tasa municipal"],
  ["internet", "Internet"],
] as const;
export type Servicio = (typeof SERVICIOS)[number][0];

/** Duración del contrato en meses; 0 = a convenir. */
export const DURACIONES = [12, 24, 36, 0] as const;
/** Cada cuántos meses se ajusta el precio; 0 = a convenir. */
export const AJUSTES = [3, 4, 6, 12, 0] as const;
export const INDICES = ["IPC", "ICL", "convenir"] as const;
export type Indice = (typeof INDICES)[number];
export type SiNo = "si" | "no" | "consultar";
export type Amoblado = "si" | "no" | "parcial";

export interface CondicionesAlquiler {
  garantias: Garantia[];
  /** Meses de depósito (0 = sin depósito). null = no lo dijo. */
  deposito: number | null;
  /** Pide el primer mes por adelantado. */
  adelantado: boolean | null;
  /** Meses de contrato; 0 = a convenir. */
  duracion: number | null;
  /** Ajuste cada N meses; 0 = a convenir. */
  ajuste: number | null;
  indice: Indice | null;
  mascotas: SiNo | null;
  amoblado: Amoblado | null;
  /** "ya" o una fecha AAAA-MM-DD. "" = no lo dijo. */
  disponible: string;
  /** Expensas por mes en pesos: 0 = sin expensas; null = no lo dijo. */
  expensas: number | null;
  /** Lo que paga el inquilino aparte. */
  paga: Servicio[];
  /** Otros requisitos, en palabras del dueño (ej. "ingresos comprobables"). */
  requisitos: string;
}

export const CONDICIONES_VACIAS: CondicionesAlquiler = {
  garantias: [], deposito: null, adelantado: null, duracion: null, ajuste: null, indice: null,
  mascotas: null, amoblado: null, disponible: "", expensas: null, paga: [], requisitos: "",
};

const de = <T extends string | number>(lista: readonly T[], x: unknown): T | null => (lista.includes(x as T) ? (x as T) : null);
const entero = (x: unknown, max: number): number | null => {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

/** Toma lo que venga (formulario, API) y deja solo valores válidos. null si no queda nada. */
export function limpiarCondiciones(x: unknown): CondicionesAlquiler | null {
  if (!x || typeof x !== "object") return null;
  const e = x as Record<string, unknown>;
  const lista = <T extends string>(validos: readonly (readonly [T, string])[], v: unknown): T[] =>
    Array.isArray(v) ? validos.map(([id]) => id).filter((id) => v.includes(id)) : [];
  const fecha = typeof e.disponible === "string" && (e.disponible === "ya" || /^\d{4}-\d{2}-\d{2}$/.test(e.disponible)) ? e.disponible : "";
  const c: CondicionesAlquiler = {
    garantias: lista(GARANTIAS, e.garantias),
    deposito: entero(e.deposito, 6),
    adelantado: typeof e.adelantado === "boolean" ? e.adelantado : null,
    duracion: de(DURACIONES, entero(e.duracion, 120)),
    ajuste: de(AJUSTES, entero(e.ajuste, 24)),
    indice: de(INDICES, e.indice),
    mascotas: de(["si", "no", "consultar"] as const, e.mascotas),
    amoblado: de(["si", "no", "parcial"] as const, e.amoblado),
    disponible: fecha,
    expensas: entero(e.expensas, 99_999_999),
    paga: lista(SERVICIOS, e.paga),
    requisitos: typeof e.requisitos === "string" ? e.requisitos.replace(/\s+/g, " ").trim().slice(0, 200) : "",
  };
  return tieneAlgo(c) ? c : null;
}

export const tieneAlgo = (c: CondicionesAlquiler): boolean =>
  c.garantias.length > 0 || c.paga.length > 0 || !!c.requisitos || !!c.disponible ||
  [c.deposito, c.adelantado, c.duracion, c.ajuste, c.indice, c.mascotas, c.amoblado, c.expensas].some((v) => v !== null);

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombre = <T extends string>(lista: readonly (readonly [T, string])[], id: T): string => lista.find(([k]) => k === id)?.[1] ?? id;
const plata = (n: number): string => `$ ${n.toLocaleString("es-AR")}`;
const unirY = (l: string[]): string => (l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}`);

export const textoDuracion = (m: number): string => (m === 0 ? "A convenir" : m % 12 === 0 ? `${m / 12} ${m === 12 ? "año" : "años"}` : `${m} meses`);
export const textoAjuste = (m: number): string => (m === 0 ? "A convenir" : m === 12 ? "Una vez por año" : `Cada ${m} meses`);
export const textoDisponible = (d: string): string => {
  if (d === "ya") return "Ya";
  const [a, m, dia] = d.split("-").map(Number);
  return a && m && dia ? `Desde el ${dia} de ${MESES[m - 1]}${a !== new Date().getFullYear() ? ` de ${a}` : ""}` : "";
};

/** Renglones para la ficha del aviso: [qué, cómo]. Solo lo que el dueño completó. */
export function renglonesCondiciones(c: CondicionesAlquiler): [string, string][] {
  const r: [string, string][] = [];
  if (c.disponible) r.push(["Disponible", textoDisponible(c.disponible)]);
  if (c.garantias.length) r.push(["Garantía", c.garantias.map((g) => nombre(GARANTIAS, g)).join(" o ")]);
  const entrar = [
    c.deposito !== null ? (c.deposito === 0 ? "Sin depósito" : `${c.deposito} ${c.deposito === 1 ? "mes" : "meses"} de depósito`) : "",
    c.adelantado === true ? "1 mes por adelantado" : c.adelantado === false ? "Sin mes adelantado" : "",
  ].filter(Boolean);
  if (entrar.length) r.push(["Para entrar", entrar.join(" + ")]);
  if (c.duracion !== null) r.push(["Contrato", textoDuracion(c.duracion)]);
  if (c.ajuste !== null || c.indice) {
    const indice = c.indice && c.indice !== "convenir" ? ` por ${c.indice}` : "";
    r.push(["Ajuste", c.ajuste !== null ? `${textoAjuste(c.ajuste)}${indice}` : `Por ${c.indice === "convenir" ? "índice a convenir" : c.indice}`]);
  }
  if (c.expensas !== null) r.push(["Expensas", c.expensas === 0 ? "No tiene" : `${plata(c.expensas)} por mes`]);
  if (c.paga.length) {
    const lista = unirY(c.paga.map((s) => nombre(SERVICIOS, s).toLowerCase()));
    r.push(["Paga el inquilino", lista.charAt(0).toUpperCase() + lista.slice(1)]);
  }
  if (c.mascotas) r.push(["Mascotas", c.mascotas === "si" ? "Se aceptan" : c.mascotas === "no" ? "No se aceptan" : "Consultar"]);
  if (c.amoblado) r.push(["Amoblado", c.amoblado === "si" ? "Sí" : c.amoblado === "no" ? "No" : "En parte"]);
  if (c.requisitos) r.push(["Otros requisitos", c.requisitos]);
  return r;
}

/** Hasta 2 etiquetas para la tarjeta del listado: lo que más filtra a la gente. */
export function etiquetasCondiciones(c: CondicionesAlquiler | null): string[] {
  if (!c) return [];
  const e: string[] = [];
  if (c.garantias.includes("caucion")) e.push("Acepta caución");
  if (c.mascotas === "si") e.push("Con mascotas");
  if (c.amoblado === "si") e.push("Amoblado");
  if (c.disponible === "ya") e.push("Disponible ya");
  return e.slice(0, 2);
}
