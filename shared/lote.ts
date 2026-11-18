// Lee las "fichas" de avisos (texto plano, una por aviso) y las convierte en avisos para cargar al panel.
// Formato de cada ficha (lo arma el chat de IA con el prompt de Felipe):
//   AVISO 01
//   Rubro: Inmuebles
//   Tipo: Casa
//   ...
//   Fotos: 01-1 (frente), 01-2 (cocina)
// Es tolerante: acepta asteriscos de Markdown, mayúsculas/minúsculas, tildes y descripciones en varias líneas.
import { LIMITES, RUBROS } from "./config.ts";
import type { NuevoAviso, RubroId } from "./tipos.ts";
import { soloDigitos } from "./texto.ts";
import { validarAviso } from "./validar.ts";

const norm = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s$]/g, " ").replace(/\s+/g, " ").trim();

type Clave = "rubro" | "tipo" | "operacion" | "titulo" | "precio" | "moneda" | "pueblo" | "zona" | "descripcion" | "datos" | "permuta" | "financia" | "nombre" | "telefono" | "fotos" | "autorizacion" | "anunciante";
const CLAVES: Record<string, Clave> = {
  rubro: "rubro", tipo: "tipo", operacion: "operacion", titulo: "titulo", precio: "precio", moneda: "moneda", pueblo: "pueblo",
  "zona o barrio": "zona", zona: "zona", barrio: "zona", descripcion: "descripcion", "datos destacados": "datos", datos: "datos",
  "acepta permuta": "permuta", permuta: "permuta", financia: "financia", financiacion: "financia",
  "nombre del vendedor": "nombre", nombre: "nombre", vendedor: "nombre",
  "whatsapp del vendedor": "telefono", whatsapp: "telefono", telefono: "telefono", celular: "telefono",
  fotos: "fotos", "autorizacion del vendedor": "autorizacion", autorizacion: "autorizacion",
  "publicado por": "anunciante", publica: "anunciante", anunciante: "anunciante", inmobiliaria: "anunciante",
};

export interface Ficha {
  num: string;
  campos: Partial<Record<Clave, string>>;
  /** Cosas dudosas que marcó la IA (REVISAR) o datos que faltan (FALTA) */
  avisos: string[];
  /** Fotos que la ficha dice que tiene, como "1-1", "1-2" */
  fotosRef: string[];
}

export interface FichaLista extends Ficha {
  aviso: NuevoAviso | null;
  /** Lo que se pudo entender aunque tenga errores: sirve para abrirlo en el editor y completarlo. */
  borrador: Omit<NuevoAviso, "rubro"> & { rubro: NuevoAviso["rubro"] | "" };
  errores: string[];
}

const limpiar = (v: string): string => v.replace(/\*\*|__/g, "").trim();
const esVacio = (v: string): boolean => v === "" || /^(falta|sin dato|n\/?a|-+|—|ninguno)\b/i.test(v);

