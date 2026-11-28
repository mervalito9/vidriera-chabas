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

export type Accion = "ve" | "abre" | "pill" | "tarjeta" | "tarde" | "nuevos" | "bajo" | "busquedas" | "publicar" | "wa";

export type Icono = "busca" | "nuevo" | "bajo" | "publicar" | "wa";

/** Íconos de línea propios (los emojis se ven distintos en cada celular y abaratan todo). */
export function IconoNovedad({ tipo }: { tipo: Icono }) {
  const p = { viewBox: "0 0 24 24", width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (tipo === "busca") return <svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.6-4.6" /></svg>;
  if (tipo === "nuevo") return <svg {...p}><path d="M12 3.5 13.9 9l5.6 1-4.2 3.8 1.2 5.7L12 16.7l-4.5 2.8 1.2-5.7L4.5 10l5.6-1z" /></svg>;
  if (tipo === "bajo") return <svg {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /><path d="M12 9v6m0 0-2.2-2.2M12 15l2.2-2.2" /></svg>;
  if (tipo === "publicar") return <svg {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.5" r="3.4" /></svg>;
  return <svg {...p}><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" /></svg>;
}

interface Item {
  clave: Exclude<Accion, "ve" | "abre">;
  icono: Icono;
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
      icono: "nuevo",
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
    items.push({ clave: "bajo", icono: "bajo", titulo: "Bajó de precio", texto: bajo.titulo, href: ir("aviso", bajo.id), firma: `b:${bajo.id}:${bajo.precio}` });
  }

  if (buscan.length) {
    items.push({
      clave: "busquedas",
      icono: "busca",
      titulo: buscan.length === 1 ? "Alguien busca algo en la zona" : `Se buscan ${buscan.length} cosas en la zona`,
      texto: `${buscan[0]?.titulo ?? ""}${buscan.length > 1 ? " y más" : ""}. ¿Tenés alguna?`,
      href: ir("se-buscan"),
      firma: `s:${buscan.map((b) => `${b.titulo}|${b.detalle}`).join(";")}`,
    });
  }

  items.push({ clave: "publicar", icono: "publicar", titulo: "¿Vendés o alquilás algo?", texto: "Publicalo gratis en 3 pasos, desde el celular.", href: ir("publicar"), firma: null });
  if (numeroWA(WA_NUMERO)) {
    items.push({
      clave: "wa",
      icono: "wa",
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
  icono: Icono;
  /** Rótulo corto arriba ("Se busca", "Nuevo en Casilda", "Bajó de precio"). */
  etiqueta: string;
  texto: string;
  /** Adónde lleva tocar el mensaje: directo a lo que dice, sin pasos en el medio. */
  href: string;
}

/** Lo que pasa el globito, de a uno: concreto y del pueblo (no "tenés 2 notificaciones"). */
export function armarMensajes(avisos: AvisoPublico[], buscan: SeBusca[], desde: number, ahora = Date.now()): Mensaje[] {
  const reales = avisos.filter((a) => !a.ejemplo);
  const m: Mensaje[] = [];
  for (const b of buscan.slice(0, 3)) {
    const plata = b.detalle.split(/\s*·\s*/).find((p) => /^hasta/i.test(p));
    m.push({ icono: "busca", etiqueta: "Se busca · ¿tenés uno?", texto: `${b.titulo}${plata ? ` · ${plata.toLowerCase()}` : ""}`, href: ir("se-buscan") });
  }
  const corte = desde || ahora - SEMANA;
  for (const a of reales.filter((x) => Date.parse(x.publicadoEn) > corte).slice(0, 2)) m.push({ icono: "nuevo", etiqueta: `Nuevo en ${a.pueblo}`, texto: a.titulo, href: ir("aviso", a.id) });
  const bajo = reales.find((a) => a.precioAnterior !== null && a.precio !== null && a.precio < a.precioAnterior && !a.reservado);
  if (bajo) m.push({ icono: "bajo", etiqueta: "Bajó de precio", texto: bajo.titulo, href: ir("aviso", bajo.id) });
  // Intercalar: búsqueda, aviso, búsqueda… para que no pase todo lo mismo seguido.
  const bus = m.filter((x) => x.icono === "busca"), resto = m.filter((x) => x.icono !== "busca");
  const mezcla: Mensaje[] = [];
  for (let i = 0; i < Math.max(bus.length, resto.length); i++) {
    if (bus[i]) mezcla.push(bus[i] as Mensaje);
    if (resto[i]) mezcla.push(resto[i] as Mensaje);
  }
  // En temporada, la sección de vacaciones (va segunda para que se vea pronto).
  const mes = new Date(ahora).getMonth();
  if (mes >= 10 || mes <= 2) {
    const n = reales.filter((a) => a.rubro === "vacaciones").length;
    mezcla.splice(Math.min(1, mezcla.length), 0, { icono: "nuevo", etiqueta: "Temporada de vacaciones", texto: n ? `${n === 1 ? "1 casa" : `${n} casas`} de dueños de la zona` : "Casas de dueños de la zona", href: ir("vacaciones") });
  }
  // Siempre hay algo que decir: la invitación a publicar cierra la vuelta (y es lo único si no hay novedades).
  mezcla.push({ icono: "publicar", etiqueta: "¿Vendés o alquilás algo?", texto: "Publicalo gratis acá", href: ir("publicar") });
  return mezcla;
}

const SIN_BURBUJA = new Set(["aviso", "publicar", "busco", "admin"]);

export function Novedades({ ruta }: { ruta: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [vistas, setVistas] = useState<Set<string>>(() => new Set(leer(VISTO).split("\n").filter(Boolean)));
  const [abierto, setAbierto] = useState(false);
  const [globito, setGlobito] = useState(false);
  const [n, setN] = useState(0);
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
  // El número arranca en 0 y sube hasta lo real, como si recién llegaran las novedades.
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    if (mostrado === cuenta) return;
    const t = window.setTimeout(() => setMostrado((x) => (x < cuenta ? x + 1 : cuenta)), mostrado === 0 ? 1400 : 350);
    return () => window.clearTimeout(t);
  }, [mostrado, cuenta]);
  const visible = !SIN_BURBUJA.has(ruta) && items.length > 0;

  // En «Se busca» no repite las búsquedas que ya están en pantalla.
  const lista = ruta === "se-buscan" ? mensajes.filter((m) => m.icono !== "busca") : mensajes;

  // El mensaje aparece a los 2 s y cambia cada 6 s (tiempo para leerlo y tocarlo). Se queda siempre a la vista.
  useEffect(() => {
    if (!visible || !lista.length) {
      setGlobito(false);
      return;
    }
    if (!medido.current) {
      medido.current = true;
      medir("ve");
    }
    const t = window.setTimeout(() => setGlobito(true), 2000);
    const rueda = window.setInterval(() => setN((x) => x + 1), 6000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(rueda);
    };
  }, [visible, lista.length]);

  // La tarjeta grande: sube sola a los 5 s, se achica a la pastilla si no la tocan (9 s) y vuelve cada 40 s;
  // con «Más tarde» espera 90 s. Hasta 4 veces por visita. No tapa la página (se puede seguir usando) ni sale
  // mientras alguien escribe en un campo.
  const [tarjeta, setTarjeta] = useState<Mensaje | null>(null);
  const veces = useRef(0);
  const reloj = useRef(0);
  const programarTarjeta = useRef<(ms: number) => void>(() => {});
  programarTarjeta.current = (ms: number) => {
    window.clearTimeout(reloj.current);
    if (veces.current >= 4) return;
    reloj.current = window.setTimeout(() => {
      const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
      if (escribiendo || document.hidden) return programarTarjeta.current(10_000);
      const m = lista[(veces.current * 2) % Math.max(1, lista.length)];
      if (!m) return;
      veces.current += 1;
      setTarjeta(m);
      reloj.current = window.setTimeout(() => {
        setTarjeta(null);
        programarTarjeta.current(40_000);
      }, 9000);
    }, ms);
  };
  useEffect(() => {
    if (!visible || !lista.length || abierto) {
      setTarjeta(null);
      window.clearTimeout(reloj.current);
      return;
    }
    programarTarjeta.current(tarjeta ? 9000 : veces.current ? 40_000 : 5000);
    return () => window.clearTimeout(reloj.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lista.length, abierto]);
  const masTarde = () => {
    medir("tarde");
    setTarjeta(null);
    programarTarjeta.current(90_000);
  };

  // El número también en la pestaña: "(3) Vidriera Chabás", como las redes.
  useEffect(() => {
    const t = document.querySelector("title");
    const poner = () => {
      const limpio = document.title.replace(/^\(\d+\) /, "");
      const nuevo = cuenta && visible ? `(${cuenta}) ${limpio}` : limpio;
      if (document.title !== nuevo) document.title = nuevo;
    };
    poner();
    if (!t) return;
    const obs = new MutationObserver(poner);
    obs.observe(t, { childList: true });
    return () => {
      obs.disconnect();
      document.title = document.title.replace(/^\(\d+\) /, "");
    };
  }, [cuenta, visible]);

  // Hoja abierta: Escape cierra y el foco vuelve a la burbuja.
  useEffect(() => {
    if (!abierto) return;
    hoja.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    setTarjeta(null);
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

  if (!visible) return null;
  const msj = lista.length ? lista[n % lista.length] : undefined;

  return (
    <>
      {tarjeta && !abierto && (
        <div className="tarjeta-nov" role="status" aria-live="polite">
          <div className="tarjeta-cab">
            <span className="tarjeta-app" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><g fill="#F7EFE2"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" opacity=".55" /></g></svg></span>
            <span>Vidriera Chabás · ahora</span>
            {cuenta > 0 && <span className="tarjeta-n">{cuenta}</span>}
          </div>
          <a className="tarjeta-cuerpo" href={tarjeta.href} onClick={() => { medir("tarjeta"); setTarjeta(null); }}>
            <small><IconoNovedad tipo={tarjeta.icono} />{tarjeta.etiqueta}</small>
            <b>{tarjeta.texto}</b>
          </a>
          <div className="tarjeta-acc">
            <button type="button" className="tarjeta-tarde" onClick={masTarde}>Más tarde</button>
            <a className="tarjeta-ver" href={tarjeta.href} onClick={() => { medir("tarjeta"); setTarjeta(null); }}>
              Ver
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      )}

      <div className={`burbuja${globito && msj && !abierto ? " abierta" : ""}${tarjeta && !abierto ? " con-tarjeta" : ""}`}>
        <div className="burbuja-pill">
          <button
            type="button"
            ref={boton}
            className={cuenta ? "burbuja-ico hay" : "burbuja-ico"}
            aria-label={cuenta ? `Novedades de Vidriera: ${cuenta} sin ver` : "Novedades de Vidriera"}
            aria-expanded={abierto}
            aria-controls="burbuja-hoja"
            onClick={() => (abierto ? cerrar() : abrir())}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="#F7EFE2"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" opacity=".55" /></g></svg>
            {mostrado > 0 && <span className="burbuja-n" key={`${mostrado}-${n}`} aria-hidden="true">{mostrado}</span>}
          </button>
          {globito && msj && (
            <a
              className="burbuja-msj"
              href={msj.href}
              key={n}
              onClick={() => medir("pill")}
            >
              <span className="burbuja-txt">
                <small><IconoNovedad tipo={msj.icono} />{msj.etiqueta}</small>
                <b>{msj.texto}</b>
              </span>
              <span className="burbuja-ir" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
              </span>
            </a>
          )}
        </div>
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
                    <span className="notif-ico" aria-hidden="true"><IconoNovedad tipo={i.icono} /></span>
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
