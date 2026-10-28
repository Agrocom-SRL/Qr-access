/**
 * «Todos los de la cuenta» como valor EXPLÍCITO, no como `null`: un `null` o un `undefined` que se cuela por un
 * error (un dato que faltó) no puede pasar por «toda la cuenta». Solo lo construye quien opera sobre la cuenta
 * entera con permiso de plataforma (las rutas `/plataforma/cuentas/{id}/…`); ningún rol de cuenta llega a él
 * (ADR 0028 §4, invariante 1). El repositorio de cuenta sigue filtrando por la cuenta del contexto: este valor
 * solo quita el filtro por usuarios o autores DENTRO de ella.
 */
export const TODA_LA_CUENTA: unique symbol = Symbol('toda_la_cuenta');

/** Una lista de ids, o «toda la cuenta» (`TODA_LA_CUENTA`). */
export type IdsOTodaLaCuenta = readonly string[] | typeof TODA_LA_CUENTA;
