import { useRef, type PointerEvent as PE } from "react";
import type { Foco } from "../../../../shared/tipos.ts";

interface Props {
  foto: string;
  foco: Foco | null;
  onCambio: (f: Foco | null) => void;
}

/** CSS para dejar a la vista el punto elegido cuando una foto se recorta (ver object-position). */
export const posicionFoco = (f: Foco | null | undefined): string | undefined => (f ? `${f.x}% ${f.y}%` : undefined);

/** Elegir qué parte de la foto de tapa tiene que verse cuando se recorta en la portada y en las tarjetas. */
export function Encuadre({ foto, foco, onCambio }: Props) {
  const caja = useRef<HTMLDivElement>(null);

  const poner = (e: PE) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return;
    onCambio({ x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))), y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))) });
  };

  return (
    <fieldset className="encuadre">
      <legend>Encuadre de la foto de tapa</legend>
      <p className="small">En la portada la foto se recorta. Tocá o arrastrá sobre la foto para marcar lo que tiene que verse.</p>
      <div className="encuadre-fila">
        <div
          className="encuadre-foto"
          ref={caja}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            poner(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons) poner(e);
          }}
        >
          <img src={foto} alt="Foto de tapa completa: tocá donde está lo importante" draggable={false} />
          {foco && <span className="encuadre-punto" style={{ left: `${foco.x}%`, top: `${foco.y}%` }} aria-hidden="true" />}
        </div>
        <div className="encuadre-prev">
          <span className="small">Así se ve en la portada</span>
          <div className="encuadre-corte">
            <img src={foto} alt="" style={{ objectPosition: posicionFoco(foco) }} />
          </div>
          <button type="button" className="btn-mini" disabled={!foco} onClick={() => onCambio(null)}>Centrar</button>
        </div>
      </div>
    </fieldset>
  );
}
