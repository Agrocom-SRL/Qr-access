import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Estado del formulario de emisión. Cada cambio reemplaza el estado entero,
/// así que un error mostrado se borra al corregir el dato.
@immutable
class EmitirQrEstado {
  const new({
    this.puertaIds = const {},
    this.vigencia = OpcionVigencia.finDelDia,
    this.etiqueta = '',
    this.enviando = false,
    this.errorDatos,
    this.errorApi,
  });

  final Set<String> puertaIds;
  final OpcionVigencia vigencia;
  final String etiqueta;
  final bool enviando;

  /// Error de los datos del formulario (sin puertas, etiqueta larga).
  final ErrorDatosEmision? errorDatos;

  /// Error devuelto por la API al emitir.
  final ErrorApi? errorApi;
}

/// Controlador de la pantalla de emitir QR (HU-11). Valida, emite y devuelve
/// el QR a la pantalla, que lo muestra: el token no se guarda aquí.
class EmitirQrControlador extends Notifier<EmitirQrEstado> {
  @override
  EmitirQrEstado build() => const EmitirQrEstado();

  void alternarPuerta(String puertaId) {
    final ids = {...state.puertaIds};
    if (!ids.remove(puertaId)) ids.add(puertaId);
    state = EmitirQrEstado(
      puertaIds: ids,
      vigencia: state.vigencia,
      etiqueta: state.etiqueta,
    );
  }

  void elegirVigencia(OpcionVigencia vigencia) {
    state = EmitirQrEstado(
      puertaIds: state.puertaIds,
      vigencia: vigencia,
      etiqueta: state.etiqueta,
    );
  }

  void cambiarEtiqueta(String etiqueta) {
    state = EmitirQrEstado(
      puertaIds: state.puertaIds,
      vigencia: state.vigencia,
      etiqueta: etiqueta,
    );
  }

  /// Emite el QR. Devuelve `null` si los datos no son válidos o la API falla;
  /// en ese caso el error queda en el estado para mostrarlo.
  Future<QrEmitido?> emitir() async {
    if (state.enviando) return null;
    final errorDatos = DatosEmision.errorDe(
      puertaIds: state.puertaIds,
      etiqueta: state.etiqueta,
    );
    if (errorDatos != null) {
      state = _estado(errorDatos: errorDatos);
      return null;
    }
    final datos = DatosEmision(
      puertaIds: state.puertaIds,
      vigencia: state.vigencia,
      etiqueta: state.etiqueta,
    );
    state = _estado(enviando: true);
    try {
      final qr = await ref
          .read(qrAccesosRepositorioProvider)
          .emitir(datos, ahora: ref.read(relojProvider)());
      state = _estado();
      return qr;
    } on ErrorApi catch (error) {
      state = _estado(errorApi: error);
      return null;
    }
  }

  /// Estado con los mismos datos del formulario y el progreso o error dados.
  EmitirQrEstado _estado({
    bool enviando = false,
    ErrorDatosEmision? errorDatos,
    ErrorApi? errorApi,
  }) => EmitirQrEstado(
    puertaIds: state.puertaIds,
    vigencia: state.vigencia,
    etiqueta: state.etiqueta,
    enviando: enviando,
    errorDatos: errorDatos,
    errorApi: errorApi,
  );
}

/// Se descarta al salir: un formulario a medias no vuelve a la siguiente
/// emisión.
final NotifierProvider<EmitirQrControlador, EmitirQrEstado>
emitirQrControladorProvider =
    NotifierProvider.autoDispose<EmitirQrControlador, EmitirQrEstado>(
      EmitirQrControlador.new,
    );
