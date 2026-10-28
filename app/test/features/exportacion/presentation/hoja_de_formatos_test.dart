import 'dart:convert';

import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/horizontal.dart';
import '../../../helpers/pantalla.dart';
import 'montaje_exportacion.dart';

const _mimeXlsx =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// Abre la hoja de formatos desde el botón Descargar de Usuarios.
Future<void> _abrirHoja(WidgetTester tester) async {
  final textos = textosEn(tester);
  await tester.tap(find.text(textos.exportacionRecursoUsuarios));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('la hoja ofrece solo PDF y Excel, en círculos con su nombre', (
    tester,
  ) async {
    await montarExportacion(tester, pagina: const ExportacionPagina());
    await _abrirHoja(tester);
    final textos = textosEn(tester);

    expect(find.text(textos.exportacionFormatoTitulo), findsOneWidget);
    expect(find.byKey(const ValueKey('formato-pdf')), findsOneWidget);
    expect(find.byKey(const ValueKey('formato-xlsx')), findsOneWidget);
    expect(find.byKey(const ValueKey('formato-csv')), findsNothing);
    // Cada círculo lleva su nombre debajo, sin explicaciones.
    expect(find.text(textos.exportacionFormatoPdf), findsOneWidget);
    expect(find.text(textos.exportacionFormatoExcel), findsOneWidget);
  });

  testWidgets('PDF baja un documento que empieza con %PDF', (tester) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
    );
    await _abrirHoja(tester);
    await elegirFormato(tester, FormatoDeDescarga.pdf);

    final archivo = r.compartir.compartidos.single;
    expect(archivo.nombreArchivo, 'usuarios-agr-p1.pdf');
    expect(archivo.mimeType, 'application/pdf');
    expect(ascii.decode(archivo.bytes.sublist(0, 4)), '%PDF');
  });

  testWidgets('Excel baja un libro .xlsx (ZIP, empieza con PK)', (
    tester,
  ) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
    );
    await _abrirHoja(tester);
    await elegirFormato(tester, FormatoDeDescarga.xlsx);

    final archivo = r.compartir.compartidos.single;
    expect(archivo.nombreArchivo, 'usuarios-agr-p1.xlsx');
    expect(archivo.mimeType, _mimeXlsx);
    expect(archivo.bytes.sublist(0, 2), [0x50, 0x4B]);
  });

  testWidgets('cerrar la hoja sin elegir no baja nada', (tester) async {
    final r = await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
    );
    await _abrirHoja(tester);
    // Se cierra al tocar fuera de la hoja.
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();

    expect(r.repo.pedidos, isEmpty);
  });

  testWidgets('en 852×393 las dos opciones se ven y se pueden tocar', (
    tester,
  ) async {
    await montarExportacion(
      tester,
      pagina: const ExportacionPagina(),
      tamano: tamanoHorizontal,
    );
    await _abrirHoja(tester);

    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('formato-xlsx')).hitTestable(),
      findsOneWidget,
    );
  });
}
