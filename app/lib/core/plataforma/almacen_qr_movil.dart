import 'dart:convert';

import 'package:agrocom_acceso/core/plataforma/almacen_qr_contrato.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Implementación móvil: los textos de QR van al almacén seguro del sistema
/// (Keystore en Android, Keychain en iOS), en un solo valor JSON por id.
/// Cada lectura y cada escritura descartan lo vencido.
class AlmacenQrMovil implements AlmacenQr {
  new([FlutterSecureStorage? almacen])
    : _almacen = almacen ?? const FlutterSecureStorage();

  static const _clave = 'qr.generados';
  static const _clavePropio = 'qr.ultimo_propio';

  final FlutterSecureStorage _almacen;

  Future<Map<String, Map<String, String>>> _leerTodo() async {
    final crudo = await _almacen.read(key: _clave);
    if (crudo == null) return {};
    try {
      final mapa = jsonDecode(crudo) as Map<String, dynamic>;
      final ahora = DateTime.now();
      return {
        for (final e in mapa.entries)
          if (DateTime.parse(
            (e.value as Map<String, dynamic>)['vence'] as String,
          ).isAfter(ahora))
            e.key: Map<String, String>.from(e.value as Map<String, dynamic>),
      };
    } on Object {
      // Un valor dañado no debe romper "Mis QR": se empieza de cero.
      return {};
    }
  }

  Future<void> _escribir(Map<String, Map<String, String>> todo) =>
      _almacen.write(key: _clave, value: jsonEncode(todo));

  @override
  Future<String?> leer(String id) async => (await _leerTodo())[id]?['texto'];

  @override
  Future<void> guardar(String id, String texto, DateTime venceAt) async {
    final todo = await _leerTodo();
    todo[id] = {'texto': texto, 'vence': venceAt.toUtc().toIso8601String()};
    await _escribir(todo);
  }

  @override
  Future<void> borrar(String id) async {
    final todo = await _leerTodo();
    if (todo.remove(id) != null) await _escribir(todo);
  }

  @override
  Future<QrPropioGuardado?> leerUltimoPropio() async {
    final crudo = await _almacen.read(key: _clavePropio);
    if (crudo == null) return null;
    try {
      final m = jsonDecode(crudo) as Map<String, dynamic>;
      final venceAt = DateTime.parse(m['vence'] as String);
      if (!venceAt.isAfter(DateTime.now())) {
        await _almacen.delete(key: _clavePropio);
        return null;
      }
      return QrPropioGuardado(
        id: m['id'] as String,
        texto: m['texto'] as String,
        venceAt: venceAt,
        etiqueta: m['etiqueta'] as String?,
        puertas: [
          for (final p in m['puertas'] as List<dynamic>)
            (
              id: (p as Map<String, dynamic>)['id'] as String,
              nombre: p['nombre'] as String,
            ),
        ],
      );
    } on Object {
      // Un respaldo dañado no debe romper el QR propio: se descarta.
      return null;
    }
  }

  @override
  Future<void> guardarUltimoPropio(QrPropioGuardado qr) => _almacen.write(
    key: _clavePropio,
    value: jsonEncode({
      'id': qr.id,
      'texto': qr.texto,
      'vence': qr.venceAt.toUtc().toIso8601String(),
      'etiqueta': qr.etiqueta,
      'puertas': [
        for (final p in qr.puertas) {'id': p.id, 'nombre': p.nombre},
      ],
    }),
  );

  @override
  Future<void> borrarUltimoPropio(String id) async {
    final actual = await leerUltimoPropio();
    if (actual?.id == id) await _almacen.delete(key: _clavePropio);
  }
}

/// Fábrica que elige `almacen_qr.dart` por importación condicional.
AlmacenQr crearAlmacenQr() => AlmacenQrMovil();
