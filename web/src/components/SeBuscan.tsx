// «Se busca»: la otra mitad del tablón. Acá está lo que la gente de la zona anda buscando (sin nombre ni teléfono) y el
// lugar para dejar el propio pedido. Le habla a quien tiene algo y todavía no publicó, y a quien busca y no lo encuentra.
import { useState } from "react";
import { RUBROS, WA_NUMERO } from "../../../shared/config.ts";
import type { RubroId, SeBusca } from "../../../shared/tipos.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { seBuscan } from "../api.ts";
import { hace } from "../formato.ts";
import { useAparecer, useCarga, useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";
import { IconoRubro } from "./Iconos.tsx";

const esLocal = (b: SeBusca): boolean => /local|galp[oó]n|comercio/i.test(b.titulo);

function IconoLocal() {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="#C4572F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="26" height="26">
      <path d="M5 12 7 6h18l2 6M5 12v14h22V12M5 12c0 2 2.7 3 5.3 3s5.3-1 5.7-3c.4 2 3 3 5.7 3S27 14 27 12" />
      <path d="M13 26v-6h6v6" />
    </svg>
  );
}

const mensaje = (b: SeBusca): string =>
  `Hola Felipe! Vi en Vidriera Chabás que buscan: ${b.titulo}${b.detalle ? ` (${b.detalle})` : ""}. Tengo algo para eso.`;

/** Separa el presupuesto ("Hasta $400.000") del resto del detalle, para mostrarlo destacado. */
export function partirDetalle(detalle: string): { presupuesto: string; resto: string } {
  const partes = detalle.split(/\s*·\s*/).filter(Boolean);
  const i = partes.findIndex((p) => /^(hasta|m[aá]ximo|presupuesto|\$|usd|u\$s)/i.test(p));
  if (i < 0) return { presupuesto: "", resto: partes.join(" · ") };
  const presupuesto = partes[i] ?? "";
  partes.splice(i, 1);
  return { presupuesto, resto: partes.join(" · ") };
}

const RUBRO_CORTO: Record<string, string> = { inmuebles: "Inmuebles", vehiculos: "Vehículos", agro: "Maquinaria agro", maquinaria: "Maquinaria agro", vacaciones: "Vacaciones" };

function Item({ b, oscuro = false }: { b: SeBusca; oscuro?: boolean }) {
  const { presupuesto, resto } = partirDetalle(b.detalle);
  return (
    <li className="sb-item">
      <span className="sb-ico" aria-hidden="true">{esLocal(b) ? <IconoLocal /> : <IconoRubro rubro={(b.rubro in RUBROS ? b.rubro : "inmuebles") as RubroId} color="#C4572F" />}</span>
      <span className="sb-txt">
        <b>{b.titulo}</b>
        {resto && <span>{resto}</span>}
        <span className="sb-meta">
          {presupuesto && <em className="sb-plata">{presupuesto}</em>}
          {b.directo && <span>Dueño directo</span>}
          {b.cuantas > 1 && <span>{b.cuantas} personas</span>}
          {b.desde && !oscuro && <span>{hace(b.desde)}</span>}
        </span>
      </span>
      {numeroWA(WA_NUMERO) && (
        <a className="sb-tengo" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, mensaje(b))}>Tengo uno</a>
      )}
    </li>
  );
}

export function SeBuscan({ lista, oscuro }: { lista: SeBusca[]; oscuro?: boolean }) {
  return (
    <ul className="se-buscan" aria-label="Lo que se busca">
      {lista.map((b) => <Item key={`${b.rubro}|${b.titulo}|${b.detalle}`} b={b} oscuro={oscuro} />)}
    </ul>
  );
}

const EN_PORTADA = 3;

function BandaPortada({ datos }: { datos: SeBusca[] }) {
  // El hook va acá (y no arriba) porque la sección recién existe cuando llegaron las búsquedas.
  const ref = useAparecer<HTMLElement>();
  return (
    <section className="sb-banda sb-seccion" aria-labelledby="se-busca-t" ref={ref}>
      <div className="wrap">
        <p className="sb-vivo"><span className="sb-punto" aria-hidden="true" />{datos.length === 1 ? "1 búsqueda activa" : `${datos.length} búsquedas activas`}</p>
        <h2 id="se-busca-t">Se <em>busca.</em></h2>
        <p className="sb-baja">Esto anda buscando la gente de Chabás y la zona. Si tenés alguno, escribime y lo publicamos.</p>
        <SeBuscan lista={datos.slice(0, EN_PORTADA)} oscuro />
        <div className="sb-acciones">
          <a className="btn btn-main" href={ir("se-buscan")}>{datos.length > EN_PORTADA ? `Ver las ${datos.length} búsquedas` : "Ver todas las búsquedas"}</a>
          <a className="btn btn-claro" href={ir("busco")}>¿Buscás algo? Dejá tu pedido</a>
        </div>
      </div>
    </section>
  );
}

