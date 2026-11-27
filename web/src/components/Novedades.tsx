// Burbuja flotante de novedades (abajo a la derecha, donde cae el pulgar). Al lado, un globito que va pasando cosas
// REALES del sitio: lo que se busca, avisos nuevos, bajas de precio. Al tocarla se abre una hoja desde abajo con todo,
// más publicar y WhatsApp. El número rojo cuenta solo lo nuevo que la persona no vio. No tapa nada: se esconde
// mientras se baja leyendo, el globito se cierra con la ×, y no aparece en un aviso ni mientras alguien publica.
import { useEffect, useRef, useState } from "react";
import { WA_NUMERO } from "../../../shared/config.ts";
import type { AvisoPublico, SeBusca } from "../../../shared/tipos.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { listarAvisos, seBuscan } from "../api.ts";
import { hace } from "../formato.ts";
import { ir } from "../router.ts";

declare const __VISTA_PREVIA__: boolean;

const VISTO = "vidriera-notif-visto"; // firmas de lo que ya vio
const ULTIMA = "vidriera-notif-ultima"; // cuándo abrió la campanita por última vez
const CALLADO = "vidriera-notif-callado"; // cerró el globito en esta visita (sessionStorage)

export type Accion = "ve" | "abre" | "nuevos" | "bajo" | "busquedas" | "publicar" | "wa";

interface Item {
  clave: Exclude<Accion, "ve" | "abre">;
  icono: string;
  titulo: string;
  texto: string;
  href: string;
  externo?: boolean;
  /** Cambia cuando el contenido cambia: si es distinta a la que vio, cuenta como nueva. null = acceso fijo, nunca cuenta. */
  firma: string | null;
}

const leer = (k: string): string => {
  try {
    return window.localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const guardar = (k: string, v: string): void => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* modo privado: no pasa nada */
  }
};

function medir(a: Accion): void {
  if (__VISTA_PREVIA__) return;
  try {
    void fetch("/api/m", { method: "POST", headers: { "content-type": "application/json", "x-vidriera": "1" }, body: JSON.stringify({ t: "notif", a }), keepalive: true }).catch(() => {});
  } catch {
    /* nada */
  }
}

const SEMANA = 7 * 864e5;

/** Arma la lista con lo que hay en el sitio ahora. `desde`: última vez que abrió la campanita (0 = nunca). */
export function armarItems(avisos: AvisoPublico[], buscan: SeBusca[], desde: number, ahora = Date.now()): Item[] {
  const reales = avisos.filter((a) => !a.ejemplo);
  const items: Item[] = [];

  const corte = desde || ahora - SEMANA;
  const nuevos = reales.filter((a) => Date.parse(a.publicadoEn) > corte).sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn));
  const primero = nuevos[0];
  if (primero) {
    const n = nuevos.length;
    items.push({
      clave: "nuevos",
      icono: "🆕",
      titulo: desde ? (n === 1 ? "1 aviso nuevo desde tu última visita" : `${n} avisos nuevos desde tu última visita`) : n === 1 ? "Entró 1 aviso esta semana" : `Entraron ${n} avisos esta semana`,
      texto: n === 1 ? `${primero.titulo} · ${hace(primero.publicadoEn)}` : `El último: ${primero.titulo}`,
      href: n === 1 ? ir("aviso", primero.id) : ir("buscar"),
      firma: `n:${nuevos.map((a) => a.id).join(",")}`,
    });
  }

  const bajo = reales
    .filter((a) => a.precioAnterior !== null && a.precio !== null && a.precio < a.precioAnterior && !a.reservado)
    .sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn))[0];
  if (bajo) {
    items.push({ clave: "bajo", icono: "💸", titulo: "Bajó de precio", texto: bajo.titulo, href: ir("aviso", bajo.id), firma: `b:${bajo.id}:${bajo.precio}` });
  }

  if (buscan.length) {
    items.push({
      clave: "busquedas",
      icono: "🔎",
      titulo: buscan.length === 1 ? "Alguien busca algo en la zona" : `Se buscan ${buscan.length} cosas en la zona`,
      texto: `${buscan[0]?.titulo ?? ""}${buscan.length > 1 ? " y más" : ""}. ¿Tenés alguna?`,
      href: ir("se-buscan"),
      firma: `s:${buscan.map((b) => `${b.titulo}|${b.detalle}`).join(";")}`,
    });
  }

  items.push({ clave: "publicar", icono: "📸", titulo: "¿Vendés o alquilás algo?", texto: "Publicalo gratis en 3 pasos, desde el celular.", href: ir("publicar"), firma: null });
  if (numeroWA(WA_NUMERO)) {
    items.push({
      clave: "wa",
      icono: "💬",
      titulo: "¿Dudas? Escribime",
      texto: "Te respondo por WhatsApp y te ayudo a publicar.",
      href: linkWA(WA_NUMERO, "Hola Felipe! Tengo una consulta sobre Vidriera Chabás."),
      externo: true,
      firma: null,
    });
  }
  return items;
}


