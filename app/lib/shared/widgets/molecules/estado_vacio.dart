import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Pantalla de un listado sin datos: dos variantes según el caso, "todavía no
/// hay" (con la acción de crear) o "no hay resultados" (con limpiar filtros)
/// (docs/diseno/guia-pantallas.md §2.2).
class EstadoVacio extends StatelessWidget {
  const new({
    required this.icono,
    required this.titulo,
    this.ayuda,
    this.textoAccion,
    this.alAccionar,
    super.key,
  });

  final IconData icono;
  final String titulo;
  final String? ayuda;
  final String? textoAccion;
  final VoidCallback? alAccionar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final texto = Theme.of(context).textTheme;
    final textoAccion = this.textoAccion;
    final alAccionar = this.alAccionar;
    return Padding(
      padding: EdgeInsets.all(tokens.espacio.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icono,
            size: tokens.tamano.iconoGrande,
            color: tokens.colores.textoSecundario,
          ),
          SizedBox(height: tokens.espacio.l),
          Text(titulo, style: texto.titleMedium, textAlign: TextAlign.center),
          if (ayuda != null) ...[
            SizedBox(height: tokens.espacio.s),
            Text(
              ayuda!,
              style: texto.bodyMedium?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          if (textoAccion != null && alAccionar != null) ...[
            SizedBox(height: tokens.espacio.l),
            AccesoBoton(
              texto: textoAccion,
              onPressed: alAccionar,
              variante: VarianteBoton.secundaria,
            ),
          ],
        ],
      ),
    );
  }
}
