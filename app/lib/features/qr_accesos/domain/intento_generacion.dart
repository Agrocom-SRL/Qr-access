import 'dart:math';

import 'package:agrocom_acceso/features/qr_accesos/domain/clave_idempotencia.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:flutter/foundation.dart';

/// Segundos que un intento sin respuesta definitiva conserva su clave. Va por
/// debajo del TTL de la clave en la API (ADR 0031 §11): si la app reutilizara
/// una clave que el servidor ya olvidó, un reintento generaría un segundo QR.
const segundosVigenciaIntento = 600;

/// Espera, en segundos, antes de cada reintento automático ante una falla
/// transitoria (sin red, tiempo agotado o 5xx). Tras el último, el error llega
/// a la pantalla y el siguiente toque reutiliza la misma clave.
const segundosEsperasReintentoGeneracion = [1, 3];

/// Un intento lógico de generar un QR (ADR 0031 §11). Fija el cuerpo de la
/// petición (puertas, vencimiento y etiqueta) y las claves de idempotencia:
/// cada reintento manda exactamente lo mismo, o la API responde
/// `idempotencia.conflicto`.
///
/// Vive solo en memoria. No contiene el token del QR: la respuesta con el
/// token va al almacén seguro en cuanto llega (ADR 0008).
@immutable
class IntentoGeneracion {
  const new({
    required this.datos,
    required this.creadoEn,
    required this.venceAt,
    required this.clave,
    required this.claveReemplazo,
  });

  /// Un intento nuevo para una acción nueva: fija el vencimiento a partir de
  /// [ahora] y genera las dos claves (la de la generación y la de su
  /// reemplazo, ADR 0030 §2.1.3).
  new nuevo({
    required DatosGeneracion datos,
    required DateTime ahora,
    required Random azar,
  }) : this(
         datos: datos,
         creadoEn: ahora,
         venceAt: datos.vigencia.venceAtPara(ahora),
         clave: generarClaveIdempotencia(azar),
         claveReemplazo: generarClaveIdempotencia(azar),
       );

  /// Los datos de la acción; el vencimiento ya está resuelto en [venceAt].
  final DatosGeneracion datos;

  /// Cuándo empezó el intento: cuenta el vencimiento de su clave.
  final DateTime creadoEn;

  /// Vencimiento fijado al crear el intento, en UTC. Un reintento tardío
  /// debe mandar el mismo valor, no uno nuevo calculado con la hora actual.
  /// `null` cuando la API lo decide (fin del día).
  final DateTime? venceAt;

  /// `Idempotency-Key` de la generación.
  final String clave;

  /// `Idempotency-Key` del reemplazo, que tiene otro cuerpo (`reemplazar`) y
  /// por eso otra clave.
  final String claveReemplazo;

  /// ¿Es la misma acción que [otros]? Compara lo que el usuario eligió, no la
  /// hora: un reintento se hace en otro momento y sigue siendo el mismo.
  bool corresponde(DatosGeneracion otros) =>
      setEquals(datos.puertaIds.toSet(), otros.puertaIds.toSet()) &&
      datos.vigencia.opcion == otros.vigencia.opcion &&
      datos.vigencia.minutosDelDia == otros.vigencia.minutosDelDia &&
      datos.etiqueta == otros.etiqueta &&
      datos.propio == otros.propio;

  /// Pasado el plazo, la clave ya no se reutiliza y la acción empieza de cero.
  bool haVencido(DateTime ahora) =>
      ahora.difference(creadoEn) >=
      const Duration(seconds: segundosVigenciaIntento);
}
