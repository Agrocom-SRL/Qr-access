import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/cabecera_cuenta.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// "Hola, Jorge · Agroindustrial Norte · Usuario" con el avatar (C04a/b).
/// Los textos los arma Inicio con la sesión; la cabecera compartida los
/// acomoda y el avatar y el saludo llevan al perfil.
class EncabezadoInicio extends StatelessWidget {
  const new({required this.sesion, this.accion, super.key});

  final SesionAutenticada sesion;

  /// Acciones a la derecha (campanita, QR propio), fuera del área que lleva
  /// al perfil.
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final nombre = sesion.usuario.etiqueta;
    return CabeceraCuenta(
      etiquetaAvatar: nombre,
      titulo: nombre == null
          ? l10n.inicioSaludoSinNombre
          : l10n.inicioSaludo(AccesoAvatar.primerNombre(nombre)),
      subtitulo: l10n.inicioCuentaYRol(
        sesion.cuenta.nombre,
        sesion.rolActivo.nombre,
      ),
      accion: accion,
      alTocar: () => context.go(Rutas.perfil),
      etiquetaAlTocar: l10n.navPerfil,
    );
  }
}
