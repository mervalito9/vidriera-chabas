// «Se buscan» está en prueba: solo lo ve quien entró una vez con ?se-buscan=1 (queda guardado en ese navegador).
// ?se-buscan=0 lo vuelve a apagar. Cuando Felipe lo apruebe, esto devuelve siempre true y se borra.
const CLAVE = "vidriera-se-buscan";

function leer(): boolean {
  try {
    const pedido = new URLSearchParams(window.location.search).get("se-buscan");
    if (pedido === "1") window.localStorage.setItem(CLAVE, "1");
    if (pedido === "0") window.localStorage.removeItem(CLAVE);
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export const SE_BUSCAN_ACTIVO = leer();
