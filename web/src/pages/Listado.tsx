import { useEffect, useMemo, useRef, useState } from "react";
import { ATAJOS, POR_PAGINA, RUBROS } from "../../../shared/config.ts";
import { plural, slug } from "../../../shared/texto.ts";
import type { Filtros, ListaAvisos, RubroId } from "../../../shared/tipos.ts";
import { listarAvisos } from "../api.ts";
import { Cargando, Tarjeta, Vacio } from "../components/Tarjeta.tsx";
import { useCarga, useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";

const VACIOS: Filtros = { rubro: "", q: "", tipo: "", op: "", max: "", moneda: "USD", permuta: false, financia: false, orden: "" };
const PESTANAS = [["buscar", "Todo"], ["inmuebles", "Inmuebles"], ["vehiculos", "Vehículos"], ["agro", "Maquinaria agro"]] as const;

/** Convierte un atajo ("alquiler", "moto", "galpon-o-local") en filtros. */
function aplicarAtajo(rubro: RubroId | "", atajo: string): Filtros {
  const f: Filtros = { ...VACIOS, rubro };
  if (atajo === "alquiler" || atajo === "venta") return { ...f, op: atajo };
  const tipos = rubro ? RUBROS[rubro].tipos : Object.values(RUBROS).flatMap((r) => r.tipos);
  const tipo = tipos.find((t) => slug(t) === atajo);
  return tipo ? { ...f, tipo } : f;
}

export function Listado({ rubro, atajo }: { rubro: RubroId | ""; atajo: string }) {
  const R = rubro ? RUBROS[rubro] : null;
  useTitulo(R ? `${R.nombre} en Chabás` : "Todos los avisos de Chabás");
  const [f, setF] = useState<Filtros>(() => aplicarAtajo(rubro, atajo));
  const [qEscrito, setQEscrito] = useState(f.q);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [masAbierto, setMasAbierto] = useState(() => window.matchMedia?.("(min-width: 900px)").matches ?? false);

  // Si cambia la ruta (otro rubro u otro atajo), se reinician los filtros.
  useEffect(() => {
    const nuevo = aplicarAtajo(rubro, atajo);
    setF(nuevo);
    setQEscrito("");
    setLimite(POR_PAGINA);
  }, [rubro, atajo]);
  // La búsqueda por palabra espera a que termines de escribir.
  useEffect(() => {
    const t = window.setTimeout(() => setF((v) => ({ ...v, q: qEscrito })), 250);
    return () => window.clearTimeout(t);
  }, [qEscrito]);

  const lista = useCarga(() => listarAvisos(f, limite), [JSON.stringify(f), limite]);
  // Mientras carga, se sigue mostrando el último resultado (sin parpadeos al tocar "Ver más").
  const ultimo = useRef<ListaAvisos | null>(null);
  if (lista.estado === "listo") ultimo.current = lista.datos;
  const d = lista.estado === "listo" ? lista.datos : lista.estado === "cargando" ? ultimo.current : null;
  const cambiar = <K extends keyof Filtros>(k: K, v: Filtros[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setLimite(POR_PAGINA);
  };
  const tipos = R ? R.tipos : Object.values(RUBROS).flatMap((r) => r.tipos);
  const atajos = ATAJOS[rubro || "todo"];
  const atajoActivo = f.op && !f.tipo ? f.op : f.tipo ? slug(f.tipo) : "";
  const hayFiltros = useMemo(() => !!(f.q || f.tipo || f.op || f.max || f.permuta || f.financia), [f]);
  const limpiar = () => { setF({ ...VACIOS, rubro }); setQEscrito(""); setLimite(POR_PAGINA); };

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Estás en"><a href={ir("inicio")}>Inicio</a> › <span>{R ? R.nombre : "Todos los avisos"}</span></nav>
      <div className="page-h">
        <h1>{R ? `${R.nombre} en Chabás` : "Todos los avisos de Chabás"}</h1>
        <p>{R ? R.descripcion : "Inmuebles, vehículos y maquinaria agro. Filtrá y hablá directo con el dueño."}{" "}
          <a className="pub-link" href={ir("publicar", rubro)}>¿Tenés algo para vender? Publicalo gratis</a></p>
      </div>
      <nav className="subnav tabs" aria-label="Rubros">
        {PESTANAS.map(([k, t]) => <a key={k} href={ir(k)} aria-current={(rubro || "buscar") === k ? "page" : undefined}>{t}</a>)}
      </nav>
      <div className="atajos" role="group" aria-label="Atajos">
        {atajos.map(([k, t]) => (
          <button key={k} type="button" className="atajo" aria-pressed={atajoActivo === k}
            onClick={() => { setLimite(POR_PAGINA); setF(atajoActivo === k ? { ...VACIOS, rubro } : aplicarAtajo(rubro, k)); setQEscrito(""); }}>
            {t}
          </button>
        ))}
      </div>
      <div className="filtros-layout">
        <form className="filtros" role="search" aria-label="Filtrar avisos" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="lbl" htmlFor="q">Buscar por palabra</label>
            <input type="search" id="q" maxLength={60} placeholder="Ej: patio, 4x4, pala" autoComplete="off" value={qEscrito} onChange={(e) => setQEscrito(e.target.value)} />
          </div>
          <details className="mas-filtros" open={masAbierto} onToggle={(e) => setMasAbierto(e.currentTarget.open)}>
            <summary>Más filtros: tipo, precio, permuta</summary>
            <div className="mf-in">
              <div>
                <label className="lbl" htmlFor="tipo">Tipo</label>
                <select id="tipo" value={f.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {(rubro === "" || rubro === "inmuebles") && (
                <fieldset>
                  <legend className="lbl">Venta o alquiler</legend>
                  <div className="seg">
                    {([["", "Todo"], ["venta", "Venta"], ["alquiler", "Alquiler"]] as const).map(([v, t]) => (
                      <label key={v}><input type="radio" name="op" value={v} checked={f.op === v} onChange={() => cambiar("op", v)} /><span>{t}</span></label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="precio-row">
                <div>
                  <label className="lbl" htmlFor="max">Precio hasta</label>
                  <input type="text" id="max" inputMode="numeric" maxLength={12} placeholder="Ej: 20000" value={f.max}
                    onChange={(e) => cambiar("max", e.target.value.replace(/\D+/g, ""))} />
                </div>
                <div>
                  <label className="lbl" htmlFor="moneda">En</label>
                  <select id="moneda" value={f.moneda} onChange={(e) => cambiar("moneda", e.target.value === "ARS" ? "ARS" : "USD")}>
                    <option value="USD">Dólares</option><option value="ARS">Pesos</option>
                  </select>
                </div>
              </div>
              <label className="check"><input type="checkbox" checked={f.permuta} onChange={(e) => cambiar("permuta", e.target.checked)} /> Acepta permuta</label>
              <label className="check"><input type="checkbox" checked={f.financia} onChange={(e) => cambiar("financia", e.target.checked)} /> Financia</label>
              <div>
                <label className="lbl" htmlFor="orden">Ordenar</label>
                <select id="orden" value={f.orden} onChange={(e) => cambiar("orden", e.target.value === "barato" || e.target.value === "caro" ? e.target.value : "")}>
                  <option value="">Más nuevos primero</option>
                  <option value="barato">Precio: de menor a mayor</option>
                  <option value="caro">Precio: de mayor a menor</option>
                </select>
              </div>
            </div>
          </details>
          {hayFiltros && <button type="button" className="linkbtn" onClick={limpiar}>Borrar filtros</button>}
        </form>
        <div>
          {d && d.soloEjemplos && d.total > 0 && (
            <p className="banda-ej"><span className="badge">Ejemplos</span> Todavía no hay avisos reales: estos son de muestra. <a href={ir("publicar")}>Publicá el primero, es gratis</a></p>
          )}
          <div className="res-bar">
            <strong id="count" aria-live="polite">{d ? plural(d.total, "aviso", "avisos") : ""}</strong>
            <a href={ir("busco")}>¿No está? Avisame cuando aparezca</a>
          </div>
          {!d && lista.estado === "cargando" && <Cargando />}
          {lista.estado === "error" && <p className="form-err" role="alert">{lista.mensaje}</p>}
          {d && (
            d.total === 0 ? (
              <Vacio texto={hayFiltros ? "No hay avisos con esos filtros." : "Todavía no hay avisos de esto."} />
            ) : (
              <>
                <div className="grid" id="grid" aria-busy={lista.estado === "cargando"}>{d.avisos.map((a) => <Tarjeta key={a.id} aviso={a} />)}</div>
                {d.total > d.avisos.length && (
                  <div className="ver-mas"><button type="button" className="btn btn-line" onClick={() => setLimite((l) => l + POR_PAGINA)}>Ver más avisos</button></div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
