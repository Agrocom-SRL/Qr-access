import 'package:flutter/foundation.dart';

/// Desde qué punto del cupo se avisa (ADR 0028 §6). La API calcula el aviso; la
/// app solo lo muestra.
enum AvisoCupo { cercaDelLimite, limiteAlcanzado }

/// Cuánto del cupo de usuarios del plan usa la cuenta. Cuentan todos los
/// niveles y lo ve el Administrador (ADR 0028 §6).
@immutable
class Cupo {
  const new({
    required this.usados,
    required this.maximo,
    required this.porcentaje,
    required this.aviso,
    required this.maxMiembrosPorTitular,
  });

  final int usados;

  /// `null` = el plan no limita usuarios.
  final int? maximo;
  final int? porcentaje;
  final AvisoCupo? aviso;
  final int maxMiembrosPorTitular;
}
