import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Superficie de tarjeta (radio 14, elev1 en claro; en oscuro la elevación
/// es el color de superficie). Opcionalmente navegable con [alTocar].
class AccesoTarjeta extends StatelessWidget {
  const new({
    required this.child,
    this.alTocar,
    this.relleno,
    this.seleccionada = false,
    this.elevada = false,
    this.color,
    super.key,
  });

  final Widget child;
  final VoidCallback? alTocar;
  final EdgeInsetsGeometry? relleno;

  /// Borde de 2 dp primario (tarjeta seleccionable elegida).
  final bool seleccionada;

  /// Sombra elev3 (diálogos y menús) en vez de elev1.
  final bool elevada;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final radio = BorderRadius.circular(tokens.radio.l);
    final contenido = Padding(
      padding: relleno ?? EdgeInsets.all(tokens.espacio.l),
      child: child,
    );
    return AnimatedContainer(
      duration: tokens.duracion.efectiva(context, tokens.duracion.normal),
      curve: tokens.duracion.curva,
      decoration: BoxDecoration(
        color:
            color ?? (elevada ? colores.superficieElevada : colores.superficie),
        borderRadius: radio,
        boxShadow: elevada ? colores.elev3 : colores.elev1,
        border: seleccionada
            ? Border.all(
                color: colores.primario,
                width: tokens.tamano.bordeSeleccion,
              )
            : null,
      ),
      child: Material(
        type: MaterialType.transparency,
        child: alTocar == null
            ? contenido
            : InkWell(borderRadius: radio, onTap: alTocar, child: contenido),
      ),
    );
  }
}
