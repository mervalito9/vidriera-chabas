import { useEffect, useRef, useState } from "react";
import { PUEBLOS_PROXIMOS, WA_NUMERO } from "../../../shared/config.ts";
import { recortar } from "../../../shared/texto.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { ir } from "../router.ts";

export function FaltaWhatsApp() {
  return <p className="falta-wa" role="status">Falta configurar el WhatsApp del sitio. Probá de nuevo más tarde.</p>;
}

/** "Todavía no llegamos a {pueblo}" + botón de WhatsApp para pedirlo (así se mide qué pueblo pide más). */
export function PanelPueblo({ nombre }: { nombre: string }) {
  const otro = nombre === "Otro pueblo";
  const [pueblo, setPueblo] = useState("");
  const [error, setError] = useState("");
  const elegido = otro ? recortar(pueblo, 40) : nombre;
  const href = linkWA(WA_NUMERO, `Quiero Vidriera en ${elegido || "mi pueblo"}`);
  return (
    <div className="proximo">
      <span className="badge">Próximamente</span>
      <h2>{otro ? "¿En qué pueblo estás?" : `Todavía no llegamos a ${nombre}.`}</h2>
      <p>{otro ? "Todavía no llegamos a otros pueblos. ¿Querés que lleguemos? Avisanos por WhatsApp." : "¿Querés que lleguemos? Avisanos por WhatsApp."}</p>
      {otro && (
        <>
          <label className="lbl" htmlFor="otroPueblo">Nombre del pueblo</label>
          <input id="otroPueblo" type="text" maxLength={40} autoComplete="address-level2" placeholder="Ej: Los Molinos" value={pueblo}
            onChange={(e) => { setPueblo(e.target.value); setError(""); }} />
        </>
      )}
      <div className="proximo-btn">
        {numeroWA(WA_NUMERO) ? (
          <a className="btn btn-wa" href={href} target="_blank" rel="noopener noreferrer"
            onClick={(e) => { if (otro && !elegido) { e.preventDefault(); setError("Escribí el nombre del pueblo."); } }}>
            Avisar por WhatsApp
          </a>
        ) : <FaltaWhatsApp />}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

/** Ventana para elegir pueblo. Se abre desde el botón "Chabás ▾" o desde la tira de pueblos. */
export function DialogoPueblos({ abierto, inicial, onCerrar }: { abierto: boolean; inicial: string; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [detalle, setDetalle] = useState(inicial);
  useEffect(() => setDetalle(inicial), [inicial, abierto]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} aria-labelledby="dlgT" onClose={onCerrar} onClick={(e) => e.target === ref.current && onCerrar()}>
      <div className="dlg-in">
        <div className="dlg-head">
          <h2 id="dlgT">Elegí tu pueblo</h2>
          <button type="button" className="cerrar" aria-label="Cerrar" onClick={onCerrar}>×</button>
        </div>
        {detalle ? (
          <>
            <PanelPueblo nombre={detalle} />
            <button type="button" className="linkbtn" onClick={() => setDetalle("")}>← Ver todos los pueblos</button>
          </>
        ) : (
          <>
            <p>Por ahora Vidriera está solo en Chabás. Tocá tu pueblo para pedir que lleguemos.</p>
            <ul className="plist">
              <li><a className="on" href={ir("inicio")} onClick={onCerrar}>Chabás <span className="badge">Estás acá</span></a></li>
              {PUEBLOS_PROXIMOS.map((p) => (
                <li key={p.slug}>
                  <a href={ir("pueblo", p.slug)} onClick={(e) => { e.preventDefault(); setDetalle(p.nombre); }}>
                    {p.nombre} <span className="badge">Próximamente</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  );
}
