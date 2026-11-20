// Los datos del formulario de aviso tal como los escribe la persona, y cómo se convierten en un aviso.
import { CONDICIONES_VACIAS, renglonesCondiciones, limpiarCondiciones, type CondicionesAlquiler } from "../../../../shared/alquiler.ts";
import { OTRO_PUEBLO, RUBROS } from "../../../../shared/config.ts";
import { fmtNum, soloDigitos } from "../../../../shared/texto.ts";
import type { RubroId } from "../../../../shared/tipos.ts";

export interface ValoresForm {
  rubro: RubroId | "";
  tipo: string;
  operacion: "venta" | "alquiler";
  titulo: string;
  precio: string;
  moneda: "USD" | "ARS";
  permuta: boolean;
  financia: boolean;
  descripcion: string;
  nombre: string;
  telefono: string;
  fotos: string[];
  /** ¿Dónde está? Uno de PUEBLOS, "otro" (y entonces vale puebloOtro) o "" si todavía no eligió */
  pueblo: string;
  puebloOtro: string;
  /** Solo el panel los usa: barrio o zona, y datos destacados separados por coma */
  zona: string;
  datos: string;
  /** Solo el panel: quién publica (se ve en el aviso) */
  anunciante: string;
  /** Solo alquileres: garantía, depósito, contrato… */
  condiciones: CondicionesAlquiler;
}

export const valoresIniciales = (rubro: RubroId | ""): ValoresForm => ({
  rubro, tipo: "", operacion: "venta", titulo: "", precio: "", moneda: "USD", permuta: false, financia: false, descripcion: "", nombre: "", telefono: "", fotos: [], pueblo: "", puebloOtro: "", zona: "", datos: "", anunciante: "", condiciones: CONDICIONES_VACIAS,
});

/** Moneda que se usa en la zona para cada cosa (casas en venta y maquinaria en dólares; autos y alquileres en pesos).
 * Si ya escribió un precio, no se la cambiamos. */
export function monedaSugerida(rubro: RubroId | "", operacion: "venta" | "alquiler", v: Pick<ValoresForm, "precio" | "moneda">): "USD" | "ARS" {
  if (v.precio) return v.moneda;
  return (rubro === "inmuebles" && operacion === "venta") || rubro === "agro" ? "USD" : "ARS";
}

export const listaDatos = (texto: string) => texto.split(",").map((d) => d.trim()).filter(Boolean);

/** El pueblo que quedó elegido (el de la lista o el que escribió en "Otro"). */
export const puebloElegido = (v: ValoresForm): string => (v.pueblo === OTRO_PUEBLO ? v.puebloOtro.trim() : v.pueblo);

export const aNuevoAviso = (v: ValoresForm): unknown => ({ ...v, pueblo: puebloElegido(v), precio: v.precio, datos: listaDatos(v.datos), zona: v.zona });

/** Mensaje de WhatsApp con todos los datos (se usa cuando no hay servidor o si la persona prefiere mandarlo así). */
export function mensajeWhatsApp(v: ValoresForm): string {
  const r = v.rubro ? RUBROS[v.rubro] : null;
  const L = ["Hola! Quiero publicar un aviso en Vidriera Chabás.", ""];
  L.push(`Rubro: ${r?.nombre ?? "-"}`, `Tipo: ${v.tipo || "-"}`);
  if (v.rubro === "inmuebles") L.push(`Operación: ${v.operacion === "alquiler" ? "Alquiler" : "Venta"}`);
  L.push(`Título: ${v.titulo.trim() || "-"}`, `Dónde está: ${puebloElegido(v) || "-"}`);
  const p = soloDigitos(v.precio);
  L.push(`Precio: ${p ? `${fmtNum(Number(p))} ${v.moneda === "ARS" ? "Pesos ($)" : "Dólares (USD)"}${v.operacion === "alquiler" && v.rubro === "inmuebles" ? " por mes" : ""}` : "A consultar"}`);
  if (v.datos.trim()) L.push(`Datos: ${listaDatos(v.datos).join(", ")}`);
  if (v.permuta) L.push("Acepta permuta: Sí");
  if (v.financia) L.push("Financia: Sí");
  const cond = v.operacion === "alquiler" ? limpiarCondiciones(v.condiciones) : null;
  if (cond) L.push("Condiciones:", ...renglonesCondiciones(cond).map(([q, c]) => `- ${q}: ${c}`));
  L.push(`Descripción: ${v.descripcion.trim() || "-"}`, `Nombre: ${v.nombre.trim() || "-"}`, `WhatsApp para que me contacten: ${soloDigitos(v.telefono) || "-"}`, "", "Ahora te mando las fotos por acá.");
  return L.join("\n");
}
