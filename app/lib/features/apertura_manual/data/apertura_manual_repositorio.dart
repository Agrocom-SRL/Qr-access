import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/apertura_manual_contratos.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Acceso a la apertura manual (ADR 0035). Los tests lo sustituyen por un fake
/// con el mismo shape que la API.
abstract interface class AperturaManualRepositorio {
  /// Las puertas que la API deja ver a esta persona: todas las de la cuenta
  /// al administrador, solo las disponibles a los demás.
  Future<List<PuertaAbrible>> puertas();

  /// Pide abrir [puertaId]. Un reintento con la misma [claveIdempotencia]
  /// devuelve la misma orden.
  Future<OrdenDeApertura> abrir(
    String puertaId, {
    required String claveIdempotencia,
  });

  /// Cómo va la orden [ordenId] y, si ya terminó, cómo terminó.
  Future<({EstadoOrden estado, DesenlaceDeApertura? desenlace})> estado(
    String ordenId,
  );

  Future<void> configurarPuerta(String puertaId, {required bool habilitada});

  /// Todas las puertas de la cuenta y las que se registren después.
  Future<void> configurarCuenta({required bool habilitada});
}

class AperturaManualRepositorioApi implements AperturaManualRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<List<PuertaAbrible>> puertas() async {
    final dtos = await _api.puertasDeAperturaManual();
    return [for (final dto in dtos) _aPuerta(dto)];
  }

  @override
  Future<OrdenDeApertura> abrir(
    String puertaId, {
    required String claveIdempotencia,
  }) async {
    final dto = await _api.abrirPuerta(
      puertaId,
      idempotencyKey: claveIdempotencia,
    );
    return OrdenDeApertura(
      id: dto.ordenId,
      estado: EstadoOrden.desde(dto.estado),
      venceAt: dto.venceAt,
    );
  }

  @override
  Future<({EstadoOrden estado, DesenlaceDeApertura? desenlace})> estado(
    String ordenId,
  ) async {
    final dto = await _api.estadoDeOrden(ordenId);
    final estado = EstadoOrden.desde(dto.estado);
    return (estado: estado, desenlace: desenlaceDeOrden(estado, dto.causa));
  }

  @override
  Future<void> configurarPuerta(String puertaId, {required bool habilitada}) =>
      _api.configurarAperturaManualDePuerta(puertaId, habilitada: habilitada);

  @override
  Future<void> configurarCuenta({required bool habilitada}) =>
      _api.configurarAperturaManualDeLaCuenta(habilitada: habilitada);
}

PuertaAbrible _aPuerta(PuertaAbribleDto dto) => PuertaAbrible(
  id: dto.id,
  nombre: dto.nombre,
  sitioNombre: dto.sitio.nombre,
  habilitada: dto.habilitada,
  disponible: dto.disponible,
  tienePlaca: dto.tienePlaca,
  enLinea: dto.enLinea,
);

/// `ejecutada` con `sin_confirmacion` (la puerta no tiene sensor) cuenta como
/// abierta: el relé se accionó y no hay nada que contradiga. Una `fallida` con
/// causa `ocupada` es que la placa descartó la orden porque el relé estaba en
/// uso; con causa `vencida`, que se le acabó el plazo (se muestra como una
/// orden vencida). Solo el resto de las fallas informadas por la placa son
/// "no abrió". [causa] viene de `resultado.causa` de la API (puede ser `null`).
@visibleForTesting
DesenlaceDeApertura? desenlaceDeOrden(EstadoOrden estado, String? causa) =>
    switch (estado) {
      EstadoOrden.ejecutada => DesenlaceDeApertura.abierta,
      EstadoOrden.fallida => switch (causa) {
        'ocupada' => DesenlaceDeApertura.ocupada,
        'vencida' => DesenlaceDeApertura.vencida,
        _ => DesenlaceDeApertura.noAbrio,
      },
      EstadoOrden.vencida => DesenlaceDeApertura.vencida,
      EstadoOrden.pendiente || EstadoOrden.entregada => null,
    };

final aperturaManualRepositorioProvider = Provider<AperturaManualRepositorio>(
  (ref) => AperturaManualRepositorioApi(ref.watch(clienteApiProvider)),
);
