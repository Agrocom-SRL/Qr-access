import 'dart:async';
import 'dart:math';

import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/apertura_manual/data/apertura_manual_repositorio.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Cada cuánto se pregunta cómo va la orden mientras la placa la toma.
final intervaloDeConsultaDeOrdenProvider = Provider<Duration>(
  (ref) => const Duraciones().consultaOrdenApertura,
);

/// Cuánto dura la animación como máximo. Si la placa no toma la orden en ese
/// tiempo, la puerta se da por no contactada; lo que tarde la API después no
/// alarga la espera.
final maxEsperaDeOrdenProvider = Provider<Duration>(
  (ref) => const Duraciones().esperaMaximaOrdenApertura,
);

/// Lo que la pantalla muestra de una apertura.
///
/// - `enviada`: la placa tomó la orden y el pulso se está enviando. No es
///   "abierta": no sabemos si la puerta se movió.
/// - `abierta`: la placa informó que ejecutó la orden.
enum FaseDeApertura { libre, enviando, esperando, enviada, abierta, fallo }

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
/// va hasta que la placa la toma o informa. La app no decide nada: si la API
/// rechaza o la orden no se toma a tiempo, la puerta no se abrió y así se dice.
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

  /// Espera a lo sumo `maxEsperaDeOrden` a que la orden llegue a un estado
  /// que la pantalla pueda mostrar. El tope corre en paralelo con las
  /// consultas: aunque una consulta se cuelgue, la animación termina a tiempo.
  Future<void> _esperarDesenlace(OrdenDeApertura orden, String nombre) async {
    final intervalo = ref.read(intervaloDeConsultaDeOrdenProvider);
    final maximo = ref.read(maxEsperaDeOrdenProvider);
    final limite = Completer<AperturaEstado>();
    final temporizador = Timer(maximo, () {
      if (!limite.isCompleted) limite.complete(_noContactada(nombre));
    });
    var sigueConsultando = true;
    final resultado = await Future.any<AperturaEstado?>([
      _consultarHastaVer(
        orden.id,
        nombre,
        intervalo: intervalo,
        seguir: () => sigueConsultando && ref.mounted,
      ),
      limite.future,
    ]);
    sigueConsultando = false;
    temporizador.cancel();
    if (!ref.mounted || resultado == null) return;
    state = resultado;
  }

  /// Consulta la orden cada [intervalo] hasta que hay algo que mostrar. Devuelve
  /// `null` si [seguir] deja de valer (el tope ya respondió o la pantalla se
  /// cerró).
  Future<AperturaEstado?> _consultarHastaVer(
    String ordenId,
    String nombre, {
    required Duration intervalo,
    required bool Function() seguir,
  }) async {
    final repositorio = ref.read(aperturaManualRepositorioProvider);
    while (true) {
      await Future<void>.delayed(intervalo);
      if (!seguir()) return null;
      try {
        final consulta = await repositorio.estado(ordenId);
        final visto = _estadoVisto(consulta.estado, consulta.desenlace, nombre);
        if (visto != null) return visto;
      } on Object {
        // Una consulta que falla (red intermitente) no cambia el desenlace de
        // la orden: se vuelve a preguntar hasta el tiempo máximo.
      }
    }
  }

  /// Vuelve a la lista de puertas tras ver el desenlace.
  void reiniciar() {
    if (!state.enCurso) state = const AperturaEstado();
  }
}

/// Lo que la pantalla muestra con el estado de la orden, o `null` si todavía
/// no hay nada que decir (la orden sigue `pendiente`).
AperturaEstado? _estadoVisto(
  EstadoOrden estado,
  DesenlaceDeApertura? desenlace,
  String nombre,
) {
  if (desenlace == DesenlaceDeApertura.abierta) {
    return AperturaEstado(fase: FaseDeApertura.abierta, puertaNombre: nombre);
  }
  if (desenlace != null) {
    return AperturaEstado(
      fase: FaseDeApertura.fallo,
      puertaNombre: nombre,
      desenlace: desenlace,
    );
  }
  if (estado == EstadoOrden.entregada) {
    return AperturaEstado(fase: FaseDeApertura.enviada, puertaNombre: nombre);
  }
  return null;
}

/// La placa no tomó la orden a tiempo: no sabemos si la puerta se movió, así
/// que se dice que no se contactó y que se puede intentar de nuevo.
AperturaEstado _noContactada(String nombre) => AperturaEstado(
  fase: FaseDeApertura.fallo,
  puertaNombre: nombre,
  desenlace: DesenlaceDeApertura.vencida,
);

final NotifierProvider<AbrirPuertaControlador, AperturaEstado>
abrirPuertaProvider =
    NotifierProvider.autoDispose<AbrirPuertaControlador, AperturaEstado>(
      AbrirPuertaControlador.new,
    );
