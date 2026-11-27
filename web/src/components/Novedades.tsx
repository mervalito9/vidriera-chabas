// Campanita de novedades en la cabecera. Muestra cosas REALES del sitio (avisos nuevos desde la última vez, bajas de
// precio, lo que se busca) más dos accesos fijos (publicar y WhatsApp). El número rojo cuenta solo lo nuevo que la
// persona todavía no vio; una vez por día aparece un globito que invita a tocarla. Nada inventado: si no hay novedades,
// la campanita queda sin número y sin globito.
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
const GLOBITO = "vidriera-notif-globito"; // día en que ya se mostró el globito

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

function Campana() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function Novedades({ ruta }: { ruta: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [vistas, setVistas] = useState<Set<string>>(() => new Set(leer(VISTO).split("\n").filter(Boolean)));
  const [abierto, setAbierto] = useState(false);
  const [globito, setGlobito] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const medido = useRef(false);

  useEffect(() => {
    let vigente = true;
    const desde = Number(leer(ULTIMA)) || 0;
    Promise.all([listarAvisos({}, 40).then((l) => l.avisos, () => [] as AvisoPublico[]), seBuscan().catch(() => [] as SeBusca[])]).then(([avisos, buscan]) => {
      if (vigente) setItems(armarItems(avisos, buscan, desde));
    });
    return () => {
      vigente = false;
    };
  }, []);

  const nuevos = items.filter((i) => i.firma && !vistas.has(i.firma));
  const cuenta = nuevos.length;
  const enPublicar = ruta === "publicar" || ruta === "busco";

  // El globito: una vez por día, a los pocos segundos, solo si hay algo nuevo de verdad y no está publicando.
  useEffect(() => {
    if (!cuenta || enPublicar || abierto) return;
    if (!medido.current) {
      medido.current = true;
      medir("ve");
    }
    const hoy = new Date().toISOString().slice(0, 10);
    if (leer(GLOBITO) === hoy) return;
    const t1 = window.setTimeout(() => {
      setGlobito(true);
      guardar(GLOBITO, hoy);
    }, 4000);
    const t2 = window.setTimeout(() => setGlobito(false), 14000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [cuenta, enPublicar, abierto]);

  // Cerrar tocando afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  // Al cambiar de pantalla se cierra.
  useEffect(() => setAbierto(false), [ruta]);

  const abrir = () => {
    const ahora = !abierto;
    setAbierto(ahora);
    setGlobito(false);
    if (!ahora) return;
    medir("abre");
    // Lo que está a la vista pasa a "visto" (el número se apaga), pero la lista se sigue viendo igual.
    const firmas = items.map((i) => i.firma).filter((f): f is string => !!f);
    guardar(VISTO, firmas.join("\n"));
    guardar(ULTIMA, String(Date.now()));
    window.setTimeout(() => setVistas(new Set(firmas)), 1200);
  };

  if (!items.length) return null;
  const primero = nuevos[0];

  return (
    <div className="notif" ref={caja}>
      <button
        type="button"
        ref={boton}
        className={cuenta ? "notif-btn hay" : "notif-btn"}
        aria-label={cuenta ? `Novedades: ${cuenta} sin ver` : "Novedades"}
        aria-expanded={abierto}
        aria-controls="notif-lista"
        onClick={abrir}
      >
        <Campana />
        {cuenta > 0 && <span className="notif-n" aria-hidden="true">{cuenta}</span>}
      </button>

      {globito && primero && !abierto && (
        <button type="button" className="notif-globito" onClick={abrir}>
          <span aria-hidden="true">{primero.icono}</span>
          <span><b>{primero.titulo}</b><span>Tocá para ver</span></span>
        </button>
      )}

      {abierto && (
        <div className="notif-lista" id="notif-lista" role="region" aria-label="Novedades">
          <p className="notif-cab">Novedades</p>
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
      )}
    </div>
  );
}
