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

/** Portada nueva: categorías con cantidad y sin vacías, «Se buscan» arriba, bloque de publicar más corto. */
export const PORTADA_NUEVA = enPrueba("portada");
// Los estilos de la prueba se aplican solo con esta clase (así el resto del público no ve cambios).
if (PORTADA_NUEVA) document.documentElement.classList.add("portada-nueva");