export interface Mensaje {
  icono: string;
  texto: string;
}

/** Lo que pasa el globito, de a uno: concreto y del pueblo (no "tenés 2 notificaciones"). */
export function armarMensajes(avisos: AvisoPublico[], buscan: SeBusca[], desde: number, ahora = Date.now()): Mensaje[] {
  const reales = avisos.filter((a) => !a.ejemplo);
  const m: Mensaje[] = [];
  for (const b of buscan.slice(0, 3)) {
    const plata = b.detalle.split(/\s*·\s*/).find((p) => /^hasta/i.test(p));
    m.push({ icono: "🔎", texto: `Se busca: ${b.titulo}${plata ? ` · ${plata.toLowerCase()}` : ""}. ¿Tenés uno?` });
  }
  const corte = desde || ahora - SEMANA;
  for (const a of reales.filter((x) => Date.parse(x.publicadoEn) > corte).slice(0, 2)) m.push({ icono: "🆕", texto: `Nuevo: ${a.titulo} · ${a.pueblo}` });
  const bajo = reales.find((a) => a.precioAnterior !== null && a.precio !== null && a.precio < a.precioAnterior && !a.reservado);
  if (bajo) m.push({ icono: "💸", texto: `Bajó de precio: ${bajo.titulo}` });
  // Intercalar: búsqueda, aviso, búsqueda… para que no pase todo lo mismo seguido.
  const bus = m.filter((x) => x.icono === "🔎"), resto = m.filter((x) => x.icono !== "🔎");
  const mezcla: Mensaje[] = [];
  for (let i = 0; i < Math.max(bus.length, resto.length); i++) {
    if (bus[i]) mezcla.push(bus[i] as Mensaje);
    if (resto[i]) mezcla.push(resto[i] as Mensaje);
  }
  return mezcla;
}

const SIN_BURBUJA = new Set(["aviso", "publicar", "busco", "admin"]);

