// Medición propia, sin cookies: páginas vistas, búsquedas y "en vivo". Nunca le falla al visitante.
import * as actividad from "../actividad.ts";
import { esAdmin } from "../auth.ts";
import { SITE_URL } from "../config.ts";
import * as estad from "../estad.ts";
import { crearLimitador, leerJson } from "../http.ts";
import { sinContenido, type Rutas } from "./comun.ts";

const limiteMedir = crearLimitador(400, 10 * 60_000);
const limiteLatido = crearLimitador(120, 10 * 60_000);
const texto = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export const rutasMedicion: Rutas = async (p) => {
  const { req, metodo, ip, recurso, a1 } = p;
  if (metodo !== "POST" || a1) return false;

  // Cada página abierta (y visible) avisa cada 30 s que sigue ahí.
  if (recurso === "latido") {
    try {
      limiteLatido(ip);
      if (!esAdmin(req)) {
        const b = (await leerJson(req, 1_000)) as { pagina?: unknown };
        actividad.latido(req, texto(b.pagina, 40) || "inicio");
      }
    } catch { /* nunca falla para el visitante */ }
    return sinContenido(p);
  }

  if (recurso === "m") {
    try {
      limiteMedir(ip);
      if (!esAdmin(req) && !estad.esRobot(req)) {
        const b = (await leerJson(req, 4_000)) as Record<string, unknown>;
        if (b.t === "pv") {
          const avisoId = Number(b.aviso);
          let propio = "";
          try { propio = new URL(SITE_URL || `http://${req.headers.host ?? ""}`).hostname.replace(/^www\./, ""); } catch { /* sin host */ }
          estad.registrarPagina(req, { pagina: texto(b.p, 20), entrada: b.ent === true, avisoId: Number.isInteger(avisoId) && avisoId > 0 ? avisoId : null, de: texto(b.de, 10), ref: texto(b.ref, 300), propio });
        } else if (b.t === "notif") {
          estad.registrarNotif(req, texto(b.a, 12));
        } else if (b.t === "busca") {
          const n = Number(b.n);
          estad.registrarBusqueda(req, texto(b.q, 60), Number.isFinite(n) ? n : -1);
        }
      }
    } catch { /* medir nunca rompe nada */ }
    return sinContenido(p);
  }
  return false;
};
