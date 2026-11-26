// Asistente de Felipe por Telegram. Solo responde a los IDs de Telegram permitidos (Felipe), en chat privado.
// Dos usos: 1) preguntas sobre el sitio (gente en vivo, visitas, avisos, búsquedas…): contesta con los datos reales;
// 2) cargar un aviso: con /aviso o mandando una foto, Felipe pasa los datos crudos, el asistente arma la ficha y
// se publica con /publicar. Este archivo no toca la base ni el disco: eso lo conecta server/bot/index.ts.
import { LIMITES } from "../../shared/config.ts";
import type { NuevoAviso } from "../../shared/tipos.ts";
import { fmtNum } from "../../shared/texto.ts";
import { validarAviso } from "../../shared/validar.ts";
import type { ArmarFicha, Ficha } from "./claude.ts";
import { ES_AVISO, type Consultar } from "./consultas.ts";
import type { MensajeTelegram, TelegramApi, UpdateTelegram } from "./telegram.ts";

const HORAS_12 = 12 * 60 * 60 * 1000;
const MAX_TEXTO_BORRADOR = 8000;
const FOTOS_RECOMENDADAS = 3;

export interface DepsAsistente {
  tg: TelegramApi;
  armar: ArmarFicha;
  /** Guarda el aviso en el sitio y devuelve su id. Recibe las fotos como data URL. */
  publicar: (aviso: NuevoAviso) => number;
  /** IDs de Telegram con permiso. Cualquier otro se ignora sin respuesta. */
  permitidos: ReadonlySet<number>;
  /** Contacto que se usa cuando el aviso es de Felipe. */
  propio: { nombre: string; telefono: string };
  urlSitio: string;
  /** Preguntas sobre el sitio: la IA contesta con `datosSitio()` (una foto del estado actual). */
  consultar?: Consultar;
  datosSitio?: () => unknown;
  /**
   * Milisegundos de silencio después del último dato o foto para armar la ficha solo (sin /listo).
   * Los reenvíos y las fotos llegan en ráfaga: se espera a que termine. 0 = solo con /listo.
   */
  esperaAutoMs?: number;
  /** Tope de pedidos a Claude por hora, para acotar el gasto. */
  maxLlamadasPorHora?: number;
  ahora?: () => number;
}

interface Borrador {
  pendientes: string[];
  fotos: string[];
  ficha: Ficha | null;
  /** Ya se le mostraron las advertencias al intentar publicar. */
  advertido: boolean;
  /** Ya se le avisó que se llegó al tope de fotos. */
  avisoTope: boolean;
  saludado: boolean;
  /** Felipe pidió cargar un aviso (/aviso o mandó una foto): los textos van al borrador, no son preguntas. */
  enAviso: boolean;
  /** Ya se le mostró la ficha y se le preguntó si se publica: «sí», «dale», «ok» publican. */
  preguntoPublicar: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  ultima: number;
}

const AYUDA = `Soy tu asistente de Vidriera Chabás. Hablame normal:

- Preguntame lo que quieras del sitio: "¿cuánta gente hay ahora?", "¿cómo vamos esta semana?", "¿qué aviso se mira más?", "¿hay pendientes?".
- Para cargar un aviso, mandame los datos y las fotos como te salgan (o reenviá lo que te mandó el dueño). Te armo la ficha solo.
- Para corregir, decime el cambio: "el precio es 9.000 dólares".
- Para publicar: "publicalo". Para borrar el borrador: "cancelá".
- Si el aviso es tuyo, decime "es mío" y uso tu contacto.`;

