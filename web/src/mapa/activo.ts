// El mapa está en prueba: solo lo ve quien entró una vez con ?mapa=1 (queda guardado en ese navegador).
// ?mapa=0 lo vuelve a apagar. Cuando Felipe lo apruebe, esto devuelve siempre true y se borra.
const CLAVE = "vidriera-mapa";

function leer(): boolean {
  try {
    const pedido = new URLSearchParams(window.location.search).get("mapa");
    if (pedido === "1") window.localStorage.setItem(CLAVE, "1");
    if (pedido === "0") window.localStorage.removeItem(CLAVE);
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export const MAPA_ACTIVO = leer();
