// API pública: listar y ver avisos, pedir el contacto, publicar y dejar una búsqueda.
import { statfsSync } from "node:fs";
import { validarAviso, validarBusqueda } from "../../shared/validar.ts";
import { linkWA } from "../../shared/whatsapp.ts";
import { esAdmin } from "../auth.ts";
import { MAX_CON_FOTOS, MAX_JSON, MAX_PENDIENTES, MAX_SUBIDAS_A_LA_VEZ, MIN_LIBRE_BYTES, sitioDe } from "../config.ts";
import * as datos from "../db.ts";
import { FOTOS_DIR } from "../db.ts";
import * as estad from "../estad.ts";
import { ErrorHttp, crearLimitador, json, leerJson } from "../http.ts";
import { guardarFotos } from "../imagenes.ts";
import { notificar } from "../notificar.ts";
import { filtrosDe, idDe, type Rutas } from "./comun.ts";

const limiteContacto = crearLimitador(30, 10 * 60_000);
const limitePublicar = crearLimitador(6, 60 * 60_000);
const limiteBusqueda = crearLimitador(10, 60 * 60_000);

let subidasEnCurso = 0;
function hayLugar(): boolean {
  try {
    const s = statfsSync(FOTOS_DIR);
    return s.bavail * s.bsize > MIN_LIBRE_BYTES;
  } catch {
    return true;
  }
}

export const rutasPublicas: Rutas = async ({ req, res, url, metodo, ip, recurso, a1, a2 }) => {
  if (recurso === "salud" && metodo === "GET") {
    json(res, 200, { ok: true });
    return true;
  }

  if (recurso === "avisos") {
    if (!a1 && metodo === "GET") {
      const limite = Math.min(Math.max(Number(url.searchParams.get("limite")) || 12, 1), 60);
      const desde = Math.max(Number(url.searchParams.get("desde")) || 0, 0);
      json(res, 200, datos.listarPublicos(filtrosDe(url.searchParams), limite, desde));
      return true;
    }
    const id = idDe(a1);
    if (!a2 && metodo === "GET") {
      const aviso = datos.obtenerPublico(id); // la visita la cuenta /api/m (una por persona y día)
      if (!aviso) throw new ErrorHttp(404, "Este aviso ya no está.");
      json(res, 200, aviso);
      return true;
    }
    if (a2 === "contacto" && metodo === "POST") {
      limiteContacto(ip);
      const c = datos.telefonoParaContacto(id);
      if (!c) throw new ErrorHttp(404, "Este aviso no se puede contactar.");
      if (!esAdmin(req) && !estad.esRobot(req) && estad.registrarContacto(req, id)) datos.sumarContacto(id);
      json(res, 200, { url: linkWA(c.telefono, `Hola! Vi tu aviso «${c.titulo}» en Vidriera Chabás. ¿Sigue disponible?`) });
      return true;
    }
  }

  if (recurso === "publicaciones" && metodo === "POST" && !a1) {
    limitePublicar(ip);
    if (datos.contarPendientes() >= MAX_PENDIENTES || !hayLugar()) throw new ErrorHttp(503, "Ahora no podemos recibir avisos. Mandalo por WhatsApp y lo cargamos nosotros.");
    if (subidasEnCurso >= MAX_SUBIDAS_A_LA_VEZ) throw new ErrorHttp(503, "Hay mucha gente publicando. Probá de nuevo en un minuto.");
    subidasEnCurso++;
    try {
      const r = validarAviso(await leerJson(req, MAX_CON_FOTOS), { exigirFotos: true });
      if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
      const archivos = guardarFotos(r.valor.fotos);
      // "Publicado por" lo pone solo el panel: un vecino no puede decir que es una inmobiliaria.
      const id = datos.crearAviso({ ...r.valor, anunciante: "", quien: "dueno" }, archivos, { estado: "pendiente" });
      json(res, 201, { id });
      notificar.avisoNuevo(r.valor, id, sitioDe(req));
      return true;
    } finally {
      subidasEnCurso--;
    }
  }

  if (recurso === "se-buscan" && metodo === "GET" && !a1) {
    json(res, 200, datos.listarSeBuscan());
    return true;
  }

  if (recurso === "busquedas" && metodo === "POST" && !a1) {
    limiteBusqueda(ip);
    const r = validarBusqueda(await leerJson(req, MAX_JSON));
    if (!r.ok) throw new ErrorHttp(422, "Revisá los datos marcados.", r.errores);
    json(res, 201, { id: datos.crearBusqueda(r.valor) });
    notificar.busquedaNueva(r.valor, sitioDe(req));
    return true;
  }
  return false;
};
