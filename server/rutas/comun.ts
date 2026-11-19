// Lo que comparten todas las rutas de la API.
import type { IncomingMessage, ServerResponse } from "node:http";
import { OTRO_PUEBLO, PUEBLOS, RUBROS } from "../../shared/config.ts";
import { recortar, soloDigitos } from "../../shared/texto.ts";
import type { Filtros, RubroId } from "../../shared/tipos.ts";
import { ErrorHttp } from "../http.ts";

/** Un pedido a la API ya desarmado: /api/<recurso>/<a1>/<a2>/… */
export interface Pedido {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  metodo: string;
  ip: string;
  recurso: string;
  a1: string | undefined;
  a2: string | undefined;
  /** Partes de la ruta después de /api */
  resto: string[];
}

/** Cada grupo de rutas devuelve true si atendió el pedido. */
export type Rutas = (p: Pedido) => Promise<boolean>;

export function idDe(texto: string | undefined): number {
  const id = Number(texto);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorHttp(404, "No encontrado.");
  return id;
}

export function filtrosDe(q: URLSearchParams): Filtros {
  const rubro = q.get("rubro") ?? "";
  const op = q.get("op");
  const orden = q.get("orden");
  const pueblo = q.get("pueblo") ?? "";
  return {
    rubro: rubro in RUBROS ? (rubro as RubroId) : "",
    pueblo: pueblo === OTRO_PUEBLO || PUEBLOS.includes(pueblo) ? pueblo : "",
    q: recortar(q.get("q"), 60),
    tipo: recortar(q.get("tipo"), 40),
    op: op === "venta" || op === "alquiler" ? op : "",
    max: soloDigitos(q.get("max")).slice(0, 12),
    moneda: q.get("moneda") === "ARS" ? "ARS" : "USD",
    permuta: q.get("permuta") === "1",
    financia: q.get("financia") === "1",
    orden: orden === "barato" || orden === "caro" ? orden : "",
  };
}

/** Respuesta vacía (para la medición, que nunca le devuelve nada al visitante). */
export function sinContenido(p: Pedido): true {
  p.res.writeHead(204);
  p.res.end();
  return true;
}
