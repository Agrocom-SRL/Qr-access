import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('rango de días de Bolivia', () {
    test('un día va de su medianoche (04:00 UTC) a la del día siguiente', () {
      final dia = DateTime.utc(2026, 10, 27);
      final filtros = FiltrosDeExportacion(
        desde: instanteDeDia(dia),
        hasta: instanteDeDia(dia),
      );

      expect(inicioDelRango(filtros), DateTime.utc(2026, 10, 27, 4));
      expect(finDelRango(filtros), DateTime.utc(2026, 10, 28, 4));
    });

    test('el fin cruza el mes sin tocar la zona del dispositivo', () {
      final filtros = FiltrosDeExportacion(
        hasta: instanteDeDia(DateTime.utc(2026, 10, 31)),
      );

      expect(finDelRango(filtros), DateTime.utc(2026, 11, 1, 4));
    });

    test('sin fecha de fin no hay fin que mandar', () {
      expect(finDelRango(const FiltrosDeExportacion()), isNull);
    });

    test('un rango al revés no vale; uno abierto siempre', () {
      final antes = instanteDeDia(DateTime.utc(2026, 10));
      final despues = instanteDeDia(DateTime.utc(2026, 10, 5));

      expect(
        rangoValido(FiltrosDeExportacion(desde: despues, hasta: antes)),
        isFalse,
      );
      expect(
        rangoValido(FiltrosDeExportacion(desde: antes, hasta: despues)),
        isTrue,
      );
      expect(rangoValido(FiltrosDeExportacion(desde: despues)), isTrue);
      expect(rangoValido(const FiltrosDeExportacion()), isTrue);
    });

    test('el día elegido se muestra como ese mismo día en Bolivia', () {
      final instante = instanteDeDia(DateTime.utc(2026, 10, 27));

      expect(formatearFecha(instante), '27/10/2026');
    });
  });

  group('páginas', () {
    test('cuántas páginas hacen falta, y una aunque no haya filas', () {
      expect(paginasDe(0, 1000), 1);
      expect(paginasDe(1000, 1000), 1);
      expect(paginasDe(1001, 1000), 2);
      expect(paginasDe(2500, 1000), 3);
    });

    test('la siguiente es la que sigue si hay más; si no, la primera', () {
      const conMas = ResumenDePagina(
        pagina: 2,
        porPagina: 1000,
        total: 2500,
        filas: 1000,
        hayMas: true,
        truncado: false,
      );
      const ultima = ResumenDePagina(
        pagina: 3,
        porPagina: 1000,
        total: 2500,
        filas: 500,
        hayMas: false,
        truncado: false,
      );

      expect(paginaSiguiente(null), 1);
      expect(paginaSiguiente(conMas), 3);
      expect(paginaSiguiente(ultima), 1);
    });

    test('el resumen dice cuántas páginas tiene en total', () {
      const resumen = ResumenDePagina(
        pagina: 1,
        porPagina: 1000,
        total: 2500,
        filas: 1000,
        hayMas: true,
        truncado: false,
      );

      expect(resumen.paginas, 3);
    });
  });

  group('archivo', () {
    test('el nombre lleva el recurso, el código de la cuenta y la página', () {
      expect(
        nombreDeArchivo(
          RecursoExportable.lecturas,
          'AGR',
          2,
          FormatoDeDescarga.xlsx,
        ),
        'lecturas-agr-p2.xlsx',
      );
    });

    test('el código de la cuenta se limpia y sin código queda cuenta', () {
      expect(
        nombreDeArchivo(
          RecursoExportable.usuarios,
          'a/b c',
          1,
          FormatoDeDescarga.xlsx,
        ),
        'usuarios-abc-p1.xlsx',
      );
      expect(
        nombreDeArchivo(
          RecursoExportable.puertas,
          '../',
          1,
          FormatoDeDescarga.xlsx,
        ),
        'puertas-cuenta-p1.xlsx',
      );
    });
  });

  test('el filtro de resultado solo manda valor si filtra', () {
    expect(ResultadoFiltro.todos.api, isNull);
    expect(ResultadoFiltro.permitido.api, 'permitido');
    expect(ResultadoFiltro.rechazado.api, 'rechazado');
  });

  test('cambiar un filtro conserva los demás', () {
    final dia = instanteDeDia(DateTime.utc(2026, 10, 27));
    final filtros = const FiltrosDeExportacion()
        .conDesde(dia)
        .conResultado(ResultadoFiltro.rechazado);

    expect(filtros.desde, dia);
    expect(filtros.resultado, ResultadoFiltro.rechazado);
    expect(filtros.hasta, isNull);
  });
}
