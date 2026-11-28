// Datos destacados guiados: el formulario pregunta año, km, dormitorios… y los guarda como etiquetas
// ("2018", "98.000 km", "3 dormitorios") en la misma lista de datos del aviso. Así las tarjetas
// muestran lo importante sin que el vendedor tenga que pensar qué escribir.
import { PUEBLOS } from "./config.ts";
import { fmtNum, soloDigitos } from "./texto.ts";
import type { RubroId } from "./tipos.ts";

export interface CampoGuiado {
  id: string;
  etiqueta: string;
  /** "numero": se escribe un número; "opciones": se elige; "si": casilla */
  tipo: "numero" | "opciones" | "si";
  opciones?: readonly string[];
  placeholder?: string;
  /** Reconoce la etiqueta guardada (para leerla al editar) */
  reconoce: RegExp;
  /** Arma la etiqueta a partir de lo que eligió; "" = no poner nada */
  armar: (valor: string) => string;
  /** Saca el valor de la etiqueta guardada */
  leer: (etiqueta: string) => string;
}

const numero = (sufijo: (n: number) => string, min = 1, max = 9_999_999) => ({
  armar: (v: string) => { const n = Number(soloDigitos(v)); return n >= min && n <= max ? sufijo(n) : ""; },
  leer: (e: string) => soloDigitos(e),
});
const opcion = (opciones: readonly string[]) => ({
  armar: (v: string) => (opciones.includes(v) ? v : ""),
  leer: (e: string) => opciones.find((o) => o.toLowerCase() === e.toLowerCase()) ?? "",
});
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const ANIO = new Date().getFullYear() + 1;

/** Períodos de la temporada, para marcar fechas libres en los avisos de vacaciones. */
export const PERIODOS = [
  ["dic", "diciembre"], ["ene1", "1ª quincena de enero"], ["ene2", "2ª quincena de enero"],
  ["feb1", "1ª quincena de febrero"], ["feb2", "2ª quincena de febrero"], ["mar", "marzo"],
] as const;

const COMBUSTIBLES = ["Nafta", "Diésel", "GNC", "Nafta y GNC", "Híbrido", "Eléctrico"] as const;
const CAJAS = ["Manual", "Automática"] as const;

