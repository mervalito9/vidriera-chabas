import { PUEBLOS, RUBROS, WA_NUMERO } from "../../../shared/config.ts";
import { plural, slug } from "../../../shared/texto.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { listarAvisos } from "../api.ts";
import { IconoBuscar, IconoMas, IconoRubro } from "../components/Iconos.tsx";
import { FaltaWhatsApp } from "../components/Pueblos.tsx";
import { Tarjeta, Vacio } from "../components/Tarjeta.tsx";
import { useAparecer, useCarga, useTitulo } from "../hooks.ts";
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
  const muestra = datos
    ? soloEjemplos
      ? [0, 1, 2].flatMap((i) => PRINCIPALES.map((r) => datos.avisos.filter((a) => a.rubro === r)[i])).filter((a) => a !== undefined)
      : intercalar(datos.avisos, 8)
    : [];
  const rExplorar = useAparecer<HTMLElement>();
  const rVender = useAparecer<HTMLElement>();
  const rEjemplos = useAparecer<HTMLElement>();
  const rBusco = useAparecer<HTMLElement>();
  const rCarta = useAparecer<HTMLElement>();

  const avisosBloque = (
    <section className="wrap ejemplos" aria-labelledby="ultTitulo" ref={rEjemplos}>
      <div className="sec-h">
        <h2 id="ultTitulo">{soloEjemplos ? "Así se ve un aviso" : "Últimos avisos"}</h2>
        {datos && !soloEjemplos && <a href={ir("buscar")}>Ver todos ({datos.total})</a>}
      </div>
      {soloEjemplos && (
        <p className="nota-ejemplos"><span className="badge">Ejemplos</span> Todavía no hay avisos reales: estos son de muestra. ¡El tuyo puede ser el primero!</p>
      )}
      {lista.estado === "listo" && muestra.length === 0 ? (
        <Vacio texto="Todavía no hay avisos." />
      ) : (
        <div className="grid mini">{muestra.map((a) => <Tarjeta key={a.id} aviso={a} />)}</div>
      )}
    </section>
  );

  return (
    <>
      <section className="hero">
        <div className="wrap hero-solo">
          <div className="hero-txt">
            <h1>Casas, autos y más de Chabás y la zona.</h1>
            <p className="sub">Publicá gratis. Hablá directo con el dueño.</p>
            <div className="hero-btns">
              <a className="btn btn-dark" href={ir("buscar")}><IconoBuscar />Buscar</a>
              <a className="btn btn-main" href={ir("publicar")}><IconoMas />Publicar gratis</a>
            </div>
            <div className="rubros">
              {PRINCIPALES.map((r) => (
                <a key={r} className="rubro" href={ir(r)}>
                  <span className="circ"><IconoRubro rubro={r} /></span>
                  <span className="txt">
                    <b>{RUBROS[r].nombre}</b>
                    <span>{datos && !soloEjemplos && datos.conteo[r] > 0 ? plural(datos.conteo[r], "aviso", "avisos") : RUBROS[r].resumen}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!soloEjemplos && avisosBloque}

      <section className="wrap explorar" aria-labelledby="explorar" ref={rExplorar}>
        <div className="sec-h"><h2 id="explorar">Buscá por categoría</h2><a href={ir("buscar")}>Ver todo</a></div>
        <nav className="por-pueblo" aria-label="Avisos por pueblo">
          <span>Por pueblo:</span>
          {PUEBLOS.map((p) => <a key={p} className="chip" href={ir("pueblo", slug(p))}>{p}</a>)}
          <a className="chip" href={ir("pueblo", "otro")}>Otro</a>
        </nav>
        <div className="cats">
          {EXPLORAR.map(([rubro, atajo, nombre]) => (
            <a key={nombre} className="cat" href={ir(rubro, atajo)}>{nombre}<span aria-hidden="true">→</span></a>
          ))}
        </div>
      </section>

      <section className="wrap" aria-labelledby="vender" ref={rVender}>
        <div className="vender">
          <div className="vender-txt">
            <p className="kicker">Recién arrancamos · Sé de los primeros</p>
            <h2 id="vender">¿Tenés algo para vender o alquilar? <em>Así funciona.</em></h2>
            <ol className="historia">
              <li className="h1"><b>Cargás fotos y datos en 2 minutos.</b><span>Desde el celular. Si te cuesta, mandanos todo por WhatsApp y lo armamos nosotros.</span></li>
              <li className="h2"><b>Tu aviso aparece en la vidriera.</b><span>Lo revisamos y queda publicado con fotos, precio y un botón para escribirte. Te pasamos el link para compartirlo en tus estados y grupos, y también lo mostramos en las redes de Vidriera.</span></li>
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

      <section className="wrap" aria-label="Avisame cuando aparezca" ref={rBusco}>
        <aside className="busco">
          <div><h2>¿No encontrás lo que buscás?</h2><p>Contanos qué buscás y te avisamos por WhatsApp cuando aparezca.</p></div>
          <a className="btn" href={ir("busco")}>Avisame cuando aparezca</a>
        </aside>
      </section>

      <section className="wrap" aria-labelledby="quien" ref={rCarta}>
        <div className="carta">
          <div className="carta-txt">
            <h2 id="quien">Hola, soy Felipe.</h2>
            <p>Soy de Chabás y armé Vidriera porque me pasaba lo mismo que a todos: querés saber qué casa se alquila, quién vende un auto o una sembradora, y terminás preguntando de a uno, mirando carteles o buscando en mil grupos. Y el precio casi nunca lo sabés hasta que preguntás.</p>
            <p>La idea es simple:</p>
          </div>
          <ul className="objetivos">
            <li><b>Que esté todo en un lugar.</b><span>Casas, alquileres, autos y motos de Chabás y la zona, para comprar o alquilar.</span></li>
            <li><b>Que los precios estén a la vista.</b><span>Así sabés cuánto se pide antes de preguntar, y podés comparar.</span></li>
            <li><b>Armar un historial de precios.</b><span>Para ver cuánto se pide por un alquiler, un terreno o un tractor, y cómo va cambiando. Ya lo estamos guardando.</span></li>
            <li><b>Que sea gratis y directo entre vecinos.</b><span>Sin comisiones y sin vueltas.</span></li>
          </ul>
          <div className="carta-cta">
            <p>Recién arranco, así que si tenés una idea o algo que no te cierra, escribime.</p>
            <div className="quien-wa">
              {numeroWA(WA_NUMERO) ? (
                <a className="btn btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, "Hola Felipe! Te escribo por Vidriera Chabás.")}>Escribime por WhatsApp</a>
              ) : <FaltaWhatsApp />}
            </div>
          </div>
        </div>
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
