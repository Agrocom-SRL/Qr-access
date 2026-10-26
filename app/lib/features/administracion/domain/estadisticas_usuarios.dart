import 'package:flutter/foundation.dart';

/// Uso que un usuario hizo de sus QR en la ventana (ADR 0028 §4). Informativo.
@immutable
class UsoDeUsuario {
  const new({
    required this.id,
    required this.etiqueta,
    required this.rol,
    required this.unidad,
    required this.qrGenerados,
    required this.qrUsados,
    required this.maxQrEnUnDia,
    required this.ultimoQrAt,
    required this.inactivo,
    required this.ruidoso,
  });

  final String id;
  final String? etiqueta;
  final String? rol;

  /// La unidad, si es un Titular.
  final String? unidad;
  final int qrGenerados;
  final int qrUsados;
  final int maxQrEnUnDia;

  /// El último QR que generó, de cualquier fecha; `null` si nunca generó uno.
  final DateTime? ultimoQrAt;
  final bool inactivo;
  final bool ruidoso;
}

/// Un Titular con cuántos Miembros tiene y cuánto de su tope usa.
@immutable
class TitularConMiembros {
  const new({
    required this.id,
    required this.etiqueta,
    required this.unidad,
    required this.miembros,
    required this.tope,
    required this.porcentaje,
    required this.cercaDelTope,
  });

  final String id;
  final String? etiqueta;
  final String? unidad;
  final int miembros;
  final int tope;
  final int porcentaje;
  final bool cercaDelTope;
}

/// El uso de los usuarios de la rama de quien pregunta (ADR 0028 §4). Los
/// umbrales los fija la API (30 días sin QR; más de 10 QR en un día): la app
/// solo los muestra y nunca calcula nada.
@immutable
class EstadisticasDeUsuarios {
  const new({
    required this.ventanaDias,
    required this.umbralInactivoDias,
    required this.umbralRuidosoPorDia,
    required this.usuarios,
    required this.titulares,
  });

  final int ventanaDias;
  final int umbralInactivoDias;
  final int umbralRuidosoPorDia;
  final List<UsoDeUsuario> usuarios;
  final List<TitularConMiembros> titulares;

  /// Los que no generaron ningún QR en la ventana: candidatos a baja.
  List<UsoDeUsuario> get inactivos => [
    for (final u in usuarios)
      if (u.inactivo) u,
  ];

  /// Los que generan QR a cada rato: candidatos a revisión.
  List<UsoDeUsuario> get ruidosos => [
    for (final u in usuarios)
      if (u.ruidoso) u,
  ];

  /// Los Titulares que ya usan casi todo su tope de Miembros.
  List<TitularConMiembros> get titularesCercaDelTope => [
    for (final t in titulares)
      if (t.cercaDelTope) t,
  ];
}
