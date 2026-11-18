import type { AvisoPublico } from "../../../shared/tipos.ts";
import { ir } from "../router.ts";
import { fotoSegura, hace, porMes, precioTexto } from "../formato.ts";

export function Tarjeta({ aviso: a }: { aviso: AvisoPublico }) {
  const foto = fotoSegura(a.fotos[0] ?? "");
  const extras = [a.permuta && "Acepta permuta", a.financia && "Financia"].filter(Boolean).join(" · ");
  return (
    <a className="card" href={ir("aviso", a.id)}>
      <div className="card-ph">
        {foto ? <img src={foto} alt="" width={640} height={420} loading="lazy" decoding="async" /> : <div className="sin-foto">Sin foto</div>}
        <div className="tags">
          {a.ejemplo && <span className="tag tag-ej">Ejemplo</span>}
          {a.reservado && <span className="tag tag-res">Reservado</span>}
          <span className="tag">{a.operacion === "alquiler" ? "Alquiler" : "Venta"}</span>
          {a.precioAnterior !== null && a.precio !== null && a.precio < a.precioAnterior && <span className="tag tag-baja">Bajó de precio</span>}
        </div>
      </div>
      <div className="card-body">
        <p className="price">
          {precioTexto(a)}
          {porMes(a) && <span> por mes</span>}
        </p>
        <h3>{a.titulo}</h3>
        {a.datos.length > 0 && (
          <ul className="chips-datos">{a.datos.slice(0, 4).map((d) => <li key={d}>{d}</li>)}</ul>
        )}
        {extras && <p className="perks">{extras}</p>}
        <p className="meta card-pie">
          <span className="lugar">{a.pueblo}</span>
          <span>{hace(a.publicadoEn)}</span>
        </p>
      </div>
    </a>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <div className="empty">
      <img src="assets/img/isotipo-claro.svg" alt="" width={64} height={73} />
      <p className="empty-t">{texto}</p>
      <p>Publicá el primero, es gratis.</p>
      <div className="empty-btns">
        <a className="btn btn-main" href={ir("publicar")}>Publicar gratis</a>
        <a className="btn btn-line" href={ir("busco")}>Avisame cuando aparezca</a>
      </div>
    </div>
  );
}

export function Cargando() {
  return (
    <div className="cargando" role="status">
      <span className="punto" />
      <span className="punto" />
      <span className="punto" />
      <span className="sr">Cargando…</span>
    </div>
  );
}
