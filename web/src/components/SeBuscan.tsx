// «Se buscan»: lo que la gente anda buscando en la zona (sin nombre ni teléfono). Le habla a quien tiene algo y todavía no publicó.
import { RUBROS, WA_NUMERO } from "../../../shared/config.ts";
import type { RubroId, SeBusca } from "../../../shared/tipos.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { seBuscan } from "../api.ts";
import { useAparecer, useCarga } from "../hooks.ts";
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

export function SeBuscan({ cuantas }: { cuantas?: number }) {
  const c = useCarga(() => seBuscan(), []);
  if (c.estado !== "listo" || c.datos.length === 0) return null;
  const lista = cuantas ? c.datos.slice(0, cuantas) : c.datos;

  return (
    <ul className="se-buscan" aria-label="Lo que se busca">
      {lista.map((b) => (
        <li key={`${b.rubro}|${b.titulo}|${b.detalle}`} className="sb-item">
          <span className="sb-ico" aria-hidden="true">{esLocal(b) ? <IconoLocal /> : <IconoRubro rubro={(b.rubro in RUBROS ? b.rubro : "inmuebles") as RubroId} color="#C4572F" />}</span>
          <span className="sb-txt">
            <b>{b.titulo}</b>
            <span>{[b.detalle, b.directo ? "Dueño directo" : "", b.cuantas > 1 ? `${b.cuantas} personas buscan` : ""].filter(Boolean).join(" · ")}</span>
          </span>
          {numeroWA(WA_NUMERO) && (
            <a className="sb-tengo" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, mensaje(b))}>Tengo uno</a>
          )}
        </li>
      ))}
    </ul>
  );
}

const EN_PORTADA = 6;

function SeccionPortada({ total }: { total: number }) {
  // El hook va acá (y no arriba) porque la sección recién existe cuando llegaron las búsquedas.
  const ref = useAparecer<HTMLElement>();
  return (
    <section className="wrap sb-seccion" aria-labelledby="se-buscan-t" ref={ref}>
      <div className="sec-h"><h2 id="se-buscan-t">Se buscan en Chabás y la zona</h2>{total > EN_PORTADA && <a href={ir("se-buscan")}>Ver todas</a>}</div>
      <p className="sb-vivo"><span className="sb-punto" aria-hidden="true" />Búsquedas activas ahora</p>
      <SeBuscan cuantas={EN_PORTADA} />
      <p className="sb-pie">¿Tenés alguno? <a href={ir("publicar")}>Publicalo gratis</a> o escribime y te ayudo.</p>
    </section>
  );
}

/** Sección de la portada: arriba de «Sé de los primeros», que es donde se invita a publicar. */
export function SeBuscanPortada() {
  const c = useCarga(() => seBuscan(), []);
  if (c.estado !== "listo" || c.datos.length === 0) return null;
  return <SeccionPortada total={c.datos.length} />;
}

export function SeBuscanPagina() {
  return (
    <div className="wrap">
      <div className="page-h">
        <h1>Se <em>buscan.</em></h1>
        <p>Esto es lo que anda buscando la gente de Chabás y la zona. Si tenés alguno, tocá «Tengo uno» y escribime.</p>
      </div>
      <SeBuscan />
      <p className="sb-pie">¿Buscás otra cosa? <a href={ir("busco")}>Avisame cuando aparezca</a>.</p>
    </div>
  );
}
