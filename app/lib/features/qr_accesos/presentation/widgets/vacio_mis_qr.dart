import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:flutter/material.dart';

/// Estado vacío de un filtro de Mis QR. Solo ilustración y texto, sin botón:
/// generar ya está en la acción de la barra y en el botón flotante, y repetirlo
/// aquí confundía. Cada filtro dice que no hay QR en ESE filtro; "no tienes"
/// se usa solo en Vigentes, que es el filtro por defecto.
class VacioMisQr extends StatelessWidget {
  const new({required this.estado, super.key});

  /// Filtro que está vacío.
  final EstadoQr estado;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (titulo, ayuda) = switch (estado) {
      EstadoQr.vigente => (
        l10n.qrVacioVigentesTitulo,
        l10n.qrVacioVigentesAyuda,
      ),
      EstadoQr.usado => (l10n.qrVacioUsadosTitulo, l10n.qrVacioUsadosAyuda),
      EstadoQr.vencido => (
        l10n.qrVacioVencidosTitulo,
        l10n.qrVacioVencidosAyuda,
      ),
      EstadoQr.anulado => (
        l10n.qrVacioAnuladosTitulo,
        l10n.qrVacioAnuladosAyuda,
      ),
    };
    // Con poca altura (horizontal de teléfono) el contenido no cabe: se puede
    // desplazar, y en pantalla alta se centra con el mínimo de la altura.
    return LayoutBuilder(
      builder: (context, restricciones) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: restricciones.maxHeight),
          child: EstadoVacio(
            ilustracion: Multimedia.vacioQr,
            titulo: titulo,
            ayuda: ayuda,
          ),
        ),
      ),
    );
  }
}
