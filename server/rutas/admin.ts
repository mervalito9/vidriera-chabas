// API del panel (/api/admin/…): entrar, avisos, búsquedas, estadísticas, actividad y copia de seguridad.
// Todo, salvo entrar y preguntar por la sesión, exige la sesión de Felipe.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { LIMITES } from "../../shared/config.ts";
import { recortar, soloDigitos } from "../../shared/texto.ts";
import type { Estado } from "../../shared/tipos.ts";
import { validarAviso, validarBusquedaPublica } from "../../shared/validar.ts";
import * as actividad from "../actividad.ts";
import { claveCorrecta, cerrarSesion, esAdmin, exigirAdmin, iniciarSesion } from "../auth.ts";
import { MAX_CON_FOTOS, MAX_JSON } from "../config.ts";
import * as datos from "../db.ts";
import { FOTOS_DIR } from "../db.ts";
import * as estad from "../estad.ts";
import { ErrorHttp, crearLimitador, json, leerJson } from "../http.ts";
import { borrarFotos, guardarFotos } from "../imagenes.ts";
import { armarZip, escribirZip } from "../zip.ts";
import { idDe, type Pedido, type Rutas } from "./comun.ts";

const limiteLogin = crearLimitador(8, 15 * 60_000);
const ESTADOS: Estado[] = ["pendiente", "publicado", "rechazado", "vendido"];
const ahora = () => new Date().toISOString();

export const rutasAdmin: Rutas = async (p) => {
  if (p.recurso !== "admin") return false;
  const { req, res, metodo, ip, a1 } = p;

  if (a1 === "login" && metodo === "POST") {
    limiteLogin(ip);
    const cuerpo = (await leerJson(req, MAX_JSON)) as { clave?: unknown };
    if (typeof cuerpo.clave !== "string" || !claveCorrecta(cuerpo.clave.slice(0, 200))) {
      console.warn(ahora(), "PANEL: contraseña incorrecta desde", ip);
      actividad.contarLoginMal();
      throw new ErrorHttp(401, "Contraseña incorrecta.");
    }
    console.log(ahora(), "PANEL: entrada correcta desde", ip);
    iniciarSesion(res);
    json(res, 200, { ok: true });
    return true;
  }
  if (a1 === "logout" && metodo === "POST") {
    cerrarSesion(req, res);
    json(res, 200, { ok: true });
    return true;
  }
  if (a1 === "sesion" && metodo === "GET") {
    json(res, 200, { ok: esAdmin(req) });
    return true;
  }

  exigirAdmin(req);
  if (a1 === "actividad" && !p.a2 && metodo === "GET") {
    const periodo = p.url.searchParams.get("periodo");
    json(res, 200, actividad.resumen(periodo === "7d" || periodo === "30d" ? periodo : "24h"));
    return true;
  }
  if (a1 === "estadisticas" && !p.a2 && metodo === "GET") {
    const dias = Number(p.url.searchParams.get("dias"));
    json(res, 200, estad.resumen([7, 30, 90].includes(dias) ? dias : 30));
    return true;
  }
  if (a1 === "copia" && !p.a2 && metodo === "GET") return copiaDeSeguridad(p);
  if (a1 === "avisos") return avisos(p);
  if (a1 === "busquedas") {
    if (!p.a2 && metodo === "GET") {
      json(res, 200, datos.listarBusquedas());
      return true;
    }
    if (!p.a2 && metodo === "POST") {
      const r = validarBusquedaPublica(await leerJson(p.req, MAX_JSON));
      if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
      json(res, 201, { id: datos.crearBusquedaPublica(r.valor) });
      return true;
    }
    if (p.a2 && metodo === "PATCH") {
      const c = (await leerJson(p.req, MAX_JSON)) as Record<string, unknown>;
      const r = datos.cambiarBusqueda(idDe(p.a2), {
        publica: typeof c.publica === "boolean" ? c.publica : undefined,
        titulo: typeof c.titulo === "string" ? recortar(c.titulo, 60) : undefined,
        detalle: typeof c.detalle === "string" ? recortar(c.detalle, 80) : undefined,
        directo: typeof c.directo === "boolean" ? c.directo : undefined,
      });
      if (r === "no-esta") throw new ErrorHttp(404, "Esa búsqueda ya no está.");
      if (r === "sin-permiso") throw new ErrorHttp(409, "Esta persona no aceptó que su búsqueda se muestre en el sitio.");
      json(res, 200, { ok: true });
      return true;
    }
    if (p.a2 && metodo === "DELETE") {
      datos.borrarBusqueda(idDe(p.a2));
      json(res, 200, { ok: true });
      return true;
    }
  }
  return false;
};

