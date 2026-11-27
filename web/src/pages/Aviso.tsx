import { MAPA_ACTIVO } from "../mapa/activo.ts";
import { Mapa } from "../mapa/Mapa.tsx";
import { renglonesCondiciones } from "../../../shared/alquiler.ts";
import { useEffect, useRef, useState, type PointerEvent as PE, type RefObject } from "react";
import { RUBROS } from "../../../shared/config.ts";
import { posicionFoco } from "../components/form/Encuadre.tsx";
import { fmtFecha, fmtNum } from "../../../shared/texto.ts";
import type { AvisoPublico } from "../../../shared/tipos.ts";
import { ErrorApi, avisoConocido, linkContacto, listarAvisos, obtenerAviso } from "../api.ts";
import { Cargando, Tarjeta } from "../components/Tarjeta.tsx";
import { fotoSegura, porMes, precioTexto } from "../formato.ts";
import { useCarga, useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";

/** La única página de aviso: se llena con los datos que devuelve el backend para ese id. */
export function Aviso({ id }: { id: number }) {
  const carga = useCarga(() => obtenerAviso(id), [id]);
  // Si venía de una tarjeta, ya tenemos el aviso: se muestra enseguida y se actualiza cuando llegan los datos.
  const conocido = carga.estado === "cargando" ? avisoConocido(id) : null;
  const aviso = carga.estado === "listo" ? carga.datos : conocido;
  useTitulo(aviso ? aviso.titulo : carga.estado === "cargando" ? "Aviso" : "Aviso no encontrado");

  if (conocido) return <FichaAviso a={conocido} />;
  if (carga.estado === "cargando") return <div className="wrap"><Cargando /></div>;
  if (carga.estado === "error") return <div className="wrap prose"><p className="form-err" role="alert">{carga.mensaje}</p></div>;
  if (!aviso) return <AvisoQueNoEsta />;
  return <FichaAviso a={aviso} />;
}

/** El link llegó por WhatsApp o Instagram pero el aviso ya no está: en vez de un callejón sin salida, otros avisos. */
function AvisoQueNoEsta() {
  const otros = useCarga(() => listarAvisos({}, 4), []);
  const lista = otros.estado === "listo" && !otros.datos.soloEjemplos ? otros.datos.avisos : [];
  return (
    <div className="wrap">
      <div className="prose">
        <h1>Este aviso ya no está.</h1>
        <p>Puede que se haya vendido, que lo hayan bajado o que haya vencido (los avisos duran 90 días).</p>
        <p className="botones"><a className="btn btn-main" href={ir("buscar")}>Ver todos los avisos</a> <a className="btn btn-line" href={ir("busco")}>Avisame si aparece algo parecido</a></p>
      </div>
      {lista.length > 0 && (
        <section className="relacionados" aria-labelledby="otrosT">
          <h2 id="otrosT">Mirá estos otros</h2>
          <div className="grid mini reales">{lista.map((x) => <Tarjeta key={x.id} aviso={x} />)}</div>
        </section>
      )}
    </div>
  );
}

function FichaAviso({ a }: { a: AvisoPublico }) {
  const R = RUBROS[a.rubro];
  const fotos = a.fotos.map(fotoSegura).filter(Boolean);
  const [foto, setFoto] = useState(0);
  const [grande, setGrande] = useState(false);
  const contacto = useContacto(a);
  const refBoton = useRef<HTMLDivElement>(null);
  const otros = useCarga(() => listarAvisos({ rubro: a.rubro }, 5), [a.id]);
  const meta = [a.tipo, a.operacion === "alquiler" ? "Alquiler" : "Venta", a.zona].filter(Boolean).join(" · ");
  const bajo = a.precioAnterior !== null && a.precio !== null && a.precio < a.precioAnterior;

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Estás en">
        <a href={ir("inicio")}>Inicio</a> › <a href={ir(R.ruta)}>{R.nombre}</a> › <span>{a.tipo}</span>
      </nav>
      <div className="aviso-grid">
        <div className="galeria">
          <div className="foto-main">
            {fotos[foto] ? (
              <>
                <button type="button" className="foto-abrir" aria-label="Ver la foto en grande" onClick={() => setGrande(true)}>
                  <img src={fotos[foto]} alt={`Foto ${foto + 1} de ${fotos.length}: ${a.titulo}`} style={foto === 0 ? { objectPosition: posicionFoco(a.foco) } : undefined} />
                </button>
                <span className="foto-lupa" aria-hidden="true">Tocá para verla entera</span>
                {fotos.length > 1 && <>
                  <button type="button" className="foto-flecha izq" aria-label="Foto anterior" onClick={() => setFoto((foto - 1 + fotos.length) % fotos.length)}>‹</button>
                  <button type="button" className="foto-flecha der" aria-label="Foto siguiente" onClick={() => setFoto((foto + 1) % fotos.length)}>›</button>
                  <span className="foto-num">{foto + 1} / {fotos.length}</span>
                </>}
              </>
            ) : <div className="sin-foto">Sin foto</div>}
            {a.ejemplo && <span className="tag tag-ej big">Aviso de ejemplo</span>}
          </div>
          {grande && fotos.length > 0 && <Visor fotos={fotos} inicial={foto} onCerrar={(i) => { setFoto(i); setGrande(false); }} />}
          {fotos.length > 1 && (
            <div className="thumbs">
              {fotos.map((f, i) => (
                <button key={f} type="button" aria-label={`Ver foto ${i + 1}`} aria-current={i === foto} onClick={() => setFoto(i)}>
                  <img src={f} alt="" width={120} height={80} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="aviso-info">
          <p className="meta"><span className="lugar">{a.pueblo}</span> · {meta}</p>
          <h1>{a.titulo}</h1>
          {a.reservado && <p className="reservado"><b>Reservado.</b> El dueño ya lo tiene señado. Si querés quedar por si se cae, escribile igual.</p>}
          <p className="price big">
            {precioTexto(a)}
            {porMes(a) && <span> por mes</span>}
          </p>
          {!!a.condiciones?.expensas && <p className="small expensas">+ $ {fmtNum(a.condiciones.expensas)} de expensas por mes</p>}
          {bajo && a.precioAnterior !== null && (
            <p className="baja">Bajó de precio: antes {a.moneda === "ARS" ? "$" : "USD"} {fmtNum(a.precioAnterior)}</p>
          )}
          <Contacto a={a} c={contacto} refBoton={refBoton} />
          {a.publica && (
            <p className="publica">
              <span className="publica-ini" aria-hidden="true">{a.publica.charAt(0).toUpperCase()}</span>
              <span>Publica <b>{a.publica}</b><small>{QUIEN_TEXTO[a.quien]}</small></span>
            </p>
          )}
          <ul className="datos">
            {a.datos.map((d) => <li key={d}>{d}</li>)}
            {a.permuta && <li className="ok">Acepta permuta</li>}
            {a.financia && <li className="ok">Financia</li>}
          </ul>
          {a.operacion === "alquiler" && <Condiciones a={a} />}
          {a.descripcion && <p className="desc">{a.descripcion}</p>}
          {MAPA_ACTIVO && a.lat !== null && a.lng !== null && (
            <section className="ubicacion" aria-labelledby="ubi-t">
              <h2 id="ubi-t">Ubicación</h2>
              <Mapa lat={a.lat} lng={a.lng} zoom={15} titulo={`Ubicación de ${a.titulo}`} puntos={[{ id: a.id, lat: a.lat, lng: a.lng }]} />
              <a className="small" href={`https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`} target="_blank" rel="noopener noreferrer">Abrir en Google Maps para ir</a>
            </section>
          )}
          <p className="small">Publicado el {fmtFecha(new Date(a.publicadoEn))}. Se muestra hasta el {fmtFecha(new Date(a.venceEn))}.</p>
          {!a.ejemplo && <Compartir a={a} />}
        </div>
      </div>
      <BarraContacto a={a} c={contacto} refBoton={refBoton} />
      {otros.estado === "listo" && otros.datos.avisos.some((x) => x.id !== a.id) && (
        <>
          <div className="sec-h"><h2>Más avisos de {R.nombre.toLowerCase()}</h2><a href={ir(R.ruta)}>Ver todos</a></div>
          <div className="grid mini reales">{otros.datos.avisos.filter((x) => x.id !== a.id).slice(0, 4).map((x) => <Tarjeta key={x.id} aviso={x} />)}</div>
        </>
      )}
    </div>
  );
}

/** El teléfono del dueño lo da el backend recién cuando tocan el botón. Lo usan el botón grande y la barra fija del celular. */
/** Garantía, depósito, contrato… lo que más pregunta quien quiere alquilar. */
const QUIEN_TEXTO: Record<AvisoPublico["quien"], string> = { dueno: "Dueño directo", inmobiliaria: "Inmobiliaria", agencia: "Agencia", "": "" };

function Condiciones({ a }: { a: AvisoPublico }) {
  const renglones = a.condiciones ? renglonesCondiciones(a.condiciones) : [];
  return (
    <section className="condiciones" aria-labelledby="cond-t">
      <h2 id="cond-t">Condiciones del alquiler</h2>
      {renglones.length ? (
        <dl>{renglones.map(([que, como]) => <div key={que}><dt>{que}</dt><dd>{como}</dd></div>)}</dl>
      ) : (
        <p className="small">{a.quien === "dueno" || !a.anunciante ? "El dueño no cargó" : "No cargaron"} las condiciones (garantía, depósito, contrato). Preguntá por WhatsApp.</p>
      )}
    </section>
  );
}

function useContacto(a: AvisoPublico) {
  const [estado, setEstado] = useState<"" | "pidiendo" | "listo">("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const pedir = async () => {
    setEstado("pidiendo");
    setError("");
    try {
      const r = await linkContacto(a.id);
      setUrl(r.url);
      setEstado("listo");
      window.location.assign(r.url); // en el celular abre WhatsApp directo; si no, queda el botón
    } catch (e) {
      setEstado("");
      setError(e instanceof ErrorApi ? e.message : "No se pudo abrir el contacto. Probá de nuevo.");
    }
  };
  return { estado, url, error, pedir };
}
type EstadoContacto = ReturnType<typeof useContacto>;

/** "con el dueño", "con la agencia"… según quién publica. */
const conQuien = (q: AvisoPublico["quien"]): string => (q === "agencia" ? "con la agencia" : q === "inmobiliaria" ? "con la inmobiliaria" : q === "dueno" ? "con el dueño" : "");

function BotonWA({ c, corto, quien }: { c: EstadoContacto; corto?: boolean; quien: AvisoPublico["quien"] }) {
  return c.estado === "listo" ? (
    <a className="btn btn-wa" href={c.url} target="_blank" rel="noopener noreferrer">{corto ? "Abrir" : `Abrir WhatsApp ${conQuien(quien)}`.trim()}</a>
  ) : (
    <button type="button" className="btn btn-wa" onClick={() => void c.pedir()} disabled={c.estado === "pidiendo"}>
      {c.estado === "pidiendo" ? "Un segundo…" : corto ? "WhatsApp" : `Hablar por WhatsApp ${conQuien(quien)}`.trim()}
    </button>
  );
}

function Contacto({ a, c, refBoton }: { a: AvisoPublico; c: EstadoContacto; refBoton: RefObject<HTMLDivElement | null> }) {
  if (a.ejemplo)
    return (
      <div className="contacto">
        <button type="button" className="btn btn-wa" disabled>Hablar por WhatsApp con el dueño</button>
        <p className="nota-ej">Aviso de ejemplo: está para que veas cómo se ve. No tiene un dueño real para contactar.</p>
      </div>
    );
  return (
    <div className="contacto" ref={refBoton}>
      <BotonWA c={c} quien={a.quien} />
      {c.error && <p className="err" role="alert">{c.error}</p>}
      <p className="small">Hablás directo con quien publicó. Vidriera Chabás no cobra comisión ni participa de la operación.</p>
    </div>
  );
}

/** En el celular: precio y WhatsApp siempre a mano, mientras el botón grande no está a la vista. */
function BarraContacto({ a, c, refBoton }: { a: AvisoPublico; c: EstadoContacto; refBoton: RefObject<HTMLDivElement | null> }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = refBoton.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(([e]) => setVisible(!e!.isIntersecting), { threshold: 0 });
    o.observe(el);
    return () => o.disconnect();
  }, [refBoton]);
  if (a.ejemplo) return null;
  return (
    <div className={`barra-wa${visible ? " visible" : ""}`} aria-hidden={!visible} inert={!visible}>
      <span className="barra-wa-precio"><b>{precioTexto(a)}</b>{porMes(a) && <small> por mes</small>}</span>
      <BotonWA c={c} quien={a.quien} corto />
    </div>
  );
}

/** Link para compartir el aviso por WhatsApp (con foto y título en la vista previa). */
function Compartir({ a }: { a: AvisoPublico }) {
  const link = `${window.location.origin}/a/${a.id}?de=wa`;
  const texto = `${a.titulo} · ${precioTexto(a)} — ${link}`;
  return (
    <p className="compartir">
      <a className="btn btn-line" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
    </p>
  );
}

/** Foto a pantalla completa: entera, con flechas, deslizar, teclado y zoom (tocar o rueda; en el celular también pellizcar). */
function Visor({ fotos, inicial, onCerrar }: { fotos: string[]; inicial: number; onCerrar: (i: number) => void }) {
  const [i, setI] = useState(inicial);
  const [zoom, setZoom] = useState(1);
  const [origen, setOrigen] = useState("50% 50%");
  const toque = useRef<{ x: number; y: number } | null>(null);
  const ir = (d: number) => { setZoom(1); setI((x) => (x + d + fotos.length) % fotos.length); };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar(i);
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
  });
  const punto = (e: PE<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigen(`${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };
  return (
    <div className="visor" role="dialog" aria-modal="true" aria-label="Fotos del aviso"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(i); }}
      onPointerDown={(e) => { toque.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const t = toque.current; toque.current = null;
        if (!t || zoom > 1 || e.pointerType === "mouse") return;
        const dx = e.clientX - t.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - t.y)) ir(dx < 0 ? 1 : -1);
      }}
      onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.002)))}>
      <img key={fotos[i]} src={fotos[i]} alt={`Foto ${i + 1} de ${fotos.length}`} draggable={false}
        className={zoom > 1 ? "con-zoom" : ""} style={{ transform: `scale(${zoom})`, transformOrigin: origen }}
        onPointerMove={(e) => zoom > 1 && punto(e)}
        onClick={(e) => { punto(e); setZoom((z) => (z > 1 ? 1 : 2.5)); }} />
      <button type="button" className="visor-cerrar" aria-label="Cerrar" onClick={() => onCerrar(i)}>✕</button>
      {fotos.length > 1 && <>
        <button type="button" className="visor-flecha izq" aria-label="Foto anterior" onClick={() => ir(-1)}>‹</button>
        <button type="button" className="visor-flecha der" aria-label="Foto siguiente" onClick={() => ir(1)}>›</button>
      </>}
      <p className="visor-pie">{i + 1} / {fotos.length} · {zoom > 1 ? "Tocá para alejar" : "Tocá la foto para acercar"}</p>
    </div>
  );
}
