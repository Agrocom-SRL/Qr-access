import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Abre la hoja inferior con los formatos (PDF o Excel), con el estilo de
/// "Crear nuevo" de Drive: un toque en el círculo elige y cierra. Devuelve el
/// formato elegido, o `null` si la persona cierra la hoja sin elegir.
Future<FormatoDeDescarga?> elegirFormatoDeDescarga(BuildContext context) =>
    showModalBottomSheet<FormatoDeDescarga>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => const _HojaDeFormatos(),
    );

class _HojaDeFormatos extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return SafeArea(
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: tokens.tamano.maxAuth),
          child: Padding(
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
                Text(
                  l10n.exportacionFormatoTitulo,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                SizedBox(height: tokens.espacio.l),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _OpcionDeFormato(
                      formato: FormatoDeDescarga.pdf,
                      etiqueta: l10n.exportacionFormatoPdf,
                      ruta: Multimedia.iconoPdf,
                    ),
                    _OpcionDeFormato(
                      formato: FormatoDeDescarga.xlsx,
                      etiqueta: l10n.exportacionFormatoExcel,
                      ruta: Multimedia.iconoExcel,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Un formato: círculo con borde y su ícono a color, y el nombre debajo (el
/// estilo de "Crear nuevo" de Google Drive). Todo el conjunto es el botón.
class _OpcionDeFormato extends StatelessWidget {
  const new({
    required this.formato,
    required this.etiqueta,
    required this.ruta,
  });

  final FormatoDeDescarga formato;
  final String etiqueta;
  final String ruta;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    return Semantics(
      button: true,
      label: etiqueta,
      excludeSemantics: true,
      child: InkWell(
        key: ValueKey('formato-${formato.extension}'),
        onTap: () => Navigator.of(context).pop(formato),
        borderRadius: BorderRadius.circular(tokens.radio.l),
        child: Padding(
          padding: EdgeInsets.all(tokens.espacio.s),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: tokens.tamano.iconoFormato,
                height: tokens.tamano.iconoFormato,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colores.superficie,
                  border: Border.all(
                    color: colores.borde,
                    width: tokens.tamano.bordeFino,
                  ),
                ),
                child: SvgPicture.asset(
                  ruta,
                  width: tokens.tamano.iconoCaja,
                  height: tokens.tamano.iconoCaja,
                ),
              ),
              SizedBox(height: tokens.espacio.s),
              Text(
                etiqueta,
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: colores.textoSecundario),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
