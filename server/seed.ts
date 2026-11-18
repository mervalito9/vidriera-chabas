// Carga (o vuelve a cargar) los avisos de ejemplo. Uso: npm run ejemplos
// El servidor ya lo hace solo al arrancar; esto queda para usarlo a mano.
import { sincronizarEjemplos } from "./ejemplos.ts";

console.log(`Listo: ${sincronizarEjemplos()} avisos de ejemplo cargados.`);
