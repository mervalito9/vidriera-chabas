import { useState, type FormEvent } from "react";
import { PUEBLOS, RUBROS, WA_NUMERO } from "../../../shared/config.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { plural, slug } from "../../../shared/texto.ts";
import { listarAvisos } from "../api.ts";
import { IconoBuscar, IconoMas, IconoRubro } from "../components/Iconos.tsx";
import { Preguntas } from "../components/Preguntas.tsx";
import { SeBuscanPortada } from "../components/SeBuscan.tsx";
import { PORTADA_NUEVA } from "../pruebas.ts";
import { SE_BUSCAN_ACTIVO } from "../seBuscan.ts";
import { Tarjeta, Vacio } from "../components/Tarjeta.tsx";
import { useAparecer, useCarga, useTitulo } from "../hooks.ts";
import { buscarDesdePortada } from "./Listado.tsx";
import { ir } from "../router.ts";

/** Foco en inmuebles y vehículos. Maquinaria agro sigue existiendo (se puede publicar y buscar) pero no está en la portada. */
const PRINCIPALES = ["inmuebles", "vehiculos"] as const;

const EXPLORAR = [
  ["inmuebles", "casa", "Casas"],
  ["inmuebles", "alquiler", "Alquileres"],
  ["inmuebles", "departamento", "Deptos"],
  ["inmuebles", "terreno", "Terrenos"],
  ["inmuebles", "galpon-o-local", "Galpones y locales"],
  ["vehiculos", "auto", "Autos"],
  ["vehiculos", "camioneta-o-utilitario", "Camionetas"],
  ["vehiculos", "moto", "Motos"],
] as const;

/** Intercala rubros (inmueble, vehículo, inmueble…) para que la portada no quede de un solo rubro aunque haya más de uno. */
function intercalar<T extends { rubro: string }>(avisos: T[], cuantos: number): T[] {
  const grupos = new Map<string, T[]>();
  for (const a of avisos) grupos.set(a.rubro, [...(grupos.get(a.rubro) ?? []), a]);
  const filas = [...grupos.values()];
  const salida: T[] = [];
  for (let i = 0; salida.length < cuantos && filas.some((f) => f[i]); i++) for (const f of filas) if (f[i] && salida.length < cuantos) salida.push(f[i]!);
  return salida;
}

const CINTA = ["Casas", "Alquileres", "Departamentos", "Terrenos", "Galpones y locales", "Autos", "Camionetas", "Utilitarios", "Motos"];

