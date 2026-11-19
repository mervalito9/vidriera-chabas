// Panel de Vidriera Chabás: entrada (contraseña) y armazón. Se baja aparte del sitio (ver App.tsx).
import { useEffect, useState, type FormEvent } from "react";
import { admin, conServidor } from "../api.ts";
import { Cargando } from "../components/Tarjeta.tsx";
import { useCarga, useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";
import { Logo, mensajeError } from "./comunes.tsx";
import { Panel } from "./Panel.tsx";

export function Admin({ param = "" }: { param?: string }) {
  useTitulo("Panel");
  const servidor = useCarga(() => conServidor(), []);
  const [sesion, setSesion] = useState<"?" | "si" | "no">("?");
  useEffect(() => {
    if (servidor.estado !== "listo" || !servidor.datos) return;
    admin.sesion().then((r) => setSesion(r.ok ? "si" : "no"), () => setSesion("no"));
  }, [servidor]);

  if (servidor.estado === "cargando" || (servidor.estado === "listo" && servidor.datos && sesion === "?")) return <div className="pn-centro"><Cargando /></div>;
  if (servidor.estado !== "listo" || !servidor.datos)
    return <div className="pn-centro"><div className="pn-login"><Logo /><p>El panel funciona cuando el sitio está corriendo en su servidor. En esta vista previa no hay base de datos.</p></div></div>;
  if (sesion === "no") return <Login onEntrar={() => setSesion("si")} />;
  return <Panel param={param} onSalir={() => setSesion("no")} />;
}

function Login({ onEntrar }: { onEntrar: () => void }) {
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await admin.entrar(clave);
      setClave("");
      onEntrar();
    } catch (x) {
      setError(mensajeError(x));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="pn-centro">
      <form className="pn-login" onSubmit={(e) => void entrar(e)}>
        <Logo />
        <h1>Panel</h1>
        <label className="pn-campo">
          <span>Contraseña</span>
          <span className="pn-clave">
            <input type={ver ? "text" : "password"} autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} autoFocus />
            <button type="button" className="pn-linkbtn" onClick={() => setVer(!ver)}>{ver ? "Ocultar" : "Ver"}</button>
          </span>
        </label>
        {error && <p className="form-err" role="alert">{error}</p>}
        <button className="pn-btn pn-btn-main pn-btn-xl" type="submit" disabled={enviando || !clave}>{enviando ? "Entrando…" : "Entrar"}</button>
        <a className="pn-linkbtn" href={ir("inicio")}>← Volver al sitio</a>
      </form>
    </div>
  );
}
