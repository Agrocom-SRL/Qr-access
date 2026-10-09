import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/estado_qr_vista.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Un QR en el listado: etiqueta, puertas, estado y la hora que corresponde a
/// ese estado. Anular es la única acción, y solo si el QR sigue vigente.
class TarjetaQr extends StatelessWidget {
  const new({
    required this.qr,
    required this.anulando,
    required this.alAnular,
    super.key,
  });

  final QrAcceso qr;
  final bool anulando;

  /// `null` si el usuario no tiene el permiso de anular: no se muestra el
  /// botón.
  final VoidCallback? alAnular;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final texto = Theme.of(context).textTheme;
    final puertas = qr.puertas.map((puerta) => puerta.nombre).join(', ');

    return Card(
      child: Padding(
        padding: EdgeInsets.all(tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    qr.etiqueta ?? l10n.qrSinEtiqueta,
                    style: texto.titleMedium,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                AccesoBadge(
                  texto: textoEstadoQr(l10n, qr.estado),
                  tono: tonoEstadoQr(qr.estado),
                ),
              ],
            ),
            SizedBox(height: tokens.espacio.xs),
            Text(puertas, style: texto.bodyMedium),
            SizedBox(height: tokens.espacio.xs),
            Text(
              _fechaDeEstado(l10n),
              style: texto.bodySmall?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
            ),
            if (qr.puedeAnularse && alAnular != null) ...[
              SizedBox(height: tokens.espacio.s),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: AccesoBoton(
                  texto: l10n.qrAnular,
                  variante: VarianteBoton.peligro,
                  cargando: anulando,
                  onPressed: alAnular,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// La hora que importa según el estado: hasta cuándo vale, o cuándo se usó
  /// o se anuló. El contrato trae esa fecha para cada estado.
  String _fechaDeEstado(AppLocalizations l10n) {
    return switch (qr.estado) {
      EstadoQr.vigente ||
      EstadoQr.vencido => l10n.qrVenceEl(formatearFechaHora(qr.venceAt)),
      EstadoQr.usado => l10n.qrUsadoEl(
        formatearFechaHora(qr.usadoAt ?? qr.venceAt),
      ),
      EstadoQr.anulado => l10n.qrAnuladoEl(
        formatearFechaHora(qr.anuladoAt ?? qr.venceAt),
      ),
    };
  }
}
