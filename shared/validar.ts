// Validación compartida: la web la usa para avisar errores al instante
// y el backend la usa SIEMPRE antes de guardar (nunca se confía en el navegador).
import { limpiarCondiciones } from "./alquiler.ts";
import { RUBROS, LIMITES, PUEBLOS, OTRO_PUEBLO } from "./config.ts";
import type { BusquedaPublica, ErrorCampo, NuevaBusqueda, NuevoAviso, RubroId } from "./tipos.ts";
import { recortar, slug, soloDigitos } from "./texto.ts";
import { telefonoArgentino } from "./whatsapp.ts";

const MSG_TELEFONO = "Escribí tu WhatsApp con código de área, por ejemplo 3464 40-1234.";

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
/** Un punto dentro de Argentina (con margen), con 6 decimales (~10 cm). Si no, sin ubicación. */
export function ubicacion(lat: unknown, lng: unknown): { lat: number | null; lng: number | null } {
  const a = Number(lat), o = Number(lng);
  if (lat === null || lng === null || lat === undefined || lng === undefined || !Number.isFinite(a) || !Number.isFinite(o)) return { lat: null, lng: null };
  if (a < -56 || a > -21 || o < -74 || o > -53) return { lat: null, lng: null };
  return { lat: Math.round(a * 1e6) / 1e6, lng: Math.round(o * 1e6) / 1e6 };
}

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
  const anunciante = recortar(e.anunciante, LIMITES.anunciante);
  const descripcion = recortar(e.descripcion, LIMITES.descripcion);
  const datos = (Array.isArray(e.datos) ? e.datos : [])
    .map((d) => recortar(d, 40))
    .filter(Boolean)
    .slice(0, 8);
  const nombre = recortar(e.nombre, LIMITES.nombre);
  const telefono = telefonoArgentino(typeof e.telefono === "string" ? e.telefono : "");
  const condiciones = operacion === "alquiler" ? limpiarCondiciones(e.condiciones) : null;
  const { lat, lng } = ubicacion(e.lat, e.lng);
  const quien = e.quien === "dueno" || e.quien === "inmobiliaria" || e.quien === "agencia" ? e.quien : "";
  const fotos = (Array.isArray(e.fotos) ? e.fotos : []).filter((f): f is string => typeof f === "string").slice(0, LIMITES.fotos);

  if (!rubro) errores.push({ campo: "rubro", msg: "Elegí qué querés publicar." });
  if (rubro && !RUBROS[rubro].tipos.includes(tipo)) errores.push({ campo: "tipo", msg: "Elegí el tipo." });
  if (pueblo.length < 2 || slug(pueblo) === OTRO_PUEBLO) errores.push({ campo: "pueblo", msg: "Elegí dónde está lo que publicás." });
  if (titulo.length < 4) errores.push({ campo: "titulo", msg: "Escribí un título corto (qué es)." });
  if (precio !== null && (precio <= 0 || !Number.isSafeInteger(precio))) errores.push({ campo: "precio", msg: "El precio tiene que ser un número." });
  if (!nombre) errores.push({ campo: "nombre", msg: "Escribí tu nombre." });
  if (!telefono) errores.push({ campo: "telefono", msg: MSG_TELEFONO });
  if (opciones.exigirFotos && fotos.length === 0) errores.push({ campo: "fotos", msg: "Agregá al menos una foto." });

  return {
    ok: errores.length === 0,
    errores,
    valor: { rubro: (rubro || "inmuebles") as RubroId, tipo, operacion, titulo, precio, moneda, pueblo, anunciante, quien, zona, descripcion, datos, permuta: e.permuta === true, financia: e.financia === true, nombre, telefono, fotos, condiciones, lat, lng },
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
    telefono: telefonoArgentino(typeof e.telefono === "string" ? e.telefono : ""),
    permiso: e.permiso === true,
  };
  if (!valor.rubro) errores.push({ campo: "rubro", msg: "Elegí qué buscás." });
  if (valor.que.length < 3) errores.push({ campo: "que", msg: "Contanos en pocas palabras qué buscás." });
  if (!valor.nombre) errores.push({ campo: "nombre", msg: "Escribí tu nombre." });
  if (!valor.telefono) errores.push({ campo: "telefono", msg: MSG_TELEFONO });
  return { ok: errores.length === 0, errores, valor };
}

/** Una búsqueda para mostrar en el sitio (la carga Felipe desde el panel): sin datos de contacto. */
export function validarBusquedaPublica(entrada: unknown): Resultado<BusquedaPublica> {
  const e = esObjeto(entrada) ? entrada : {};
  const errores: ErrorCampo[] = [];
  const rubro = (typeof e.rubro === "string" && e.rubro in RUBROS ? e.rubro : "") as RubroId | "";
  const valor: BusquedaPublica = { rubro: rubro || "inmuebles", titulo: recortar(e.titulo, 60), detalle: recortar(e.detalle, 80), directo: e.directo === true };
  if (!rubro) errores.push({ campo: "rubro", msg: "Elegí el rubro." });
  if (valor.titulo.length < 3) errores.push({ campo: "titulo", msg: "Escribí qué se busca, en pocas palabras." });
  return { ok: errores.length === 0, errores, valor };
}
