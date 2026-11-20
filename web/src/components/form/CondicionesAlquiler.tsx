import { useState, type ReactNode } from "react";
import {
  AJUSTES, DURACIONES, GARANTIAS, INDICES, SERVICIOS, textoAjuste, textoDuracion,
  type CondicionesAlquiler as Condiciones,
} from "../../../../shared/alquiler.ts";
import { fmtNum, soloDigitos } from "../../../../shared/texto.ts";

interface Props {
  valor: Condiciones;
  /** Para un galpón, local o terreno no tiene sentido preguntar por mascotas ni muebles. */
  esVivienda: boolean;
  onCambio: (c: Condiciones) => void;
}

/** Botones de opción: tocar el elegido lo destilda (todo es opcional). */
function Opciones<T extends string | number>({ titulo, opciones, elegido, onElegir }: {
  titulo: string;
  opciones: readonly (readonly [T, string])[];
  elegido: T | null;
  onElegir: (v: T | null) => void;
}) {
  return (
    <Fila titulo={titulo}>
      {opciones.map(([v, texto]) => (
        <button key={String(v)} type="button" className={`chip${elegido === v ? " on" : ""}`} aria-pressed={elegido === v} onClick={() => onElegir(elegido === v ? null : v)}>{texto}</button>
      ))}
    </Fila>
  );
}

/** Varias a la vez (garantías, servicios). */
function Varias<T extends string>({ titulo, opciones, elegidas, onCambio }: {
  titulo: string;
  opciones: readonly (readonly [T, string])[];
  elegidas: T[];
  onCambio: (v: T[]) => void;
}) {
  return (
    <Fila titulo={titulo} nota="podés marcar varias">
      {opciones.map(([v, texto]) => {
        const on = elegidas.includes(v);
        return <button key={v} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onCambio(on ? elegidas.filter((x) => x !== v) : [...elegidas, v])}>{texto}</button>;
      })}
    </Fila>
  );
}

function Fila({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <div className="cond-fila" role="group" aria-label={titulo}>
      <span className="lbl">{titulo}{nota && <span className="opc"> ({nota})</span>}</span>
      <div className="cond-chips">{children}</div>
    </div>
  );
}

/** Lo que pide y ofrece el dueño de un alquiler. Aparece solo cuando se elige "Alquiler". */
export function CondicionesAlquiler({ valor: c, esVivienda, onCambio }: Props) {
  const set = <K extends keyof Condiciones>(k: K, v: Condiciones[K]) => onCambio({ ...c, [k]: v });
  // "Desde una fecha" se puede elegir antes de poner la fecha.
  const [conFecha, setConFecha] = useState(!!c.disponible && c.disponible !== "ya");
  const tieneExpensas = c.expensas !== null && c.expensas > 0;
  const [expensasSi, setExpensasSi] = useState(tieneExpensas);

  return (
    <fieldset className="condiciones-form">
      <legend>Condiciones del alquiler <span className="opc">(opcional, pero es lo primero que preguntan)</span></legend>

      <Fila titulo="¿Desde cuándo está disponible?">
        <button type="button" className={`chip${c.disponible === "ya" ? " on" : ""}`} aria-pressed={c.disponible === "ya"}
          onClick={() => { setConFecha(false); set("disponible", c.disponible === "ya" ? "" : "ya"); }}>Ya</button>
        <button type="button" className={`chip${conFecha ? " on" : ""}`} aria-pressed={conFecha}
          onClick={() => { const no = conFecha; setConFecha(!no); if (no || c.disponible === "ya") set("disponible", ""); }}>Desde una fecha</button>
        {conFecha && (
          <input type="date" className="cond-fecha" aria-label="Fecha desde la que está disponible" value={c.disponible === "ya" ? "" : c.disponible}
            onChange={(e) => set("disponible", e.target.value)} />
        )}
      </Fila>

      <Varias titulo="Garantía que acepta" opciones={GARANTIAS} elegidas={c.garantias} onCambio={(v) => set("garantias", v)} />

      <Opciones titulo="Depósito" opciones={[[0, "Sin depósito"], [1, "1 mes"], [2, "2 meses"]] as const} elegido={c.deposito} onElegir={(v) => set("deposito", v)} />
      <Opciones titulo="¿Pide el primer mes por adelantado?" opciones={[["si", "Sí"], ["no", "No"]] as const}
        elegido={c.adelantado === null ? null : c.adelantado ? "si" : "no"} onElegir={(v) => set("adelantado", v === null ? null : v === "si")} />

      <Opciones titulo="Duración del contrato" opciones={DURACIONES.map((m) => [m, textoDuracion(m)] as const)} elegido={c.duracion} onElegir={(v) => set("duracion", v)} />
      <Opciones titulo="¿Cada cuánto se ajusta el precio?" opciones={AJUSTES.map((m) => [m, textoAjuste(m)] as const)} elegido={c.ajuste} onElegir={(v) => set("ajuste", v)} />
      <Opciones titulo="¿Con qué índice?" opciones={INDICES.map((i) => [i, i === "convenir" ? "A convenir" : i] as const)} elegido={c.indice} onElegir={(v) => set("indice", v)} />

      <Fila titulo="Expensas">
        <button type="button" className={`chip${c.expensas === 0 ? " on" : ""}`} aria-pressed={c.expensas === 0}
          onClick={() => { setExpensasSi(false); set("expensas", c.expensas === 0 ? null : 0); }}>No tiene</button>
        <button type="button" className={`chip${expensasSi ? " on" : ""}`} aria-pressed={expensasSi}
          onClick={() => { const no = expensasSi; setExpensasSi(!no); if (no || c.expensas === 0) set("expensas", null); }}>Sí tiene</button>
        {expensasSi && (
          <input type="text" inputMode="numeric" className="cond-plata" aria-label="Expensas por mes, en pesos" placeholder="$ por mes" maxLength={11}
            value={c.expensas ? fmtNum(c.expensas) : ""} onChange={(e) => { const n = Number(soloDigitos(e.target.value).slice(0, 8)); set("expensas", n > 0 ? n : null); }} />
        )}
      </Fila>
      <Varias titulo="Aparte del alquiler, el inquilino paga" opciones={SERVICIOS} elegidas={c.paga} onCambio={(v) => set("paga", v)} />

      {esVivienda && (
        <>
          <Opciones titulo="Mascotas" opciones={[["si", "Se aceptan"], ["no", "No"], ["consultar", "Consultar"]] as const} elegido={c.mascotas} onElegir={(v) => set("mascotas", v)} />
          <Opciones titulo="¿Está amoblado?" opciones={[["si", "Sí"], ["parcial", "En parte"], ["no", "No"]] as const} elegido={c.amoblado} onElegir={(v) => set("amoblado", v)} />
        </>
      )}

      <div className="cond-fila">
        <label className="lbl" htmlFor="f-requisitos">Otros requisitos <span className="opc">(si pide algo más)</span></label>
        <input id="f-requisitos" type="text" maxLength={200} autoComplete="off" placeholder="Ej: ingresos comprobables, solo familia" value={c.requisitos}
          onChange={(e) => set("requisitos", e.target.value)} />
      </div>
    </fieldset>
  );
}
