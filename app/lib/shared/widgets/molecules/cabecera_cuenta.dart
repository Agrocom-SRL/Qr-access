import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:flutter/material.dart';

/// Cabecera de CUENTA: el avatar del usuario, un saludo o nombre, una línea de
/// cuenta y rol (o sitio) y, a la derecha, acciones como la campanita o el QR
/// propio. Es la cabecera del Inicio (handoff C04).
///
/// No es una cabecera de título: para el título de una pantalla usa
/// `CabeceraTitulo`. Aquí el protagonista es la persona, así que el saludo
/// lleva el estilo de título pequeño y la línea de cuenta, el secundario.
///
/// El widget recibe textos ya armados: quien lo usa decide qué dice el saludo
/// (la feature que conoce la sesión), y este widget solo los acomoda.
class CabeceraCuenta extends StatelessWidget {
  const new({
    required this.titulo,
    required this.subtitulo,
    this.etiquetaAvatar,
    this.accion,
    this.alTocar,
    this.etiquetaAlTocar,
    super.key,
  }) : assert(
         alTocar == null || etiquetaAlTocar != null,
         'Lo que se toca necesita una etiqueta para la semántica',
       );

  /// Saludo o nombre, por ejemplo "Hola, Jorge".
  final String titulo;

  /// Cuenta y rol o sitio, por ejemplo "Agroindustrial Norte · Usuario".
  final String subtitulo;

  /// Nombre con el que se arma la inicial del avatar.
  final String? etiquetaAvatar;

  /// Acción a la derecha del bloque (la campanita, el QR propio); no toca el
  /// saludo.
  final Widget? accion;

  /// Lo que pasa al tocar el avatar y el saludo (llevar al perfil, en Inicio).
  final VoidCallback? alTocar;

  /// Nombre accesible de [alTocar] para lectores de pantalla.
  final String? etiquetaAlTocar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final saludo = Row(
      children: [
        AccesoAvatar(etiqueta: etiquetaAvatar),
        SizedBox(width: tokens.espacio.m),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: textos.headlineSmall),
              Text(
                subtitulo,
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
    final tocable = alTocar == null
        ? saludo
        : Semantics(
            button: true,
            label: etiquetaAlTocar,
            child: InkWell(
              onTap: alTocar,
              borderRadius: BorderRadius.circular(tokens.radio.l),
              child: saludo,
            ),
          );
    return Row(
      children: [
        // La acción queda fuera del área que lleva al perfil: tocar la
        // campanita no navega.
        Expanded(child: tocable),
        if (accion != null) ...[SizedBox(width: tokens.espacio.m), accion!],
      ],
    );
  }
}
