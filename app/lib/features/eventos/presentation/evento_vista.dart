import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';

/// Texto corto del motivo de un evento, por su `motivo_code` (handoff:
/// "QR vencido", "QR ya usado", "Otra puerta", "Suscripción vencida"). Un
/// código que la app no conoce muestra el texto genérico.
String textoMotivoEvento(AppLocalizations l10n, String motivoCode) =>
    switch (motivoCode) {
      'acceso.permitido' => l10n.eventoMotivoAccesoPermitido,
      'qr.formato_invalido' => l10n.eventoMotivoQrFormatoInvalido,
      'qr.desconocido' => l10n.eventoMotivoQrDesconocido,
      'qr.anulado' => l10n.eventoMotivoQrAnulado,
      'qr.vencido' => l10n.eventoMotivoQrVencido,
      'qr.otra_puerta' => l10n.eventoMotivoQrOtraPuerta,
      'qr.usado' => l10n.eventoMotivoQrUsado,
      'suscripcion.vencida' => l10n.eventoMotivoSuscripcionVencida,
      _ => l10n.eventoMotivoDesconocido,
    };

/// Línea secundaria de un evento: el motivo si fue rechazado; si fue
/// permitido, la etiqueta del QR y quién lo emitió ("Proveedor de gas · QR
/// de Jorge R.").
String textoDetalleEvento(AppLocalizations l10n, EventoAcceso evento) {
  if (!evento.esPermitido) return textoMotivoEvento(l10n, evento.motivoCode);
  final etiqueta = evento.qrEtiqueta ?? l10n.qrSinEtiqueta;
  final emisor = evento.emisorEtiqueta;
  return emisor == null ? etiqueta : l10n.eventoQrDe(etiqueta, emisor);
}

/// Texto del resultado de un evento.
String textoResultadoEvento(AppLocalizations l10n, ResultadoEvento resultado) =>
    switch (resultado) {
      ResultadoEvento.permitido => l10n.eventoResultadoPermitido,
      ResultadoEvento.rechazado => l10n.eventoResultadoRechazado,
    };

/// Tono del badge (handoff): permitido es primario; rechazado, peligro.
TonoAcceso tonoResultadoEvento(ResultadoEvento resultado) =>
    switch (resultado) {
      ResultadoEvento.permitido => TonoAcceso.primario,
      ResultadoEvento.rechazado => TonoAcceso.peligro,
    };
