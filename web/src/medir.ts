// Mide páginas vistas y búsquedas para las estadísticas del panel. Sin cookies, sin servicios externos.
// Si algo falla, no pasa nada: nunca molesta al visitante.
import { clarityPantalla } from "./clarity.ts";

declare const __VISTA_PREVIA__: boolean;
/** En la vista previa (sin servidor) no hay a quién mandarle nada. */
const medir = !__VISTA_PREVIA__;

const de = new URLSearchParams(window.location.search).get("de") ?? "";
let primera = true;

function mandar(cuerpo: Record<string, unknown>): void {
  if (!medir) return;
  try {
    void fetch("/api/m", { method: "POST", headers: { "content-type": "application/json", "x-vidriera": "1" }, body: JSON.stringify(cuerpo), keepalive: true }).catch(() => {});
  } catch { /* nada */ }
}

let paginaActual = "inicio";
let enAdmin = false;
function latir(): void {
  if (!medir || enAdmin || document.visibilityState !== "visible") return;
  try {
    void fetch("/api/latido", { method: "POST", headers: { "content-type": "application/json", "x-vidriera": "1" }, body: JSON.stringify({ pagina: paginaActual }), keepalive: true }).catch(() => {});
  } catch { /* nada */ }
}
// "En vivo": mientras la pestaña esté visible, avisa cada 30 s. En segundo plano no cuenta.
window.setInterval(latir, 30_000);
document.addEventListener("visibilitychange", latir);

/** Cada vez que cambia la página (también la primera). */
export function medirPagina(nombre: string, param: string): void {
  clarityPantalla(nombre);
  enAdmin = nombre === "admin";
  if (enAdmin) return;
  paginaActual = param ? `${nombre}--${param}` : nombre;
  latir();
  const aviso = nombre === "aviso" && /^\d+$/.test(param) ? Number(param) : null;
  mandar({ t: "pv", aviso, de: primera ? de : "", ref: primera ? document.referrer : "" });
  if (primera && de) {
    // Saca el ?de=wa de la dirección para que, si la comparten de nuevo, no se cuente mal.
    try { history.replaceState(null, "", window.location.pathname + window.location.hash); } catch { /* nada */ }
  }
  primera = false;
}

let espera = 0;
let ultima = "";
/** Búsqueda por palabra: se manda cuando la persona deja de escribir (no cada letra). */
export function medirBusqueda(q: string, resultados: number): void {
  window.clearTimeout(espera);
  const t = q.trim().toLowerCase();
  if (t.length < 3 || t === ultima) return;
  espera = window.setTimeout(() => { ultima = t; mandar({ t: "busca", q: t, n: resultados }); }, 1500);
}
