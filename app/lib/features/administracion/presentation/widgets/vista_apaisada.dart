import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:flutter/material.dart';

/// Teléfono en horizontal (852×393, handoff): compacto y de poco alto. Ahí
/// apilar el resumen sobre la lista deja a la lista sin alto y desborda la
/// pantalla, así que el resumen va a la izquierda y la lista a la derecha. En
/// vertical, tablet y web no cambia nada: esto solo se activa en un teléfono
/// (plataforma móvil o su navegador) con poca altura. Una ventana de escritorio
/// baja no cuenta, por eso no basta con `esCompacta`.
bool estaApaisada(BuildContext context) =>
    context.esTelefono(MediaQuery.sizeOf(context).shortestSide) &&
    context.esAlturaCorta;

/// Resumen y lista lado a lado (solo con [estaApaisada]). La columna de resumen
/// se desplaza sola; la lista tiene su propio desplazamiento y toda la altura.
class VistaApaisada extends StatelessWidget {
  const new({required this.resumen, required this.listado, super.key});

  /// Las tarjetas de arriba, en orden; la columna las apila y se desplaza.
  final List<Widget> resumen;

  /// El listado paginado, que ocupa el resto del ancho y de la altura.
  final Widget listado;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: tokens.tamano.columnaApaisada,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ...resumen,
                SizedBox(height: tokens.espacio.l),
              ],
            ),
          ),
        ),
        VerticalDivider(width: tokens.tamano.bordeFino),
        Expanded(child: listado),
      ],
    );
  }
}

/// La foto de la columna de resumen: el mismo recorte que en vertical, pero
/// con la altura de la columna. Es decorativa (la marca `AccesoFoto`).
class FotoApaisada extends StatelessWidget {
  const new({
    required this.ruta,
    this.alineacion = Alignment.center,
    super.key,
  });

  /// Ruta del asset (ver `Multimedia`).
  final String ruta;
  final AlignmentGeometry alineacion;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.espacio.l,
        tokens.espacio.l,
        tokens.espacio.l,
        0,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(tokens.radio.xl),
        child: SizedBox(
          height: tokens.tamano.fotoApaisada,
          width: double.infinity,
          child: AccesoFoto(
            ruta: ruta,
            alineacion: alineacion,
            fundirConFondo: true,
            verdeEnClaro: true,
          ),
        ),
      ),
    );
  }
}
