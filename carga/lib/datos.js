// Carga del JSON que genera preparar-datos.mjs. Solo se usa en el contexto de inicialización de k6
// (`open` no existe después). Los datos son de prueba: placas, PIN y QR de un entorno de prueba.
import { CONFIG } from './entorno.js';

/** Lee y valida lo mínimo que necesitan los escenarios. Falla con un mensaje claro si falta algo. */
export function leerDatos() {
  if (!CONFIG.datos) {
    throw new Error('Falta CARGA_DATOS: ruta absoluta al JSON que genera carga/preparar-datos.mjs.');
  }
  const datos = JSON.parse(open(CONFIG.datos));
  for (const clave of ['puertas', 'dispositivos', 'usuarios']) {
    if (!Array.isArray(datos[clave]) || datos[clave].length === 0) {
      throw new Error(`El archivo de datos no tiene "${clave}". Vuelve a correr preparar-datos.mjs.`);
    }
  }
  if (!Array.isArray(datos.qr)) datos.qr = [];
  return datos;
}

/** Los QR de un uso concreto: 'validacion', 'repeticion' (ya usados en la preparación) o 'confirmacion'. */
export function qrDeUso(datos, uso) {
  return datos.qr.filter((qr) => qr.uso === uso);
}
