import { useState } from "react";
import { CAMPOS_GUIADOS, escribirGuiado, leerGuiados } from "../../../../shared/datosGuiados.ts";
import { soloDigitos } from "../../../../shared/texto.ts";
import type { RubroId } from "../../../../shared/tipos.ts";
import { listaDatos } from "./valores.ts";

/** Año, km, dormitorios… según el rubro. Se guardan como etiquetas en "datos". */
export function DatosGuiados({ rubro, datos, onCambio }: { rubro: RubroId; datos: string; onCambio: (d: string) => void }) {
  const lista = listaDatos(datos);
  const { valores } = leerGuiados(rubro, lista);
  // Lo que está escribiendo en los campos de números (un año a medio escribir todavía no es válido y no se guarda).
  const [crudo, setCrudo] = useState<Record<string, string>>({});
  const poner = (id: string, valor: string) => onCambio(escribirGuiado(rubro, lista, id, valor).join(", "));
  return (
    <fieldset className="guiados">
      <legend>Lo que más preguntan <span className="opc">(opcional, pero ayuda mucho)</span></legend>
      <div className="guiados-campos">
        {CAMPOS_GUIADOS[rubro].map((c) => {
          const id = `g-${c.id}`;
          if (c.tipo === "si") return (
            <label key={c.id} className="check guiado-si"><input type="checkbox" checked={valores[c.id] === "si"} onChange={(e) => poner(c.id, e.target.checked ? "si" : "")} /> {c.etiqueta}</label>
          );
          return (
            <div key={c.id}>
              <label className="lbl" htmlFor={id}>{c.etiqueta}</label>
              {c.tipo === "opciones" ? (
                <select id={id} value={valores[c.id] ?? ""} onChange={(e) => poner(c.id, e.target.value)}>
                  <option value="">—</option>
                  {c.opciones?.map((o) => <option key={o} value={o}>{o}{c.id === "dorm" && o === "5" ? " o más" : ""}</option>)}
                </select>
              ) : (
                <input id={id} type="text" inputMode="numeric" maxLength={9} autoComplete="off" placeholder={c.placeholder} value={crudo[c.id] ?? valores[c.id] ?? ""}
                  onChange={(e) => { const t = soloDigitos(e.target.value); setCrudo({ ...crudo, [c.id]: t }); poner(c.id, t); }}
                  onBlur={() => setCrudo(Object.fromEntries(Object.entries(crudo).filter(([k]) => k !== c.id)))} />
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
