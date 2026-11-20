// Inicio del panel: en vivo, "para hacer hoy", números de la semana y lo que más rinde.
import { useEffect, useState } from "react";
import { fmtNum } from "../../../shared/texto.ts";
import type { AvisoAdmin, Busqueda, ResumenActividad, ResumenEstadisticas } from "../../../shared/tipos.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { admin } from "../api.ts";
import { Cargando } from "../components/Tarjeta.tsx";
import { fotoSegura, precioTexto } from "../formato.ts";
import { useCarga } from "../hooks.ts";
import { ir } from "../router.ts";
import { I, Ico, diasHasta, esNueva, type Accion } from "./comunes.tsx";

export function Inicio({ avisos, busquedas, accion }: { avisos: AvisoAdmin[] | null; busquedas: Busqueda[] | null; accion: Accion }) {
  const est = useCarga<ResumenEstadisticas>(() => admin.estadisticas(7), []);
  const [act, setAct] = useState<ResumenActividad | null>(null);
  useEffect(() => {
    const traer = () => { if (document.visibilityState === "visible") admin.actividad("24h").then(setAct, () => {}); };
    traer();
    const t = window.setInterval(traer, 15_000);
    return () => window.clearInterval(t);
  }, []);
  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const pend = avisos?.filter((a) => a.estado === "pendiente") ?? [];
  const publicados = avisos?.filter((a) => a.estado === "publicado") ?? [];
  const vencen = publicados.filter((a) => diasHasta(a.venceEn) <= 7).sort((a, b) => Date.parse(a.venceEn) - Date.parse(b.venceEn));
  const nuevas = busquedas?.filter((b) => esNueva(b.creadoEn)) ?? [];
  const e = est.estado === "listo" ? est.datos : null;
  const cambio = (a: number, b: number | undefined) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}% vs. semana anterior` : "Sin comparación todavía");
  const maxDia = Math.max(1, ...(e?.serie.map((s) => s.personas) ?? [1]));
  const sinHacer = pend.length === 0 && nuevas.length === 0 && vencen.length === 0;

  return (
    <>
      <div className="pn-titulo">
        <div><p className="pn-fecha">{hoy}</p><h1>Hola, Felipe</h1></div>
        <a className="pn-btn pn-btn-line pn-solo-compu" href={ir("inicio")} target="_blank" rel="noopener">Ver el sitio <Ico d={I.afuera} size={16} /></a>
        <a className="pn-btn pn-btn-main" href={ir("admin", "cargar")}><Ico d={I.mas} size={18} />Cargar aviso</a>
      </div>

      <div className="pn-fila2">
        <section className="pn-vivo-caja" aria-live="polite">
          <p className="pn-vivo-etq"><i className={act?.enVivo.total ? "on" : ""} />EN VIVO</p>
          <p className="pn-vivo-num"><b>{act ? act.enVivo.total : "–"}</b> {act?.enVivo.total === 1 ? "persona mirando el sitio ahora" : "personas mirando el sitio ahora"}</p>
          {act && act.enVivo.paginas.length > 0 ? (
            <ul>{act.enVivo.paginas.slice(0, 4).map((p) => <li key={p.nombre}><span>{p.nombre.replace(/^Aviso: /, "")}</span><b>{p.n}</b></li>)}</ul>
          ) : <p className="pn-vivo-nadie">Nadie en este momento. Vos con el panel no contás.</p>}
        </section>

        <section className="pn-caja">
          <h2>Para hacer hoy</h2>
          {avisos === null ? <Cargando /> : sinHacer ? <p className="pn-ok">✓ Nada pendiente. Buen momento para salir a conseguir avisos.</p> : (
            <div className="pn-tareas">
              {pend.length > 0 && <a className="pn-tarea fuerte" href={ir("admin", "avisos")}><b>{pend.length}</b><span>{pend.length === 1 ? "aviso espera que lo revises" : "avisos esperan que los revises"}</span><em>Revisar →</em></a>}
              {nuevas.slice(0, 2).map((b) => (
                <a key={b.id} className="pn-tarea" target="_blank" rel="noopener noreferrer" href={linkWA(b.telefono, `Hola ${b.nombre}! Te escribo de Vidriera Chabás por lo que estabas buscando.`)}>
                  <b>1</b><span>búsqueda: <strong>{b.que}</strong> ({b.nombre})</span><em>Escribirle →</em></a>
              ))}
              {vencen.slice(0, 3).map((a) => (
                <button key={a.id} type="button" className="pn-tarea" onClick={() => void accion(() => admin.cambiar(a.id, { renovar: true }))}>
                  <b>!</b><span>{diasHasta(a.venceEn) <= 0 ? "vence hoy" : `vence en ${diasHasta(a.venceEn)} días`}: <strong>{a.titulo}</strong></span><em>Renovar →</em></button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="pn-nums">
        <Num t="Visitas · 7 días" v={e ? fmtNum(e.total.personas) : "–"} pie={e ? cambio(e.total.personas, e.anterior?.personas) : ""} />
        <Num t="Contactos por WhatsApp" v={e ? fmtNum(e.total.contactos) : "–"} pie={e ? cambio(e.total.contactos, e.anterior?.contactos) : ""} fuerte />
        <Num t="Avisos publicados" v={fmtNum(publicados.length)} pie={`${publicados.filter((a) => a.rubro === "vehiculos").length} vehículos · ${publicados.filter((a) => a.rubro === "inmuebles").length} inmuebles`} />
        <Num t="Disco" v={act ? `${Math.round(act.salud.baseMB + act.salud.fotosMB)} MB` : "–"} pie={act ? `de ${act.salud.limiteMB} MB` : ""} barra={act ? (act.salud.baseMB + act.salud.fotosMB) / act.salud.limiteMB : undefined} />
      </div>

      <div className="pn-fila2">
        <section className="pn-caja">
          <div className="pn-caja-h"><h2>Visitas por día</h2><a href={ir("admin", "estad")}>Ver estadísticas</a></div>
          {e ? (
            <>
              <p className="pn-barras-nota">
                Cuántas personas entraron cada día. Hoy <b>{fmtNum(e.serie.at(-1)?.personas ?? 0)}</b> · en toda la semana <b>{fmtNum(e.total.personas)}</b> distintas
              </p>
              <div className="pn-barras" role="img" aria-label={`Visitas de los últimos 7 días: ${e.serie.map((s) => s.personas).join(", ")}`}>
                {e.serie.map((s) => (
                  <div key={s.fecha}>
                    <b className="pn-barras-n">{s.personas}</b>
                    <i style={{ height: `${(s.personas / maxDia) * 100}%` }} />
                    <span>{diaSemana(s.fecha)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <Cargando />}
        </section>
        <section className="pn-caja">
          <div className="pn-caja-h"><h2>Los que más rinden</h2><span>7 días</span></div>
          {!e ? <Cargando /> : e.avisos.length === 0 ? <p className="pn-gris">Todavía sin datos de esta semana.</p> : (
            <ul className="pn-top">
              {e.avisos.slice(0, 4).map((x) => {
                const a = avisos?.find((y) => y.id === x.id);
                const foto = a ? fotoSegura(a.fotos[0] ?? "") : "";
                return (
                  <li key={x.id}>
                    {foto ? <img src={foto} alt="" width={64} height={44} /> : <span className="pn-sinfoto" />}
                    <a href={ir("admin", `editar-${x.id}`)}><b>{x.titulo}</b><span>{a ? `${precioTexto(a)} · ${a.pueblo}` : ""}</span></a>
                    <span className="pn-top-n"><b>{x.contactos}</b> {x.contactos === 1 ? "contacto" : "contactos"}<br />{x.vistas} {x.vistas === 1 ? "vista" : "vistas"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {e && e.sinResultados.length > 0 && (
        <section className="pn-caja">
          <h2>Buscaron y no encontraron <span className="pn-gris">· avisos para salir a conseguir</span></h2>
          <div className="pn-chips">{e.sinResultados.slice(0, 10).map((b) => <span key={b.texto}>{b.texto} · {b.n}</span>)}</div>
        </section>
      )}
    </>
  );
}

export function Num({ t, v, pie, fuerte, barra }: { t: string; v: string; pie: string; fuerte?: boolean; barra?: number }) {
  return (
    <div className={`pn-num-caja${fuerte ? " fuerte" : ""}`}>
      <span>{t}</span>
      <b>{v}</b>
      {barra !== undefined && <span className="pn-disco"><i style={{ width: `${Math.min(100, Math.max(2, barra * 100))}%` }} className={barra > 0.8 ? "alto" : ""} /></span>}
      <small>{pie}</small>
    </div>
  );
}

/** "vie 20": día de la semana y número, para el eje del gráfico. */
function diaSemana(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(a ?? 2026, (m ?? 1) - 1, d ?? 1).getDay();
  return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][dia]} ${d}`;
}
