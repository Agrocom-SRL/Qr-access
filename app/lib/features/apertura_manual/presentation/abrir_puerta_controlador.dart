import 'dart:math';

import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/apertura_manual/data/apertura_manual_repositorio.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Cada cuánto se pregunta cómo va la orden mientras la placa la ejecuta.
final intervaloDeConsultaDeOrdenProvider = Provider<Duration>(
  (ref) => const Duraciones().consultaOrdenApertura,
);

/// Cuánto se espera el desenlace antes de darlo por no abierto. La API vence
/// la orden a los 15 s y la placa informa unos segundos después.
final maxEsperaDeOrdenProvider = Provider<Duration>(
  (ref) => const Duraciones().esperaMaximaOrdenApertura,
);

/// Lo que la pantalla muestra de una apertura.
enum FaseDeApertura { libre, enviando, esperando, abierta, fallo }

@immutable
class AperturaEstado {
  const new({
    this.fase = FaseDeApertura.libre,
    this.puertaNombre,
    this.error,
    this.desenlace,
  });

  final FaseDeApertura fase;

  /// La puerta que se está abriendo (o se abrió); `null` si no hay ninguna.
  final String? puertaNombre;

  /// El error de la API cuando la orden ni siquiera se creó (sin conexión,
  /// puerta sin placa, límite...). `null` si la falla es de la ejecución.
  final Object? error;

  /// Cómo terminó una orden que sí se creó, cuando no se abrió.
  final DesenlaceDeApertura? desenlace;

  bool get enCurso =>
      fase == FaseDeApertura.enviando || fase == FaseDeApertura.esperando;
}

/// Abre una puerta sin QR (ADR 0035): pide la orden a la API y consulta cómo
/// va hasta que la placa informa. La app no decide nada: si la API rechaza o
/// la orden vence, la puerta no se abrió y así se dice.
class AbrirPuertaControlador extends Notifier<AperturaEstado> {
  @override
  AperturaEstado build() => const AperturaEstado();

  /// Pide abrir [puerta]. Con una apertura en curso no hace nada: un segundo
  /// toque no genera otra orden.
  Future<void> abrir(PuertaAbrible puerta) async {
    if (state.enCurso) return;
    state = AperturaEstado(
      fase: FaseDeApertura.enviando,
      puertaNombre: puerta.nombre,
    );
    final repositorio = ref.read(aperturaManualRepositorioProvider);
    final OrdenDeApertura orden;
    try {
      orden = await repositorio.abrir(
        puerta.id,
        // Una clave por toque: un reintento de la misma petición no abre dos
        // veces, y un toque nuevo es una orden nueva.
        claveIdempotencia: generarClaveIdempotencia(Random.secure()),
      );
    } on Object catch (error) {
      if (!ref.mounted) return;
      state = AperturaEstado(
        fase: FaseDeApertura.fallo,
        puertaNombre: puerta.nombre,
        error: error,
      );
      return;
    }
    if (!ref.mounted) return;
    state = AperturaEstado(
      fase: FaseDeApertura.esperando,
      puertaNombre: puerta.nombre,
    );
    await _esperarDesenlace(orden, puerta.nombre);
  }

  Future<void> _esperarDesenlace(OrdenDeApertura orden, String nombre) async {
    final intervalo = ref.read(intervaloDeConsultaDeOrdenProvider);
    final maximo = ref.read(maxEsperaDeOrdenProvider);
    final repositorio = ref.read(aperturaManualRepositorioProvider);
    var esperado = Duration.zero;
    while (esperado <= maximo) {
      await Future<void>.delayed(intervalo);
      if (!ref.mounted) return;
      esperado += intervalo;
      try {
        final consulta = await repositorio.estado(orden.id);
        if (!ref.mounted) return;
        final desenlace = consulta.desenlace;
        if (desenlace != null) {
          state = desenlace == DesenlaceDeApertura.abierta
              ? AperturaEstado(
                  fase: FaseDeApertura.abierta,
                  puertaNombre: nombre,
                )
              : AperturaEstado(
                  fase: FaseDeApertura.fallo,
                  puertaNombre: nombre,
                  desenlace: desenlace,
                );
          return;
        }
      } on Object {
        // Una consulta que falla (red intermitente) no cambia el desenlace de
        // la orden: se vuelve a preguntar hasta el tiempo máximo.
      }
    }
    if (!ref.mounted) return;
    state = AperturaEstado(
      fase: FaseDeApertura.fallo,
      puertaNombre: nombre,
      desenlace: DesenlaceDeApertura.vencida,
    );
  }

  /// Vuelve a la lista de puertas tras ver el desenlace.
  void reiniciar() {
    if (!state.enCurso) state = const AperturaEstado();
  }
}

final NotifierProvider<AbrirPuertaControlador, AperturaEstado>
abrirPuertaProvider =
    NotifierProvider.autoDispose<AbrirPuertaControlador, AperturaEstado>(
      AbrirPuertaControlador.new,
    );
