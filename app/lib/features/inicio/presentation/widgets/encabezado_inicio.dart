import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// "Hola, Jorge · Agroindustrial Norte · Usuario" con el avatar (C04a/b).
class EncabezadoInicio extends StatelessWidget {
  const new({required this.sesion, this.accion, super.key});

  final SesionAutenticada sesion;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final nombre = sesion.usuario.etiqueta;
    final saludo = Row(
      children: [
        AccesoAvatar(etiqueta: nombre),
        SizedBox(width: tokens.espacio.m),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                nombre == null
                    ? l10n.inicioSaludoSinNombre
                    : l10n.inicioSaludo(AccesoAvatar.primerNombre(nombre)),
                style: textos.headlineSmall,
              ),
              Text(
                l10n.inicioCuentaYRol(
                  sesion.cuenta.nombre,
                  sesion.rolActivo.nombre,
                ),
                style: textos.bodyMedium?.copyWith(
                  color: tokens.colores.textoSecundario,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
    return Row(
      children: [
        // El avatar y el saludo llevan al perfil; la acción queda aparte.
        Expanded(
          child: Semantics(
            button: true,
            label: l10n.navPerfil,
            child: InkWell(
              onTap: () => context.go(Rutas.perfil),
              borderRadius: BorderRadius.circular(tokens.radio.l),
              child: saludo,
            ),
          ),
        ),
        if (accion != null) ...[SizedBox(width: tokens.espacio.m), accion!],
      ],
    );
  }
}
