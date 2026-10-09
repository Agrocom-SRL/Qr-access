import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Listado paginado en tarjetas: una columna en móvil, más columnas al ganar
/// ancho (web). Lo usan los listados de QR y de eventos.
///
/// Cuando la pantalla necesite tabla en `expandido` (§2.2 de la guía), esta es
/// la pieza que cambia; las pantallas no se tocan.
class ListadoPaginado<T> extends StatelessWidget {
  const new({
    required this.pagina,
    required this.itemBuilder,
    required this.alCambiarPagina,
    super.key,
  });

  final Pagina<T> pagina;
  final Widget Function(BuildContext context, T dato) itemBuilder;

  /// Recibe el número de la página que se quiere ver.
  final ValueChanged<int> alCambiarPagina;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(tokens.espacio.l),
            child: _Tarjetas<T>(datos: pagina.datos, itemBuilder: itemBuilder),
          ),
        ),
        _Paginacion<T>(pagina: pagina, alCambiarPagina: alCambiarPagina),
      ],
    );
  }
}

class _Tarjetas<T> extends StatelessWidget {
  const new({required this.datos, required this.itemBuilder});

  final List<T> datos;
  final Widget Function(BuildContext context, T dato) itemBuilder;

  @override
  Widget build(BuildContext context) {
    final espacio = context.tokens.espacio;
    return LayoutBuilder(
      builder: (context, restricciones) {
        final columnas = switch (context.clasePantalla) {
          ClasePantalla.compacta => 1,
          ClasePantalla.media => 2,
          ClasePantalla.expandida => 3,
        };
        final separacion = espacio.l;
        final ancho =
            (restricciones.maxWidth - separacion * (columnas - 1)) / columnas;
        return Wrap(
          spacing: separacion,
          runSpacing: separacion,
          children: [
            for (final dato in datos)
              SizedBox(width: ancho, child: itemBuilder(context, dato)),
          ],
        );
      },
    );
  }
}

class _Paginacion<T> extends StatelessWidget {
  const new({required this.pagina, required this.alCambiarPagina});

  final Pagina<T> pagina;
  final ValueChanged<int> alCambiarPagina;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return Padding(
      padding: EdgeInsets.all(tokens.espacio.l),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AccesoBoton(
            texto: l10n.comunPaginaAnterior,
            variante: VarianteBoton.texto,
            onPressed: pagina.tieneAnterior
                ? () => alCambiarPagina(pagina.pagina - 1)
                : null,
          ),
          SizedBox(width: tokens.espacio.l),
          Text(
            l10n.comunPaginaDe(pagina.pagina, pagina.totalPaginas),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          SizedBox(width: tokens.espacio.l),
          AccesoBoton(
            texto: l10n.comunPaginaSiguiente,
            variante: VarianteBoton.texto,
            onPressed: pagina.tieneSiguiente
                ? () => alCambiarPagina(pagina.pagina + 1)
                : null,
          ),
        ],
      ),
    );
  }
}
