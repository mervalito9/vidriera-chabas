import { useState } from "react";
import { RUBROS, WA_NUMERO } from "../../../shared/config.ts";
import type { ErrorCampo, NuevoAviso, RubroId } from "../../../shared/tipos.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { ErrorApi, SinServidor, conServidor, publicar } from "../api.ts";
import { FormAviso, mensajeWhatsApp, valoresIniciales, type ValoresForm } from "../components/form/FormAviso.tsx";
import { FaltaWhatsApp } from "../components/Pueblos.tsx";
import { useCarga, useTitulo } from "../hooks.ts";
import { PORTADA_NUEVA } from "../pruebas.ts";
import { ir } from "../router.ts";

export function Publicar({ rubro }: { rubro: string }) {
  useTitulo("Publicar gratis");
  const servidor = useCarga(() => conServidor(), []);
  const hayServidor = servidor.estado === "listo" && servidor.datos;
  const [v, setV] = useState<ValoresForm>(() => valoresIniciales(rubro in RUBROS ? (rubro as RubroId) : ""));
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{ tipo: "ok"; id: number } | { tipo: "whatsapp" } | null>(null);
  const linkMensaje = linkWA(WA_NUMERO, mensajeWhatsApp(v));

  const enviar = async (a: NuevoAviso) => {
    if (!hayServidor) {
      setResultado({ tipo: "whatsapp" });
      return;
    }
    setEnviando(true);
    setError("");
    setErrores([]);
    try {
      const r = await publicar(a);
      setResultado({ tipo: "ok", id: r.id });
      window.scrollTo(0, 0);
    } catch (e) {
      if (e instanceof SinServidor) setResultado({ tipo: "whatsapp" });
      else if (e instanceof ErrorApi) {
        setErrores(e.campos);
        setError(e.campos.length ? "" : e.message);
      } else setError("Algo salió mal. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (resultado?.tipo === "ok")
    return (
      <div className="wrap prose listo">
        <img src="assets/img/isotipo-claro.svg" alt="" width={80} height={91} />
        <h1>¡Listo! Recibimos <em>tu aviso.</em></h1>
        <p>Lo revisamos y, cuando esté publicado, te avisamos por WhatsApp.</p>
        {numeroWA(WA_NUMERO) && (
          <p><a className="btn btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, `Hola! Acabo de mandar mi aviso (n.º ${resultado.id}) en Vidriera Chabás.`)}>Avisarle a Vidriera por WhatsApp</a></p>
        )}
        <p><a className="btn btn-line" href={ir("inicio")}>Volver al inicio</a></p>
      </div>
    );

  return (
    <div className="wrap">
      <div className="page-h">
        <h1>Publicá tu aviso <em>gratis.</em></h1>
        <p>{hayServidor ? "Completá estos datos, agregá las fotos y listo: lo revisamos y queda publicado. Sin comisión." : "Completá estos datos y tocá el botón: se abre WhatsApp con el mensaje listo. Después mandás las fotos por ahí mismo. Sin comisión."}</p>
      </div>
      {PORTADA_NUEVA && hayServidor && !resultado && (
        <div className="como-publicar">
          <ol>
            <li><b>Completás esto</b> desde el celular: qué es, fotos, precio y tu WhatsApp. Son 2 minutos.</li>
            <li><b>Lo reviso y lo publico</b>, normalmente en el día. Te aviso por WhatsApp.</li>
            <li><b>Te escriben directo a vos.</b> Sin comisión.</li>
          </ol>
          {numeroWA(WA_NUMERO) && (
            <p>¿Te resulta más fácil por WhatsApp? <a target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, "Hola Felipe! Quiero publicar algo en Vidriera Chabás. Te mando fotos y datos.")}>Mandame fotos y datos, y lo cargo yo</a>.</p>
          )}
        </div>
      )}
      {resultado?.tipo === "whatsapp" ? (
        <div className="form">
          <h2>Último paso: mandalo por WhatsApp</h2>
          <p>Tocá el botón y se abre WhatsApp con tu aviso escrito. Después mandá las fotos en el mismo chat.</p>
          {numeroWA(WA_NUMERO) ? <a className="btn btn-wa btn-xl" href={linkMensaje} target="_blank" rel="noopener noreferrer">Mandar por WhatsApp</a> : <FaltaWhatsApp />}
          <details className="preview-box"><summary>Ver el mensaje</summary><pre className="preview">{mensajeWhatsApp(v)}</pre></details>
          <button type="button" className="linkbtn" onClick={() => setResultado(null)}>← Corregir datos</button>
        </div>
      ) : (
        <FormAviso
          valores={v}
          onCambio={setV}
          onEnviar={(a) => void enviar(a)}
          exigirFotos={!!hayServidor}
          enviando={enviando}
          erroresServidor={errores}
          textoBoton={hayServidor ? "Publicar mi aviso" : "Seguir"}
          pie={
            <>
              {error && <p className="form-err" role="alert">{error}</p>}
              {hayServidor && numeroWA(WA_NUMERO) && (
                <p className="ayuda">¿Te cuesta cargarlo? <a href={linkMensaje} target="_blank" rel="noopener noreferrer">Mandanos los datos por WhatsApp</a> y lo armamos nosotros.</p>
              )}
              <p className="small">Tu aviso dura 90 días y es gratis. Antes de publicarse lo revisamos. <a href={ir("terminos")}>Términos</a> · <a href={ir("privacidad")}>Privacidad</a></p>
            </>
          }
        />
      )}
    </div>
  );
}
