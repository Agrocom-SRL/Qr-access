import 'dart:typed_data';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/data/fuentes_pdf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/exportacion_falsa.dart';
import '../../../helpers/fakes.dart';
import '../../../helpers/fuentes_pdf_de_prueba.dart';

/// Los textos del documento: el controlador no conoce el ARB.
TextosDeDocumento _textosDe(ResumenDePagina resumen) => textosDePrueba(
  parte: resumen.paginas > 1 ? 'Parte ${resumen.pagina}' : null,
);

ProviderContainer _contenedor({
  required ExportacionRepositorioFalso repositorio,
  required CompartirArchivo compartir,
}) {
  final contenedor = ProviderContainer(
    overrides: [
      exportacionRepositorioProvider.overrideWithValue(repositorio),
      fuentesPdfProvider.overrideWith((ref) async => fuentesDePrueba()),
      compartirArchivoProvider.overrideWithValue(compartir),
      sesionControladorProvider.overrideWith(() => SesionFalsa(sesionCon())),
    ],
  );
  addTearDown(contenedor.dispose);
  return contenedor;
}

void main() {
  test('baja la primera página, la pasa al menú con BOM y su nombre', () async {
    final repo = ExportacionRepositorioFalso(paginaEntregada: paginaDePrueba());
    final compartir = CompartirArchivoFalso();
    final contenedor = _contenedor(repositorio: repo, compartir: compartir);

    await contenedor
        .read(exportacionControladorProvider.notifier)
        .descargarSiguiente(textosDe: _textosDe);

    final compartido = compartir.compartidos.single;
    expect(compartido.nombreArchivo, 'usuarios-agr-p1.csv');
    expect(compartido.mimeType, 'text/csv');
    expect(compartido.bytes.sublist(0, 3), [0xEF, 0xBB, 0xBF]);
    final estado = contenedor.read(exportacionControladorProvider);
    expect(estado.ultimo?.pagina, 1);
    expect(estado.descargando, isFalse);
    expect(estado.error, isNull);
  });

  test('la siguiente vez pide la página que sigue', () async {
    final repo = ExportacionRepositorioFalso(
      paginaEntregada: paginaDePrueba(total: 2500, filas: 1000, hayMas: true),
    );
    final contenedor = _contenedor(
      repositorio: repo,
      compartir: CompartirArchivoFalso(),
    );
    final notifier = contenedor.read(exportacionControladorProvider.notifier);

    await notifier.descargarSiguiente(textosDe: _textosDe);
    await notifier.descargarSiguiente(textosDe: _textosDe);

    expect(repo.pedidos.map((p) => p.pagina), [1, 2]);
  });

  test('una página sin filas no abre el menú y lo dice el resumen', () async {
    final repo = ExportacionRepositorioFalso(
      paginaEntregada: paginaDePrueba(total: 0, filas: 0),
    );
    final compartir = CompartirArchivoFalso();
    final contenedor = _contenedor(repositorio: repo, compartir: compartir);

    await contenedor
        .read(exportacionControladorProvider.notifier)
        .descargarSiguiente(textosDe: _textosDe);

    expect(compartir.compartidos, isEmpty);
    expect(contenedor.read(exportacionControladorProvider).ultimo?.total, 0);
  });

  test('si cierra el menú, la página no cuenta y se vuelve a pedir', () async {
    final repo = ExportacionRepositorioFalso(
      paginaEntregada: paginaDePrueba(total: 2500, filas: 1000, hayMas: true),
    );
    final compartir = CompartirArchivoFalso(
      resultado: ResultadoCompartir.cancelado,
    );
    final contenedor = _contenedor(repositorio: repo, compartir: compartir);
    final notifier = contenedor.read(exportacionControladorProvider.notifier);

    await notifier.descargarSiguiente(textosDe: _textosDe);
    await notifier.descargarSiguiente(textosDe: _textosDe);

    expect(contenedor.read(exportacionControladorProvider).ultimo, isNull);
    expect(repo.pedidos.map((p) => p.pagina), [1, 1]);
  });

  test('un error de la API queda en el estado y no bloquea el botón', () async {
    final repo = ExportacionRepositorioFalso(
      error: const ErrorApi(code: 'limite.excedido', status: 429),
    );
    final contenedor = _contenedor(
      repositorio: repo,
      compartir: CompartirArchivoFalso(),
    );

    await contenedor
        .read(exportacionControladorProvider.notifier)
        .descargarSiguiente(textosDe: _textosDe);

    final estado = contenedor.read(exportacionControladorProvider);
    expect(estado.error?.code, 'limite.excedido');
    expect(estado.descargando, isFalse);
  });

  test('un fallo del menú de compartir no deja el botón bloqueado', () async {
    final repo = ExportacionRepositorioFalso(paginaEntregada: paginaDePrueba());
    final contenedor = _contenedor(
      repositorio: repo,
      compartir: _CompartirQueFalla(),
    );

    await expectLater(
      contenedor
          .read(exportacionControladorProvider.notifier)
          .descargarSiguiente(textosDe: _textosDe),
      throwsA(isA<StateError>()),
    );

    expect(
      contenedor.read(exportacionControladorProvider).descargando,
      isFalse,
    );
  });

  test('un rango de fechas al revés no pide nada', () async {
    final repo = ExportacionRepositorioFalso();
    final contenedor = _contenedor(
      repositorio: repo,
      compartir: CompartirArchivoFalso(),
    );
    final notifier = contenedor.read(exportacionControladorProvider.notifier)
      ..elegirRecurso(RecursoExportable.lecturas)
      ..elegirDesde(instanteDeDia(DateTime.utc(2026, 10, 5)))
      ..elegirHasta(instanteDeDia(DateTime.utc(2026, 10)));

    await notifier.descargarSiguiente(textosDe: _textosDe);

    expect(repo.pedidos, isEmpty);
  });

  test('cambiar el recurso o un filtro empieza de la primera página', () async {
    final repo = ExportacionRepositorioFalso(
      paginaEntregada: paginaDePrueba(total: 2500, filas: 1000, hayMas: true),
    );
    final contenedor = _contenedor(
      repositorio: repo,
      compartir: CompartirArchivoFalso(),
    );
    final notifier = contenedor.read(exportacionControladorProvider.notifier);
    await notifier.descargarSiguiente(textosDe: _textosDe);

    notifier.elegirRecurso(RecursoExportable.puertas);

    expect(contenedor.read(exportacionControladorProvider).ultimo, isNull);
  });

  test('los filtros de lecturas viajan a la API al bajar', () async {
    final repo = ExportacionRepositorioFalso();
    final contenedor = _contenedor(
      repositorio: repo,
      compartir: CompartirArchivoFalso(),
    );
    final dia = instanteDeDia(DateTime.utc(2026, 10, 27));
    final notifier = contenedor.read(exportacionControladorProvider.notifier)
      ..elegirRecurso(RecursoExportable.lecturas)
      ..elegirResultado(ResultadoFiltro.permitido)
      ..elegirDesde(dia);

    await notifier.descargarSiguiente(textosDe: _textosDe);

    final pedido = repo.pedidos.single;
    expect(pedido.recurso, RecursoExportable.lecturas);
    expect(pedido.filtros.resultado, ResultadoFiltro.permitido);
    expect(pedido.filtros.desde, dia);
    expect(pedido.filtros.hasta, isNull);
  });

  test('en PDF, la página sale como %PDF con el nombre .pdf', () async {
    final repo = ExportacionRepositorioFalso(paginaEntregada: paginaDePrueba());
    final compartir = CompartirArchivoFalso();
    final contenedor = _contenedor(repositorio: repo, compartir: compartir);

    await contenedor
        .read(exportacionControladorProvider.notifier)
        .descargarSiguiente(
          formato: FormatoDeDescarga.pdf,
          textosDe: _textosDe,
        );

    final compartido = compartir.compartidos.single;
    expect(compartido.nombreArchivo, 'usuarios-agr-p1.pdf');
    expect(compartido.mimeType, 'application/pdf');
    expect(String.fromCharCodes(compartido.bytes.sublist(0, 4)), '%PDF');
  });

  test('en Excel, la página sale como .xlsx (ZIP) con su tipo MIME', () async {
    final repo = ExportacionRepositorioFalso(paginaEntregada: paginaDePrueba());
    final compartir = CompartirArchivoFalso();
    final contenedor = _contenedor(repositorio: repo, compartir: compartir);

    await contenedor
        .read(exportacionControladorProvider.notifier)
        .descargarSiguiente(
          formato: FormatoDeDescarga.xlsx,
          textosDe: _textosDe,
        );

    final compartido = compartir.compartidos.single;
    expect(compartido.nombreArchivo, 'usuarios-agr-p1.xlsx');
    expect(compartido.bytes.sublist(0, 2), [0x50, 0x4B]);
  });
}

/// El menú de compartir que falla con un error que no es de la API.
class _CompartirQueFalla implements CompartirArchivo {
  @override
  Future<ResultadoCompartir> compartir({
    required Uint8List bytes,
    required String nombreArchivo,
    required String mimeType,
  }) async => throw StateError('menú roto');
}
