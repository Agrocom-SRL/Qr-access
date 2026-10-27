import 'package:agrocom_acceso/features/qr_accesos/domain/anulacion_masiva.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('el motivo se limpia de espacios sobrantes', () {
    expect(motivoDeAnulacion('  PIN filtrado  '), 'PIN filtrado');
  });

  test('un motivo vacío o de solo espacios no vale', () {
    expect(motivoDeAnulacion(''), isNull);
    expect(motivoDeAnulacion('   '), isNull);
  });

  test('el motivo acepta hasta 200 caracteres y no uno más', () {
    final justo = 'a' * maxMotivoDeAnulacion;
    expect(motivoDeAnulacion(justo), justo);
    expect(motivoDeAnulacion('${justo}b'), isNull);
  });
}
