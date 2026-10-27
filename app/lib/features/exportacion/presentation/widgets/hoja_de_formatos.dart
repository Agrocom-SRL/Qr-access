import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/hoja_formulario.dart';
import 'package:flutter/material.dart';

/// Abre la hoja inferior con los formatos (CSV, PDF o Excel). Devuelve el que
/// la persona elige, o `null` si cierra la hoja sin elegir. Usa la hoja
/// compartida: con arrastre, sube sobre la barra del sistema, tiene ancho
/// máximo en tablet y web, y se desplaza si la pantalla es corta.
Future<FormatoDeDescarga?> elegirFormatoDeDescarga(BuildContext context) =>
    mostrarHojaFormulario<FormatoDeDescarga>(
      context,
      builder: (_) => const _HojaDeFormatos(),
    );

class _HojaDeFormatos extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final opciones = [
      (
        formato: FormatoDeDescarga.csv,
        titulo: l10n.exportacionFormatoCsv,
        ayuda: l10n.exportacionFormatoCsvAyuda,
        icono: Icons.table_chart_outlined,
      ),
      (
        formato: FormatoDeDescarga.pdf,
        titulo: l10n.exportacionFormatoPdf,
        ayuda: l10n.exportacionFormatoPdfAyuda,
        icono: Icons.picture_as_pdf_outlined,
      ),
      (
        formato: FormatoDeDescarga.xlsx,
        titulo: l10n.exportacionFormatoExcel,
        ayuda: l10n.exportacionFormatoExcelAyuda,
        icono: Icons.grid_on_outlined,
      ),
    ];
    return HojaFormulario(
      titulo: l10n.exportacionFormatoTitulo,
      acciones: [
        AccesoBoton(
          texto: l10n.comunCancelar,
          variante: VarianteBoton.secundaria,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final opcion in opciones) ...[
            TarjetaFila(
              titulo: opcion.titulo,
              subtitulo: opcion.ayuda,
              inicio: CajaIcono(
                icono: opcion.icono,
                tamano: tokens.tamano.iconoCaja,
              ),
              fin: const Icon(Icons.chevron_right),
              alTocar: () => Navigator.of(context).pop(opcion.formato),
            ),
            SizedBox(height: tokens.espacio.s),
          ],
        ],
      ),
    );
  }
}
