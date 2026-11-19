import { useState } from "react";
import { LIMITES } from "../../../../shared/config.ts";
import { achicarFoto } from "../../fotos.ts";

interface Props {
  fotos: string[];
  exigir: boolean;
  /** Error que viene de la validación del aviso (por ejemplo, "Subí al menos una foto") */
  error: string;
  onCambio: (fotos: string[]) => void;
  /** Avisa mientras se achican las fotos, para no dejar enviar a medias */
  onProcesando: (si: boolean) => void;
}

/** Elegir, sacar y ordenar las fotos. La primera es la de tapa. */
export function ElegirFotos({ fotos, exigir, error, onCambio, onProcesando }: Props) {
  const [procesando, setProcesando] = useState(false);
  const [errFoto, setErrFoto] = useState("");
  const ocupado = (si: boolean) => {
    setProcesando(si);
    onProcesando(si);
  };

  const agregar = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setErrFoto("");
    ocupado(true);
    const nuevas: string[] = [];
    for (const archivo of Array.from(lista).slice(0, LIMITES.fotos - fotos.length)) {
      try {
        nuevas.push(await achicarFoto(archivo));
      } catch (e) {
        setErrFoto(e instanceof Error ? e.message : "No se pudo agregar una foto.");
      }
    }
    ocupado(false);
    onCambio([...fotos, ...nuevas].slice(0, LIMITES.fotos));
  };

  const mover = (i: number, a: number) => {
    if (a < 0 || a >= fotos.length) return;
    const lista = [...fotos];
    const [f] = lista.splice(i, 1);
    if (f !== undefined) lista.splice(a, 0, f);
    onCambio(lista);
  };

  return (
    <fieldset>
      <legend>3. Fotos {exigir ? "" : <span className="opc">(opcional)</span>}</legend>
      <div className="fotos-pick">
        {fotos.map((f, i) => (
          <div key={i} className="foto-mini">
            <img src={f} alt={`Foto ${i + 1}`} />
            <button type="button" aria-label={`Sacar foto ${i + 1}`} onClick={() => onCambio(fotos.filter((_, j) => j !== i))}>×</button>
            {i === 0 && <span className="foto-tapa">Tapa</span>}
            {fotos.length > 1 && (
              <span className="foto-mover">
                <button type="button" aria-label={`Mover la foto ${i + 1} a la izquierda`} disabled={i === 0} onClick={() => mover(i, i - 1)}>‹</button>
                <button type="button" aria-label={`Mover la foto ${i + 1} a la derecha`} disabled={i === fotos.length - 1} onClick={() => mover(i, i + 1)}>›</button>
              </span>
            )}
          </div>
        ))}
        {fotos.length < LIMITES.fotos && (
          <label className="foto-add" htmlFor="f-fotos">
            <span aria-hidden="true">+</span>{procesando ? "Preparando…" : fotos.length ? "Agregar más" : "Agregar fotos"}
          </label>
        )}
      </div>
      <input id="f-fotos" className="sr" type="file" accept="image/*" multiple onChange={(e) => { void agregar(e.target.files); e.target.value = ""; }} />
      <p className="small">Hasta {LIMITES.fotos} fotos, con luz de día. La primera es la de tapa; con las flechas ‹ › cambiás el orden.</p>
      {(error || errFoto) && <p className="err">{error || errFoto}</p>}
    </fieldset>
  );
}
