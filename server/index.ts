// Servidor de Vidriera Chabás: API + web + fotos. Node 24, sin dependencias externas.
// Arrancar: node server/index.ts   (ver README.md para las variables de entorno)
//
// Mapa:
//   config.ts        variables de entorno y topes
//   rutas/publicas   avisos, contacto, publicar, búsquedas          (/api/…)
//   rutas/medicion   estadísticas propias y "en vivo"               (/api/m, /api/latido)
//   rutas/admin      panel                                          (/api/admin/…)
//   estaticos.ts     web, fotos, /a/:id para compartir, 404
//   db.ts            SQLite · estad.ts y actividad.ts: mediciones · auth.ts: sesión del panel
//   dolar.ts         dólar de referencia para comparar precios en USD y en $
import { createServer } from "node:http";
import * as actividad from "./actividad.ts";
import { PUERTO, WEB_DIR } from "./config.ts";
import { seguirDolar } from "./dolar.ts";
import { sincronizarEjemplos } from "./ejemplos.ts";
import { servirSitio } from "./estaticos.ts";
import { ErrorHttp, cabecerasSeguridad, exigirMismoOrigen, ipDe, json } from "./http.ts";
import { rutasAdmin } from "./rutas/admin.ts";
import type { Pedido, Rutas } from "./rutas/comun.ts";
import { rutasMedicion } from "./rutas/medicion.ts";
import { rutasPublicas } from "./rutas/publicas.ts";
import { iniciarBot } from "./bot/index.ts";
import { retomarMejoras } from "./mejoras.ts";
import { cargarBusquedasIniciales } from "./semillas.ts";

const RUTAS: Rutas[] = [rutasPublicas, rutasMedicion, rutasAdmin];

const servidor = createServer(async (req, res) => {
  cabecerasSeguridad(res);
  const url = new URL(req.url ?? "/", "http://localhost");
  actividad.medirPedido(req, res, url.pathname);
  try {
    const metodo = req.method ?? "GET";
    if (url.pathname.startsWith("/api/")) {
      if (metodo !== "GET") exigirMismoOrigen(req);
      const resto = url.pathname.split("/").filter(Boolean).slice(1); // sin "api"
      const pedido: Pedido = { req, res, url, metodo, ip: ipDe(req), recurso: resto[0] ?? "", a1: resto[1], a2: resto[2], resto };
      for (const rutas of RUTAS) if (await rutas(pedido)) return;
      throw new ErrorHttp(404, "No encontrado.");
    }
    if (metodo !== "GET" && metodo !== "HEAD") throw new ErrorHttp(405, "Método no permitido.");
    servirSitio(req, res, url);
  } catch (err) {
    actividad.anotarError(res, err instanceof Error ? err.message : String(err));
    if (err instanceof ErrorHttp) return json(res, err.status, { error: err.message, campos: err.campos });
    console.error(new Date().toISOString(), req.method, url.pathname, err);
    if (!res.headersSent) json(res, 500, { error: "Algo salió mal. Probá de nuevo en un rato." });
  }
});

servidor.requestTimeout = 60_000;
servidor.headersTimeout = 15_000;
try {
  sincronizarEjemplos();
} catch (err) {
  console.error("No se pudieron cargar los avisos de ejemplo:", err);
}

servidor.listen(PUERTO, () => {
  console.log(`Vidriera Chabás escuchando en http://localhost:${PUERTO}  (web: ${WEB_DIR})`);
  if (!process.env.ADMIN_PASSWORD_HASH) console.warn("Ojo: falta ADMIN_PASSWORD_HASH, el panel no va a dejar entrar. Generalo con: npm run clave");
  seguirDolar();
  retomarMejoras();
  cargarBusquedasIniciales();
  iniciarBot();
});
