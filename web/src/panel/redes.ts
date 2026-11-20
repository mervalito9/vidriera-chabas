// "Para redes": arma en el navegador (canvas) las imágenes de un aviso para Instagram, listas para bajar:
//   historia 1080x1920 y posteo 1080x1440 (3:4), más los textos para copiar.
// Usa solo datos reales del aviso: foto de tapa, operación, título, hasta 3 datos clave, precio y pueblo.
// Nunca el teléfono ni el nombre del dueño (el contacto es por la página).
import { leerGuiados } from "../../../shared/datosGuiados.ts";
import type { AvisoPublico } from "../../../shared/tipos.ts";
import { fotoSegura, porMes, precioTexto } from "../formato.ts";

export const FORMATOS = {
  historia: { w: 1080, h: 1920, nombre: "historia" },
  posteo: { w: 1080, h: 1440, nombre: "posteo" },
} as const;
export type Formato = keyof typeof FORMATOS;

const C = { crema: "#F2ECDF", crema2: "#E6DDCA", papel: "#FBF8F1", tinta: "#17150F", tinta2: "#4A463C", terra: "#C4572F", oliva: "#2E3A27" };
const SANS = `Inter, "Helvetica Neue", Arial, sans-serif`;
// Charter viene en el iPhone y la Mac; si no está, la serif itálica más parecida del sistema.
const SERIF = `Charter, "Bitstream Charter", "Iowan Old Style", Georgia, serif`;
const LOGO = "assets/img/logo-horizontal-claro.svg";
const LOGO_PROPORCION = 1766 / 376;

// ---------------------------------------------------------------- datos

export interface DatosRedes {
  titulo: string;
  /** Cartel de la historia: "SE VENDE", "SE ALQUILA", "SE VENDE O PERMUTA" */
  cartel: string;
  /** Cinta del posteo: "VENTA", "ALQUILER", "VENTA · PERMUTA" */
  cinta: string;
  precio: string;
  porMes: boolean;
  /** Hasta 3, solo los que el aviso tiene */
  datos: string[];
  pueblo: string;
  reservado: boolean;
  foto: string;
}

/** Los datos clave por rubro, sacados de lo que cargó el vendedor (nunca inventados). */
function datosClave(a: AvisoPublico): string[] {
  const { valores } = leerGuiados(a.rubro, a.datos);
  const etiqueta = (id: string) => a.datos.find((d) => leerGuiados(a.rubro, [d]).valores[id] !== undefined) ?? "";
  const lista =
    a.rubro === "inmuebles" ? [a.tipo, valores.dorm ? etiqueta("dorm") : "", valores.m2 ? etiqueta("m2") : ""]
    : a.rubro === "vehiculos" ? [a.tipo, valores.anio ?? "", valores.km ? etiqueta("km") : ""]
    : [a.tipo, valores.anio ?? "", valores.horas ? etiqueta("horas") : ""];
  return lista.filter(Boolean).slice(0, 3);
}

export function datosRedes(a: AvisoPublico): DatosRedes {
  const alquiler = a.operacion === "alquiler";
  const permuta = a.permuta && !alquiler;
  return {
    titulo: a.titulo.trim(),
    cartel: alquiler ? "SE ALQUILA" : permuta ? "SE VENDE O PERMUTA" : "SE VENDE",
    cinta: alquiler ? "ALQUILER" : permuta ? "VENTA · PERMUTA" : "VENTA",
    // precioTexto nunca devuelve 0 ni vacío: sin precio dice "Consultar precio"
    precio: a.precio && a.precio > 0 ? precioTexto(a) : "Consultar",
    porMes: porMes(a) && !!a.precio,
    datos: datosClave(a),
    pueblo: a.pueblo,
    reservado: a.reservado,
    foto: fotoSegura(a.fotos[0] ?? "") || (/^data:image\//.test(a.fotos[0] ?? "") ? a.fotos[0]! : ""),
  };
}

/** Si ya no tiene sentido promocionarlo (vendido, rechazado o vencido), no se arman imágenes. */
export function motivoSinRedes(a: AvisoPublico & { estado?: string }): string {
  if (a.estado === "vendido") return "Está marcado como vendido.";
  if (a.estado && a.estado !== "publicado") return "No está publicado.";
  if (Date.parse(a.venceEn) < Date.now()) return "Está vencido: renovalo para poder compartirlo.";
  return "";
}

// ---------------------------------------------------------------- textos

const conQuien = (a: AvisoPublico) => (a.quien === "agencia" ? "con la agencia" : a.quien === "inmobiliaria" ? "con la inmobiliaria" : "con el dueño");

export function textoPosteo(a: AvisoPublico): string {
  const d = datosRedes(a);
  const op = a.operacion === "alquiler" ? "Alquiler" : d.cinta.includes("PERMUTA") ? "Venta o permuta" : "Venta";
  const precio = d.precio === "Consultar" ? "Precio a consultar" : `${d.precio}${d.porMes ? " por mes" : ""}`;
  return `${d.titulo.replace(/[.\s]+$/, "")}. ${op} en ${d.pueblo}. ${precio}. Fotos y contacto directo ${conQuien(a)} en vidrierachabas.ar (link en la bio).`;
}

export function textoHistoria(a: AvisoPublico, link: string): string {
  const escribirle = a.quien === "agencia" ? "escribirle a la agencia" : a.quien === "inmobiliaria" ? "escribirle a la inmobiliaria" : "escribirle al dueño";
  return `Nuevo en ${a.pueblo}. Tocá el link para ver las fotos y ${escribirle}.\n${link}`;
}

// ---------------------------------------------------------------- dibujo

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error("No se pudo cargar la foto de tapa. Probá de nuevo o cambiá la primera foto del aviso."));
    i.src = src;
  });
}

