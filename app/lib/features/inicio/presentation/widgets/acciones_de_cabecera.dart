import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/boton_qr_propio.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:flutter/material.dart';

/// Las acciones de la cabecera del inicio: la bandeja (si la cuenta le da
/// permiso, con su contador) y el QR propio. `null` si no hay ninguna, para
/// que la cabecera no deje hueco.
Widget? accionesDeCabecera(SesionAutenticada sesion, {required bool qrPropio}) {
  final bandeja = sesion.tiene(Permisos.verNotificaciones);
  if (!bandeja && !qrPropio) return null;
  return _AccionesDeCabecera(bandeja: bandeja, qrPropio: qrPropio);
}

class _AccionesDeCabecera extends StatelessWidget {
  const new({required this.bandeja, required this.qrPropio});

  final bool bandeja;
  final bool qrPropio;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (bandeja) const BotonNotificaciones(),
        if (bandeja && qrPropio) SizedBox(width: context.tokens.espacio.s),
        if (qrPropio) const BotonQrPropio(),
      ],
    );
  }
}
