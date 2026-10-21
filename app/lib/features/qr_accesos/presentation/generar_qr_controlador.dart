import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Pasos del stepper (handoff C05): puertas, vigencia y confirmar.
enum PasoGeneracion { puertas, vigencia, confirmar }

/// Estado del formulario de generación. Cada cambio reemplaza el estado entero,
/// así que un error mostrado se borra al corregir el dato.
@immutable
class GenerarQrEstado {
  const new({
    this.paso = PasoGeneracion.puertas,
    this.puertaIds = const {},
    this.vigencia = const Vigencia(OpcionVigencia.dosHoras),
    this.etiqueta = '',
    this.enviando = false,
    this.errorDatos,
    this.errorApi,
  });

  final PasoGeneracion paso;
  final Set<String> puertaIds;
  final Vigencia vigencia;
  final String etiqueta;
  final bool enviando;

  /// Error de los datos del formulario (sin puertas, etiqueta larga…).
  final ErrorDatosGeneracion? errorDatos;

  /// Error devuelto por la API al generar.
  final ErrorApi? errorApi;

  GenerarQrEstado copiar({
    PasoGeneracion? paso,
    Set<String>? puertaIds,
    Vigencia? vigencia,
    String? etiqueta,
    bool enviando = false,
    ErrorDatosGeneracion? errorDatos,
    ErrorApi? errorApi,
  }) => GenerarQrEstado(
    paso: paso ?? this.paso,
    puertaIds: puertaIds ?? this.puertaIds,
    vigencia: vigencia ?? this.vigencia,
    etiqueta: etiqueta ?? this.etiqueta,
    enviando: enviando,
    errorDatos: errorDatos,
    errorApi: errorApi,
  );
}

/// Controlador de la pantalla de generar QR (HU-11). Valida, genera y devuelve
/// el QR a la pantalla, que lo muestra: el token no se guarda aquí.
class GenerarQrControlador extends Notifier<GenerarQrEstado> {
  @override
  GenerarQrEstado build() => const GenerarQrEstado();

  /// "Repetir último": arranca con las puertas y la etiqueta de ese QR.
  void prellenar(PrellenadoGeneracion prellenado) {
    state = GenerarQrEstado(
      puertaIds: prellenado.puertaIds,
      etiqueta: prellenado.etiqueta ?? '',
    );
  }

  void alternarPuerta(String puertaId) {
    final ids = {...state.puertaIds};
    if (!ids.remove(puertaId)) ids.add(puertaId);
    state = state.copiar(puertaIds: ids);
  }

  /// "Todas" de un sitio: marca todas sus puertas, o las desmarca si ya
  /// estaban todas.
  void alternarTodas(Iterable<String> puertaIdsDelSitio) {
    final ids = {...state.puertaIds};
    final todas = puertaIdsDelSitio.every(ids.contains);
    if (todas) {
      ids.removeAll(puertaIdsDelSitio);
    } else {
      ids.addAll(puertaIdsDelSitio);
    }
    state = state.copiar(puertaIds: ids);
  }

  void elegirVigencia(Vigencia vigencia) =>
      state = state.copiar(vigencia: vigencia);

  void cambiarEtiqueta(String etiqueta) =>
      state = state.copiar(etiqueta: etiqueta);

  /// Avanza si el paso actual es válido; si no, deja el error en el estado.
  void siguiente() {
    final error = _errorDelPaso(state.paso);
    if (error != null) {
      state = state.copiar(errorDatos: error);
      return;
    }
    final indice = state.paso.index;
    if (indice < PasoGeneracion.values.length - 1) {
      state = state.copiar(paso: PasoGeneracion.values[indice + 1]);
    }
  }

  void atras() {
    final indice = state.paso.index;
    if (indice > 0) {
      state = state.copiar(paso: PasoGeneracion.values[indice - 1]);
    }
  }

  void irAlPaso(PasoGeneracion paso) {
    if (paso.index <= state.paso.index) state = state.copiar(paso: paso);
  }

  /// Genera el QR. Devuelve `null` si los datos no son válidos o la API falla;
  /// en ese caso el error queda en el estado para mostrarlo.
  Future<QrGenerado?> generar() async {
    if (state.enviando) return null;
    final ahora = ref.read(relojProvider)();
    final errorDatos = DatosGeneracion.errorDe(
      puertaIds: state.puertaIds,
      etiqueta: state.etiqueta,
      vigencia: state.vigencia,
      ahora: ahora,
    );
    if (errorDatos != null) {
      state = state.copiar(errorDatos: errorDatos);
      return null;
    }
    final datos = DatosGeneracion(
      puertaIds: state.puertaIds,
      vigencia: state.vigencia,
      etiqueta: state.etiqueta,
      ahora: ahora,
    );
    state = state.copiar(enviando: true);
    try {
      final qr = await ref
          .read(qrAccesosRepositorioProvider)
          .generar(datos, ahora: ahora);
      state = state.copiar();
      return qr;
    } on ErrorApi catch (error) {
      state = state.copiar(errorApi: error);
      return null;
    }
  }

  ErrorDatosGeneracion? _errorDelPaso(PasoGeneracion paso) => switch (paso) {
    PasoGeneracion.puertas =>
      state.puertaIds.isEmpty ? ErrorDatosGeneracion.sinPuertas : null,
    PasoGeneracion.vigencia => DatosGeneracion.errorDe(
      puertaIds: state.puertaIds,
      etiqueta: state.etiqueta,
      vigencia: state.vigencia,
      ahora: ref.read(relojProvider)(),
    ),
    PasoGeneracion.confirmar => null,
  };
}

/// Se descarta al salir: un formulario a medias no vuelve a la siguiente
/// generación.
final NotifierProvider<GenerarQrControlador, GenerarQrEstado>
generarQrControladorProvider =
    NotifierProvider.autoDispose<GenerarQrControlador, GenerarQrEstado>(
      GenerarQrControlador.new,
    );
