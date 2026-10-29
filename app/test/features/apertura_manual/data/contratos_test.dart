import 'package:agrocom_acceso/core/api/contratos/apertura_manual_contratos.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('puerta abrible', () {
    final json = <String, dynamic>{
      'id': '7',
      'nombre': 'Portón',
      'sitio': {'id': '2', 'nombre': 'Condominio'},
      'habilitada': true,
      'disponible': true,
      'tiene_placa': true,
      'conexion': 'en_linea',
    };

    test('lee la puerta sin ningún dato de sentido', () {
      final dto = PuertaAbribleDto.desde(json);

      expect(dto.id, '7');
      expect(dto.sitio.nombre, 'Condominio');
      expect(dto.disponible, isTrue);
      expect(dto.enLinea, isTrue);
    });

    test('sin conexión no es en línea', () {
      final dto = PuertaAbribleDto.desde({...json, 'conexion': 'sin_conexion'});

      expect(dto.enLinea, isFalse);
    });
  });

  group('estado de la orden', () {
    test('trae el resultado de la placa cuando ya informó', () {
      final dto = EstadoDeOrdenDto.desde({
        'orden_id': '3',
        'estado': 'ejecutada',
        'resultado': {'resultado': 'ejecutada', 'causa': 'puerta_abrio'},
      });

      expect(dto.estado, 'ejecutada');
      expect(dto.resultado, 'ejecutada');
      expect(dto.causa, 'puerta_abrio');
    });

    test('sin resultado mientras la placa no informó', () {
      final dto = EstadoDeOrdenDto.desde({
        'orden_id': '3',
        'estado': 'pendiente',
        'resultado': null,
      });

      expect(dto.resultado, isNull);
      expect(dto.causa, isNull);
    });

    test('un estado desconocido se trata como pendiente', () {
      expect(EstadoOrden.desde('inventado'), EstadoOrden.pendiente);
      expect(EstadoOrden.desde('vencida').terminada, isTrue);
      expect(EstadoOrden.desde('entregada').terminada, isFalse);
    });
  });
}
