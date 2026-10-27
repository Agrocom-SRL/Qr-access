import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:agrocom_acceso/features/notificaciones/presentation/widgets/presentacion_de_notificacion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:flutter/material.dart';

/// Un aviso de la bandeja en compacto: qué pasó, a quién o dónde, cuándo, y si
/// todavía no está leído, el botón para marcarlo. El texto del servidor
/// (puertas, usuario, sitio) se muestra como texto plano.
class TarjetaNotificacion extends StatelessWidget {
  const new({
    required this.aviso,
    required this.puedeMarcar,
    required this.marcando,
    this.alMarcarLeida,
    super.key,
  });

  final Notificacion aviso;

  /// Si la persona puede marcar avisos (`notificaciones.aviso.gestionar`).
  final bool puedeMarcar;
  final bool marcando;
  final VoidCallback? alMarcarLeida;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final detalle = detalleDeNotificacion(l10n, aviso);
    final mostrarBoton = puedeMarcar && aviso.puedeMarcarLeida;
    return TarjetaFila(
      titulo: textoDeTipo(l10n, aviso.tipo),
      subtituloWidget: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (detalle != null)
            Text(
              detalle,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: colores.textoSecundario),
            ),
          SizedBox(height: tokens.espacio.xxs),
          Text(
            l10n.notificacionRecibida(formatearFechaHora(aviso.novedadAt)),
            style: tokens.tipografia.mono(
              tokens.tipografia.t12,
              color: colores.textoSecundario,
            ),
          ),
        ],
      ),
      inicio: CajaIcono(
        icono: iconoDeSeveridad(aviso.severidad),
        tono: tonoCajaDeSeveridad(aviso.severidad),
      ),
      fin: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          AccesoBadge(
            texto: textoDeSeveridad(l10n, aviso.severidad),
            tono: tonoDeSeveridad(aviso.severidad),
          ),
          SizedBox(height: tokens.espacio.xs),
          AccesoBadge(
            texto: aviso.leida
                ? l10n.notificacionesLeida
                : l10n.notificacionesNoLeida,
            tono: aviso.leida ? TonoAcceso.neutro : TonoAcceso.primario,
          ),
        ],
      ),
      pie: mostrarBoton
          ? Align(
              alignment: AlignmentDirectional.centerEnd,
              child: AccesoBoton(
                texto: l10n.notificacionesMarcarLeida,
                icono: Icons.done,
                variante: VarianteBoton.texto,
                onPressed: marcando ? null : alMarcarLeida,
              ),
            )
          : null,
    );
  }
}
