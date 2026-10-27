import 'package:agrocom_acceso/core/sincronizacion/estado_sincronizacion.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final ultima = DateTime.utc(2026, 10, 27, 14);

  test('dos estados con los mismos datos son iguales', () {
    final a = EstadoSincronizacion(
      ultimaActualizacion: ultima,
      sinConexion: true,
    );
    final b = EstadoSincronizacion(
      ultimaActualizacion: ultima,
      sinConexion: true,
    );

    expect(a, b);
    expect(a.hashCode, b.hashCode);
  });

  test('copiar cambia solo lo que se pasa y deja lo demás como estaba', () {
    const inicial = EstadoSincronizacion();

    final pidiendo = inicial.copiar(actualizando: true);
    final respondio = pidiendo.copiar(
      ultimaActualizacion: ultima,
      actualizando: false,
    );

    expect(pidiendo.actualizando, isTrue);
    expect(pidiendo.ultimaActualizacion, isNull);
    expect(respondio.ultimaActualizacion, ultima);
    expect(respondio.actualizando, isFalse);
    expect(respondio.sinConexion, isFalse);
  });
}
