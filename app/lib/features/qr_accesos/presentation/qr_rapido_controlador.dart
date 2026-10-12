import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Máximo de puertas por QR que acepta la API (`MAX_PUERTAS_POR_QR`).
const maxPuertasPorQr = 20;

/// La cuenta no le dio ninguna puerta a esta persona: no hay QR que emitir.
class SinPuertasParaQrRapido implements Exception {
  const new();
}

/// QR rápido: emite al instante un QR para la propia persona, sin formulario.
/// Es un QR normal (un solo uso, con vencimiento; invariante 3): abre las
/// puertas de la cuenta que la persona puede ver y vale la vigencia por
/// defecto (2 h). No se comparte: se muestra en este mismo dispositivo para
/// acercarlo al lector.
///
/// El token solo vive en este estado y se descarta al salir (ADR 0008).
class QrRapidoControlador extends Notifier<AsyncValue<QrEmitido>> {
  @override
  AsyncValue<QrEmitido> build() => const AsyncLoading();

  /// Emite un QR con la [etiqueta] ya traducida por la pantalla ("Entrada
  /// para Ana"). Se llama de nuevo para sacar otro QR (otro token).
  Future<void> emitir(String etiqueta) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _emitirOUsarRespaldo(etiqueta));
  }

  /// Con internet siempre se emite uno nuevo. Solo si no hay conexión se
  /// reutiliza el último QR propio guardado: en el servidor sigue siendo el
  /// único vigente de la persona, así que el lector lo valida igual.
  Future<QrEmitido> _emitirOUsarRespaldo(String etiqueta) async {
    try {
      return await _emitir(etiqueta);
    } on ErrorApi catch (error) {
      if (!error.esSinConexion) rethrow;
      final respaldo = await ref
          .read(qrAccesosRepositorioProvider)
          .ultimoPropioGuardado();
      if (respaldo == null) rethrow;
      return respaldo;
    }
  }

  Future<QrEmitido> _emitir(String etiqueta) async {
    final ahora = ref.read(relojProvider)();
    final puertas = await ref.read(puertasDisponiblesProvider.future);
    if (puertas.isEmpty) throw const SinPuertasParaQrRapido();
    final datos = DatosEmision(
      puertaIds: puertas.take(maxPuertasPorQr).map((p) => p.id).toSet(),
      vigencia: Vigencia.porDefecto,
      etiqueta: recortarEtiqueta(etiqueta),
      ahora: ahora,
      // La API anula el QR propio anterior: solo el último sirve, aunque a
      // alguien le hayan sacado una foto del anterior.
      propio: true,
    );
    return await ref
        .read(qrAccesosRepositorioProvider)
        .emitir(datos, ahora: ahora);
  }
}

/// La etiqueta cortada al largo máximo que acepta la app.
String recortarEtiqueta(String etiqueta) {
  final limpia = etiqueta.trim();
  return limpia.length <= DatosEmision.largoMaximoEtiqueta
      ? limpia
      : limpia.substring(0, DatosEmision.largoMaximoEtiqueta);
}

/// Se descarta al salir: el QR rápido no se puede volver a ver.
final NotifierProvider<QrRapidoControlador, AsyncValue<QrEmitido>>
qrRapidoControladorProvider =
    NotifierProvider.autoDispose<QrRapidoControlador, AsyncValue<QrEmitido>>(
      QrRapidoControlador.new,
    );
