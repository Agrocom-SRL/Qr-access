import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Máximo de puertas por QR que acepta la API (`MAX_PUERTAS_POR_QR`).
const maxPuertasPorQr = 20;

/// La cuenta no le dio ninguna puerta a esta persona: no hay QR que generar.
class SinPuertasParaQrRapido implements Exception {
  const new();
}

/// QR rápido: genera al instante un QR para la propia persona, sin formulario.
/// Es un QR normal (un solo uso, con vencimiento; invariante 3): abre las
/// puertas de la cuenta que la persona puede ver y vale la vigencia por
/// defecto (2 h). No se comparte: se muestra en este mismo dispositivo para
/// acercarlo al lector.
///
/// El token solo vive en este estado y se descarta al salir (ADR 0008).
class QrRapidoControlador extends Notifier<AsyncValue<QrGenerado>> {
  @override
  AsyncValue<QrGenerado> build() => const AsyncLoading();

  /// Genera un QR con la [etiqueta] ya traducida por la pantalla ("Entrada
  /// para Ana"). Se llama de nuevo para sacar otro QR (otro token).
  Future<void> generar(String etiqueta) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _generarOUsarRespaldo(etiqueta));
  }

  /// Al reabrir, si el QR propio guardado sigue vigente y sin usar, se muestra
  /// su token sin generar nada (ADR 0030 §2.1). Si no, se genera uno. Sin red,
  /// se muestra el último QR guardado: en el servidor sigue siendo el único
  /// vigente de la persona, así que el lector lo valida igual.
  Future<QrGenerado> _generarOUsarRespaldo(String etiqueta) async {
    try {
      final ahora = ref.read(relojProvider)();
      final puertas = await ref.read(puertasDisponiblesProvider.future);
      if (puertas.isEmpty) throw const SinPuertasParaQrRapido();
      final datos = DatosGeneracion(
        puertaIds: puertas.take(maxPuertasPorQr).map((p) => p.id).toSet(),
        vigencia: Vigencia.porDefecto,
        etiqueta: recortarEtiqueta(etiqueta),
        ahora: ahora,
        // La API anula el QR propio anterior: solo el último sirve, aunque a
        // alguien le hayan sacado una foto del anterior.
        propio: true,
      );
      final repositorio = ref.read(qrAccesosRepositorioProvider);
      final reanudado = await repositorio.reanudarPropio(datos.puertaIds);
      if (reanudado != null) return reanudado;
      return await repositorio.generar(datos, ahora: ahora);
    } on ErrorApi catch (error) {
      if (!error.esSinConexion) rethrow;
      final respaldo = await ref
          .read(qrAccesosRepositorioProvider)
          .ultimoPropioGuardado();
      if (respaldo == null) rethrow;
      return respaldo;
    }
  }
}

/// La etiqueta cortada al largo máximo que acepta la app.
String recortarEtiqueta(String etiqueta) {
  final limpia = etiqueta.trim();
  return limpia.length <= DatosGeneracion.largoMaximoEtiqueta
      ? limpia
      : limpia.substring(0, DatosGeneracion.largoMaximoEtiqueta);
}

/// Se descarta al salir: el QR rápido no se puede volver a ver.
final NotifierProvider<QrRapidoControlador, AsyncValue<QrGenerado>>
qrRapidoControladorProvider =
    NotifierProvider.autoDispose<QrRapidoControlador, AsyncValue<QrGenerado>>(
      QrRapidoControlador.new,
    );
