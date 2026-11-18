// "Tarjeta para redes": arma en el navegador una imagen 1080x1350 (formato Instagram/estados)
// con la foto de tapa, el precio y el pueblo, y un texto listo para pegar.
import type { AvisoPublico } from "../../shared/tipos.ts";
import { fmtNum } from "../../shared/texto.ts";
import { fotoSegura, porMes, precioTexto } from "./formato.ts";

const W = 1080, H = 1350, FOTO_H = 860, M = 72;
const C = { crema: "#F2ECDF", papel: "#FBF8F1", tinta: "#17150F", tinta2: "#4A463C", terra: "#C4572F", oliva: "#2E3A27" };

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error("No se pudo cargar la foto."));
    i.src = src;
  });
}

/** Parte un texto en renglones que entren en `ancho`, hasta `max` renglones (con "…" si sobra). */
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number, max: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let linea = "";
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho) linea = prueba;
    else { if (linea) out.push(linea); linea = p; }
  }
  if (linea) out.push(linea);
  if (out.length > max) {
    const corte = out.slice(0, max);
    let u = corte[max - 1]!;
    while (u && ctx.measureText(`${u}…`).width > ancho) u = u.slice(0, -1);
    corte[max - 1] = `${u.trimEnd()}…`;
    return corte;
  }
  return out;
}

export async function tarjetaRedes(a: AvisoPublico): Promise<Blob> {
  await document.fonts?.ready;
  const lienzo = document.createElement("canvas");
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo armar la imagen.");
  const sans = getComputedStyle(document.documentElement).getPropertyValue("--sans").trim() || "Arial, sans-serif";

  ctx.fillStyle = C.crema;
  ctx.fillRect(0, 0, W, H);

  // Foto de tapa, recortada para cubrir (como object-fit: cover)
  const src = fotoSegura(a.fotos[0] ?? "");
  if (src) {
    const img = await cargarImagen(src);
    const escala = Math.max(W / img.naturalWidth, FOTO_H / img.naturalHeight);
    const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
    ctx.drawImage(img, (W - w) / 2, (FOTO_H - h) / 2, w, h);
  } else {
    ctx.fillStyle = C.papel;
    ctx.fillRect(0, 0, W, FOTO_H);
  }

  // Etiqueta arriba a la izquierda: Venta / Alquiler / Reservado
  const etiqueta = a.reservado ? "RESERVADO" : a.operacion === "alquiler" ? "ALQUILER" : "VENTA";
  ctx.font = `700 34px ${sans}`;
  const ew = ctx.measureText(etiqueta).width + 48;
  ctx.fillStyle = a.reservado ? C.oliva : C.papel;
  ctx.beginPath();
  ctx.roundRect(M - 24, 48, ew, 66, 33);
  ctx.fill();
  ctx.fillStyle = a.reservado ? C.papel : C.tinta;
  ctx.fillText(etiqueta, M, 93);

  // Datos
  let y = FOTO_H + 92;
  ctx.fillStyle = C.terra;
  ctx.font = `700 34px ${sans}`;
  ctx.fillText(`${a.tipo} · ${a.pueblo}`.toUpperCase(), M, y);

  y += 84;
  ctx.fillStyle = C.tinta;
  ctx.font = `800 76px ${sans}`;
  ctx.fillText(`${precioTexto(a)}${porMes(a) ? " por mes" : ""}`, M, y);

  ctx.font = `600 46px ${sans}`;
  ctx.fillStyle = C.tinta2;
  for (const l of renglones(ctx, a.titulo, W - M * 2, 2)) {
    y += 62;
    ctx.fillText(l, M, y);
  }

  // Pie
  ctx.fillStyle = C.tinta;
  ctx.fillRect(0, H - 110, W, 110);
  ctx.font = `800 40px ${sans}`;
  ctx.fillStyle = C.papel;
  ctx.fillText("Vidriera", M, H - 42);
  const vw = ctx.measureText("Vidriera ").width;
  ctx.font = `italic 400 40px Georgia, serif`;
  ctx.fillStyle = "#E98A47";
  ctx.fillText("Chabás", M + vw, H - 42);
  ctx.font = `600 32px ${sans}`;
  ctx.fillStyle = C.crema;
  const sitio = "vidrierachabas.ar";
  ctx.fillText(sitio, W - M - ctx.measureText(sitio).width, H - 44);

  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo armar la imagen."))), "image/jpeg", 0.9));
}

/** Texto para acompañar la imagen en Instagram, estados o grupos. */
export function textoRedes(a: AvisoPublico, link: string): string {
  const precio = a.precio === null ? "Consultar precio" : `${a.moneda === "ARS" ? "$" : "USD"} ${fmtNum(a.precio)}${porMes(a) ? " por mes" : ""}`;
  const extras = [a.permuta && "Acepta permuta", a.financia && "Financia"].filter(Boolean).join(" · ");
  return [
    `${a.reservado ? "RESERVADO · " : ""}${a.titulo}`,
    `📍 ${a.pueblo}${a.zona ? ` (${a.zona})` : ""}`,
    `💰 ${precio}`,
    ...(a.datos.length ? [a.datos.slice(0, 4).join(" · ")] : []),
    ...(extras ? [extras] : []),
    "",
    `Fotos y contacto directo con el dueño: ${link}`,
    "Publicá gratis en Vidriera Chabás.",
  ].join("\n");
}
