// Calendario mensual de un alquiler de vacaciones: cada día libre u ocupado. Sirve para mirarlo (ficha del aviso)
// y para marcarlo (formulario): se toca el primer día y el último de cada alquiler.
import { useMemo, useState } from "react";
import { anioTemporada, estadoDia, marcarRango, sumarDias, type Calendario } from "../../../shared/vacaciones.ts";
import type { AvisoPublico } from "../../../shared/tipos.ts";
import { hace } from "../formato.ts";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

const hoyISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mesDe = (f: string): string => f.slice(0, 7);
const moverMes = (m: string, n: number): string => {
  const [a, b] = m.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, b - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const diasDelMes = (m: string): string[] => {
  const out: string[] = [];
  for (let d = `${m}-01`; mesDe(d) === m; d = sumarDias(d, 1)) out.push(d);
  return out;
};
/** 0 = lunes … 6 = domingo */
const diaSemana = (f: string): number => (new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7;
const nombreMes = (m: string): string => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Meses de la temporada (dic → mar), para saltar rápido. */
const mesesTemporada = (): string[] => {
  const a = anioTemporada();
  return [`${a}-12`, `${a + 1}-01`, `${a + 1}-02`, `${a + 1}-03`];
};

interface Props {
  estado: (dia: string) => "libre" | "ocupado" | "";
  mesInicial: string;
  onTocar?: (dia: string) => void;
  /** Día marcado como inicio de un rango (al editar). */
  inicio?: string;
}

function Mes({ estado, mesInicial, onTocar, inicio }: Props) {
  const [mes, setMes] = useState(mesInicial);
  const hoy = hoyISO();
  const dias = diasDelMes(mes);
  const huecos = diaSemana(dias[0] as string);
  const libres = dias.filter((d) => d >= hoy && estado(d) === "libre").length;
  return (
    <div className="cal">
      <div className="cal-saltos" role="group" aria-label="Ir a un mes de la temporada">
        {mesesTemporada().map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={m === mes} onClick={() => setMes(m)}>{MESES[Number(m.slice(5, 7)) - 1]?.slice(0, 3)}</button>
        ))}
      </div>
      <div className="cal-cab">
        <button type="button" className="cal-flecha" aria-label="Mes anterior" onClick={() => setMes(moverMes(mes, -1))}>‹</button>
        <div className="cal-titulo">
          <b>{nombreMes(mes)}</b>
          <small>{libres ? `${libres} ${libres === 1 ? "día libre" : "días libres"}` : dias.some((d) => estado(d)) ? "Sin días libres" : "Sin datos para este mes"}</small>
        </div>
        <button type="button" className="cal-flecha" aria-label="Mes siguiente" onClick={() => setMes(moverMes(mes, 1))}>›</button>
      </div>
      <div className="cal-grilla" role="grid" aria-label={`Disponibilidad de ${nombreMes(mes)}`}>
        {SEMANA.map((s, i) => <span key={i} className="cal-sem" aria-hidden="true">{s}</span>)}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
        {dias.map((d) => {
          const e = estado(d);
          const clase = ["cal-dia", e, d < hoy ? "pasado" : "", d === hoy ? "hoy" : "", d === inicio ? "inicio" : ""].filter(Boolean).join(" ");
          const etiqueta = `${Number(d.slice(8))} de ${MESES[Number(d.slice(5, 7)) - 1]?.toLowerCase()}: ${e === "libre" ? "libre" : e === "ocupado" ? "ocupado" : "sin dato"}`;
          return onTocar ? (
            <button key={d} type="button" className={clase} aria-label={etiqueta} aria-pressed={d === inicio} onClick={() => onTocar(d)}>{Number(d.slice(8))}</button>
          ) : (
            <span key={d} className={clase} role="gridcell" aria-label={etiqueta}>{Number(d.slice(8))}</span>
          );
        })}
      </div>
      <p className="cal-ref" aria-hidden="true"><i className="libre" /> Libre <i className="ocupado" /> Ocupado <i /> Sin dato</p>
    </div>
  );
}

/** Mes con el que conviene abrir: el actual si tiene datos; si no, el primero con datos de acá en adelante. */
function primerMes(estado: (d: string) => string): string {
  const hoy = hoyISO();
  let m = mesDe(hoy);
  for (let i = 0; i < 8; i++, m = moverMes(m, 1)) if (diasDelMes(m).some((d) => d >= hoy && estado(d))) return m;
  return mesesTemporada()[0] as string;
}

/** En la ficha: solo para mirar. */
export function CalendarioAviso({ a }: { a: Pick<AvisoPublico, "rubro" | "datos" | "calendario"> }) {
  const estado = (d: string) => estadoDia(a, d);
  const inicial = useMemo(() => primerMes(estado), [a]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="calendario" aria-labelledby="cal-t">
      <h2 id="cal-t">Disponibilidad</h2>
      <Mes estado={estado} mesInicial={inicial} />
      <p className="small">
        {a.calendario ? `Lo actualizó el dueño ${hace(a.calendario.actualizado)}.` : "Según las quincenas que marcó el dueño."} Confirmá las fechas por WhatsApp antes de señar.
      </p>
    </section>
  );
}

/** En el formulario: tocar el primer y el último día de cada alquiler. */
export function EditorCalendario({ valor, onCambio }: { valor: Calendario | null; onCambio: (c: Calendario | null) => void }) {
  const [inicio, setInicio] = useState("");
  const estado = (d: string): "libre" | "ocupado" | "" => (valor ? (valor.ocupado.some(([x, y]) => d >= x && d <= y) ? "ocupado" : "libre") : "");
  const tocar = (d: string) => {
    if (!inicio) return setInicio(d);
    // Si el primer día tocado estaba ocupado, el rango se libera; si estaba libre, se ocupa.
    onCambio(marcarRango(valor, inicio, d, estado(inicio) !== "ocupado"));
    setInicio("");
  };
  return (
    <fieldset className="calendario editor">
      <legend>Calendario de disponibilidad <span className="opc">(opcional, pero es lo primero que miran)</span></legend>
      <p className="small">
        {inicio
          ? "Ahora tocá el último día de ese alquiler."
          : "Tocá el primer día y el último de cada alquiler para marcarlo ocupado. Para liberar, tocá el primer y el último día de lo ocupado. Lo que no marques queda libre."}
      </p>
      <Mes estado={estado} mesInicial={mesesTemporada()[0] as string} onTocar={tocar} inicio={inicio} />
      <div className="cal-acc">
        {inicio && <button type="button" className="btn-mini" onClick={() => setInicio("")}>Cancelar</button>}
        {valor && <button type="button" className="btn-mini" onClick={() => { setInicio(""); onCambio(null); }}>Borrar calendario</button>}
      </div>
    </fieldset>
  );
}
