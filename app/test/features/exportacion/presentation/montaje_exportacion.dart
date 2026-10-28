import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/data/fuentes_pdf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/exportacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/fuentes_pdf_de_prueba.dart';
import '../../../helpers/pantalla.dart';

/// Un "ahora" fijo para que los filtros de fecha sean predecibles.
final ahoraDeExportacion = DateTime.utc(2026, 10, 27, 14);

/// Monta [pagina] con el repositorio y el menú de compartir falsos, la sesión
/// del Administrador y el reloj fijo. Devuelve lo que el test necesita para
/// comprobar pedidos y archivos compartidos.
Future<({ExportacionRepositorioFalso repo, CompartirArchivoFalso compartir})>
montarExportacion(
  WidgetTester tester, {
  required Widget pagina,
  ExportacionRepositorioFalso? repositorio,
  Size? tamano,
}) async {
  final repo = repositorio ?? ExportacionRepositorioFalso();
  final compartir = CompartirArchivoFalso();
  await montarPantalla(
    tester,
    pagina: pagina,
    tamano: tamano,
    overrides: [
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.exportarDatos})),
      ),
      exportacionRepositorioProvider.overrideWithValue(repo),
      compartirArchivoProvider.overrideWithValue(compartir),
      relojProvider.overrideWithValue(() => ahoraDeExportacion),
      fuentesPdfProvider.overrideWith((ref) async => fuentesDePrueba()),
    ],
  );
  await tester.pumpAndSettle();
  return (repo: repo, compartir: compartir);
}

/// Toca una opción de la hoja de formatos (PDF o Excel) y espera a que la
/// descarga termine.
Future<void> elegirFormato(
  WidgetTester tester,
  FormatoDeDescarga formato,
) async {
  await tester.tap(find.byKey(ValueKey('formato-${formato.extension}')));
  await tester.pumpAndSettle();
}
