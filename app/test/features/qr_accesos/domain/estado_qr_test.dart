import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter_test/flutter_test.dart';

QrAcceso _qr(EstadoQr estado) => QrAcceso(
  id: 'qr1',
  etiqueta: null,
  estado: estado,
  venceAt: DateTime.utc(2026, 10, 9, 23, 59),
  usadoAt: null,
  anuladoAt: null,
  creadoAt: DateTime.utc(2026, 10, 9, 12),
  puertas: const [PuertaDeQr(id: 'p1', nombre: 'Portón')],
);

void main() {
  group('EstadoQr.desdeApi', () {
    test('lee cada estado del contrato', () {
      for (final estado in EstadoQr.values) {
        expect(EstadoQr.desdeApi(estado.valorApi), estado);
      }
    });

    test('un estado desconocido es un error de contrato, no se oculta', () {
      expect(() => EstadoQr.desdeApi('archivado'), throwsFormatException);
    });
  });

  group('QrAcceso.puedeAnularse', () {
    test('solo un QR vigente se puede anular', () {
      expect(_qr(EstadoQr.vigente).puedeAnularse, isTrue);
    });

    for (final estado in [EstadoQr.usado, EstadoQr.vencido, EstadoQr.anulado]) {
      test('un QR $estado ya no se puede anular', () {
        expect(_qr(estado).puedeAnularse, isFalse);
      });
    }
  });
}
