import { CENTRO_ZONA, COORDENADAS } from "../../../shared/config.ts";
import { Mapa } from "./Mapa.tsx";

/** En el formulario: tocar el mapa para marcar dónde está la propiedad. Arranca en el pueblo elegido. */
export function MarcarUbicacion({ lat, lng, pueblo, onCambio }: {
  lat: number | null;
  lng: number | null;
  pueblo: string;
  onCambio: (lat: number | null, lng: number | null) => void;
}) {
  const marcado = lat !== null && lng !== null;
  const base = COORDENADAS[pueblo];
  const [cLat, cLng] = marcado ? [lat, lng] : (base ?? CENTRO_ZONA);
  return (
    <fieldset className="marcar-ubicacion">
      <legend>Ubicación en el mapa <span className="opc">(opcional)</span></legend>
      <p className="small">Acercá el mapa y tocá justo donde está. Así aparece en el mapa de avisos y la gente sabe cómo llegar.</p>
      {/* Solo se recentra al cambiar de pueblo, no con cada toque (si no, el mapa saltaría). */}
      <Mapa key={pueblo} lat={cLat} lng={cLng} zoom={marcado ? 16 : base ? 14 : 10} titulo="Mapa para marcar la ubicación"
        puntos={marcado ? [{ id: "aca", lat, lng }] : []}
        onTocarMapa={(a, o) => onCambio(Math.round(a * 1e6) / 1e6, Math.round(o * 1e6) / 1e6)} />
      <div className="marcar-pie">
        <span className="small">{marcado ? "Listo: quedó marcada. Si no es ahí, tocá de nuevo en el lugar correcto." : "Todavía sin marcar."}</span>
        {marcado && <button type="button" className="linkbtn" onClick={() => onCambio(null, null)}>Quitar</button>}
      </div>
    </fieldset>
  );
}
