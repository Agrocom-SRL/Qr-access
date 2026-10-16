import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Abre un formulario corto en una hoja inferior (bottom sheet) en vez de un
/// diálogo: ocupa el ancho en el móvil, sube con el teclado y se cierra
/// arrastrando. Devuelve lo que la hoja entregue al cerrarse, o `null`.
Future<T?> mostrarHojaFormulario<T>(
  BuildContext context, {
  required WidgetBuilder builder,
}) => showModalBottomSheet<T>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  useSafeArea: true,
  constraints: BoxConstraints(maxWidth: context.tokens.tamano.maxFormulario),
  builder: builder,
);

/// Contenido de una hoja de formulario: título, campos y, abajo, las acciones
/// (Cancelar | Guardar). Se desplaza si el teclado no deja ver todo.
class HojaFormulario extends StatelessWidget {
  const new({
    required this.titulo,
    required this.child,
    required this.acciones,
    super.key,
  });

  final String titulo;
  final Widget child;
  final List<Widget> acciones;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final medidas = MediaQuery.of(context);
    // Con el teclado, la hoja sube por encima de él; sin teclado, deja libre la
    // barra de navegación del sistema (en Android con pantalla completa los
    // botones quedaban debajo de los controles flotantes).
    final abajo = medidas.viewInsets.bottom > medidas.viewPadding.bottom
        ? medidas.viewInsets.bottom
        : medidas.viewPadding.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: abajo),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          tokens.espacio.l,
          0,
          tokens.espacio.l,
          tokens.espacio.l,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(titulo, style: Theme.of(context).textTheme.titleLarge),
            SizedBox(height: tokens.espacio.l),
            child,
            SizedBox(height: tokens.espacio.xl),
            // Los botones se reparten el ancho: caben en cualquier pantalla.
            Row(
              children: [
                for (var i = 0; i < acciones.length; i++) ...[
                  if (i > 0) SizedBox(width: tokens.espacio.m),
                  Expanded(child: acciones[i]),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
