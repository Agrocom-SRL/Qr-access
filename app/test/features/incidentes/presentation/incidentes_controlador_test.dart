import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:agrocom_acceso/features/incidentes/presentation/incidentes_controlador.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/incidentes_falsos.dart';

ProviderContainer _contenedor(IncidentesRepositorioFalso repositorio) {
  final contenedor = ProviderContainer(
    overrides: [incidentesRepositorioProvider.overrideWithValue(repositorio)],
  );
  addTearDown(contenedor.dispose);
  return contenedor;
}

void main() {
  group('filtros del listado', () {
    test('cambiar el tipo vuelve a la página 1 y conserva el estado', () {
      final contenedor = _contenedor(IncidentesRepositorioFalso());
      final notifier = contenedor.read(filtroIncidentesProvider.notifier)
        ..elegirEstado(EstadoDeIncidente.confirmado)
        ..irAPagina(3)
        ..elegirTipo(TipoDeIncidente.usoMasivo);

      final filtro = contenedor.read(filtroIncidentesProvider);
      expect(filtro.pagina, 1);
      expect(filtro.tipo, TipoDeIncidente.usoMasivo);
      expect(filtro.estado, EstadoDeIncidente.confirmado);
      expect(notifier, isNotNull);
    });

    test('pasar de página conserva los filtros', () {
      final contenedor = _contenedor(IncidentesRepositorioFalso());
      contenedor.read(filtroIncidentesProvider.notifier)
        ..elegirTipo(TipoDeIncidente.otro)
        ..irAPagina(2);

      final filtro = contenedor.read(filtroIncidentesProvider);
      expect(filtro.pagina, 2);
      expect(filtro.tipo, TipoDeIncidente.otro);
    });
  });

  group('resolver', () {
    test('devuelve la respuesta de la API si sale bien', () async {
      final incidente = incidenteDePrueba();
      final repositorio = IncidentesRepositorioFalso(incidentes: [incidente]);
      final contenedor = _contenedor(repositorio);

      final envio = await contenedor
          .read(resolucionIncidenteProvider.notifier)
          .resolver('7', resultado: ResultadoDeResolucion.descartado);

      expect(envio.error, isNull);
      expect(envio.respuesta?.incidente.id, '7');
      expect(
        repositorio.resoluciones.single.resultado,
        ResultadoDeResolucion.descartado,
      );
      expect(contenedor.read(resolucionIncidenteProvider), isFalse);
    });

    test('un error de la API se devuelve, no se lanza', () async {
      final repositorio = IncidentesRepositorioFalso(
        errorResolver: const ErrorApi(
          code: 'incidente.motivo_requerido',
          status: 422,
        ),
      );
      final contenedor = _contenedor(repositorio);

      final envio = await contenedor
          .read(resolucionIncidenteProvider.notifier)
          .resolver('7', resultado: ResultadoDeResolucion.confirmado);

      expect(envio.respuesta, isNull);
      expect(envio.error?.code, 'incidente.motivo_requerido');
      expect(contenedor.read(resolucionIncidenteProvider), isFalse);
    });
  });
}
