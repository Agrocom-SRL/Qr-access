/**
 * Devuelve el valor de un selector si pertenece a su lista cerrada, o el valor por omisión. Un
 * valor que el panel no conoce nunca llega a la API ni a un filtro con un nombre inventado.
 */
export function enLista<T extends string>(lista: readonly T[], valor: string, porOmision: T): T {
  return lista.find((elemento) => elemento === valor) ?? porOmision;
}
