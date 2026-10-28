import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { permisoDePlataforma } from '../../plugins/permisos.js';
import { ejecutar as listarConsumoDeBolsa } from './actions/listar-consumo-de-bolsa.js';
import { ejecutar as listarFlujoDeCuentas } from './actions/listar-flujo-de-cuentas.js';
import { ejecutar as listarSenales } from './actions/listar-senales.js';
import { ejecutar as resumirSenales } from './actions/resumir-senales.js';
import { ejecutar as verConsumoDeCuenta } from './actions/ver-consumo-de-cuenta.js';
import { ejecutar as verFlujoDeCuenta } from './actions/ver-flujo-de-cuenta.js';
import {
  consultaDeConsumo,
  consultaDeFlujoDeCuenta,
  consultaDeFlujoDeCuentas,
  consultaDeResumenDeSenales,
  consultaDeSenales,
  parametrosDeCuentaDeSenales,
  respuestaDeConsumo,
  respuestaDeConsumoDeCuenta,
  respuestaDeFlujoDeCuenta,
  respuestaDeFlujoDeCuentas,
  respuestaDeResumenDeSenales,
  respuestaDeSenales,
} from './schemas.js';

const ETIQUETA = ['plataforma'];

/**
 * La vista de AGROCOM sobre el uso y el abuso (ADR 0030 §5, ola W12): consumo de la bolsa mensual por cuenta, señales
 * abiertas y flujo atípico. Todo es de SOLO LECTURA y de plataforma: un rol de cuenta nunca llega acá (los permisos
 * `limites.consumo.ver` y `seguridad.senal.ver` son de ámbito plataforma). Nada de esto limita ni bloquea a nadie.
 */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/plataforma/consumo-de-bolsa',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'El consumo de la bolsa mensual de QR de todas las cuentas en el mes local en curso: usado, tope, porcentaje ' +
            'y estado (`normal`, `aviso`, `superada`, `sin_tope`). Por omisión, el ranking de mayor a menor porcentaje. ' +
            'No corta nada: la bolsa solo se registra y se avisa.',
          querystring: consultaDeConsumo,
          response: { 200: respuestaDeConsumo },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('limites.consumo.ver'),
      },
      (request) => {
        const { pagina, por_pagina, estado, buscar, orden, sentido } = request.query;
        return listarConsumoDeBolsa(
          pool,
          { estado: estado ?? null, buscar: buscar ?? null, orden, sentido },
          { pagina, por_pagina },
        );
      },
    );

    app.get(
      '/plataforma/cuentas/:cuenta_id/consumo-de-bolsa',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'El consumo de la bolsa de una cuenta con los QR generados por día del mes en curso. 404 ' +
            '`cuenta.no_encontrada` si no existe.',
          params: parametrosDeCuentaDeSenales,
          response: { 200: respuestaDeConsumoDeCuenta },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('limites.consumo.ver'),
      },
      (request) => verConsumoDeCuenta(pool, request.params.cuenta_id),
    );

    app.get(
      '/plataforma/senales',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Las señales de abuso (incidentes que abrió el sistema) de todas las cuentas, del más reciente al más ' +
            'antiguo. `estado=abiertas` deja las que nadie resolvió. Solo ids de evidencia: nunca un token, un hash, ' +
            'un PIN ni una IP.',
          querystring: consultaDeSenales,
          response: { 200: respuestaDeSenales },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.senal.ver'),
      },
      (request) => {
        const { pagina, por_pagina, cuenta_id, usuario_id, tipo, gravedad, estado, desde, hasta } =
          request.query;
        return listarSenales(
          pool,
          {
            cuentaId: cuenta_id ?? null,
            usuarioId: usuario_id ?? null,
            tipo: tipo ?? null,
            gravedad: gravedad ?? null,
            estado: estado ?? null,
            desde: desde ?? null,
            hasta: hasta ?? null,
          },
          { pagina, por_pagina },
        );
      },
    );

    app.get(
      '/plataforma/senales/resumen',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Cuántas señales de abuso hubo en los últimos `dias` días, por tipo, y las diez cuentas con más señales.',
          querystring: consultaDeResumenDeSenales,
          response: { 200: respuestaDeResumenDeSenales },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.senal.ver'),
      },
      (request) => resumirSenales(pool, request.query.dias),
    );

    app.get(
      '/plataforma/flujo-de-cuentas',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'El flujo reciente de todas las cuentas: aperturas de hoy por usuario activo, cuántos de los últimos `dias` ' +
            'días fueron atípicos y la base habitual. Por omisión, primero las de más aperturas por usuario.',
          querystring: consultaDeFlujoDeCuentas,
          response: { 200: respuestaDeFlujoDeCuentas },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.senal.ver'),
      },
      (request) => {
        const { pagina, por_pagina, dias, solo_atipicas, buscar, orden, sentido } = request.query;
        return listarFlujoDeCuentas(
          pool,
          { dias, soloAtipicas: solo_atipicas, buscar: buscar ?? null, orden, sentido },
          { pagina, por_pagina },
        );
      },
    );

    app.get(
      '/plataforma/cuentas/:cuenta_id/flujo',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'La serie diaria de aperturas, rechazos y QR generados de una cuenta, con la marca de anomalía de cada día y ' +
            'la base habitual. 404 `cuenta.no_encontrada` si no existe.',
          params: parametrosDeCuentaDeSenales,
          querystring: consultaDeFlujoDeCuenta,
          response: { 200: respuestaDeFlujoDeCuenta },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('seguridad.senal.ver'),
      },
      (request) => verFlujoDeCuenta(pool, request.params.cuenta_id, request.query.dias),
    );

    listo();
  };
}
