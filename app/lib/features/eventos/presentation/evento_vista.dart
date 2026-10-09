import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/eventos/domain/evento_acceso.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';

/// Texto del motivo de un evento, por su `motivo_code` (contrato V1). Un código
/// que la app no conoce muestra el texto genérico de "motivo desconocido".
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

/// Texto del resultado de un evento.
String textoResultadoEvento(AppLocalizations l10n, ResultadoEvento resultado) =>
    switch (resultado) {
      ResultadoEvento.permitido => l10n.eventoResultadoPermitido,
      ResultadoEvento.rechazado => l10n.eventoResultadoRechazado,
    };

/// Tono del badge de un resultado: permitido es éxito; rechazado, peligro.
TonoAcceso tonoResultadoEvento(ResultadoEvento resultado) =>
    switch (resultado) {
      ResultadoEvento.permitido => TonoAcceso.exito,
      ResultadoEvento.rechazado => TonoAcceso.peligro,
    };
