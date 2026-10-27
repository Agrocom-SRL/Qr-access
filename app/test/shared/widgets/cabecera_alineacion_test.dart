import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/incidentes.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/generar_qr_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/incidentes_falsos.dart';
import '../../helpers/pantalla.dart';

/// Tolerancia en píxeles lógicos para "el mismo eje vertical".
const _tolerancia = 1.0;

final _ahora = DateTime.utc(2026, 10, 27, 14);

/// La flecha o la X y el título de una pantalla deben compartir su centro
/// vertical, como en Generar QR (la referencia del usuario): si no, el título
/// queda más arriba que el botón de salida.
void _expectMismoEje(WidgetTester tester, String titulo) {
  final centroSalida = tester.getCenter(find.byType(BotonSalidaCabecera));
  final centroTitulo = tester.getCenter(find.text(titulo));
  expect(
    (centroSalida.dy - centroTitulo.dy).abs(),
    lessThanOrEqualTo(_tolerancia),
    reason: 'salida y título deben compartir el eje vertical',
  );
}

void main() {
  group('Incidentes de uso (PlantillaAdmin con CabeceraTitulo)', () {
    Future<void> montar(WidgetTester tester, {required bool expandida}) async {
      await montarPantalla(
        tester,
        pagina: const IncidentesPagina(),
        expandida: expandida,
        overrides: [
          sesionControladorProvider.overrideWith(
            () => SesionFalsa(sesionCon(permisos: {Permisos.verIncidentes})),
          ),
          incidentesRepositorioProvider.overrideWithValue(
            IncidentesRepositorioFalso(),
          ),
          relojProvider.overrideWithValue(() => _ahora),
        ],
      );
      await tester.pump();
      await tester.pump();
    }

    testWidgets('en compacto, la salida y el título comparten eje', (
      tester,
    ) async {
      await montar(tester, expandida: false);

      _expectMismoEje(tester, textosEn(tester).incidentesTitulo);
    });

    testWidgets('en expandido, la salida y el título comparten eje', (
      tester,
    ) async {
      await montar(tester, expandida: true);

      _expectMismoEje(tester, textosEn(tester).incidentesTitulo);
    });
  });

  group('Generar QR (referencia: AppBar en compacto)', () {
    Future<void> montar(WidgetTester tester, {required bool expandida}) async {
      await montarPantalla(
        tester,
        pagina: const GenerarQrPagina(),
        expandida: expandida,
        overrides: [
          qrAccesosRepositorioProvider.overrideWithValue(
            QrAccesosRepositorioFalso(),
          ),
          puertasRepositorioProvider.overrideWithValue(
            PuertasRepositorioFalso(const [
              Puerta(
                id: 'p1',
                nombre: 'Portón principal',
                sitioId: 's1',
                sitioNombre: 'Sede',
              ),
            ]),
          ),
          relojProvider.overrideWithValue(() => _ahora),
          sesionControladorProvider.overrideWith(
            () => SesionFalsa(sesionCon(permisos: {Permisos.generarQr})),
          ),
        ],
      );
      await tester.pump();
      await tester.pump();
    }

    // En expandido Generar QR no lleva botón de salida (es el primer paso de
    // un flujo con su resumen), así que la regla de eje solo aplica en
    // compacto.
    testWidgets('en compacto, la X y el título comparten eje', (tester) async {
      await montar(tester, expandida: false);

      _expectMismoEje(tester, textosEn(tester).qrGenerarTitulo);
    });
  });
}