/** Separa el texto en fichas. Corta cuando empiezan las listas finales ("A) FALTAN DATOS", "B) FOTOS SIN ASIGNAR"). */
export function leerFichas(texto: string): Ficha[] {
  const fichas: Ficha[] = [];
  let actual: Ficha | null = null;
  let clave: Clave | null = null;
  for (const cruda of texto.replace(/\r/g, "").split("\n")) {
    const linea = cruda.replace(/^[\s>*•\-#]+/, "").trim();
    const cab = /^\**\s*aviso\s*(?:n[°ºo.]*\s*)?0*(\d+)\b/i.exec(linea);
    if (cab) {
      actual = { num: String(Number(cab[1])), campos: {}, avisos: [], fotosRef: [] };
      fichas.push(actual);
      clave = null;
      continue;
    }
    if (!actual) continue;
    if (/^(?:[ab]\)|faltan datos|fotos sin asignar)/i.test(norm(linea).replace(/^([ab]) /, "$1) ")) && /(faltan datos|fotos sin asignar)/i.test(norm(linea))) break;
    const m = /^([^:]{2,40}):\s*(.*)$/.exec(linea);
    const k = m ? CLAVES[norm(m[1] ?? "")] : undefined;
    if (m && k) {
      clave = k;
      actual.campos[k] = limpiar(m[2] ?? "");
    } else if (clave && linea) {
      actual.campos[clave] = `${actual.campos[clave] ?? ""} ${limpiar(linea)}`.trim();
    }
  }
  for (const f of fichas) {
    for (const [k, v] of Object.entries(f.campos) as [Clave, string][]) {
      if (/\brevisar\b/i.test(v)) {
        f.avisos.push(`${k}: ${v.slice(0, 120)}`);
        f.campos[k] = v.split(/\brevisar\b/i)[0]?.replace(/[\s(\-–—:]+$/, "").trim() ?? "";
      }
    }
    f.fotosRef = [...(f.campos.fotos ?? "").matchAll(/\b0*(\d{1,3})\s*-\s*0*(\d{1,3})\b/g)].map((x) => `${x[1]}-${x[2]}`);
  }
  return fichas;
}

const buscar = (lista: readonly string[], valor: string): string | undefined => lista.find((x) => norm(x) === norm(valor));

/** Convierte una ficha en un aviso (sin fotos). Devuelve los problemas en `errores` si no se puede. */
export function fichaAAviso(f: Ficha): FichaLista {
  const c = f.campos;
  const v = (k: Clave): string => {
    const t = c[k] ?? "";
    return esVacio(t) ? "" : t;
  };
  const errores: string[] = [];
  const faltan: string[] = [];
  const rubroTxt = norm(v("rubro"));
  const rubro = (Object.keys(RUBROS) as RubroId[]).find((id) => rubroTxt === id || rubroTxt.includes(norm(RUBROS[id].nombre)) || (id === "agro" && /agro|maquinaria|campo/.test(rubroTxt)) || (id === "vehiculos" && /vehic/.test(rubroTxt)));
  if (!rubro) errores.push(`No entendí el rubro "${v("rubro") || "vacío"}".`);
  const tipo = rubro ? buscar(RUBROS[rubro].tipos, v("tipo")) ?? RUBROS[rubro].tipos.find((t) => norm(t).startsWith(norm(v("tipo")).split(" ")[0] ?? "§")) : undefined;
  if (rubro && !tipo) errores.push(`El tipo "${v("tipo") || "vacío"}" no es de ${RUBROS[rubro].nombre}.`);
  const op = norm(v("operacion"));
  const operacion = op.includes("alquil") ? "alquiler" : op.includes("vent") ? "venta" : "";
  if (!operacion) errores.push("Falta si es venta o alquiler.");
  const precioTxt = soloDigitos(v("precio"));
  const mon = norm(v("moneda"));
  const moneda = /usd|u s|us\$|u\$s|dolar|dolares/.test(mon) || /u\$s|usd|dolar/.test(norm(v("precio"))) ? "USD" : "ARS";
  if (precioTxt && !mon && !/\$|usd/.test(norm(c.precio ?? ""))) faltan.push("moneda (puse pesos)");
  if (!precioTxt) faltan.push("precio");
  const datos = v("datos").split(/[,;]/).map((d) => d.trim()).filter(Boolean);
  const si = (k: Clave): boolean => /^(si|s)\b/.test(norm(v(k)));
  const aviso = {
    rubro: rubro ?? "inmuebles", tipo: tipo ?? "", operacion: operacion || "venta", titulo: v("titulo"), precio: precioTxt, moneda, pueblo: v("pueblo"), anunciante: v("anunciante"),
    zona: v("zona"), descripcion: v("descripcion"), datos, permuta: si("permuta"), financia: si("financia"), nombre: v("nombre"), telefono: v("telefono"), fotos: [],
  };
  const r = validarAviso(aviso, { exigirFotos: false });
  if (!r.ok) for (const e of r.errores) errores.push(e.msg);
  if (!f.campos.autorizacion || esVacio(f.campos.autorizacion)) faltan.push("autorización del vendedor");
  if (v("descripcion").length < 10) faltan.push("descripción");
  const borrador = { ...r.valor, rubro: rubro ?? "", tipo: tipo ?? "", fotos: [] as string[] };
  return { ...f, avisos: [...f.avisos, ...faltan.map((x) => `Falta: ${x}`)], aviso: r.ok && !errores.length ? { ...r.valor, fotos: [] } : null, borrador, errores: [...new Set(errores)] };
}

/** Clave "1-2" de un nombre de archivo de foto como "01-2.jpg" o "aviso 01 - 2.png". */
export function claveFoto(nombre: string): string | null {
  const base = nombre.split("/").pop() ?? nombre;
  const m = /(\d{1,3})\s*-\s*(\d{1,3})/.exec(base);
  return m ? `${Number(m[1])}-${Number(m[2])}` : null;
}

export const MAX_FOTOS_AVISO = LIMITES.fotos;
