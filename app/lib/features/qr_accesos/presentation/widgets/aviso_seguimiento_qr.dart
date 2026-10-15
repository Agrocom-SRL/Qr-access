import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:flutter/material.dart';

/// Lo que pasó cuando se acercó el QR al lector: la puerta lo aceptó o lo
/// rechazó y por qué, para que quien lo muestra sepa qué hacer. Sin intento y
/// con el QR vigente no muestra nada.
class AvisoSeguimientoQr extends StatelessWidget {
  const new({required this.seguimiento, super.key});

  final SeguimientoQr seguimiento;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final intento = seguimiento.ultimoIntento;
    if (seguimiento.concedido && intento != null) {
      return AccesoAviso(
        tono: TonoAviso.primario,
        icono: Icons.check_circle_outline,
        titulo: l10n.seguimientoConcedidoTitulo,
        texto: l10n.seguimientoConcedidoTexto(intento.puertaNombre),
      );
    }
    final motivo = seguimiento.motivoDeRechazo;
    if (motivo == null) return const SizedBox.shrink();
    final puerta = intento?.puertaNombre;
    return AccesoAviso(
      tono: TonoAviso.peligro,
      icono: Icons.block,
      titulo: puerta == null ? null : l10n.seguimientoRechazadoTitulo(puerta),
      texto: textoDeRechazoQr(l10n, motivo),
    );
  }
}

/// Qué hacer ante un rechazo, por su `motivo_code`. Un código que la app no
/// conoce manda a avisar al administrador.
String textoDeRechazoQr(AppLocalizations l10n, String motivoCode) =>
    switch (motivoCode) {
      'qr.usado' => l10n.seguimientoRechazoUsado,
      'qr.vencido' => l10n.seguimientoRechazoVencido,
      'qr.anulado' => l10n.seguimientoRechazoAnulado,
      'qr.otra_puerta' => l10n.seguimientoRechazoOtraPuerta,
      'suscripcion.vencida' => l10n.seguimientoRechazoSuscripcion,
      _ => l10n.seguimientoRechazoGenerico,
    };
