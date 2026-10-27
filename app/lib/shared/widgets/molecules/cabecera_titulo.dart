import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:flutter/material.dart';

/// Cabecera de TÍTULO: el título de una pantalla, con su subtítulo opcional,
/// una acción a la derecha (un `AccesoBoton`) y un botón de salida a la
/// izquierda (volver o cerrar).
///
/// Úsala en toda pantalla que tenga un título propio: Lecturas, Mis QR,
/// Generar QR, Notificaciones, Actividad de usuarios, Estructura, Perfil, etc.
/// El estilo depende solo de la clase de pantalla (ver [estiloDe]), así que
/// todas las cabeceras de título se ven igual. Para la cabecera de la cuenta de
/// Inicio (avatar, nombre y acciones), usa `CabeceraCuenta`.
///
/// La salida la decide la pantalla, no el widget: [SalidaDeCabecera.volver] en
/// una subpágina o en un paso de flujo, [SalidaDeCabecera.cerrar] en un
/// formulario que se descarta. Ver `SalidaDeCabecera`.
class CabeceraTitulo extends StatelessWidget {
  const new({
    required this.titulo,
    this.subtitulo,
    this.accion,
    this.salida = SalidaDeCabecera.ninguna,
    this.alSalir,
    super.key,
  }) : assert(
         salida == SalidaDeCabecera.ninguna || alSalir != null,
         'Una salida necesita qué hacer al pulsarla (alSalir)',
       );

  final String titulo;
  final String? subtitulo;

  /// Acción principal a la derecha del título.
  final Widget? accion;

  /// Botón de salida a la izquierda; [SalidaDeCabecera.ninguna] (por defecto)
  /// no lo muestra.
  final SalidaDeCabecera salida;

  /// Lo que pasa al pulsar la salida: volver o cerrar, según [salida].
  final VoidCallback? alSalir;

  /// Estilo del título según la clase de pantalla: 20 en compacto (el de la
  /// barra superior de Generar QR) y 32 en medio y expandido (título grande
  /// del contenido). Los dos vienen del `textTheme`, que sale de los tokens de
  /// tipografía.
  static TextStyle? estiloDe(BuildContext context) {
    final textos = Theme.of(context).textTheme;
    return context.esCompacta ? textos.headlineSmall : textos.headlineLarge;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final pulsarSalida = alSalir;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (salida != SalidaDeCabecera.ninguna && pulsarSalida != null) ...[
          BotonSalidaCabecera(salida: salida, alPulsar: pulsarSalida),
          SizedBox(width: tokens.espacio.s),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: estiloDe(context)),
              if (subtitulo != null) ...[
                SizedBox(height: tokens.espacio.xs),
                Text(
                  subtitulo!,
                  style: textos.bodyLarge?.copyWith(
                    color: tokens.colores.textoSecundario,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (accion != null) ...[SizedBox(width: tokens.espacio.l), accion!],
      ],
    );
  }
}
