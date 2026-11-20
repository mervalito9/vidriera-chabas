// Bloque "Para redes" de cada aviso: vista previa de la historia y el posteo, botones para bajarlos y los textos.
import { useEffect, useRef, useState } from "react";
import type { AvisoAdmin } from "../../../shared/tipos.ts";
import { mensajeError } from "./comunes.tsx";
import { guardarImagen, imagenRedes, motivoSinRedes, textoHistoria, textoPosteo, type Formato, type ImagenRedes } from "./redes.ts";

type Estado = { tipo: "armando" } | { tipo: "listo"; imagenes: Record<Formato, ImagenRedes & { url: string }> } | { tipo: "error"; mensaje: string };

export function RedesDialogo({ a, onCerrar }: { a: AvisoAdmin; onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const motivo = motivoSinRedes(a);
  const [estado, setEstado] = useState<Estado>({ tipo: "armando" });
  const [aviso, setAviso] = useState("");
  const avisar = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(""), 3000); };

  useEffect(() => {
    dialogo.current?.showModal();
    // Se arman las dos al abrir: así se ven antes de bajar y el botón responde al instante (en el iPhone,
    // "Guardar en Fotos" tiene que salir enseguida del toque).
    let vigente = true;
    const urls: string[] = [];
    Promise.all([imagenRedes(a, "historia"), imagenRedes(a, "posteo")]).then(
      ([historia, posteo]) => {
        const conUrl = (i: ImagenRedes) => { const url = URL.createObjectURL(i.blob); urls.push(url); return { ...i, url }; };
        if (vigente) setEstado({ tipo: "listo", imagenes: { historia: conUrl(historia), posteo: conUrl(posteo) } });
      },
      (e: unknown) => vigente && setEstado({ tipo: "error", mensaje: mensajeError(e) }),
    );
    return () => { vigente = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [a]);

  const bajar = async (f: Formato) => {
    if (estado.tipo !== "listo") return;
    const r = await guardarImagen(estado.imagenes[f]);
    if (r === "bajada") avisar(`Bajada: ${estado.imagenes[f].nombre}`);
  };
  const copiar = async (texto: string, que: string) => {
    const ok = await navigator.clipboard?.writeText(texto).then(() => true, () => false);
    avisar(ok ? `Texto ${que} copiado` : "No se pudo copiar");
  };
  const link = `${window.location.origin}/a/${a.id}?de=ig`;
  const apagado = !!motivo || estado.tipo !== "listo";

  return (
    <dialog ref={dialogo} className="pn-redes" aria-label={`Para redes: ${a.titulo}`} onClose={onCerrar} onClick={(e) => { if (e.target === dialogo.current) dialogo.current?.close(); }}>
      <div className="pn-redes-in">
        <div className="pn-redes-cab">
          <div><h2>Para redes</h2><p className="pn-gris">{a.titulo}</p></div>
          <button type="button" className="pn-redes-x" aria-label="Cerrar" onClick={() => dialogo.current?.close()}>×</button>
        </div>
        {motivo && <p className="pn-redes-motivo" role="alert">{motivo} Las imágenes no se pueden bajar.</p>}
        {estado.tipo === "error" && <p className="pn-redes-motivo" role="alert">{estado.mensaje}</p>}
        <div className="pn-redes-previas">
          {(["historia", "posteo"] as const).map((f) => (
            <figure key={f} className={`pn-redes-previa ${f}`}>
              {estado.tipo === "listo" ? <img src={estado.imagenes[f].url} alt={`Vista previa de la ${f === "historia" ? "historia" : "publicación"}`} /> : <div className="pn-redes-hueco">{estado.tipo === "armando" ? "Armando…" : "—"}</div>}
              <figcaption>{f === "historia" ? "Historia · 1080×1920" : "Posteo · 1080×1440"}</figcaption>
            </figure>
          ))}
        </div>
        <div className="pn-redes-botones">
          <button type="button" className="pn-btn pn-btn-main" disabled={apagado} onClick={() => void bajar("historia")}>Bajar historia</button>
          <button type="button" className="pn-btn pn-btn-main" disabled={apagado} onClick={() => void bajar("posteo")}>Bajar posteo</button>
          <button type="button" className="pn-btn pn-btn-line" disabled={!!motivo} onClick={() => void copiar(textoPosteo(a), "del posteo")}>Copiar texto del posteo</button>
          <button type="button" className="pn-btn pn-btn-line" disabled={!!motivo} onClick={() => void copiar(textoHistoria(a, link), "de la historia")}>Copiar texto de la historia</button>
        </div>
        <p className="pn-gris pn-redes-ayuda">En el iPhone, «Bajar» abre el menú de compartir: elegí <b>Guardar imagen</b> y queda en Fotos. En la historia, el link va con el sticker de enlace (el texto de la historia ya lo trae).</p>
        {aviso && <p className="pn-toast" role="status">{aviso}</p>}
      </div>
    </dialog>
  );
}