export function Inicio() {
  useTitulo("");
  const lista = useCarga(() => listarAvisos({}, 60), []);
  const datos = lista.estado === "listo" ? lista.datos : null;
  const soloEjemplos = datos?.soloEjemplos ?? true;
  // Con ejemplos: 3 inmuebles y 3 vehículos. Con avisos reales: los 8 más nuevos, intercalando rubros, arriba de todo.
  const [pestana, setPestana] = useState<"recientes" | "inmuebles" | "vehiculos" | "bajaron">("recientes");
  const [texto, setTexto] = useState("");
  const buscar = (e: FormEvent) => { e.preventDefault(); buscarDesdePortada(texto); };
  const reales = datos && !soloEjemplos ? datos.avisos : [];
  const bajaron = reales.filter((a) => a.precioAnterior !== null && a.precio !== null && a.precio < a.precioAnterior);
  const PESTANAS = [
    ["recientes", "Recientes", reales.length],
    ["inmuebles", "Inmuebles", reales.filter((a) => a.rubro === "inmuebles").length],
    ["vehiculos", "Vehículos", reales.filter((a) => a.rubro === "vehiculos").length],
    ["bajaron", "Bajaron de precio", bajaron.length],
  ] as const;
  const muestra = datos
    ? soloEjemplos
      ? [0, 1, 2].flatMap((i) => PRINCIPALES.map((r) => datos.avisos.filter((a) => a.rubro === r)[i])).filter((a) => a !== undefined)
      : pestana === "recientes"
        ? intercalar(reales, 8)
        : pestana === "bajaron"
          ? bajaron.slice(0, 8)
          : reales.filter((a) => a.rubro === pestana).slice(0, 8)
    : [];
  // Portada nueva: cada categoría y pueblo con su cantidad; los que no tienen avisos no se muestran (no llevan a un listado vacío).
  const contar = PORTADA_NUEVA && !soloEjemplos;
  // Portada nueva con avisos reales: sin los cuadros Inmuebles/Vehículos (repiten las pestañas de «Avisos»), así las fotos suben a la primera pantalla.
  const sinCuadros = contar;
  const cats = EXPLORAR.map(([rubro, atajo, nombre]) => ({
    rubro, atajo, nombre,
    n: reales.filter((a) => a.rubro === rubro && (atajo === "alquiler" ? a.operacion === "alquiler" : slug(a.tipo) === atajo)).length,
  })).filter((c) => !contar || c.n > 0);
  const pueblos = [...PUEBLOS.map((p) => ({ nombre: p, ruta: slug(p), n: reales.filter((a) => a.pueblo === p).length })),
    { nombre: "Otro", ruta: "otro", n: reales.filter((a) => !(PUEBLOS as readonly string[]).includes(a.pueblo)).length }]
    .filter((p) => !contar || p.n > 0);
  const rExplorar = useAparecer<HTMLElement>();
  const rVender = useAparecer<HTMLElement>();
  const rEjemplos = useAparecer<HTMLElement>();
  const rBusco = useAparecer<HTMLElement>();

  const avisosBloque = (
    <section className="wrap ejemplos" aria-labelledby="ultTitulo" ref={rEjemplos}>
      <div className="sec-h">
        <h2 id="ultTitulo">{soloEjemplos ? "Así se ve un aviso" : "Avisos"}</h2>
        {datos && !soloEjemplos && <a href={ir("buscar")}>Ver todos ({datos.total})</a>}
      </div>
      {!soloEjemplos && !(PORTADA_NUEVA && reales.length < 12) && PESTANAS.filter(([, , n]) => n > 0).length > 2 && (
        <div className="pestanas-home" role="tablist" aria-label="Qué avisos mostrar">
          {PESTANAS.filter(([, , n]) => n > 0).map(([id, nombre]) => (
            <button key={id} type="button" role="tab" aria-selected={pestana === id} className={pestana === id ? "activa" : ""} onClick={() => setPestana(id)}>{nombre}</button>
          ))}
        </div>
      )}
      {soloEjemplos && (
        <p className="nota-ejemplos"><span className="badge">Ejemplos</span> Todavía no hay avisos reales: estos son de muestra. ¡El tuyo puede ser el primero!</p>
      )}
      {lista.estado === "listo" && muestra.length === 0 ? (
        <Vacio texto="Todavía no hay avisos." />
      ) : (
        <div className={`grid mini ${soloEjemplos ? "ej" : "reales"}`}>{muestra.map((a) => <Tarjeta key={a.id} aviso={a} />)}</div>
      )}
    </section>
  );

  return (
    <>
      <section className={sinCuadros ? "hero corto" : "hero"}>
        <div className="wrap hero-solo">
          <div className="hero-txt">
            <h1>Casas, autos y más de Chabás y la zona.</h1>
            <p className="sub">Publicá gratis. Hablá directo con el dueño.</p>
            <form className="buscador" role="search" onSubmit={buscar}>
              <label className="sr" htmlFor="buscar-home">¿Qué buscás?</label>
              <input id="buscar-home" type="search" maxLength={60} placeholder="¿Qué buscás? Casa, terreno, Hilux…" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <button type="submit" className="btn btn-dark"><IconoBuscar /><span>Buscar</span></button>
            </form>
            <a className="btn btn-main publicar-home" href={ir("publicar")}><IconoMas />Publicar gratis</a>
            {PORTADA_NUEVA && <a className="dudas-wa" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, "Hola Felipe! Te escribo por Vidriera Chabás.")}>¿Dudas? Escribime por WhatsApp</a>}
            {!sinCuadros && <div className="rubros">
              {PRINCIPALES.map((r) => (
                <a key={r} className="rubro" href={ir(r)}>
                  <span className="circ"><IconoRubro rubro={r} /></span>
                  <span className="txt">
                    <b>{RUBROS[r].nombre}</b>
                    <span>{datos && !soloEjemplos && datos.conteo[r] > 0 ? plural(datos.conteo[r], "aviso", "avisos") : RUBROS[r].resumen}</span>
                  </span>
                </a>
              ))}
            </div>}
          </div>
        </div>
      </section>

      {!soloEjemplos && avisosBloque}

      {PORTADA_NUEVA && (
        <section className="wrap" aria-label="Avisame cuando aparezca">
          <aside className="busco busco-corto">
            <div><h2>¿Buscás algo que no está?</h2><p>Dejanos tu WhatsApp y te avisamos apenas aparezca. Muchos buscan alquiler.</p></div>
            <a className="btn" href={ir("busco")}>Avisame cuando aparezca</a>
          </aside>
        </section>
      )}

      {PORTADA_NUEVA && <SeBuscanPortada />}

      <section className="wrap explorar" aria-labelledby="explorar" ref={rExplorar}>
        <div className="sec-h"><h2 id="explorar">Buscá por categoría</h2><a href={ir("buscar")}>Ver todo</a></div>
        {pueblos.length > 1 && (
          <nav className="por-pueblo" aria-label="Avisos por pueblo">
            <span>Por pueblo:</span>
            {pueblos.map((p) => <a key={p.ruta} className="chip" href={ir("pueblo", p.ruta)}>{p.nombre}{contar && <small className="cuenta"> {p.n}</small>}</a>)}
          </nav>
        )}
        <div className="cats">
          {cats.map((c) => (
            <a key={c.nombre} className="cat" href={ir(c.rubro, c.atajo)}>
              <span>{c.nombre}{contar && <small className="cuenta">{c.n === 1 ? "1 aviso" : `${c.n} avisos`}</small>}</span>
              <span aria-hidden="true">→</span>
            </a>
          ))}
        </div>
      </section>