/** La base de datos + todas las fotos, en un solo .zip para guardar en la compu. */
function copiaDeSeguridad({ res, ip }: Pedido): true {
  const tmp = join(tmpdir(), `copia-${randomBytes(8).toString("hex")}.db`);
  try {
    datos.copiarBase(tmp);
    res.writeHead(200, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="vidriera-copia-${ahora().slice(0, 10)}.zip"`, "Cache-Control": "no-store" });
    const fotos = readdirSync(FOTOS_DIR).filter((f) => /^[A-Za-z0-9._-]+$/.test(f));
    escribirZip(res, [
      { nombre: "vidriera.db", leer: () => readFileSync(tmp) },
      ...fotos.map((f) => ({ nombre: `fotos/${f}`, leer: () => { try { return readFileSync(join(FOTOS_DIR, f)); } catch { return null; } } })),
    ]);
    console.log(ahora(), "PANEL: copia de seguridad descargada desde", ip);
    res.end();
    return true;
  } finally {
    rmSync(tmp, { force: true });
  }
}

async function avisos(p: Pedido): Promise<boolean> {
  const { req, res, url, metodo, a2, resto } = p;
  if (!a2 && metodo === "GET") {
    const e = url.searchParams.get("estado") ?? "";
    json(res, 200, datos.listarAdmin(ESTADOS.includes(e as Estado) ? (e as Estado) : ""));
    return true;
  }
  if (!a2 && metodo === "POST") {
    const r = validarAviso(await leerJson(req, MAX_CON_FOTOS), { exigirFotos: false });
    if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
    // ?estado=pendiente lo usa "Cargar varios": entran como pendientes para revisarlos uno por uno.
    const estado = url.searchParams.get("estado") === "pendiente" ? "pendiente" : "publicado";
    const id = datos.crearAviso(r.valor, guardarFotos(r.valor.fotos), { estado });
    json(res, 201, datos.obtenerAdmin(id));
    return true;
  }
  const id = idDe(a2);
  if (resto[3] === "fotos.zip" && metodo === "GET") return fotosEnZip(p, id);
  if (resto.length > 3) return false;
  if (metodo === "PATCH") {
    const c = (await leerJson(req, MAX_JSON)) as Record<string, unknown>;
    const aviso = datos.actualizarAviso(id, {
      estado: ESTADOS.includes(c.estado as Estado) ? (c.estado as Estado) : undefined,
      renovar: c.renovar === true,
      reservado: typeof c.reservado === "boolean" ? c.reservado : undefined,
      destacado: typeof c.destacado === "boolean" ? c.destacado : undefined,
      titulo: typeof c.titulo === "string" && recortar(c.titulo, LIMITES.titulo).length >= 4 ? recortar(c.titulo, LIMITES.titulo) : undefined,
      descripcion: typeof c.descripcion === "string" ? recortar(c.descripcion, LIMITES.descripcion) : undefined,
      precio: "precio" in c ? (soloDigitos(c.precio) ? Number(soloDigitos(c.precio).slice(0, 12)) : null) : undefined,
      moneda: c.moneda === "ARS" || c.moneda === "USD" ? c.moneda : undefined,
    });
    if (!aviso) throw new ErrorHttp(404, "No encontrado.");
    json(res, 200, aviso);
    return true;
  }
  if (metodo === "PUT") return editarCompleto(p, id);
  if (metodo === "DELETE") {
    borrarFotos(datos.borrarAviso(id));
    json(res, 200, { ok: true });
    return true;
  }
  return false;
}

/** Todas las fotos del aviso juntas, en el orden del aviso (1 = tapa). */
function fotosEnZip({ res }: Pedido, id: number): true {
  const archivos = datos.archivosDe(id).flatMap((archivo, i) => {
    const ruta = join(FOTOS_DIR, archivo);
    return existsSync(ruta) ? [{ nombre: `aviso-${id}-foto-${i + 1}${extname(archivo).toLowerCase()}`, datos: readFileSync(ruta) as Buffer }] : [];
  });
  if (!archivos.length) throw new ErrorHttp(404, "Este aviso no tiene fotos.");
  const zip = armarZip(archivos);
  res.writeHead(200, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="aviso-${id}-fotos.zip"`, "Content-Length": zip.length, "Cache-Control": "no-store" });
  res.end(zip);
  return true;
}

/** Edición completa: todos los datos y las fotos (las que ya estaban + las nuevas), en el orden que mandó el panel. */
async function editarCompleto({ req, res }: Pedido, id: number): Promise<true> {
  const r = validarAviso(await leerJson(req, MAX_CON_FOTOS), { exigirFotos: false });
  if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
  if (!datos.obtenerAdmin(id)) throw new ErrorHttp(404, "No encontrado.");
  const propias = datos.archivosDe(id);
  const nuevas: string[] = [];
  const plan: ({ archivo: string } | { nueva: number })[] = [];
  for (const f of r.valor.fotos) {
    const ya = /^\/fotos\/([A-Za-z0-9._-]+)$/.exec(f);
    if (ya?.[1]) {
      if (!propias.includes(ya[1])) throw new ErrorHttp(400, "Una de las fotos no es de este aviso.", [{ campo: "fotos", msg: "Volvé a cargar las fotos." }]);
      plan.push({ archivo: ya[1] });
    } else {
      plan.push({ nueva: nuevas.length });
      nuevas.push(f);
    }
  }
  const guardadas = guardarFotos(nuevas);
  const final = plan.map((x) => ("archivo" in x ? x.archivo : (guardadas[x.nueva] ?? "")));
  let resultado: ReturnType<typeof datos.editarAviso>;
  try {
    resultado = datos.editarAviso(id, r.valor, final);
  } catch (err) {
    borrarFotos(guardadas);
    throw err;
  }
  if (!resultado) {
    borrarFotos(guardadas);
    throw new ErrorHttp(404, "No encontrado.");
  }
  borrarFotos(resultado.quitadas);
  json(res, 200, resultado.aviso);
  return true;
}
