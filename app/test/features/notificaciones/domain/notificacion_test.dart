import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:flutter_test/flutter_test.dart';

Notificacion _aviso({required bool leida}) => Notificacion(
  id: '1',
  tipo: TipoNotificacion.placaCaidaSostenida,
  severidad: Severidad.critica,
  cantidad: 1,
  leida: leida,
  puertas: const ['Portón'],
  sitio: null,
  usuario: null,
  novedadAt: DateTime.utc(2026, 10, 27, 12),
);

void main() {
  group('TipoNotificacion.desdeApi', () {
    test('nombra cada tipo de aviso que la app conoce', () {
      expect(
        TipoNotificacion.desdeApi('placa.caida_sostenida'),
        TipoNotificacion.placaCaidaSostenida,
      );
      expect(
        TipoNotificacion.desdeApi('placa.lector_sin_respuesta'),
        TipoNotificacion.placaLectorSinRespuesta,
      );
      expect(
        TipoNotificacion.desdeApi('apertura.fallida'),
        TipoNotificacion.aperturaFallida,
      );
      expect(
        TipoNotificacion.desdeApi('flujo.atipico'),
        TipoNotificacion.flujoAtipico,
      );
    });

    test('una señal de uso se distingue por su subtipo', () {
      expect(
        TipoNotificacion.desdeApi('senal.uso', subtipo: 'uso_masivo'),
        TipoNotificacion.senalUsoMasivo,
      );
      expect(
        TipoNotificacion.desdeApi('senal.uso', subtipo: 'pin_compartido'),
        TipoNotificacion.senalPinCompartido,
      );
      expect(
        TipoNotificacion.desdeApi('senal.uso', subtipo: 'otro_subtipo'),
        TipoNotificacion.desconocido,
      );
    });

    test('un tipo que la app no conoce cae en desconocido, sin fallar', () {
      expect(
        TipoNotificacion.desdeApi('tipo.nuevo_del_servidor'),
        TipoNotificacion.desconocido,
      );
    });
  });

  group('Severidad.desdeApi', () {
    test('lee las tres severidades', () {
      expect(Severidad.desdeApi('info'), Severidad.info);
      expect(Severidad.desdeApi('aviso'), Severidad.aviso);
      expect(Severidad.desdeApi('critica'), Severidad.critica);
    });

    test('lo que no conoce no sube la urgencia: queda en informativa', () {
      expect(Severidad.desdeApi('alarma'), Severidad.info);
    });
  });

  test('solo se puede marcar leída la que no lo está', () {
    expect(_aviso(leida: false).puedeMarcarLeida, isTrue);
    expect(_aviso(leida: true).puedeMarcarLeida, isFalse);
  });
}
