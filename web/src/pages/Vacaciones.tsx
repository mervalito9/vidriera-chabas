// «Vacaciones»: casas, departamentos y cabañas para la temporada, de dueños de Chabás y la zona, estén donde estén
// (costa, sierras, Entre Ríos…). Lo que la hace distinta de cualquier portal es la confianza: le alquilás a gente
// del pueblo. Mientras haya pocos avisos, la página le habla sobre todo a los dueños para que publiquen.
import { useMemo, useState } from "react";
import type { AvisoPublico } from "../../../shared/tipos.ts";
import { duenosDe } from "../../../shared/vacaciones.ts";
import { listarAvisos } from "../api.ts";
import { Cargando, Tarjeta } from "../components/Tarjeta.tsx";
import { useCarga, useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";

/** "Para 6 personas" → 6 (0 si no lo dice). */
const personas = (a: AvisoPublico): number => {
  const t = a.datos.find((d) => /^para \d+ personas?$/i.test(d.trim()));
  return t ? Number(/\d+/.exec(t)?.[0] ?? 0) : 0;
};

const MINIMOS = [2, 4, 6, 8] as const;

function Sol() {
  return (
    <svg className="vac-sol" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="26" fill="#F0A35E" />
      <g stroke="#F0A35E" strokeWidth="5" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <line key={i} x1={60 + Math.cos(a) * 38} y1={60 + Math.sin(a) * 38} x2={60 + Math.cos(a) * 50} y2={60 + Math.sin(a) * 50} />;
        })}
      </g>
    </svg>
  );
}

export function Vacaciones() {
  useTitulo("Vacaciones");
  const c = useCarga(() => listarAvisos({ rubro: "vacaciones" }, 120), []);
  const [destino, setDestino] = useState("");
  const [minimo, setMinimo] = useState(0);

  const avisos = c.estado === "listo" && !c.datos.soloEjemplos ? c.datos.avisos.filter((a) => a.rubro === "vacaciones") : [];
  const destinos = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const a of avisos) cuenta.set(a.pueblo, (cuenta.get(a.pueblo) ?? 0) + 1);
    return [...cuenta.entries()].sort((x, y) => y[1] - x[1]);
  }, [avisos]);
  const lista = avisos.filter((a) => (!destino || a.pueblo === destino) && (!minimo || personas(a) >= minimo));
  const deLaZona = avisos.filter((a) => duenosDe(a)).length;

  return (
    <>
      <section className="vac-banda">
        <Sol />
        <div className="wrap">
          <p className="vac-temp">Temporada {new Date().getMonth() >= 6 ? `${new Date().getFullYear()}–${new Date().getFullYear() + 1}` : new Date().getFullYear()}</p>
          <h1>Vacaciones <em>de confianza.</em></h1>
          <p className="vac-baja">Casas, departamentos y cabañas de dueños de Chabás y la zona, en la costa, las sierras o donde estén. Le alquilás a gente que conocés y hablás directo con ellos.</p>
          {avisos.length > 0 && (
            <p className="vac-cuenta">
              <b>{avisos.length === 1 ? "1 alquiler" : `${avisos.length} alquileres`}</b> para esta temporada
              {deLaZona > 0 && <> · {deLaZona === avisos.length ? "todos" : deLaZona} de dueños de la zona</>}
            </p>
          )}
          <div className="vac-acc">
            <a className="btn btn-main" href={ir("publicar", "vacaciones")}>¿Tenés una casa? Publicala gratis</a>
            <a className="btn btn-claro-oscuro" href={ir("busco")}>¿Buscás algo? Dejá tu pedido</a>
          </div>
        </div>
      </section>

      <div className="wrap vac-pagina">
        {c.estado === "cargando" && <Cargando />}
        {c.estado === "error" && <p className="sb-baja">No se pudieron cargar los alquileres. Probá de nuevo en un rato.</p>}

        {avisos.length > 0 && (
          <>
            {destinos.length > 1 && (
              <div className="chips vac-filtros" role="group" aria-label="Destino">
                <button type="button" className="chip" aria-pressed={!destino} onClick={() => setDestino("")}>Todos los destinos</button>
                {destinos.map(([d, n]) => (
                  <button key={d} type="button" className="chip" aria-pressed={destino === d} onClick={() => setDestino(d)}>{d} ({n})</button>
                ))}
              </div>
            )}
            {avisos.some((a) => personas(a) > 0) && (
              <div className="chips vac-filtros" role="group" aria-label="Personas">
                <button type="button" className="chip" aria-pressed={!minimo} onClick={() => setMinimo(0)}>Cualquier cantidad</button>
                {MINIMOS.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={minimo === m} onClick={() => setMinimo(m)}>{m}+ personas</button>
                ))}
              </div>
            )}
            {lista.length > 0 ? (
              <div className="grid reales">{lista.map((a) => <Tarjeta key={a.id} aviso={a} />)}</div>
            ) : (
              <p className="sb-baja">No hay alquileres con esos filtros. <button type="button" className="linkbtn" onClick={() => { setDestino(""); setMinimo(0); }}>Ver todos</button></p>
            )}
          </>
        )}

        {c.estado === "listo" && avisos.length === 0 && (
          <section className="vac-vacio" aria-labelledby="vac-vacio-t">
            <h2 id="vac-vacio-t">Todavía no hay alquileres cargados para esta temporada</h2>
            <p>¿Tenés una casa, un departamento o una cabaña en la costa, las sierras o donde sea? Publicala gratis: la ve la gente de Chabás y la zona, que prefiere alquilarle a alguien conocido.</p>
            <a className="btn btn-main" href={ir("publicar", "vacaciones")}>Publicar mi alquiler de vacaciones</a>
          </section>
        )}

        <section className="sb-como" aria-labelledby="vac-como-t">
          <h2 id="vac-como-t">¿Cómo funciona?</h2>
          <ol>
            <li><b>Elegís dónde y para cuántos</b><span>Cada aviso dice dónde queda, para cuántas personas es y de dónde son los dueños.</span></li>
            <li><b>Hablás directo con el dueño</b><span>Por WhatsApp, sin intermediarios ni comisiones. Le preguntás fechas y condiciones.</span></li>
            <li><b>Señás seguro</b><span>Pedí fotos nuevas o una videollamada, transferí solo a nombre del dueño y pedí recibo.</span></li>
          </ol>
        </section>
      </div>
    </>
  );
}
