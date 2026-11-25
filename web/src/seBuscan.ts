// «Se buscan» en prueba (?se-buscan=1). También se ve con la portada nueva (?portada=1).
import { PORTADA_NUEVA, enPrueba } from "./pruebas.ts";

export const SE_BUSCAN_ACTIVO = enPrueba("se-buscan") || PORTADA_NUEVA;
