import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { permisoDePlataforma, plataformaDe } from '../../plugins/permisos.js';
import { ejecutar as anularMasivoDeCuenta } from './actions/anular-masivo-de-cuenta.js';
import { ejecutar as exportarDatosDeCuenta } from './actions/exportar-datos-de-cuenta.js';
import {
  consultaDeExportacion,
  cuerpoDeAnulacionMasivaDePlataforma,
  parametrosDeCuentaDePlataforma,
  parametrosDeExportacionDeCuenta,
  respuestaDeAnulacionMasiva,
} from './schemas.js';

const ETIQUETA = ['plataforma'];

/**
 * Rutas de AGROCOM sobre los accesos de UNA cuenta (ADR 0033 §3, ola W11): anulación masiva de QR y exportación de
 * datos. Mismas acciones y topes que las de la cuenta; solo cambia quién llama (un super admin con permiso de
 * plataforma, nunca un rol de cuenta: invariante 10) y el alcance (toda la cuenta del path).
 */
export function rutasDePlataforma({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.post(
      '/plataforma/cuentas/:cuenta_id/qr-accesos/anulacion-masiva',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Anula en bloque los QR VIGENTES de una cuenta (`alcance: cuenta`), de un usuario suyo (`usuario`) o de una ' +
            'rama (`rama`; ambos exigen `usuario_id`). Por lotes y con constancia de su motivo; los anulados no ' +
            'reviven. 404 `cuenta.no_encontrada` si la cuenta no existe, 404 `usuario.no_encontrado` si el usuario no ' +
            'es de esa cuenta.',
          params: parametrosDeCuentaDePlataforma,
          body: cuerpoDeAnulacionMasivaDePlataforma,
          response: { 200: respuestaDeAnulacionMasiva },
        },
        config: { acceso: 'plataforma' },
        preHandler: permisoDePlataforma('accesos.qr.anular_masivo_cuenta'),
      },
      async (request) => {
        const resultado = await anularMasivoDeCuenta(
          pool,
          plataformaDe(request),
          request.params.cuenta_id,
          {
            alcance: request.body.alcance,
            usuarioId: request.body.usuario_id ?? null,
            motivo: request.body.motivo,
          },
        );
        return {
          id: resultado.id,
          alcance: resultado.alcance,
          usuario_id: resultado.usuarioId,
          usuarios_alcanzados: resultado.usuariosAlcanzados,
          qr_anulados: resultado.qrAnulados,
        };
      },
    );

    app.get(
      '/plataforma/cuentas/:cuenta_id/exportaciones/:recurso',
      {
        schema: {
          tags: ETIQUETA,
          description:
            'Una página de datos de UNA cuenta en CSV (`text/csv; charset=utf-8`): `usuarios`, `puertas` o `lecturas`, ' +
            'completos (AGROCOM no tiene árbol). Mismo contrato que `/exportaciones/{recurso}`: paginada, tope de ' +
            '10000 filas por recurso (422 `exportacion.tope_excedido`), cabeceras `X-*`, sin tokens, hashes ni PIN, ' +
            'constancia en la cuenta y límite de exportación. 404 `cuenta.no_encontrada` si no existe.',
          params: parametrosDeExportacionDeCuenta,
          querystring: consultaDeExportacion,
        },
        config: { acceso: 'plataforma', limite: 'exportacion' },
        preHandler: permisoDePlataforma('accesos.evento.exportar_cuenta'),
      },
      async (request, reply) => {
        const { pagina, por_pagina, ...consulta } = request.query;
        const { cuenta_id: cuentaId, recurso } = request.params;
        const resultado = await exportarDatosDeCuenta(
          pool,
          plataformaDe(request),
          cuentaId,
          recurso,
          { pagina, por_pagina },
          {
            resultado: consulta.resultado ?? null,
            ejecucion: consulta.ejecucion ?? null,
            puertaId: consulta.puerta_id ?? null,
            desde: consulta.desde ?? null,
            hasta: consulta.hasta ?? null,
          },
        );
        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', `attachment; filename="${recurso}-p${pagina}.csv"`)
          .header('x-total-filas', String(resultado.total))
          .header('x-pagina', String(resultado.pagina))
          .header('x-por-pagina', String(resultado.porPagina))
          .header('x-filas', String(resultado.filas))
          .header('x-hay-mas', String(resultado.hayMas))
          .header('x-truncado', String(resultado.truncado))
          .send(resultado.csv);
      },
    );

    listo();
  };
}