{!PORTADA_NUEVA && (
        <section className="wrap" aria-label="Avisame cuando aparezca" ref={rBusco}>
        <aside className="busco">
          <div><h2>¿No encontrás lo que buscás?</h2><p>Contanos qué buscás y te avisamos por WhatsApp cuando aparezca.</p></div>
          <a className="btn" href={ir("busco")}>Avisame cuando aparezca</a>
        </aside>
      </section>
      )}

      {SE_BUSCAN_ACTIVO && !PORTADA_NUEVA && <SeBuscanPortada />}

      <section className="wrap" aria-labelledby="vender" ref={rVender}>
        <div className={PORTADA_NUEVA ? "vender corto" : "vender"}>
          <div className="vender-txt">
            <p className="kicker">Recién arrancamos · Sé de los primeros</p>
            <h2 id="vender">¿Tenés algo para vender o alquilar? <em>Así funciona.</em></h2>
            <ol className="historia">
              <li className="h1"><b>Cargás fotos y datos en 2 minutos.</b><span>Desde el celular. Si te cuesta, mandanos todo por WhatsApp y lo armamos nosotros.</span></li>
              <li className="h2"><b>Tu aviso aparece en la vidriera.</b><span>Lo revisamos y queda publicado con fotos, precio y un botón para escribirte. Te pasamos el link para compartirlo.</span></li>
              <li className="h3"><b>Te escriben directo a vos.</b><span>Los interesados te hablan por WhatsApp. Vos arreglás y cerrás, sin comisión.</span></li>
            </ol>
          </div>
          <Telefono />
          <div className="arr-btns">
            <a className="btn btn-main" href={ir("publicar", "inmuebles")}>Publicar una casa o alquiler</a>
            <a className="btn btn-crema" href={ir("publicar", "vehiculos")}>Publicar un vehículo</a>
          </div>
          <div className="ticker" aria-hidden="true">
            <div className="ticker-in">{[...CINTA, ...CINTA].map((c, i) => <span key={i}>{c}</span>)}</div>
          </div>
        </div>
      </section>

      {soloEjemplos && avisosBloque}


      <section className="wrap preguntas-home" aria-labelledby="faq-t">
        <div className="sec-h"><h2 id="faq-t">Preguntas frecuentes</h2><a href={ir("preguntas")}>Ver todas</a></div>
        <Preguntas cuantas={5} />
      </section>
    </>
  );
}

/** Celular animado: 1) mandás fotos, 2) aparece tu aviso, 3) te escriben. */
function Telefono() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="ph-notch" />
      <div className="ph-screen">
        <div className="scene s1">
          <div className="wa-top"><span className="wa-av"><img src="assets/img/icono-app.svg" alt="" width={28} height={28} /></span>Vidriera Chabás</div>
          <div className="wa-body">
            <p className="b out p1">Hola! Quiero publicar mi casa.</p>
            <p className="b out fotos p2">{[0, 1, 2].map((i) => <img key={i} src="assets/img/ejemplo-casa.svg" alt="" width={64} height={42} />)}</p>
            <p className="b in p3">¡Buenísimo! Ya lo publicamos.</p>
          </div>
        </div>
        <div className="scene s2">
          <div className="mini-top"><img src="assets/img/logo-horizontal-claro.svg" alt="" width={120} height={26} /></div>
          <p className="mini-h">Inmuebles · Chabás y la zona</p>
          <div className="mini-card nuevo"><img src="assets/img/ejemplo-casa.svg" alt="" width={640} height={420} /><span className="mini-tag">Nuevo</span><b>USD 68.000</b><small>Tu casa · Chabás</small></div>
          <div className="mini-card tenue"><img src="assets/img/ejemplo-terreno.svg" alt="" width={640} height={420} /><b>USD 14.500</b><small>Terreno · Casilda</small></div>
        </div>
        <div className="scene s3">
          <div className="wa-top"><span className="wa-av" />Nuevo mensaje</div>
          <div className="wa-body">
            <p className="b in p4">Hola! Vi tu aviso en Vidriera Chabás. ¿Sigue disponible?</p>
            <p className="b out p5">¡Sí! ¿Cuándo querés verla?</p>
          </div>
        </div>
      </div>
    </div>
  );
}
