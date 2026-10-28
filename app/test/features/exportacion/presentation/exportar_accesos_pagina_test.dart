import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/data/fuentes_pdf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/chip_etiqueta.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/exportacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/fuentes_pdf_de_prueba.dart';
import '../../../helpers/pantalla.dart';
import 'montaje_exportacion.dart';

/// Un controlador con un rango de fechas ya elegido (1 al 5 de octubre).
class _ControladorConFechas extends ExportacionControlador {
  @override
  EstadoExportacion build() => EstadoExportacion(
    recurso: RecursoExportable.lecturas,
    filtros: FiltrosDeExportacion(
      desde: instanteDeDia(DateTime.utc(2026, 10)),
      hasta: instanteDeDia(DateTime.utc(2026, 10, 5)),
    ),
  );
}

void main() {
  testWidgets('la salida es la X de cerrar, no la flecha', (tester) async {
    await montarExportacion(tester, pagina: const ExportarAccesosPagina());
    final textos = textosEn(tester);

    expect(find.byIcon(Icons.close), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back), findsNothing);
    expect(find.byTooltip(textos.comunCerrar), findsOneWidget);
  });

  testWidgets('el resultado se elige con pestañas y baja solo ese filtro', (
    tester,
  ) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportarAccesosPagina(),
    );
    final textos = textosEn(tester);

    await tester.tap(find.text(textos.exportacionPermitido));
    await tester.pumpAndSettle();
    expect(
      find.text(textos.exportacionResultadoPermitidoAyuda),
      findsOneWidget,
    );
    await tester.tap(find.byTooltip(textos.exportacionDescargar));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    final pedido = r.repo.pedidos.single;
    expect(pedido.recurso, RecursoExportable.lecturas);
    expect(pedido.filtros.resultado, ResultadoFiltro.permitido);
    expect(find.text(textos.exportacionDescargada(1, 1, 2)), findsOneWidget);
  });

  testWidgets('con más partes, el botón pide la que sigue', (tester) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportarAccesosPagina(),
      repositorio: ExportacionRepositorioFalso(
        paginaEntregada: paginaDePrueba(total: 2500, filas: 1000, hayMas: true),
      ),
    );
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.exportacionDescargar));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);
    await tester.tap(find.byTooltip(textos.exportacionSiguiente(2, 3)));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    expect(r.repo.pedidos.map((p) => p.pagina).toList(), [1, 2]);
  });

  testWidgets('si la API llegó al tope, lo explica en una línea', (
    tester,
  ) async {
    await montarExportacion(
      tester,
      pagina: const ExportarAccesosPagina(),
      repositorio: ExportacionRepositorioFalso(
        paginaEntregada: paginaDePrueba(
          total: 10000,
          filas: 1000,
          truncado: true,
        ),
      ),
    );
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.exportacionDescargar));
    await tester.pumpAndSettle();
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    expect(find.text(textos.exportacionTruncado), findsWidgets);
    expect(find.byType(AccesoAviso), findsWidgets);
  });

  testWidgets('con fechas elegidas, muestra el rango en un chip', (
    tester,
  ) async {
    await montarPantalla(
      tester,
      pagina: const ExportarAccesosPagina(),
      overrides: [
        sesionControladorProvider.overrideWith(
          () => SesionFalsa(sesionCon(permisos: {Permisos.exportarDatos})),
        ),
        exportacionRepositorioProvider.overrideWithValue(
          ExportacionRepositorioFalso(),
        ),
        compartirArchivoProvider.overrideWithValue(CompartirArchivoFalso()),
        relojProvider.overrideWithValue(() => ahoraDeExportacion),
        fuentesPdfProvider.overrideWith((ref) async => fuentesDePrueba()),
        exportacionControladorProvider.overrideWith(_ControladorConFechas.new),
      ],
    );
    await tester.pumpAndSettle();
    final textos = textosEn(tester);

    expect(
      find.widgetWithText(
        ChipEtiqueta,
        textos.exportacionRangoAmbas('01/10/2026', '05/10/2026'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('el botón de fechas abre el menú; "Quitar fechas" los borra', (
    tester,
  ) async {
    await montarExportacion(tester, pagina: const ExportarAccesosPagina());
    final textos = textosEn(tester);

    await tester.tap(find.byTooltip(textos.exportacionFechasTooltip));
    await tester.pumpAndSettle();

    expect(find.text(textos.exportacionFechasTitulo), findsOneWidget);
    expect(find.text(textos.exportacionDesde), findsOneWidget);
    expect(find.text(textos.exportacionHasta), findsOneWidget);
    expect(find.text(textos.exportacionQuitarFechas), findsOneWidget);
    expect(find.text(textos.exportacionSinLimite), findsNWidgets(2));
  });

  for (final tamano in const [
    Size(393, 852),
    Size(852, 393),
    Size(1024, 768),
    Size(1280, 800),
  ]) {
    testWidgets(
      'en ${tamano.width.toInt()}×${tamano.height.toInt()}, sin desbordes y '
      'con Descargar en la barra superior',
      (tester) async {
        await montarExportacion(
          tester,
          pagina: const ExportarAccesosPagina(),
          tamano: tamano,
        );
        final textos = textosEn(tester);

        expect(tester.takeException(), isNull);
        expect(
          find.byTooltip(textos.exportacionDescargar).hitTestable(),
          findsOneWidget,
        );
        // Sin botón grande abajo: la descarga vive en la barra.
        expect(find.byType(AccesoBoton), findsNothing);
      },
    );
  }
}
