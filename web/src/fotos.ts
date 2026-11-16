import { LIMITES } from "../../shared/config.ts";

/** Achica una foto en el navegador (lado mayor 1600 px, JPEG) para que suba rápido aunque la señal sea mala. */
export async function achicarFoto(archivo: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(archivo.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(archivo.name)) {
    throw new Error("Ese archivo no es una foto.");
  }
  const bmp = await createImageBitmap(archivo).catch(() => {
    throw new Error("No se pudo leer esa foto. Probá con otra.");
  });
  const escala = Math.min(1, LIMITES.fotoLado / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bmp.width * escala);
  lienzo.height = Math.round(bmp.height * escala);
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la foto.");
  ctx.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  let calidad = 0.82;
  let url = lienzo.toDataURL("image/jpeg", calidad);
  while (url.length * 0.75 > LIMITES.fotoBytes && calidad > 0.4) {
    calidad -= 0.12;
    url = lienzo.toDataURL("image/jpeg", calidad);
  }
  return url;
}