/** Las letras tienen que estar cargadas antes de dibujar; si no, el canvas usa otra y la imagen sale mal. */
export async function cargarFuentes(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all([document.fonts.load(`800 80px Inter`), document.fonts.load(`600 40px Inter`), document.fonts.load(`400 40px Inter`), document.fonts.load(`italic 400 40px ${SERIF}`)]);
  if (!document.fonts.check(`800 80px Inter`) || !document.fonts.check(`600 40px Inter`)) {
    throw new Error("No se cargaron las letras de Vidriera. Revisá la conexión y probá de nuevo.");
  }
}

const fuente = (peso: number, tam: number, fam = SANS, italica = false) => `${italica ? "italic " : ""}${peso} ${tam}px ${fam}`;

/**
 * Parte el texto en renglones que entren en `ancho` sin cortar palabras, achicando la letra (de `max` a `min`)
 * hasta que entre en `lineas` renglones. Si ni con la mínima entra, el último renglón termina en "…" (entre palabras).
 */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, ancho: number, lineas: number, max: number, min: number, peso = 800) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  for (let tam = max; tam >= min; tam -= 2) {
    ctx.font = fuente(peso, tam);
    if (palabras.some((p) => ctx.measureText(p).width > ancho)) continue;
    const out: string[] = [];
    let linea = "";
    for (const p of palabras) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (ctx.measureText(prueba).width <= ancho) linea = prueba;
      else { out.push(linea); linea = p; }
    }
    if (linea) out.push(linea);
    if (out.length <= lineas) return { lineas: out, tam };
    if (tam - 2 < min) {
      const corte = out.slice(0, lineas);
      while (corte.length && ctx.measureText(`${corte[lineas - 1]}…`).width > ancho) {
        corte[lineas - 1] = corte[lineas - 1]!.split(" ").slice(0, -1).join(" ");
      }
      corte[lineas - 1] = `${corte[lineas - 1]}…`;
      return { lineas: corte, tam };
    }
  }
  ctx.font = fuente(peso, min);
  return { lineas: [texto], tam: min };
}

/** El tamaño más grande (entre max y min) en que el texto entra en un renglón de `ancho`. */
function tamQueEntra(ctx: CanvasRenderingContext2D, texto: string, ancho: number, max: number, min: number, f: (t: number) => string): number {
  for (let t = max; t > min; t -= 2) {
    ctx.font = f(t);
    if (ctx.measureText(texto).width <= ancho) return t;
  }
  return min;
}

/** Foto recortada para cubrir el recuadro (como object-fit: cover), centrada. */
function fotoCubriendo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function sinFoto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = C.crema2;
  ctx.fillRect(x, y, w, h);
}

/** Pastilla con texto (chips, cinta). Devuelve el ancho. */
function pastilla(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, alto: number, fondo: string, color: string, f: string, pad = 26) {
  ctx.font = f;
  const w = ctx.measureText(texto).width + pad * 2;
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.roundRect(x, y, w, alto, alto / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x + pad, y + alto / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

/** Sello "RESERVADO" inclinado, centrado en (cx, cy). */
function sello(ctx: CanvasRenderingContext2D, cx: number, cy: number, escala = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.16);
  ctx.font = fuente(800, 92 * escala);
  const w = ctx.measureText("RESERVADO").width + 90 * escala, h = 150 * escala;
  ctx.fillStyle = "rgba(242,236,223,.94)";
  ctx.strokeStyle = C.oliva;
  ctx.lineWidth = 12 * escala;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 24 * escala);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.oliva;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RESERVADO", 0, 6 * escala);
  ctx.restore();
}

