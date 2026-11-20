import type { ReactNode } from "react";
import { DIAS_VIGENCIA, WA_NUMERO } from "../../../shared/config.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { ir } from "../router.ts";

const escribime = (texto: string) => (
  <a target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, "Hola Felipe! Te escribo por Vidriera Chabás.")}>{texto}</a>
);

/** Preguntas frecuentes. Las primeras son las que más se repiten: la portada muestra solo esas. */
export const PREGUNTAS: [string, ReactNode][] = [
  ["¿Qué es Vidriera Chabás?", <>Un tablón de avisos de Chabás y la zona (Casilda, Firmat, Sanford, Villada y alrededores) para comprar, vender o alquilar casas, terrenos, autos y más. Quien publica y quien busca hablan directo por WhatsApp.</>],
  ["¿Cuánto cuesta publicar?", <>Nada. Publicar es gratis y no se cobra comisión cuando vendés o alquilás.</>],
  ["¿Cómo publico?", <>Tocá <a href={ir("publicar")}>Publicar gratis</a> y completá el formulario con fotos: lleva unos 2 minutos. Si te cuesta, mandanos los datos y las fotos por WhatsApp y lo armamos nosotros.</>],
  ["¿Cómo hablo con quien vende o alquila?", <>Cada aviso tiene un botón de WhatsApp que te lleva directo al dueño, o a la inmobiliaria o agencia si dice «Publica: …». Vidriera no se mete en la conversación ni en el negocio.</>],
  ["No encuentro lo que busco, ¿qué hago?", <>Dejanos qué buscás en <a href={ir("busco")}>Avisame cuando aparezca</a> y te escribimos por WhatsApp cuando alguien lo publique.</>],
  ["¿Cuánto tarda en aparecer mi aviso?", <>Revisamos cada aviso a mano antes de publicarlo, para que no haya avisos falsos ni repetidos. Apenas está publicado, te pasamos el link para que lo compartas.</>],
  ["¿Cuánto tiempo queda publicado?", <>{DIAS_VIGENCIA} días. Si para entonces no se vendió o alquiló, lo renovamos gratis. Si se vendió antes, avisanos y lo bajamos.</>],
  ["¿Pueden publicar inmobiliarias y agencias?", <>Sí, también gratis. Si tienen varios avisos, nos mandan la lista con fotos y los cargamos. En cada aviso figura quién publica.</>],
  ["¿Cómo evito que me estafen?", <>Mirá la casa o el vehículo en persona antes de pagar nada, desconfiá de señas por adelantado sin conocer al dueño y revisá los papeles: las escrituras las hace una escribanía y las transferencias de vehículos, el Registro Automotor. Si un aviso te parece raro, {escribime("avisanos")}.</>],
  ["¿Quién está detrás de Vidriera?", <>La armé yo, Felipe Sancho, de Chabás. Si tenés una idea o algo no te cierra, {escribime("escribime por WhatsApp")}. En <a href={ir("como-funciona")}>Cómo funciona</a> te cuento por qué la hice.</>],
];

/** Lista de preguntas que se abren al tocarlas. `cuantas` limita (la portada muestra las primeras). */
export function Preguntas({ cuantas }: { cuantas?: number }) {
  return (
    <div className="faq">
      {PREGUNTAS.slice(0, cuantas).map(([p, r]) => (
        <details key={p}>
          <summary>{p}</summary>
          <div className="faq-r">{r}</div>
        </details>
      ))}
    </div>
  );
}
