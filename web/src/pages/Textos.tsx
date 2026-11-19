import { WA_NUMERO } from "../../../shared/config.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";

export function ComoFunciona() {
  useTitulo("Cómo funciona");
  return (
    <div className="wrap prose">
      <h1>Cómo <em>funciona.</em></h1>
      <p>Vidriera Chabás es un tablón de avisos de Chabás y la zona: quien vende o alquila publica, y los interesados le escriben directo. Nada más.</p>
      <ol className="pasos">
        <li><b>Buscás o publicás.</b><span>Buscás por rubro, tipo, precio o palabra. Para publicar, completás un formulario corto con fotos (o nos mandás todo por WhatsApp).</span></li>
        <li className="verde"><b>Hablás directo por WhatsApp.</b><span>Cada aviso tiene un botón para escribirle a quien lo publicó: el dueño, o la inmobiliaria o agencia si dice «Publica: …». Vidriera no se mete en el medio.</span></li>
        <li><b>Cerrás vos, sin comisión.</b><span>Vidriera no cobra comisión, no tasa y no participa de la operación.</span></li>
      </ol>
      <h2>¿Cuánto cuesta publicar?</h2><p>Nada. Publicar es gratis y no se cobra comisión por vender o alquilar.</p>
      <h2>¿Cuánto dura un aviso?</h2><p>90 días. Si no se vendió, lo volvemos a publicar gratis. Si se vendió antes, avisanos por WhatsApp y lo bajamos.</p>
      <h2>¿Sos inmobiliaria, agencia o concesionaria?</h2>
      <p>También podés publicar gratis. Si tenés varios avisos, mandanos la lista con las fotos por WhatsApp y los cargamos nosotros. En cada aviso aparece «Publica: el nombre de tu negocio», y las consultas te llegan directo a tu WhatsApp.</p>
      <p><a className="btn btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, "Hola Felipe! Tengo una inmobiliaria/agencia y quiero publicar mis avisos en Vidriera Chabás.")}>Mandar mis avisos por WhatsApp</a></p>
      <h2>¿Y los papeles?</h2><p>Las escrituras las hace una escribanía. Las transferencias de autos, motos y maquinaria se hacen en el Registro Automotor.</p>
      <p><a className="btn btn-main" href={ir("publicar")}>Publicar gratis</a></p>
    </div>
  );
}

export function Terminos() {
  useTitulo("Términos");
  return (
    <div className="wrap prose">
      <h1>Términos <em>de uso.</em></h1>
      <h2>1. Qué es Vidriera Chabás</h2>
      <p>Un tablón de avisos clasificados donde dueños, inmobiliarias y agencias publican casas, alquileres, vehículos y maquinaria, y los interesados los contactan directo. Vidriera Chabás no es una inmobiliaria ni una concesionaria: no intermedia en las operaciones, no tasa, no participa en las negociaciones y no cobra comisión sobre ventas o alquileres.</p>
      <h2>2. Responsabilidad de cada aviso</h2>
      <p>Cada aviso es responsabilidad de quien lo publica, que declara que la información es verdadera y que tiene derecho a vender o alquilar lo que ofrece. Vidriera Chabás revisa los avisos antes de publicarlos, pero no verifica la titularidad ni garantiza las operaciones. Antes de pagar, cada persona debe verificar la titularidad y los papeles.</p>
      <h2>3. Precio</h2><p>Publicar es gratis. No se cobra comisión.</p>
      <h2>4. Duración y baja</h2>
      <p>Los avisos se muestran 90 días. Podés pedir que bajemos tu aviso cuando quieras, escribiéndonos por WhatsApp. Podemos rechazar o sacar avisos falsos, engañosos o que no cumplan estos términos.</p>
      <h2>5. Datos personales</h2><p>Ver la página de <a href={ir("privacidad")}>Privacidad</a>.</p>
    </div>
  );
}

export function Privacidad() {
  useTitulo("Privacidad");
  return (
    <div className="wrap prose">
      <h1>Privacidad.</h1>
      <h2>Qué datos guardamos</h2>
      <p>Para publicar: tu nombre, tu WhatsApp, los datos del aviso y las fotos. Para "Avisame cuando aparezca": tu nombre, lo que buscás y tu WhatsApp. Se guardan en el servidor de Vidriera Chabás.</p>
      <h2>Para qué</h2>
      <p>Para publicar tu aviso y que los interesados te puedan escribir, o para avisarte cuando aparezca lo que buscás. Además guardamos los cambios de precio de cada aviso para armar un historial de precios de la zona (sin datos personales). No vendemos ni compartimos tus datos.</p>
      <h2>Tu número en el aviso</h2>
      <p>Tu WhatsApp no aparece escrito en la página: el servidor lo entrega recién cuando alguien toca "Hablar por WhatsApp" en tu aviso.</p>
      <h2>Cookies y estadísticas</h2>
      <p>El sitio no usa cookies para visitantes, ni servicios de analítica ni publicidad de terceros. La única cookie es la del panel de administración.</p>
      <p>Para saber cuánta gente usa el sitio contamos, de forma propia y anónima, páginas vistas, contactos por WhatsApp, desde qué sitio se llegó y las palabras buscadas. Para no contar dos veces a la misma persona en un día usamos un código que se arma con la dirección IP y el navegador y una clave que cambia todos los días y se borra: no guardamos la IP y no se puede reconocer a nadie de un día para otro. De cada día solo quedan totales. También contamos, sin guardar IPs, los pedidos que recibe el servidor, sus errores y cuántas personas tienen el sitio abierto en este momento.</p>
      <h2>Borrar tus datos</h2>
      <p>Escribinos por WhatsApp y borramos tu aviso, sus fotos o tu búsqueda.</p>
    </div>
  );
}


export function NoEncontrado() {
  useTitulo("No encontramos esa página");
  return (
    <div className="wrap prose">
      <h1>No encontramos <em>esa página.</em></h1>
      <p>Puede que el aviso haya vencido o que el link esté mal escrito.</p>
      <p><a className="btn btn-main" href={ir("inicio")}>Ir al inicio</a></p>
    </div>
  );
}