/** Precio en terracota (con "por mes" chico si es alquiler), en un renglón. Devuelve el alto usado. */
function precio(ctx: CanvasRenderingContext2D, d: DatosRedes, x: number, base: number, ancho: number, max: number, min: number): number {
  const sufijo = d.porMes ? " por mes" : "";
  let tam = max;
  for (; tam > min; tam -= 2) {
    ctx.font = fuente(800, tam);
    const w = ctx.measureText(d.precio).width;
    ctx.font = fuente(600, Math.round(tam * 0.42));
    if (w + ctx.measureText(sufijo).width <= ancho) break;
  }
  ctx.font = fuente(800, tam);
  ctx.fillStyle = C.terra;
  ctx.fillText(d.precio, x, base);
  if (sufijo) {
    const w = ctx.measureText(d.precio).width;
    ctx.font = fuente(600, Math.round(tam * 0.42));
    ctx.fillStyle = C.tinta2;
    ctx.fillText(sufijo, x + w, base);
  }
  return tam;
}

// ---------------------------------------------------------------- historia 1080x1920

async function dibujarHistoria(ctx: CanvasRenderingContext2D, d: DatosRedes, foto: HTMLImageElement | null, logo: HTMLImageElement) {
  const { w: W } = FORMATOS.historia;
  const M = 80, ANCHO = W - M * 2;
  // Zonas seguras de Instagram: nada importante antes de y=250 ni después de y=1580 (1920 − 340).
  const ARRIBA = 250, ABAJO = 1580;
  ctx.fillStyle = C.crema;
  ctx.fillRect(0, 0, W, FORMATOS.historia.h);

  const logoW = 440, logoH = logoW / LOGO_PROPORCION;
  ctx.drawImage(logo, (W - logoW) / 2, ARRIBA, logoW, logoH);

  // Primero se mide el texto de abajo; la foto ocupa lo que queda (hasta 900 de alto).
  const t = ajustar(ctx, d.titulo, ANCHO, 2, 66, 44);
  const altoTitulo = t.lineas.length * t.tam * 1.12;
  const altoPueblo = 54, altoPrecio = 112, altoChips = d.datos.length ? 64 + 26 : 0, altoPie = 44;
  const bloque = altoPueblo + 18 + altoTitulo + 22 + altoPrecio + altoChips + 30 + altoPie;
  const fotoY = ARRIBA + logoH + 44;
  const fotoH = Math.min(900, ABAJO - bloque - 40 - fotoY);

  // Foto en tarjeta con bordes redondeados
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(M, fotoY, ANCHO, fotoH, 40);
  ctx.clip();
  if (foto) fotoCubriendo(ctx, foto, M, fotoY, ANCHO, fotoH);
  else sinFoto(ctx, M, fotoY, ANCHO, fotoH);
  ctx.restore();
  if (d.reservado) sello(ctx, W / 2, fotoY + fotoH / 2);

  // Cartel inclinado sobre la esquina de arriba a la izquierda
  ctx.save();
  ctx.translate(M + 6, fotoY + 10);
  ctx.rotate(-0.07);
  pastilla(ctx, d.cartel, -18, -46, 92, C.terra, C.crema, fuente(800, 46), 34);
  ctx.restore();

  // Texto debajo de la foto
  let y = fotoY + fotoH + 40;
  ctx.fillStyle = C.tinta2;
  ctx.font = fuente(400, 44, SERIF, true);
  ctx.fillText(`en ${d.pueblo}`, M, y + 40);
  y += altoPueblo + 18;
  ctx.fillStyle = C.tinta;
  ctx.font = fuente(800, t.tam);
  t.lineas.forEach((l, i) => ctx.fillText(l, M, y + t.tam * 0.92 + i * t.tam * 1.12));
  y += altoTitulo + 22;
  precio(ctx, d, M, y + 92, ANCHO, 112, 64);
  y += altoPrecio;
  if (d.datos.length) {
    y += 26;
    let x = M;
    const tamChip = tamQueEntra(ctx, d.datos.join("      "), ANCHO - d.datos.length * 52, 34, 26, (s) => fuente(600, s));
    for (const dato of d.datos) x += pastilla(ctx, dato, x, y, 64, C.crema2, C.tinta, fuente(600, tamChip)) + 14;
    y += 64;
  }
  y += 30;
  ctx.fillStyle = C.tinta;
  ctx.font = fuente(600, 34);
  ctx.textAlign = "center";
  ctx.fillText("Mirá el aviso en vidrierachabas.ar", W / 2, y + 34);
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- posteo 1080x1440

async function dibujarPosteo(ctx: CanvasRenderingContext2D, d: DatosRedes, foto: HTMLImageElement | null, logo: HTMLImageElement) {
  const { w: W, h: H } = FORMATOS.posteo;
  const M = 64, ANCHO = W - M * 2;

  // Franja de abajo: se mide primero para saber cuánto alto le queda a la foto (unos 940).
  const t = ajustar(ctx, d.titulo, ANCHO, 2, 58, 40);
  const altoTitulo = t.lineas.length * t.tam * 1.12;
  const altoPie = 64;
  const franja = M - 8 + altoTitulo + 18 + 96 + 16 + 46 + 28 + altoPie + M - 8;
  const fotoH = H - Math.max(franja, 440);

  ctx.fillStyle = C.crema;
  ctx.fillRect(0, 0, W, H);
  if (foto) fotoCubriendo(ctx, foto, 0, 0, W, fotoH);
  else sinFoto(ctx, 0, 0, W, fotoH);
  if (d.reservado) sello(ctx, W / 2, fotoH / 2, 0.9);

  // Cinta de operación, pegada al borde izquierdo
  ctx.font = fuente(800, 40);
  const cw = ctx.measureText(d.cinta).width + 64 + 40;
  ctx.fillStyle = C.terra;
  ctx.beginPath();
  ctx.roundRect(-40, 56, cw, 80, [0, 40, 40, 0]);
  ctx.fill();
  ctx.fillStyle = C.crema;
  ctx.textBaseline = "middle";
  ctx.fillText(d.cinta, 32, 97);
  ctx.textBaseline = "alphabetic";

  let y = fotoH + M - 8;
  ctx.fillStyle = C.tinta;
  ctx.font = fuente(800, t.tam);
  t.lineas.forEach((l, i) => ctx.fillText(l, M, y + t.tam * 0.92 + i * t.tam * 1.12));
  y += altoTitulo + 18;
  precio(ctx, d, M, y + 80, ANCHO, 96, 56);
  y += 96 + 16;

  // Datos clave en una línea y el pueblo en itálica
  const datos = d.datos.join("  ·  ");
  const pueblo = `${datos ? "  ·  " : ""}${d.pueblo}`;
  let tam = 36;
  for (; tam > 26; tam -= 2) {
    ctx.font = fuente(600, tam);
    const w1 = ctx.measureText(datos).width;
    ctx.font = fuente(400, tam + 4, SERIF, true);
    if (w1 + ctx.measureText(pueblo).width <= ANCHO) break;
  }
  ctx.font = fuente(600, tam);
  ctx.fillStyle = C.tinta2;
  ctx.fillText(datos, M, y + 36);
  const w1 = ctx.measureText(datos).width;
  ctx.font = fuente(400, tam + 4, SERIF, true);
  ctx.fillText(pueblo, M + w1, y + 36);
  y += 46 + 28;

  // Pie: logo chico a la izquierda, dirección a la derecha
  const base = H - M;
  const logoH = 56, logoW = logoH * LOGO_PROPORCION;
  ctx.drawImage(logo, M - 6, base - logoH + 6, logoW, logoH);
  ctx.font = fuente(600, 32);
  ctx.fillStyle = C.tinta;
  ctx.textAlign = "right";
  ctx.fillText("vidrierachabas.ar", W - M, base - 12);
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- armar

export interface ImagenRedes {
  formato: Formato;
  blob: Blob;
  nombre: string;
}

/** Arma una imagen PNG del aviso. Con `datosDe` se puede pasar otra foto (por ej. una recién elegida en el panel). */
export async function imagenRedes(a: AvisoPublico, formato: Formato): Promise<ImagenRedes> {
  const d = datosRedes(a);
  await cargarFuentes();
  const [foto, logo] = await Promise.all([d.foto ? cargarImagen(d.foto) : Promise.resolve(null), cargarImagen(LOGO)]);
  const { w, h, nombre } = FORMATOS[formato];
  const lienzo = document.createElement("canvas");
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo armar la imagen.");
  if (formato === "historia") await dibujarHistoria(ctx, d, foto, logo);
  else await dibujarPosteo(ctx, d, foto, logo);
  const blob = await new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo armar la imagen."))), "image/png"));
  return { formato, blob, nombre: `aviso-${a.id}-${nombre}.png` };
}

/**
 * Guardar la imagen. En el iPhone, "Compartir" abre la hoja de iOS con "Guardar imagen" (va a Fotos);
 * donde no se puede, se baja como archivo.
 */
export async function guardarImagen(img: ImagenRedes): Promise<"compartida" | "bajada" | "cancelada"> {
  const archivo = new File([img.blob], img.nombre, { type: "image/png" });
  const tactil = window.matchMedia?.("(pointer: coarse)").matches;
  if (tactil && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] });
      return "compartida";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelada";
    }
  }
  const url = URL.createObjectURL(img.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = img.nombre;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "bajada";
}
