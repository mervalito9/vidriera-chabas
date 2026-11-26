// Lo que el agente de Telegram puede hacer en el sitio, conectado a la base y a la carpeta de fotos.
// No borra ni rechaza avisos: eso queda en el panel.
import { randomBytes } from "node:crypto";
import { copyFileSync } from "node:fs";
import { extname, join } from "node:path";
import { LIMITES } from "../../shared/config.ts";
import type { AvisoAdmin, NuevoAviso } from "../../shared/tipos.ts";
import { validarAviso } from "../../shared/validar.ts";
import * as datos from "../db.ts";
import { FOTOS_DIR } from "../db.ts";
import { borrarFotos } from "../imagenes.ts";
import type { AccesoSitio, CambiosAviso } from "./agente.ts";
import { fotoDelSitio } from "./datosSitio.ts";

const sinTildes = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Copia las fotos del bot a la carpeta del sitio con nombres nuevos. */
function copiarAlSitio(rutas: string[]): string[] {
  const copiadas: string[] = [];
  try {
    for (const r of rutas) {
      const nombre = `${randomBytes(12).toString("hex")}${extname(r).toLowerCase() || ".jpg"}`;
      copyFileSync(r, join(FOTOS_DIR, nombre));
      copiadas.push(nombre);
    }
    return copiadas;
  } catch (err) {
    borrarFotos(copiadas);
    throw err;
  }
}

function aNuevo(a: AvisoAdmin): NuevoAviso {
  return {
    rubro: a.rubro, tipo: a.tipo, operacion: a.operacion, titulo: a.titulo, precio: a.precio, moneda: a.moneda, pueblo: a.pueblo,
    anunciante: a.anunciante, quien: a.quien, zona: a.zona, descripcion: a.descripcion, datos: a.datos, permuta: a.permuta,
    financia: a.financia, nombre: a.nombre, telefono: a.telefono, fotos: a.fotos, condiciones: a.condiciones, lat: a.lat, lng: a.lng,
  };
}

function resumen(a: AvisoAdmin, sitio: string) {
  return {
    id: a.id, estado: a.estado, titulo: a.titulo, rubro: a.rubro, tipo: a.tipo, operacion: a.operacion, pueblo: a.pueblo,
    precio: a.precio === null ? "sin precio" : `${a.moneda} ${a.precio}`, fotos: a.fotos.length, reservado: a.reservado || undefined,
    publicadoEn: a.publicadoEn || undefined, link: `${sitio}/a/${a.id}`,
  };
}

export function crearAccesoSitio(urlSitio: string): AccesoSitio {
  return {
    publicar(aviso, rutas) {
      const archivos = copiarAlSitio(rutas.slice(0, LIMITES.fotos));
      try {
        return datos.crearAviso(aviso, archivos, { estado: "publicado" });
      } catch (err) {
        borrarFotos(archivos);
        throw err;
      }
    },

    buscar(texto, estado) {
      const palabras = sinTildes(texto).split(/\s+/).filter((p) => p.length > 1);
      const todos = datos.listarAdmin("").filter((a) => !a.ejemplo && (!estado || a.estado === estado));
      const hallados = palabras.length
        ? todos.filter((a) => {
            const t = sinTildes(`${a.id} ${a.titulo} ${a.tipo} ${a.rubro} ${a.pueblo} ${a.zona} ${a.descripcion} ${a.datos.join(" ")} ${a.nombre}`);
            return palabras.some((p) => t.includes(p));
          })
        : todos;
      return { total: hallados.length, avisos: hallados.slice(0, 15).map((a) => resumen(a, urlSitio)) };
    },

    ver(id) {
      const a = datos.obtenerAdmin(id);
      if (!a || a.ejemplo) return { error: `No existe el aviso n.º ${id}` };
      return {
        ...resumen(a, urlSitio), zona: a.zona, descripcion: a.descripcion, datos: a.datos, permuta: a.permuta, financia: a.financia,
        nombre: a.nombre, telefono: a.telefono, vistas: a.vistas, contactos: a.contactos, llego: a.creadoEn, venceEn: a.venceEn,
      };
    },

    editar(id, c: CambiosAviso) {
      const a = datos.obtenerAdmin(id);
      if (!a || a.ejemplo) return `error: no existe el aviso n.º ${id}`;
      const { reservado, estado, ...campos } = c;
      const hayCampos = Object.keys(campos).length > 0;
      if (hayCampos) {
        const r = validarAviso({ ...aNuevo(a), ...campos }, { exigirFotos: false });
        if (!r.ok) return `error: ${r.errores.map((x) => x.msg).join("; ")}`;
        datos.editarAviso(id, r.valor, datos.archivosDe(id));
      }
      if (reservado !== undefined || estado !== undefined) datos.actualizarAviso(id, { reservado, estado });
      const nuevo = datos.obtenerAdmin(id);
      return `ok: ${JSON.stringify(nuevo ? resumen(nuevo, urlSitio) : { id })}`;
    },

    agregarFotos(id, rutas, alPrincipio) {
      const a = datos.obtenerAdmin(id);
      if (!a || a.ejemplo) return `error: no existe el aviso n.º ${id}`;
      const viejas = datos.archivosDe(id);
      const lugar = LIMITES.fotos - viejas.length;
      if (lugar <= 0) return `error: el aviso ya tiene ${viejas.length} fotos (máximo ${LIMITES.fotos})`;
      const nuevas = copiarAlSitio(rutas.slice(0, lugar));
      try {
        datos.editarAviso(id, aNuevo(a), alPrincipio ? [...nuevas, ...viejas] : [...viejas, ...nuevas]);
      } catch (err) {
        borrarFotos(nuevas);
        throw err;
      }
      const sobran = rutas.length - nuevas.length;
      return `ok: el aviso n.º ${id} ahora tiene ${viejas.length + nuevas.length} fotos${sobran > 0 ? ` (${sobran} no entraron por el máximo de ${LIMITES.fotos})` : ""}. ${urlSitio}/a/${id}`;
    },

    estadisticas: fotoDelSitio,
  };
}
