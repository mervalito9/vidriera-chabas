import type { ReactNode } from "react";
import type { AvisoPublico } from "../../../shared/tipos.ts";
import { ir } from "../router.ts";
import { fotoSegura, hace, porMes, precioTexto } from "../formato.ts";

/** Si la foto ya estaba bajada (por ejemplo al volver atrás), se muestra sin esperar. */
const fotoLista = (img: HTMLImageElement | null): void => {
  if (img?.complete && img.naturalWidth) img.classList.add("lista");
};

/** `previa`: vista previa en el panel (sin link y aceptando fotos recién elegidas). */
export function Tarjeta({ aviso: a, previa }: { aviso: AvisoPublico; previa?: boolean }) {
  const tapa = a.fotos[0] ?? "";
  const foto = previa && /^data:image\/(jpeg|png|webp);base64,/.test(tapa) ? tapa : fotoSegura(tapa);
  const Caja = previa ? "div" : "a";
  const extras = [a.permuta && "Acepta permuta", a.financia && "Financia"].filter(Boolean).join(" · ");
  return (
    <Caja className="card" {...(previa ? {} : { href: ir("aviso", a.id) })}>
      <div className="card-ph">
        {foto ? <img src={foto} alt="" width={640} height={420} loading="lazy" decoding="async" className="foto-entra" ref={fotoLista} onLoad={(e) => e.currentTarget.classList.add("lista")} /> : <div className="sin-foto">Sin foto</div>}
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
    </Caja>
  );
}

/** Sin resultados. En un listado, quien llegó está buscando: lo primero es ofrecerle que le avisemos. */
export function Vacio({ texto, buscando = false, extra }: { texto: string; buscando?: boolean; extra?: ReactNode }) {
  const publicar = <a className={`btn ${buscando ? "btn-line" : "btn-main"}`} href={ir("publicar")}>Publicar gratis</a>;
  const avisame = <a className={`btn ${buscando ? "btn-main" : "btn-line"}`} href={ir("busco")}>Avisame cuando aparezca</a>;
  return (
    <div className="empty">
      <img src="assets/img/isotipo-claro.svg" alt="" width={64} height={73} />
      <p className="empty-t">{texto}</p>
      <p>{buscando ? "Dejanos qué buscás y te escribimos por WhatsApp cuando alguien lo publique." : "Publicá el primero, es gratis."}</p>
      <div className="empty-btns">
        {buscando ? <>{avisame}{extra}{publicar}</> : <>{publicar}{avisame}</>}
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
