import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:agrocom_acceso/features/dispositivos/presentation/widgets/presentacion_de_sesion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_accion_fila.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:flutter/material.dart';

/// Un dispositivo conectado en la lista de compacto: su nombre (texto plano,
/// lo manda el cliente), la plataforma con su última actividad y, debajo, sus
/// acciones. En este aparato, la de cambiarle el nombre; en los demás, cerrar
/// su sesión.
class TarjetaSesion extends StatelessWidget {
  const new({
    required this.sesion,
    required this.ultimaActividad,
    required this.cerrando,
    this.alCerrar,
    this.alRenombrar,
    super.key,
  });

  final SesionConectada sesion;

  /// La última actividad ya formateada en hora de Bolivia.
  final String ultimaActividad;
  final bool cerrando;

  /// `null` en la sesión de este aparato, que no se cierra desde aquí.
  final VoidCallback? alCerrar;

  /// Solo en la sesión de este aparato: cambiar su nombre.
  final VoidCallback? alRenombrar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final acciones = <Widget>[
      if (alRenombrar != null)
        AccesoAccionFila(
          accion: AccionDeFila.editar,
          etiqueta: l10n.dispositivosRenombrar,
          onPressed: cerrando ? null : alRenombrar,
        ),
      if (alCerrar != null)
        AccesoBoton(
          texto: l10n.dispositivosCerrarUna,
          icono: Icons.logout,
          variante: VarianteBoton.peligroTexto,
          onPressed: cerrando ? null : alCerrar,
        ),
    ];
    return TarjetaFila(
      titulo: sesion.dispositivo ?? l10n.dispositivosSinNombre,
      subtitulo: l10n.dispositivosPlataformaYActividad(
        textoDePlataforma(l10n, sesion.plataforma),
        ultimaActividad,
      ),
      inicio: CajaIcono(
        icono: iconoDePlataforma(sesion.plataforma),
        tono: TonoCaja.neutro,
      ),
      fin: sesion.actual
          ? AccesoBadge(
              texto: l10n.dispositivosEsteAparato,
              tono: TonoAcceso.primario,
            )
          : null,
      pie: acciones.isEmpty
          ? null
          : Align(
              alignment: AlignmentDirectional.centerEnd,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final accion in acciones) ...[
                    accion,
                    SizedBox(width: tokens.espacio.s),
                  ],
                ],
              ),
            ),
    );
  }
}
