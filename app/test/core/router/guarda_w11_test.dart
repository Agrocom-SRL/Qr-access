import 'package:agrocom_acceso/core/router/guarda_sesion.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';

/// Las rutas se miran por su ruta declarada (con `:id`), igual que hace el
/// router con `topRoute`; por eso el detalle se prueba con
/// `Rutas.incidenteDetalle`.
void main() {
  final conIncidentes = sesionCon(permisos: {Permisos.verIncidentes});
  final conExportar = sesionCon(permisos: {Permisos.exportarDatos});
  final sinNada = sesionCon();

  test('la lista de incidentes exige verIncidentes', () {
    expect(redireccionDeSesion(conIncidentes, Rutas.incidentes), isNull);
    expect(redireccionDeSesion(sinNada, Rutas.incidentes), Rutas.inicio);
  });

  test('el detalle de un incidente exige verIncidentes', () {
    expect(redireccionDeSesion(conIncidentes, Rutas.incidenteDetalle), isNull);
    expect(redireccionDeSesion(sinNada, Rutas.incidenteDetalle), Rutas.inicio);
  });

  test('la exportación exige exportarDatos y no verIncidentes', () {
    expect(redireccionDeSesion(conExportar, Rutas.exportar), isNull);
    expect(redireccionDeSesion(conIncidentes, Rutas.exportar), Rutas.inicio);
    expect(redireccionDeSesion(sinNada, Rutas.exportar), Rutas.inicio);
  });
}
