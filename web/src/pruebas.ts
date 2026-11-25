// Funciones en prueba: solo las ve quien entró una vez con ?<clave>=1 (queda guardado en ese navegador).
// ?<clave>=0 las vuelve a apagar. Cuando Felipe aprueba una, se borra su bandera y queda para todos.
export function enPrueba(clave: string): boolean {
  try {
    const guardada = `vidriera-prueba-${clave}`;
    const pedido = new URLSearchParams(window.location.search).get(clave);
    if (pedido === "1") window.localStorage.setItem(guardada, "1");
    if (pedido === "0") window.localStorage.removeItem(guardada);
    return window.localStorage.getItem(guardada) === "1";
  } catch {
    return false;
  }
}

// Aprobadas por Felipe el 25/11/2026 y prendidas para todos:
/** Portada en formato feed: avisos de a uno, foto grande, precio sobre la foto. */
export const FEED = true;
/** Versión nueva: sin cuadros arriba, categorías con cantidad, «Nuevo», «N fotos», cómo publicar, «Se buscan». */
export const PORTADA_NUEVA = true;
// Los estilos de la versión nueva cuelgan de estas clases.
document.documentElement.classList.add("portada-nueva", "portada-feed");
