import { WA_NUMERO } from "../../../shared/config.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { useAparecer } from "../hooks.ts";
import { FaltaWhatsApp } from "./Pueblos.tsx";

/** "Hola, soy Felipe": por qué existe Vidriera. Va en "Cómo funciona"; la portada solo lleva una línea que trae acá. */
export function Carta() {
  const ref = useAparecer<HTMLElement>();
  return (
    <section className="wrap" aria-labelledby="quien" ref={ref}>
      <div className="carta">
        <div className="carta-txt">
          <h2 id="quien">Hola, soy Felipe.</h2>
          <p>Soy de Chabás y armé Vidriera porque me pasaba lo mismo que a todos: querés saber qué casa se alquila, quién vende un auto o una sembradora, y terminás preguntando de a uno, mirando carteles o buscando en mil grupos. Y el precio casi nunca lo sabés hasta que preguntás.</p>
          <p>La idea es simple:</p>
        </div>
        <ul className="objetivos">
          <li><b>Que esté todo en un lugar.</b><span>Casas, alquileres, autos y motos de Chabás y la zona, para comprar o alquilar.</span></li>
          <li><b>Que los precios estén a la vista.</b><span>Así sabés cuánto se pide antes de preguntar, y podés comparar.</span></li>
          <li><b>Armar un historial de precios.</b><span>Para ver cuánto se pide por un alquiler, un terreno o un tractor, y cómo va cambiando. Ya lo estamos guardando.</span></li>
          <li><b>Que sea gratis y directo entre vecinos.</b><span>Sin comisiones y sin vueltas.</span></li>
        </ul>
        <div className="carta-cta">
          <p>Recién arranco, así que si tenés una idea o algo que no te cierra, escribime.</p>
          <div className="quien-wa">
            {numeroWA(WA_NUMERO) ? (
              <a className="btn btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, "Hola Felipe! Te escribo por Vidriera Chabás.")}>Escribime por WhatsApp</a>
            ) : <FaltaWhatsApp />}
          </div>
        </div>
      </div>
    </section>
  );
}
