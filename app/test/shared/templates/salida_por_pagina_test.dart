import 'package:agrocom_acceso/core/plataforma/compartir_archivo.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/estructura_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/dispositivos/data/sesiones_repositorio.dart';
import 'package:agrocom_acceso/features/dispositivos/dispositivos.dart';
import 'package:agrocom_acceso/features/exportacion/data/exportacion_repositorio.dart';
import 'package:agrocom_acceso/features/exportacion/exportacion.dart';
import 'package:agrocom_acceso/features/incidentes/data/incidentes_repositorio.dart';
import 'package:agrocom_acceso/features/incidentes/incidentes.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/generar_qr_pagina.dart';
import 'package:agrocom_acceso/l10n/gen/app_localizations.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/exportacion_falsa.dart';
import '../../helpers/fakes.dart';
import '../../helpers/incidentes_falsos.dart';
import '../../helpers/notificaciones_falsas.dart';
import '../../helpers/pantalla.dart';
import '../../helpers/sesiones_falsas.dart';

/// Una pantalla secundaria y la salida que le toca (convención de
/// `SalidaDeCabecera`): flecha para volver dentro de una jerarquía o de un
/// flujo, X para cerrar lo que se descarta.
typedef _Caso = ({
  String nombre,
  Widget Function() pagina,
  List<Override> Function() overrides,
  SalidaDeCabecera salida,
  String Function(AppLocalizations textos) tooltip,
});

final _ahora = DateTime.utc(2026, 10, 27, 14);

final _casos = <_Caso>[
  (
    nombre: 'Generar QR, primer paso',
    pagina: () => const GenerarQrPagina(),
    overrides: () => [
      qrAccesosRepositorioProvider.overrideWithValue(
        QrAccesosRepositorioFalso(),
      ),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(const []),
      ),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.generarQr})),
      ),
    ],
    salida: SalidaDeCabecera.cerrar,
    tooltip: (textos) => textos.comunCerrar,
  ),
  (
    nombre: 'Estructura',
    pagina: () => const EstructuraPagina(),
    overrides: () => [
      estructuraRepositorioProvider.overrideWithValue(
        EstructuraRepositorioFalso(const []),
      ),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(const []),
      ),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.administrarSitios})),
      ),
    ],
    salida: SalidaDeCabecera.volver,
    tooltip: (textos) => textos.comunVolver,
  ),
  (
    nombre: 'Actividad de usuarios',
    pagina: () => const EstadisticasUsuariosPagina(),
    overrides: () => [
      usuariosRepositorioProvider.overrideWithValue(UsuariosRepositorioFalso()),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(
          sesionCon(permisos: {Permisos.verUsuarios, Permisos.verEstadisticas}),
        ),
      ),
    ],
    salida: SalidaDeCabecera.volver,
    tooltip: (textos) => textos.comunVolver,
  ),
  (
    nombre: 'Notificaciones',
    pagina: () => const NotificacionesPagina(),
    overrides: () => [
      notificacionesRepositorioProvider.overrideWithValue(
        NotificacionesRepositorioFalso(),
      ),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(
          sesionCon(
            permisos: {
              Permisos.verNotificaciones,
              Permisos.gestionarNotificaciones,
            },
          ),
        ),
      ),
    ],
    salida: SalidaDeCabecera.volver,
    tooltip: (textos) => textos.comunVolver,
  ),
  (
    nombre: 'Dispositivos conectados (subpágina de Perfil)',
    pagina: () => const DispositivosPagina(),
    overrides: () => [
      sesionesRepositorioProvider.overrideWithValue(SesionesRepositorioFalso()),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(() => SesionFalsa(sesionCon())),
    ],
    salida: SalidaDeCabecera.volver,
    tooltip: (textos) => textos.comunVolver,
  ),
  (
    nombre: 'Incidentes (subpágina de Perfil)',
    pagina: () => const IncidentesPagina(),
    overrides: () => [
      incidentesRepositorioProvider.overrideWithValue(
        IncidentesRepositorioFalso(),
      ),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.verIncidentes})),
      ),
    ],
    salida: SalidaDeCabecera.volver,
    tooltip: (textos) => textos.comunVolver,
  ),
  (
    nombre: 'Exportar datos (subpágina de Perfil)',
    pagina: () => const ExportacionPagina(),
    overrides: () => [
      exportacionRepositorioProvider.overrideWithValue(
        ExportacionRepositorioFalso(),
      ),
      compartirArchivoProvider.overrideWithValue(CompartirArchivoFalso()),
      relojProvider.overrideWithValue(() => _ahora),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.exportarDatos})),
      ),
    ],
    salida: SalidaDeCabecera.volver,
    tooltip: (textos) => textos.comunVolver,
  ),
];

void main() {
  // Un test por pantalla: Riverpod no admite cambiar los overrides dentro de
  // un mismo test.
  for (final caso in _casos) {
    testWidgets(
      '${caso.nombre}: la salida es ${caso.salida.name} (ícono y tooltip)',
      (tester) async {
        await montarPantalla(
          tester,
          pagina: caso.pagina(),
          overrides: caso.overrides(),
        );
        await tester.pump();

        final textos = textosEn(tester);
        final icono = caso.salida == SalidaDeCabecera.volver
            ? Icons.arrow_back
            : Icons.close;
        final otro = caso.salida == SalidaDeCabecera.volver
            ? Icons.close
            : Icons.arrow_back;

        expect(find.byIcon(icono), findsOneWidget);
        expect(find.byIcon(otro), findsNothing);
        expect(find.byTooltip(caso.tooltip(textos)), findsOneWidget);
      },
    );
  }
}
