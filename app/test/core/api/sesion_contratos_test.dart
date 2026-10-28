import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:flutter_test/flutter_test.dart';

/// En web la API no manda `refresco` en el cuerpo (va en la cookie HttpOnly,
/// ADR 0033 §5). El contrato lo trata como opcional: móvil lo sigue recibiendo.
void main() {
  const usuario = {'id': 'u1', 'etiqueta': 'Ana'};
  const cuenta = {'id': 'c1', 'codigo': 'AGR', 'nombre': 'Demo'};

  group('RespuestaInicioDto', () {
    test('sin refresco en el cuerpo (web) se lee con refresco nulo', () {
      final dto = RespuestaInicioDto.desde({
        'acceso': 'acc-1',
        'usuario': usuario,
        'cuenta': cuenta,
        'rol_activo_id': 'r1',
      });

      expect(dto.acceso, 'acc-1');
      expect(dto.refresco, isNull);
    });

    test('con refresco en el cuerpo (móvil) lo lee', () {
      final dto = RespuestaInicioDto.desde({
        'acceso': 'acc-1',
        'refresco': 'ref-1',
        'usuario': usuario,
        'cuenta': cuenta,
        'rol_activo_id': 'r1',
      });

      expect(dto.refresco, 'ref-1');
    });
  });

  group('TokensDto', () {
    test('la renovación en web trae solo el acceso', () {
      final dto = TokensDto.desde({'acceso': 'acc-2'});

      expect(dto.acceso, 'acc-2');
      expect(dto.refresco, isNull);
    });

    test('la renovación en móvil trae también el refresco rotado', () {
      final dto = TokensDto.desde({'acceso': 'acc-2', 'refresco': 'ref-2'});

      expect(dto.refresco, 'ref-2');
    });
  });
}
