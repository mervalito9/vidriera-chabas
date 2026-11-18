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

const opciones = {
  entryPoints: [`${raiz}web/src/main.tsx`],
  outfile: `${dist}/assets/app.js`,
  bundle: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  minify: !mirar,
  sourcemap: mirar,
  legalComments: "none",
  define: { "process.env.NODE_ENV": JSON.stringify(mirar ? "development" : "production"), __VISTA_PREVIA__: String(vistaPrevia) },
  logLevel: "info",
};

if (mirar) {
  const ctx = await context(opciones);
  await ctx.watch();
} else {
  await build(opciones);
  // Le pone una versión a app.js y style.css en index.html: así, después de cada cambio,
  // los navegadores bajan lo nuevo en vez de seguir usando la copia vieja guardada.
  const version = (archivo) => createHash("sha256").update(readFileSync(`${dist}/assets/${archivo}`)).digest("hex").slice(0, 10);
  const html = readFileSync(`${dist}/index.html`, "utf8")
    .replace('href="assets/style.css"', `href="assets/style.css?v=${version("style.css")}"`)
    .replace('src="assets/app.js"', `src="assets/app.js?v=${version("app.js")}"`);
  writeFileSync(`${dist}/index.html`, html);
}