function mimeReal(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** "/listo", "/listo@mi_bot" o simplemente "listo". */
function comandoDe(texto: string): string {
  const m = /^\/?(start|ayuda|help|listo|publicar|cancelar|estado|aviso)(?:@\w+)?$/i.exec(texto.trim());
  return m?.[1]?.toLowerCase() ?? "";
}

const quierePublicar = (t: string): boolean => /^\s*(s[ií],?\s*)?(dale,?\s*)?(publica(lo|r)?|publicá(lo)?|subilo|subí(lo)?|mandalo|mandálo)(?![\wáéíóúñ])/i.test(t);
const confirma = (t: string): boolean => /^\s*(s[ií]|dale|ok|okey|listo|de una|perfecto|bien|va|joya)[\s!.,]*$/i.test(t);
const quiereCancelar = (t: string): boolean => /^\s*(cancel[aá](lo|r)?|borr[aá](lo)?|olvidate|dejalo|dejá|no lo publiques)(?![\wáéíóúñ])/i.test(t);

function aAviso(f: Ficha, fotos: string[], propio: DepsAsistente["propio"]): NuevoAviso {
  const e = validarAviso(
    {
      ...f,
      nombre: f.duenoSoyYo && !f.nombre ? propio.nombre : f.nombre,
      telefono: f.duenoSoyYo && !f.telefono ? propio.telefono : f.telefono,
      fotos,
    },
    { exigirFotos: true },
  );
  return e.valor;
}

export function crearAsistente(deps: DepsAsistente) {
  const ahora = deps.ahora ?? Date.now;
  const maxLlamadas = deps.maxLlamadasPorHora ?? 40;
  const borradores = new Map<number, Borrador>();
  const charlas = new Map<number, { de: "felipe" | "bot"; texto: string; t: number }[]>();
  let llamadas: number[] = [];

  const decir = (chat: number, texto: string): Promise<void> => deps.tg.sendMessage(chat, texto);

  function borradorDe(chat: number): Borrador {
    const b = borradores.get(chat);
    if (b && ahora() - b.ultima < HORAS_12) return b;
    const nuevo: Borrador = { pendientes: [], fotos: [], ficha: null, advertido: false, avisoTope: false, saludado: false, enAviso: false, preguntoPublicar: false, timer: null, ultima: ahora() };
    borradores.set(chat, nuevo);
    return nuevo;
  }

  /** Lo que impide publicar (errores) y lo que conviene mirar antes (avisos). */
  function revisar(b: Borrador): { errores: string[]; avisos: string[] } {
    if (!b.ficha) return { errores: ["Todavía no hay ficha."], avisos: [] };
    const aviso = aAviso(b.ficha, b.fotos, deps.propio);
    const v = validarAviso(aviso, { exigirFotos: true });
    const errores = v.errores.map((x) => x.msg);
    const avisos: string[] = [];
    if (b.fotos.length > 0 && b.fotos.length < FOTOS_RECOMENDADAS) avisos.push(`Tiene ${b.fotos.length} foto(s). Un aviso completo lleva ${FOTOS_RECOMENDADAS} o más.`);
    if (aviso.precio === null) avisos.push("No tiene precio.");
    for (const f of b.ficha.faltan) avisos.push(f);
    return { errores, avisos };
  }

  function vista(b: Borrador): string {
    const f = b.ficha;
    if (!f) return `Todavía no armé la ficha. Tengo ${b.pendientes.length} mensaje(s) y ${b.fotos.length} foto(s). Tocá /listo.`;
    const a = aAviso(f, b.fotos, deps.propio);
    const { errores, avisos } = revisar(b);
    const precio = a.precio === null ? "FALTA" : `${a.moneda === "ARS" ? "$" : "USD"} ${fmtNum(a.precio)}${a.operacion === "alquiler" ? " por mes" : ""}`;
    const lineas = [
      "FICHA (borrador, todavía no está publicada)",
      `Rubro: ${a.rubro} · ${a.tipo || "FALTA"} · ${a.operacion}`,
      `Título: ${a.titulo || "FALTA"}`,
      `Precio: ${precio}`,
      `Dónde: ${a.pueblo || "FALTA"}${a.zona ? " · " + a.zona : ""}`,
      `Datos: ${a.datos.join(" · ") || "-"}`,
      `Permuta: ${a.permuta ? "sí" : "no"} · Financia: ${a.financia ? "sí" : "no"}`,
      `Contacto: ${a.nombre || "FALTA"} · ${a.telefono || "FALTA"}`,
      `Fotos: ${b.fotos.length}`,
      "",
      "Descripción:",
      a.descripcion || "(vacía)",
    ];
    if (errores.length) lineas.push("", "No se puede publicar todavía:", ...errores.map((x) => `- ${x}`));
    if (avisos.length) lineas.push("", "Revisá:", ...avisos.map((x) => `- ${x}`));
    lineas.push("", errores.length ? "Escribime lo que falte o mandá las fotos y la actualizo." : "¿Lo publico? Decime «publicalo» (confirmás que el dueño te dio permiso), o escribime qué cambiar.");
    return lineas.join("\n");
  }

  /** Cuenta un pedido a la IA; false si se llegó al tope de la hora. */
  function hayCupo(): boolean {
    const t = ahora();
    llamadas = llamadas.filter((x) => t - x < 60 * 60 * 1000);
    if (llamadas.length >= maxLlamadas) return false;
    llamadas.push(t);
    return true;
  }

  async function responder(chat: number, pregunta: string): Promise<void> {
    if (!deps.consultar || !deps.datosSitio) return decir(chat, "Para preguntas sobre el sitio todavía no estoy configurado. Para cargar un aviso: /aviso.");
    if (!hayCupo()) return decir(chat, "Llegué al tope de pedidos por hora. Probá de nuevo en un rato.");
    const historial = (charlas.get(chat) ?? []).filter((h) => ahora() - h.t < HORAS_12);
    let respuesta: string;
    void deps.tg.escribiendo?.(chat);
    try {
      respuesta = await deps.consultar(pregunta, historial, deps.datosSitio());
    } catch (err) {
      console.error(new Date().toISOString(), "bot: no pude responder:", err instanceof Error ? err.message : "error");
      return decir(chat, `No pude responderte ahora${err instanceof Error && /sin crédito|clave/.test(err.message) ? ` (${err.message.replace(/^.*\((.*)\).*$/, "$1")})` : ""}. Probá en un rato.`);
    }
    if (respuesta.includes(ES_AVISO)) {
      // No era una pregunta: son los datos de un aviso. Se arranca la carga con ese mensaje.
      const b = borradorDe(chat);
      b.enAviso = true;
      if (!/^\/?aviso$/i.test(pregunta)) b.pendientes.push(pregunta);
      if (!b.pendientes.length) return decir(chat, "Dale. Pasame los datos del aviso y las fotos, como te salgan, y te armo la ficha.");
      await decir(chat, "📝 Esto es un aviso: te armo la ficha. Si tenés fotos, mandámelas.");
      return procesar(chat, b);
    }
    charlas.set(chat, [...historial, { de: "felipe" as const, texto: pregunta, t: ahora() }, { de: "bot" as const, texto: respuesta, t: ahora() }].slice(-8));
    return decir(chat, respuesta);
  }

  /** Arma (o actualiza) la ficha sola cuando Felipe deja de mandar datos unos segundos. */
  function programar(chat: number, b: Borrador): void {
    const espera = deps.esperaAutoMs ?? 0;
    if (!espera) return;
    if (b.timer) clearTimeout(b.timer);
    b.timer = setTimeout(() => {
      b.timer = null;
      if (b.pendientes.length) void procesar(chat, b).catch(() => {});
      else if (!b.ficha && b.fotos.length) void decir(chat, `Tengo ${b.fotos.length} foto(s). Pasame los datos del aviso (qué es, precio, dónde, contacto) y te armo la ficha.`);
    }, espera);
  }

  async function procesar(chat: number, b: Borrador): Promise<void> {
    if (b.timer) { clearTimeout(b.timer); b.timer = null; }
    void deps.tg.escribiendo?.(chat);
    if (!hayCupo()) return decir(chat, "Llegué al tope de pedidos por hora. Probá de nuevo en un rato.");
    try {
      b.ficha = await deps.armar({ nuevo: b.pendientes, actual: b.ficha });
      b.pendientes = [];
      b.advertido = false;
      b.preguntoPublicar = true;
      b.saludado = false; // el próximo mensaje vuelve a recibir la guía de /listo
    } catch (err) {
      console.error(new Date().toISOString(), "bot: no pude armar la ficha:", err instanceof Error ? err.message : "error");
      return decir(chat, "No pude armar la ficha ahora. Tus datos siguen guardados: probá /listo de nuevo en un rato.");
    }
    return decir(chat, vista(b));
  }

  /** Devuelve true si la foto quedó guardada; si no, ya le explicó el motivo a Felipe. */
  async function agregarFoto(chat: number, b: Borrador, m: MensajeTelegram): Promise<boolean> {
    if (b.fotos.length >= LIMITES.fotos) {
      if (!b.avisoTope) {
        b.avisoTope = true;
        await decir(chat, `Ya tengo las ${LIMITES.fotos} fotos que admite un aviso. Las siguientes no las guardo.`);
      }
      return false;
    }
    let id = "";
    if (m.photo?.length) {
      // De mayor a menor: la primera que entra en el tope de peso.
      const candidatas = [...m.photo].reverse();
      id = (candidatas.find((p) => (p.file_size ?? 0) <= LIMITES.fotoBytes) ?? candidatas[candidatas.length - 1])?.file_id ?? "";
    } else if (m.document?.mime_type?.startsWith("image/")) {
      id = m.document.file_id;
    }
    if (!id) return false;
    try {
      const buf = await deps.tg.descargar(id, LIMITES.fotoBytes);
      const mime = mimeReal(buf);
      if (!mime) {
        await decir(chat, "Esa foto no la pude usar: tiene que ser JPG, PNG o WebP.");
        return false;
      }
      b.fotos.push(`data:${mime};base64,${buf.toString("base64")}`);
      b.advertido = false;
      return true;
    } catch {
      await decir(chat, "No pude bajar una foto (puede pesar demasiado). Mandala de nuevo como foto normal, no como archivo.");
      return false;
    }
  }

  async function publicar(chat: number, b: Borrador): Promise<void> {
    if (!b.ficha) return decir(chat, b.pendientes.length ? "Primero tocá /listo para que arme la ficha." : "No hay nada para publicar. Mandame los datos de un aviso.");
    const fotos = b.fotos;
    const { errores, avisos } = revisar(b);
    if (errores.length) return decir(chat, `No se puede publicar todavía:\n${errores.map((x) => `- ${x}`).join("\n")}`);
    if (avisos.length && !b.advertido) {
      b.advertido = true;
      b.preguntoPublicar = true;
      return decir(chat, `Antes de publicar, revisá:\n${avisos.map((x) => `- ${x}`).join("\n")}\n\n¿Lo publico igual así? Decime «sí», o pasame lo que falta.`);
    }
    let id: number;
    try {
      id = deps.publicar(aAviso(b.ficha, fotos, deps.propio));
    } catch (err) {
      console.error(new Date().toISOString(), "bot: no pude publicar:", err instanceof Error ? err.message : "error");
      return decir(chat, "No pude guardar el aviso en el sitio. Tu borrador sigue acá: probá /publicar de nuevo.");
    }
    borradores.delete(chat);
    return decir(chat, `Publicado ✅ ${deps.urlSitio ? `${deps.urlSitio}/a/${id}` : `aviso n.º ${id}`}\nCuando quieras, pasame el siguiente o preguntame lo que necesites.`);
  }

  async function manejar(update: UpdateTelegram): Promise<void> {
    const m = update.message;
    if (!m?.from || m.from.is_bot) return;
    if (m.chat.type !== "private" || !deps.permitidos.has(m.from.id)) return; // sin respuesta: no revela que existe
    const chat = m.chat.id;
    const texto = (m.text ?? m.caption ?? "").trim();
    const cmd = m.photo || m.document ? "" : comandoDe(texto);

    if (cmd === "start" || cmd === "ayuda" || cmd === "help") return decir(chat, AYUDA);
    if (cmd === "cancelar") {
      borradores.delete(chat);
      return decir(chat, "Listo, borré el borrador. Preguntame lo que quieras o tocá /aviso para cargar otro.");
    }

    // "? algo" o "/pregunta algo": pregunta sobre el sitio aunque haya un aviso a medio cargar.
    const pregunta = /^(?:\?|\/pregunta(?:@\w+)?\s)\s*([\s\S]+)$/i.exec(texto)?.[1]?.trim();
    if (pregunta && !m.photo && !m.document) return responder(chat, pregunta);

    const b = borradorDe(chat);
    b.ultima = ahora();

    if (cmd === "aviso") {
      b.enAviso = true;
      return decir(chat, b.ficha || b.pendientes.length || b.fotos.length ? "Seguimos con el aviso que estabas cargando. Mandame más datos o fotos, y /listo." : "Dale. Mandame los datos del aviso (reenviá los mensajes tal cual) y las fotos. Cuando termines, /listo.");
    }
    // Sin aviso en curso, un texto suelto va al asistente: si es una pregunta la contesta; si son datos de un aviso, arranca la carga.
    const cargando = b.enAviso || b.ficha !== null || b.pendientes.length > 0 || b.fotos.length > 0;
    if (!cargando && !cmd && texto && !m.photo && !m.document && deps.consultar) return responder(chat, texto);
    if (m.photo || m.document) b.enAviso = true;

    // Con un aviso en curso se habla normal: «publicalo», «dale», «cancelá». Lo que termina en «?» va al asistente
    // (si en realidad era un dato del aviso, el asistente lo devuelve al borrador).
    if (cargando && texto && !m.photo && !m.document && !cmd && /\?\s*$/.test(texto) && deps.consultar) return responder(chat, texto);
    if (texto && !m.photo && !m.document && !cmd) {
      if (quiereCancelar(texto)) {
        if (b.timer) clearTimeout(b.timer);
        borradores.delete(chat);
        return decir(chat, "Listo, lo borré. Preguntame lo que quieras o pasame otro aviso.");
      }
      if (b.ficha && !b.pendientes.length && (quierePublicar(texto) || (b.preguntoPublicar && confirma(texto)))) return publicar(chat, b);
      if (!b.ficha && quierePublicar(texto) && b.pendientes.length) {
        await procesar(chat, b);
        return;
      }
    }

    if (cmd === "estado") return decir(chat, vista(b));
    if (cmd === "listo") {
      if (!b.pendientes.length && !b.ficha) return decir(chat, "Primero mandame los datos del aviso y las fotos.");
      if (!b.pendientes.length) return decir(chat, vista(b));
      return procesar(chat, b);
    }
    if (cmd === "publicar") return publicar(chat, b);

    // No es un comando: datos, corrección o foto.
    if ((m.photo || m.document) && !(await agregarFoto(chat, b, m)) && !texto) return; // ya le explicó el problema
    if (texto) {
      if (b.pendientes.join("\n").length + texto.length > MAX_TEXTO_BORRADOR) return decir(chat, "Ese mensaje no entra: el borrador ya tiene demasiado texto. Tocá /listo o /cancelar.");
      b.pendientes.push(texto);
      b.advertido = false;
    }
    b.preguntoPublicar = false;
    if (deps.esperaAutoMs) {
      programar(chat, b);
      if (!b.saludado) {
        b.saludado = true;
        return decir(chat, b.ficha ? "📝 Anotado, actualizo la ficha en unos segundos." : "📝 Anotado. Mandame todo lo que tengas (datos y fotos) y en unos segundos te armo la ficha.");
      }
      return;
    }
    if (!b.saludado) {
      b.saludado = true;
      return decir(chat, b.ficha ? "Anotado. Cuando termines, tocá /listo y actualizo la ficha." : "Anotado. Seguí mandando datos y fotos, y cuando termines tocá /listo.");
    }
  }

  return { manejar };
}
