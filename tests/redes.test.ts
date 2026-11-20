// Prueba de las imágenes "Para redes" (historia 1080x1920 y posteo 1080x1440): se arman en un Chrome real.
// Necesita playwright-core y Chrome; si no están, la prueba se saltea (no rompe `npm test` en otra compu).
//   PLAYWRIGHT_CORE=/ruta/a/playwright-core   CHROME=/ruta/a/chrome   (por defecto: el paquete y /usr/bin/google-chrome)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const PW = process.env.PLAYWRIGHT_CORE ?? "playwright-core";
let chromium: { launch: (o: object) => Promise<any> } | null = null;
try {
  chromium = existsSync(CHROME) ? (await import(PW)).chromium : null;
} catch {
  chromium = null;
}

const PUERTO = 3927;
const URL_BASE = `http://127.0.0.1:${PUERTO}`;
const dir = mkdtempSync(join(tmpdir(), "vidriera-redes-"));
let servidor: ChildProcess | null = null;

before(async () => {
  if (!chromium) return;
  servidor = spawn(process.execPath, ["server/index.ts"], { env: { ...process.env, DATA_DIR: dir, PORT: String(PUERTO), NODE_ENV: "test" }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${URL_BASE}/api/salud`)).ok) return; } catch { /* arrancando */ }
    await new Promise((r) => setTimeout(r, 100));
  }
});
after(() => { servidor?.kill(); rmSync(dir, { recursive: true, force: true }); });

const base = {
  id: 12, rubro: "inmuebles", tipo: "Casa", operacion: "venta", titulo: "Casa de 3 dormitorios con patio", precio: 68000, moneda: "USD",
  pueblo: "Chabás", zona: "", descripcion: "", datos: ["3 dormitorios", "180 m²"], permuta: false, financia: false, fotos: ["assets/img/ejemplo-casa.svg"],
  anunciante: "", quien: "dueno", publica: "", ejemplo: false, reservado: false, destacado: false,
  publicadoEn: new Date().toISOString(), venceEn: new Date(Date.now() + 864e5).toISOString(), precioAnterior: null, condiciones: null, lat: null, lng: null,
};

test("redes: historia 1080x1920 y posteo 1080x1440 en PNG, también en los casos difíciles", { skip: !chromium && "sin Chrome/playwright-core" }, async () => {
  const codigo = (await build({ entryPoints: ["web/src/panel/redes.ts"], bundle: true, format: "iife", globalName: "Redes", write: false })).outputFiles[0]!.text;
  const navegador = await chromium!.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  try {
    // La CSP del sitio no deja ejecutar código suelto: para la prueba se la saltea.
    const p = await (await navegador.newContext({ bypassCSP: true })).newPage();
    await p.goto(`${URL_BASE}/`);
    await p.addScriptTag({ content: codigo });
    const casos = [
      base,
      { ...base, id: 13, rubro: "vehiculos", tipo: "Auto", titulo: "Volkswagen Amarok V6 Extreme 4x4 automática con muchos extras y cubiertas nuevas recién", precio: 125000000, moneda: "ARS", datos: ["2021", "98.000 km"], reservado: true, fotos: ["assets/img/ejemplo-auto.svg"] },
      { ...base, id: 14, rubro: "agro", tipo: "Tractor", operacion: "venta", titulo: "Tractor", precio: null, datos: ["1998", "4.500 horas"], permuta: true, fotos: ["assets/img/ejemplo-tractor.svg"] },
      { ...base, id: 15, operacion: "alquiler", titulo: "Depto", precio: 350000, moneda: "ARS", fotos: [] },
    ];
    const r = await p.evaluate(async (lista: unknown[]) => {
      const R = (window as unknown as { Redes: any }).Redes;
      const out: { nombre: string; tipo: string; w: number; h: number; kb: number }[] = [];
      for (const a of lista) for (const f of ["historia", "posteo"]) {
        const img = await R.imagenRedes(a, f);
        const bmp = await createImageBitmap(img.blob);
        out.push({ nombre: img.nombre, tipo: img.blob.type, w: bmp.width, h: bmp.height, kb: Math.round(img.blob.size / 1024) });
      }
      let error = "";
      try { await R.imagenRedes({ ...(lista[0] as object), fotos: ["assets/img/no-existe.png"] }, "posteo"); } catch (e) { error = String((e as Error).message); }
      return { out, error, fuente: document.fonts.check("800 80px Inter") };
    }, casos);
    assert.ok(r.fuente, "la letra Inter quedó cargada");
    for (const i of r.out) {
      assert.equal(i.tipo, "image/png", i.nombre);
      assert.deepEqual([i.w, i.h], i.nombre.endsWith("historia.png") ? [1080, 1920] : [1080, 1440], i.nombre);
      assert.ok(i.kb > 10, `${i.nombre} no está vacía`);
    }
    assert.deepEqual(r.out.slice(0, 2).map((i: { nombre: string }) => i.nombre), ["aviso-12-historia.png", "aviso-12-posteo.png"]);
    assert.match(r.error, /No se pudo cargar la foto de tapa/);
  } finally {
    await navegador.close();
  }
});
