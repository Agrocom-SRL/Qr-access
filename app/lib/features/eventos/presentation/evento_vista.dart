import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/eventos/domain/lectura.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';

/// Texto corto del motivo de un evento, por su `motivo_code` (handoff:
/// "QR vencido", "QR ya usado", "Otra puerta", "Suscripción vencida"). Un
/// código que la app no conoce muestra el texto genérico.
String textoMotivoEvento(AppLocalizations l10n, String motivoCode) =>
    switch (motivoCode) {
      'acceso.permitido' => l10n.lecturaMotivoAccesoPermitido,
      'qr.formato_invalido' => l10n.lecturaMotivoQrFormatoInvalido,
      'qr.desconocido' => l10n.lecturaMotivoQrDesconocido,
      'qr.anulado' => l10n.lecturaMotivoQrAnulado,
      'qr.vencido' => l10n.lecturaMotivoQrVencido,
      'qr.otra_puerta' => l10n.lecturaMotivoQrOtraPuerta,
      'qr.usado' => l10n.lecturaMotivoQrUsado,
      'suscripcion.vencida' => l10n.lecturaMotivoSuscripcionVencida,
      _ => l10n.lecturaMotivoDesconocido,
    };

/// Línea secundaria de un evento: el motivo si fue rechazado; si fue
/// permitido, la etiqueta del QR y quién lo generó ("Proveedor de gas · QR
/// de Jorge R.").
String textoDetalleEvento(AppLocalizations l10n, Lectura evento) {
  if (!evento.esPermitido) return textoMotivoEvento(l10n, evento.motivoCode);
  final etiqueta = evento.qrEtiqueta ?? l10n.qrSinEtiqueta;
  final generador = evento.generadorEtiqueta;
  return generador == null ? etiqueta : l10n.lecturaQrDe(etiqueta, generador);
}

/// Texto del resultado de un evento.
String textoResultadoEvento(AppLocalizations l10n, ResultadoEvento resultado) =>
    switch (resultado) {
      ResultadoEvento.permitido => l10n.lecturaResultadoPermitido,
      ResultadoEvento.rechazado => l10n.lecturaResultadoRechazado,
    };

/// Tono del badge (handoff): permitido es primario; rechazado, peligro.
TonoAcceso tonoResultadoEvento(ResultadoEvento resultado) =>
    switch (resultado) {
      ResultadoEvento.permitido => TonoAcceso.primario,
      ResultadoEvento.rechazado => TonoAcceso.peligro,
    };
