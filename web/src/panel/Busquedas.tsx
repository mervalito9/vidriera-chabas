// Búsquedas guardadas ("Avisame cuando aparezca").
import { fmtFecha } from "../../../shared/texto.ts";
import type { Busqueda } from "../../../shared/tipos.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { admin } from "../api.ts";
import { Cargando } from "../components/Tarjeta.tsx";
import { Confirmar, Titulo, esNueva, type Accion } from "./comunes.tsx";

export function Busquedas({ busquedas, accion }: { busquedas: Busqueda[] | null; accion: Accion }) {
  return (
    <>
      <Titulo t="Búsquedas" />
      <p className="pn-gris">Gente que dejó su WhatsApp en «Avisame cuando aparezca». Cuando consigas algo, escribiles.</p>
      {busquedas === null ? <Cargando /> : busquedas.length === 0 ? <p className="pn-caja pn-gris">Todavía nadie dejó una búsqueda.</p> : (
        <div className="pn-busq">
          {busquedas.map((b) => {
            const nueva = esNueva(b.creadoEn);
            return (
              <div key={b.id} className="pn-caja pn-busq-item">
                <div className="pn-busq-txt">
                  <span className="pn-busq-rubro">{b.rubro}{nueva && <span className="pn-chip pen">Nueva</span>}</span>
                  <b>{b.que}</b>
                  <span className="pn-gris">{b.nombre} · {b.presupuesto || "sin presupuesto"} · {fmtFecha(new Date(b.creadoEn))}</span>
                </div>
                <div className="pn-busq-acc">
                  <a className="pn-btn pn-btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(b.telefono, `Hola ${b.nombre}! Te escribo de Vidriera Chabás por lo que estabas buscando.`)}>WhatsApp</a>
                  <Confirmar texto="Borrar" onSi={() => void accion(() => admin.borrarBusqueda(b.id))} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