export function Novedades({ ruta }: { ruta: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [vistas, setVistas] = useState<Set<string>>(() => new Set(leer(VISTO).split("\n").filter(Boolean)));
  const [abierto, setAbierto] = useState(false);
  const [globito, setGlobito] = useState(false);
  const [callado, setCallado] = useState(() => {
    try {
      return window.sessionStorage.getItem(CALLADO) === "1";
    } catch {
      return false;
    }
  });
  const [n, setN] = useState(0);
  const [oculta, setOculta] = useState(false);
  const hoja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const medido = useRef(false);

  useEffect(() => {
    let vigente = true;
    const desde = Number(leer(ULTIMA)) || 0;
    Promise.all([listarAvisos({}, 40).then((l) => l.avisos, () => [] as AvisoPublico[]), seBuscan().catch(() => [] as SeBusca[])]).then(([avisos, buscan]) => {
      if (!vigente) return;
      setItems(armarItems(avisos, buscan, desde));
      setMensajes(armarMensajes(avisos, buscan, desde));
    });
    return () => {
      vigente = false;
    };
  }, []);

  const nuevos = items.filter((i) => i.firma && !vistas.has(i.firma));
  const cuenta = nuevos.length;
  const visible = !SIN_BURBUJA.has(ruta) && items.length > 0;

  // El globito aparece a los 3 s y va pasando los mensajes cada 4,5 s.
  useEffect(() => {
    // En «Se busca» el globito repetiría lo que ya está en pantalla.
    if (!visible || callado || !mensajes.length || ruta === "se-buscan") {
      setGlobito(false);
      return;
    }
    if (!medido.current) {
      medido.current = true;
      medir("ve");
    }
    const t = window.setTimeout(() => setGlobito(true), 3000);
    const rueda = window.setInterval(() => setN((x) => x + 1), 4500);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(rueda);
    };
  }, [visible, callado, mensajes.length, ruta]);

  // Mientras se baja leyendo, se corre para no tapar; al parar o subir, vuelve.
  useEffect(() => {
    if (!visible) return;
    let y = window.scrollY;
    let quieto = 0;
    const alMover = () => {
      const ny = window.scrollY;
      if (ny > y + 6 && ny > 120) setOculta(true);
      else if (ny < y - 6) setOculta(false);
      y = ny;
      window.clearTimeout(quieto);
      quieto = window.setTimeout(() => setOculta(false), 700);
    };
    window.addEventListener("scroll", alMover, { passive: true });
    return () => {
      window.removeEventListener("scroll", alMover);
      window.clearTimeout(quieto);
    };
  }, [visible]);

  // Hoja abierta: Escape cierra y el foco vuelve a la burbuja.
  useEffect(() => {
    if (!abierto) return;
    hoja.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [abierto]);

  useEffect(() => setAbierto(false), [ruta]);

  const cerrar = () => {
    setAbierto(false);
    boton.current?.focus();
  };

  const abrir = () => {
    setAbierto(true);
    medir("abre");
    const firmas = items.map((i) => i.firma).filter((f): f is string => !!f);
    guardar(VISTO, firmas.join("\n"));
    guardar(ULTIMA, String(Date.now()));
    window.setTimeout(() => setVistas(new Set(firmas)), 1200);
  };

  const callar = () => {
    setCallado(true);
    try {
      window.sessionStorage.setItem(CALLADO, "1");
    } catch {
      /* nada */
    }
  };

  if (!visible) return null;
  const msj = mensajes.length ? mensajes[n % mensajes.length] : undefined;

  return (
    <>
      <div className={`burbuja${oculta && !abierto ? " oculta" : ""}`}>
        {globito && msj && !abierto && (
          <div className="burbuja-globo">
            <button type="button" className="burbuja-msj" onClick={abrir} aria-label={`${msj.texto}. Ver novedades`}>
              <span key={n} className="burbuja-rueda"><span aria-hidden="true">{msj.icono}</span> {msj.texto}</span>
            </button>
            <button type="button" className="burbuja-x" aria-label="Cerrar el globito" onClick={callar}>×</button>
          </div>
        )}
        <button
          type="button"
          ref={boton}
          className={cuenta ? "burbuja-btn hay" : "burbuja-btn"}
          aria-label={cuenta ? `Novedades de Vidriera: ${cuenta} sin ver` : "Novedades de Vidriera"}
          aria-expanded={abierto}
          aria-controls="burbuja-hoja"
          onClick={() => (abierto ? cerrar() : abrir())}
        >
          <img src="assets/img/isotipo-claro.svg" alt="" width="30" height="30" />
          {cuenta > 0 && <span className="burbuja-n" aria-hidden="true">{cuenta}</span>}
        </button>
      </div>

      {abierto && (
        <div className="hoja-fondo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
          <div className="hoja" id="burbuja-hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-t" tabIndex={-1} ref={hoja}>
            <div className="hoja-cab">
              <p id="hoja-t">Novedades de <em>Vidriera</em></p>
              <button type="button" className="hoja-x" aria-label="Cerrar" onClick={cerrar}>×</button>
            </div>
            <ul>
              {items.map((i) => (
                <li key={i.clave}>
                  <a
                    href={i.href}
                    className={i.firma && !vistas.has(i.firma) ? "nueva" : undefined}
                    {...(i.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    onClick={() => {
                      medir(i.clave);
                      setAbierto(false);
                    }}
                  >
                    <span className="notif-ico" aria-hidden="true">{i.icono}</span>
                    <span className="notif-txt"><b>{i.titulo}</b><span>{i.texto}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
