import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';

/// Texto de un estado de QR. Un mapa por entidad, en un solo lugar.
String textoEstadoQr(AppLocalizations l10n, EstadoQr estado) =>
    switch (estado) {
      EstadoQr.vigente => l10n.qrEstadoVigente,
      EstadoQr.usado => l10n.qrEstadoUsado,
      EstadoQr.vencido => l10n.qrEstadoVencido,
      EstadoQr.anulado => l10n.qrEstadoAnulado,
    };

/// Tono del badge de un estado de QR (sistema de diseño §4): anular lleva el
/// tono de peligro, porque es el estado al que lleva ese cambio.
TonoAcceso tonoEstadoQr(EstadoQr estado) => switch (estado) {
  EstadoQr.vigente => TonoAcceso.primario,
  EstadoQr.usado => TonoAcceso.informacion,
  EstadoQr.vencido => TonoAcceso.neutro,
  EstadoQr.anulado => TonoAcceso.peligro,
};

/// Texto de un error de los datos del formulario de emisión.
String textoErrorDatosEmision(AppLocalizations l10n, ErrorDatosEmision error) =>
    switch (error) {
      ErrorDatosEmision.sinPuertas => l10n.qrEmitirErrorSinPuertas,
      ErrorDatosEmision.etiquetaLarga => l10n.qrEmitirErrorEtiquetaLarga,
    };
