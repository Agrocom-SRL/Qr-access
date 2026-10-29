import 'package:flutter/foundation.dart';

/// Puerta que se puede abrir desde la app sin QR (ADR 0035). No distingue
/// entrada de salida: sin geovalla nadie sabe hacia dónde va la persona.
@immutable
class PuertaAbrible {
  const new({
    required this.id,
    required this.nombre,
    required this.sitioNombre,
    required this.habilitada,
    required this.disponible,
    required this.tienePlaca,
    required this.enLinea,
  });

  final String id;
  final String nombre;
  final String sitioNombre;

  /// El administrador encendió la apertura manual en esta puerta.
  final bool habilitada;

  /// Encendida y con al menos una placa en servicio: es lo que muestra el
  /// botón "Abrir puerta".
  final bool disponible;

  /// Sin placa no hay nada que encender: la pantalla del administrador muestra
  /// "Sin placa" en vez del interruptor.
  final bool tienePlaca;

  /// Alguna placa reportó hace poco. Solo avisa; la autoridad es la API.
  final bool enLinea;
}

/// En qué va una orden de apertura (ADR 0035 §3).
enum EstadoOrden {
  pendiente,
  entregada,
  ejecutada,
  fallida,
  vencida;

  /// Desconocido se trata como pendiente: la consulta sigue hasta el tiempo
  /// máximo y, si la API nunca la resuelve, se da por no abierta.
  static EstadoOrden desde(String valor) => values.firstWhere(
    (estado) => estado.name == valor,
    orElse: () => pendiente,
  );

  bool get terminada => this == ejecutada || this == fallida || this == vencida;
}

/// Una orden de abrir creada por la API y lo que se sabe de ella.
@immutable
class OrdenDeApertura {
  const new({required this.id, required this.estado, required this.venceAt});

  final String id;
  final EstadoOrden estado;
  final DateTime venceAt;
}

/// Cómo terminó una orden: la puerta se abrió, o no.
enum DesenlaceDeApertura { abierta, noAbrio, vencida }
