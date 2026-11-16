// Guarda las fotos que llegan como data URL. Se controla el tipo real por los primeros bytes,
// no por lo que dice el navegador, y se guardan con un nombre al azar.
import { randomBytes } from "node:crypto";
import { writeFileSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { LIMITES } from "../shared/config.ts";
import { FOTOS_DIR } from "./db.ts";
import { ErrorHttp } from "./http.ts";

function tipoReal(b: Buffer): "jpg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Guarda las fotos y devuelve los nombres de archivo. Si una falla, borra las ya guardadas. */
export function guardarFotos(dataUrls: string[]): string[] {
  const guardadas: string[] = [];
  try {
    for (const url of dataUrls.slice(0, LIMITES.fotos)) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(url);
      if (!m || !m[2]) throw new ErrorHttp(400, "Una de las fotos no es válida.", [{ campo: "fotos", msg: "Usá fotos JPG, PNG o WebP." }]);
      const b = Buffer.from(m[2], "base64");
      if (b.length > LIMITES.fotoBytes) throw new ErrorHttp(413, "Una de las fotos es demasiado pesada.", [{ campo: "fotos", msg: "Una foto es demasiado pesada." }]);
      const ext = tipoReal(b);
      if (!ext) throw new ErrorHttp(400, "Una de las fotos no es válida.", [{ campo: "fotos", msg: "Usá fotos JPG, PNG o WebP." }]);
      const nombre = `${randomBytes(12).toString("hex")}.${ext}`;
      writeFileSync(join(FOTOS_DIR, nombre), b, { flag: "wx" });
      guardadas.push(nombre);
    }
    return guardadas;
  } catch (err) {
    borrarFotos(guardadas);
    throw err;
  }
}

export function borrarFotos(nombres: string[]): void {
  for (const n of nombres) rmSync(join(FOTOS_DIR, basename(n)), { force: true });
}
