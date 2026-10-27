import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/incidentes_falsos.dart';

void main() {
  group('valores de la API', () {
    test('cada tipo se lee de su valor de la API', () {
      expect(
        TipoDeIncidente.desdeApi('perdida_o_robo'),
        TipoDeIncidente.perdidaORobo,
      );
      expect(TipoDeIncidente.desdeApi('uso_masivo'), TipoDeIncidente.usoMasivo);
    });

    test('un tipo que la app no conoce cae en otro, sin fallar', () {
      expect(TipoDeIncidente.desdeApi('algo_nuevo'), TipoDeIncidente.otro);
    });

    test('un resultado desconocido queda pendiente, nunca confirmado', () {
      expect(
        ResultadoDeResolucion.desdeApi('raro'),
        ResultadoDeResolucion.pendiente,
      );
    });

    test('el estado sin_resolver se reconoce y un estado raro cae en él', () {
      expect(
        EstadoDeIncidente.desdeApi('sin_resolver'),
        EstadoDeIncidente.sinResolver,
      );
      expect(
        EstadoDeIncidente.desdeApi('vencido'),
        EstadoDeIncidente.sinResolver,
      );
    });

    test('la acción propuesta solo sale si la API manda una conocida', () {
      expect(
        AccionPropuesta.desdeApi('suspender_y_anular'),
        AccionPropuesta.suspenderYAnular,
      );
      expect(AccionPropuesta.desdeApi(null), isNull);
      expect(AccionPropuesta.desdeApi('borrar'), isNull);
    });
  });

  group('resolver', () {
    test('solo confirmar exige motivo', () {
      expect(exigeMotivo(ResultadoDeResolucion.confirmado), isTrue);
      expect(exigeMotivo(ResultadoDeResolucion.descartado), isFalse);
      expect(exigeMotivo(ResultadoDeResolucion.pendiente), isFalse);
    });

    test(
      'confirmar con el motivo vacío o de solo espacios no se puede guardar',
      () {
        expect(
          puedeGuardarResolucion(
            resultado: ResultadoDeResolucion.confirmado,
            motivo: '   ',
          ),
          isFalse,
        );
      },
    );

    test('descartar o dejar pendiente se pueden guardar sin motivo', () {
      expect(
        puedeGuardarResolucion(
          resultado: ResultadoDeResolucion.descartado,
          motivo: '',
        ),
        isTrue,
      );
      expect(
        puedeGuardarResolucion(
          resultado: ResultadoDeResolucion.pendiente,
          motivo: '',
        ),
        isTrue,
      );
    });

    test('el motivo se manda sin espacios y vacío no se manda', () {
      expect(motivoAEnviar('  Visto con el guardia  '), 'Visto con el guardia');
      expect(motivoAEnviar('   '), isNull);
    });
  });

  test('un incidente es de quien mira si su usuario es quien pregunta', () {
    final incidente = incidenteDePrueba(usuarioId: 'u1');

    expect(incidente.esDeUsuario('u1'), isTrue);
    expect(incidente.esDeUsuario('u2'), isFalse);
  });

  test('una evidencia sin ids no tiene nada que contar', () {
    const vacia = EvidenciaDeIncidente(
      cuantosQr: 0,
      cuantosAccesos: 0,
      cuantosLimites: 0,
    );
    expect(vacia.vacia, isTrue);
    expect(incidenteDePrueba().evidencia.vacia, isFalse);
  });
}