/** Bloque de la portada. Si todavía no hay búsquedas a la vista, invita a dejar la primera. */
export function SeBuscanPortada() {
  const c = useCarga(() => seBuscan(), []);
  if (c.estado === "cargando") return null;
  const datos = c.estado === "listo" ? c.datos : [];
  if (!datos.length) {
    return (
      <section className="wrap" aria-label="Avisame cuando aparezca">
        <aside className="busco busco-corto">
          <div><h2>¿Buscás algo que no está?</h2><p>Dejá tu pedido y te aviso por WhatsApp apenas aparezca.</p></div>
          <a className="btn" href={ir("busco")}>Dejar mi pedido</a>
        </aside>
      </section>
    );
  }
  return <BandaPortada datos={datos} />;
}

function Compartir() {
  const [copiado, setCopiado] = useState(false);
  const url = `${window.location.origin}${window.location.pathname}${ir("se-buscan")}`;
  const compartir = async () => {
    const datos = { title: "Se busca en Chabás y la zona", text: "Esto anda buscando la gente de Chabás y la zona. ¿Tenés alguno?", url };
    try {
      if (navigator.share) {
        await navigator.share(datos);
        return;
      }
    } catch {
      return; // la persona cerró el menú de compartir
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sin portapapeles: no pasa nada */
    }
  };
  return <button type="button" className="btn btn-line sb-compartir" onClick={() => void compartir()}>{copiado ? "¡Link copiado!" : "Compartir estas búsquedas"}</button>;
}

/** La página propia de «Se busca». */
export function SeBuscanPagina() {
  useTitulo("Se busca");
  const c = useCarga(() => seBuscan(), []);
  const [rubro, setRubro] = useState("");
  const datos = c.estado === "listo" ? c.datos : [];
  const rubros = [...new Set(datos.map((b) => b.rubro))];
  const lista = rubro ? datos.filter((b) => b.rubro === rubro) : datos;

  return (
    <>
      <section className="sb-banda sb-cab">
        <div className="wrap">
          <p className="sb-vivo"><span className="sb-punto" aria-hidden="true" />{c.estado === "listo" ? (datos.length === 1 ? "1 búsqueda activa" : `${datos.length} búsquedas activas`) : "Búsquedas activas"}</p>
          <h1>Se <em>busca.</em></h1>
          <p className="sb-baja">Lo que anda buscando la gente de Chabás y la zona. Si tenés alguno, tocá «Tengo uno» y escribime: lo publicamos gratis y te pongo en contacto.</p>
        </div>
      </section>
      <div className="wrap sb-pagina">
        {rubros.length > 1 && (
          <div className="chips sb-filtros" role="group" aria-label="Filtrar por rubro">
            <button type="button" className="chip" aria-pressed={!rubro} onClick={() => setRubro("")}>Todas ({datos.length})</button>
            {rubros.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={rubro === r} onClick={() => setRubro(r)}>
                {RUBRO_CORTO[r] ?? r} ({datos.filter((b) => b.rubro === r).length})
              </button>
            ))}
          </div>
        )}
        {c.estado === "cargando" && <p className="sb-baja">Cargando…</p>}
        {c.estado === "error" && <p className="sb-baja">No se pudieron cargar las búsquedas. Probá de nuevo en un rato.</p>}
        {c.estado === "listo" && !datos.length && <p className="sb-baja">Ahora no hay búsquedas activas. ¡Dejá la tuya y sé el primero!</p>}
        {lista.length > 0 && <SeBuscan lista={lista} />}

        <section className="sb-como" aria-labelledby="sb-como-t">
          <h2 id="sb-como-t">¿Cómo funciona?</h2>
          <ol>
            <li><b>Alguien deja su pedido</b><span>Qué busca, dónde y cuánto puede pagar. Su nombre y teléfono no se muestran.</span></li>
            <li><b>Vos tenés lo que busca</b><span>Tocás «Tengo uno» y me escribís por WhatsApp.</span></li>
            <li><b>Los pongo en contacto</b><span>Y si querés, publicamos tu aviso gratis para que lo vea todo el pueblo.</span></li>
          </ol>
        </section>

        <aside className="busco">
          <div><h2>¿Buscás algo que no está?</h2><p>Dejá tu pedido: si querés, aparece acá (sin tu nombre ni teléfono) y te aviso por WhatsApp apenas aparezca.</p></div>
          <a className="btn" href={ir("busco")}>Dejar mi pedido</a>
        </aside>
        <div className="sb-pie-acc"><Compartir /></div>
      </div>
    </>
  );
}