export const CAMPOS_GUIADOS: Record<RubroId, CampoGuiado[]> = {
  vehiculos: [
    { id: "anio", etiqueta: "Año", tipo: "numero", placeholder: "Ej: 2018", reconoce: /^(19|20)\d{2}$/, ...numero(String, 1950, ANIO) },
    { id: "km", etiqueta: "Kilómetros", tipo: "numero", placeholder: "Ej: 98000", reconoce: /^[\d.]+\s*km$/i, ...numero((n) => `${fmtNum(n)} km`, 0) },
    { id: "combustible", etiqueta: "Combustible", tipo: "opciones", opciones: COMBUSTIBLES, reconoce: new RegExp(`^(${COMBUSTIBLES.join("|")})$`, "i"), ...opcion(COMBUSTIBLES) },
    { id: "caja", etiqueta: "Caja", tipo: "opciones", opciones: CAJAS, reconoce: /^(manual|automática)$/i, ...opcion(CAJAS) },
  ],
  inmuebles: [
    { id: "dorm", etiqueta: "Dormitorios", tipo: "opciones", opciones: ["1", "2", "3", "4", "5"], reconoce: /^\d+\s+dormitorios?$/i, armar: (v) => (v ? plural(Number(v), "dormitorio", "dormitorios") : ""), leer: (e) => soloDigitos(e) },
    { id: "banos", etiqueta: "Baños", tipo: "opciones", opciones: ["1", "2", "3", "4"], reconoce: /^\d+\s+baños?$/i, armar: (v) => (v ? plural(Number(v), "baño", "baños") : ""), leer: (e) => soloDigitos(e) },
    { id: "m2", etiqueta: "Superficie (m²)", tipo: "numero", placeholder: "Ej: 180", reconoce: /^[\d.]+\s*m²$/i, ...numero((n) => `${fmtNum(n)} m²`, 1, 9_999_999) },
    { id: "cochera", etiqueta: "Cochera", tipo: "si", reconoce: /^cochera$/i, armar: (v) => (v === "si" ? "Cochera" : ""), leer: () => "si" },
  ],
  vacaciones: [
    // Lo que da confianza: de dónde son los dueños. Se muestra aparte, en grande.
    { id: "duenos", etiqueta: "Los dueños son de", tipo: "opciones", opciones: PUEBLOS, reconoce: /^dueños de .+$/i, armar: (v) => (v ? `Dueños de ${v}` : ""), leer: (e) => e.replace(/^dueños de\s+/i, "") },
    { id: "por", etiqueta: "El precio es por", tipo: "opciones", opciones: ["noche", "semana", "quincena", "mes"], reconoce: /^precio por (noche|semana|quincena|mes)$/i, armar: (v) => (v ? `Precio por ${v}` : ""), leer: (e) => e.replace(/^precio por\s+/i, "").toLowerCase() },
    { id: "personas", etiqueta: "¿Para cuántas personas?", tipo: "numero", placeholder: "Ej: 6", reconoce: /^para \d+ personas?$/i, ...numero((n) => `Para ${plural(n, "persona", "personas")}`, 1, 40) },
    { id: "dorm", etiqueta: "Dormitorios", tipo: "opciones", opciones: ["1", "2", "3", "4", "5"], reconoce: /^\d+\s+dormitorios?$/i, armar: (v) => (v ? plural(Number(v), "dormitorio", "dormitorios") : ""), leer: (e) => soloDigitos(e) },
    { id: "banos", etiqueta: "Baños", tipo: "opciones", opciones: ["1", "2", "3", "4"], reconoce: /^\d+\s+baños?$/i, armar: (v) => (v ? plural(Number(v), "baño", "baños") : ""), leer: (e) => soloDigitos(e) },
    { id: "minimo", etiqueta: "Estadía mínima (noches)", tipo: "numero", placeholder: "Ej: 5", reconoce: /^mínimo \d+ noches?$/i, ...numero((n) => `Mínimo ${plural(n, "noche", "noches")}`, 1, 60) },
    { id: "cuadras", etiqueta: "Cuadras al mar, río o centro", tipo: "numero", placeholder: "Ej: 3", reconoce: /^a \d+ cuadras? de/i, ...numero((n) => `A ${plural(n, "cuadra", "cuadras")} del centro o el agua`, 1, 99) },
    ...([["pileta", "Pileta"], ["cochera", "Cochera"], ["aire", "Aire acondicionado"], ["wifi", "Wi-Fi"], ["parrilla", "Parrilla"], ["mascotas", "Acepta mascotas"], ["ropa", "Ropa de cama"]] as const).map(
      ([id, nombre]): CampoGuiado => ({ id, etiqueta: nombre, tipo: "si", reconoce: new RegExp(`^${nombre}$`, "i"), armar: (v) => (v === "si" ? nombre : ""), leer: () => "si" }),
    ),
    // Fechas libres: lo primero que pregunta quien alquila. Se marcan las que están libres; el dueño (o Felipe, o el
    // bot) las saca cuando se alquilan.
    ...PERIODOS.map(([id, nombre]): CampoGuiado => ({ id, etiqueta: `Libre: ${nombre}`, tipo: "si", reconoce: new RegExp(`^libre: ${nombre}$`, "i"), armar: (v) => (v === "si" ? `Libre: ${nombre}` : ""), leer: () => "si" })),
  ],
  agro: [
    { id: "anio", etiqueta: "Año", tipo: "numero", placeholder: "Ej: 2010", reconoce: /^(19|20)\d{2}$/, ...numero(String, 1940, ANIO) },
    { id: "horas", etiqueta: "Horas de uso", tipo: "numero", placeholder: "Ej: 4500", reconoce: /^[\d.]+\s*horas$/i, ...numero((n) => `${fmtNum(n)} horas`, 0) },
  ],
};

/** Separa la lista de datos en lo que corresponde a cada campo guiado y el resto (lo que escribió aparte). */
export function leerGuiados(rubro: RubroId | "", datos: string[]): { valores: Record<string, string>; resto: string[] } {
  const campos = rubro ? CAMPOS_GUIADOS[rubro] : [];
  const valores: Record<string, string> = {};
  const resto: string[] = [];
  for (const d of datos) {
    const c = campos.find((x) => !(x.id in valores) && x.reconoce.test(d.trim()));
    if (c) valores[c.id] = c.leer(d.trim());
    else resto.push(d);
  }
  return { valores, resto };
}

/** Pone (o saca) el valor de un campo guiado, respetando el orden de los campos y lo demás que haya escrito. */
export function escribirGuiado(rubro: RubroId | "", datos: string[], id: string, valor: string): string[] {
  if (!rubro) return datos;
  const campos = CAMPOS_GUIADOS[rubro];
  const { valores, resto } = leerGuiados(rubro, datos);
  valores[id] = valor;
  const guiados = campos.map((c) => (valores[c.id] ? c.armar(valores[c.id]!) : "")).filter(Boolean);
  return [...guiados, ...resto];
}
