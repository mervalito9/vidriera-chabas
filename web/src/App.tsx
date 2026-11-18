import { useEffect, useState } from "react";
import { PUEBLOS, RUBROS } from "../../shared/config.ts";
import { slug } from "../../shared/texto.ts";
import type { RubroId } from "../../shared/tipos.ts";
import { listarAvisos } from "./api.ts";
import { Marco } from "./components/Marco.tsx";
import { Admin } from "./pages/Admin.tsx";
import { Aviso } from "./pages/Aviso.tsx";
import { Busco } from "./pages/Busco.tsx";
import { Inicio } from "./pages/Inicio.tsx";
import { Listado } from "./pages/Listado.tsx";
import { Publicar } from "./pages/Publicar.tsx";
import { ComoFunciona, NoEncontrado, Privacidad, Terminos } from "./pages/Textos.tsx";
import { useRuta, type Ruta } from "./router.ts";

function Pagina({ ruta }: { ruta: Ruta }) {
  const { nombre, param } = ruta;
  if (nombre === "inicio") return <Inicio />;
  if (nombre === "buscar") return <Listado key="todo" rubro="" atajo={param} />;
  if (nombre in RUBROS) return <Listado key={nombre} rubro={nombre as RubroId} atajo={param} />;
  if (nombre === "aviso" && /^\d+$/.test(param)) return <Aviso key={param} id={Number(param)} />;
  if (nombre === "publicar") return <Publicar key={param} rubro={param} />;
  if (nombre === "busco") return <Busco />;
  if (nombre === "como-funciona") return <ComoFunciona />;
  if (nombre === "terminos") return <Terminos />;
  if (nombre === "privacidad") return <Privacidad />;
  // #pueblo--sanford: el listado de toda la zona con el filtro de ese pueblo puesto (#pueblo--otro = pueblos fuera de la lista)
  if (nombre === "pueblo") {
    const p = param === "otro" ? "otro" : (PUEBLOS.find((x) => slug(x) === param) ?? "");
    return <Listado key={`pueblo-${p}`} rubro="" atajo="" pueblo={p} />;
  }
  if (nombre === "admin") return <Admin />;
  return <NoEncontrado />;
}

export function App() {
  const ruta = useRuta();
  const [soloEjemplos, setSoloEjemplos] = useState(false);
  useEffect(() => {
    listarAvisos({}, 1).then((l) => setSoloEjemplos(l.soloEjemplos && l.total > 0), () => setSoloEjemplos(false));
  }, []);
  return (
    <Marco ruta={ruta.nombre} soloEjemplos={soloEjemplos}>
      <Pagina ruta={ruta} />
    </Marco>
  );
}
