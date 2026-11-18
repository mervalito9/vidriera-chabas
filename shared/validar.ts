// Validación compartida: la web la usa para avisar errores al instante
// y el backend la usa SIEMPRE antes de guardar (nunca se confía en el navegador).
import { RUBROS, LIMITES, PUEBLOS, OTRO_PUEBLO } from "./config.ts";
import type { ErrorCampo, NuevaBusqueda, NuevoAviso, RubroId } from "./tipos.ts";
import { recortar, slug, soloDigitos } from "./texto.ts";

/** Pueblo de un aviso: si coincide con uno de la lista (aunque esté escrito sin tilde), queda con el nombre de la lista. */
export function normalizarPueblo(texto: unknown): string {
  const t = recortar(texto, 40);
  return PUEBLOS.find((p) => slug(p) === slug(t)) ?? t;
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export interface Resultado<T> {
  ok: boolean;
  valor: T;
  errores: ErrorCampo[];
}

/** Valida y limpia un aviso nuevo. Devuelve el valor normalizado y la lista de errores. */
export function validarAviso(entrada: unknown, opciones: { exigirFotos: boolean }): Resultado<NuevoAviso> {
  const e = esObjeto(entrada) ? entrada : {};
  const errores: ErrorCampo[] = [];
  const rubro = (typeof e.rubro === "string" && e.rubro in RUBROS ? e.rubro : "") as RubroId | "";
  const tipo = recortar(e.tipo, 40);
  const operacion = rubro === "inmuebles" && e.operacion === "alquiler" ? "alquiler" : "venta";
  const titulo = recortar(e.titulo, LIMITES.titulo);
  const precioTxt = soloDigitos(e.precio).slice(0, 12);
  const precio = precioTxt ? Number(precioTxt) : null;
  const moneda = e.moneda === "ARS" ? "ARS" : "USD";
  const pueblo = normalizarPueblo(e.pueblo);
  const zona = recortar(e.zona, 60);
  const descripcion = recortar(e.descripcion, LIMITES.descripcion);
  const datos = (Array.isArray(e.datos) ? e.datos : [])
    .map((d) => recortar(d, 40))
    .filter(Boolean)
    .slice(0, 8);
  const nombre = recortar(e.nombre, LIMITES.nombre);
  const telefono = soloDigitos(e.telefono).slice(0, 15);
  const fotos = (Array.isArray(e.fotos) ? e.fotos : []).filter((f): f is string => typeof f === "string").slice(0, LIMITES.fotos);

  if (!rubro) errores.push({ campo: "rubro", msg: "Elegí qué querés publicar." });
  if (rubro && !RUBROS[rubro].tipos.includes(tipo)) errores.push({ campo: "tipo", msg: "Elegí el tipo." });
  if (pueblo.length < 2 || slug(pueblo) === OTRO_PUEBLO) errores.push({ campo: "pueblo", msg: "Elegí dónde está lo que publicás." });
  if (titulo.length < 4) errores.push({ campo: "titulo", msg: "Escribí un título corto (qué es)." });
  if (precio !== null && (precio <= 0 || !Number.isSafeInteger(precio))) errores.push({ campo: "precio", msg: "El precio tiene que ser un número." });
  if (!nombre) errores.push({ campo: "nombre", msg: "Escribí tu nombre." });
  if (telefono.length < 8) errores.push({ campo: "telefono", msg: "Escribí tu WhatsApp con código de área (solo números)." });
  if (opciones.exigirFotos && fotos.length === 0) errores.push({ campo: "fotos", msg: "Agregá al menos una foto." });

  return {
    ok: errores.length === 0,
    errores,
    valor: { rubro: (rubro || "inmuebles") as RubroId, tipo, operacion, titulo, precio, moneda, pueblo, zona, descripcion, datos, permuta: e.permuta === true, financia: e.financia === true, nombre, telefono, fotos },
  };
}

export function validarBusqueda(entrada: unknown): Resultado<NuevaBusqueda> {
  const e = esObjeto(entrada) ? entrada : {};
  const errores: ErrorCampo[] = [];
  const valor: NuevaBusqueda = {
    rubro: recortar(e.rubro, 60),
    que: recortar(e.que, 160),
    presupuesto: recortar(e.presupuesto, 40),
    nombre: recortar(e.nombre, LIMITES.nombre),
    telefono: soloDigitos(e.telefono).slice(0, 15),
  };
  if (!valor.rubro) errores.push({ campo: "rubro", msg: "Elegí qué buscás." });
  if (valor.que.length < 3) errores.push({ campo: "que", msg: "Contanos en pocas palabras qué buscás." });
  if (!valor.nombre) errores.push({ campo: "nombre", msg: "Escribí tu nombre." });
  if (valor.telefono.length < 8) errores.push({ campo: "telefono", msg: "Escribí tu WhatsApp con código de área." });
  return { ok: errores.length === 0, errores, valor };
}
