// Arma la web en web/dist: copia web/public, genera assets/app.js con esbuild y copia index.html.
// Uso: npm run build      (o npm run build -- --watch para que se rearme sola mientras editás)
//      npm run build -- --vista-previa   arma web/dist-vista-previa: funciona sin backend, con avisos de ejemplo
import { build, context } from "esbuild";
import { cpSync, rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const raiz = new URL("..", import.meta.url).pathname;
const mirar = process.argv.includes("--watch");
const vistaPrevia = process.argv.includes("--vista-previa");
const dist = `${raiz}web/${vistaPrevia ? "dist-vista-previa" : "dist"}`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(`${raiz}web/public`, dist, { recursive: true });
copyFileSync(`${raiz}web/index.html`, `${dist}/index.html`);

// Versión de cada archivo según su contenido: si cambia, los navegadores bajan el nuevo en vez de usar la copia guardada.
const huella = (ruta) => createHash("sha256").update(readFileSync(ruta)).digest("hex").slice(0, 10);

const opciones = {
  entryPoints: [`${raiz}web/src/main.tsx`],
  outdir: `${dist}/assets`,
  entryNames: "app",
  chunkNames: "partes/[name]-[hash]",
  bundle: true,
  splitting: true,
  format: "esm",
  target: ["es2020"],
  jsx: "automatic",
  minify: !mirar,
  sourcemap: mirar,
  legalComments: "none",
  define: { "process.env.NODE_ENV": JSON.stringify(mirar ? "development" : "production"), __VISTA_PREVIA__: String(vistaPrevia),
    // Los estilos del panel van aparte: solo los baja quien entra al panel.
    __PANEL_CSS__: JSON.stringify(`assets/panel.css?v=${huella(`${raiz}web/public/assets/panel.css`)}`),
  },
  logLevel: "info",
};

if (mirar) {
  const ctx = await context(opciones);
  await ctx.watch();
} else {
  await build(opciones);
  const version = (archivo) => huella(`${dist}/assets/${archivo}`);
  const html = readFileSync(`${dist}/index.html`, "utf8")
    .replace('href="assets/style.css"', `href="assets/style.css?v=${version("style.css")}"`)
    .replace('src="assets/app.js"', `src="assets/app.js?v=${version("app.js")}"`);
  writeFileSync(`${dist}/index.html`, html);
}
