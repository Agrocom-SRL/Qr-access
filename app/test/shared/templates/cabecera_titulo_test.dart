import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/administracion.dart';
import 'package:agrocom_acceso/features/administracion/data/estructura_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/data/notificaciones_repositorio.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/data/qr_accesos_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/generar_qr_pagina.dart';
import 'package:agrocom_acceso/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/notificaciones_falsas.dart';
import '../../helpers/pantalla.dart';

/// Una pantalla con cabecera: cómo se monta y cómo se llama su título.
typedef _Caso = ({
  String nombre,
  Widget Function() pagina,
  List<Override> Function() overrides,
  String Function(AppLocalizations textos) titulo,
});

final _casos = <_Caso>[
  (
    nombre: 'Generar QR',
    pagina: () => const GenerarQrPagina(),
    overrides: () => [
      qrAccesosRepositorioProvider.overrideWithValue(
        QrAccesosRepositorioFalso(),
      ),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(const []),
      ),
      relojProvider.overrideWithValue(() => DateTime.utc(2026, 10, 27)),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(sesionCon(permisos: {Permisos.generarQr})),
      ),
    ],
    titulo: (textos) => textos.qrGenerarTitulo,
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
    titulo: (textos) => textos.estructuraTitulo,
  ),
  (
    nombre: 'Actividad de usuarios',
    pagina: () => const EstadisticasUsuariosPagina(),
    overrides: () => [
      usuariosRepositorioProvider.overrideWithValue(UsuariosRepositorioFalso()),
      relojProvider.overrideWithValue(() => DateTime.utc(2026, 10, 27)),
      sesionControladorProvider.overrideWith(
        () => SesionFalsa(
          sesionCon(permisos: {Permisos.verUsuarios, Permisos.verEstadisticas}),
        ),
      ),
    ],
    titulo: (textos) => textos.estadisticasTitulo,
  ),
  (
    nombre: 'Notificaciones',
    pagina: () => const NotificacionesPagina(),
    overrides: () => [
      notificacionesRepositorioProvider.overrideWithValue(
        NotificacionesRepositorioFalso(),
      ),
      relojProvider.overrideWithValue(() => DateTime.utc(2026, 10, 27)),
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
    titulo: (textos) => textos.notificacionesTitulo,
  ),
];

/// Estilo del título de [caso] tal como lo pinta la pantalla montada.
Future<TextStyle?> _estiloDelTitulo(
  WidgetTester tester,
  _Caso caso, {
  bool expandida = false,
}) async {
  await montarPantalla(
    tester,
    pagina: caso.pagina(),
    overrides: caso.overrides(),
    expandida: expandida,
  );
  await tester.pump();
  final titulo = caso.titulo(textosEn(tester));
  return tester.widget<Text>(find.text(titulo).first).style;
}

void main() {
  // Un test por pantalla: Riverpod no admite cambiar los overrides dentro de
  // un mismo test. Todas se comparan con la misma referencia, la de Generar QR.
  for (final caso in _casos) {
    testWidgets(
      '${caso.nombre}: en compacto, el título tiene el estilo de Generar QR',
      (tester) async {
        final estilo = await _estiloDelTitulo(tester, caso);
        final referencia = Tema.claro.textTheme.headlineSmall;

        expect(estilo?.fontSize, 20);
        expect(estilo?.fontSize, referencia?.fontSize);
        expect(estilo?.fontWeight, referencia?.fontWeight);
        expect(estilo?.fontFamily, referencia?.fontFamily);
      },
    );
  }

  testWidgets('en expandido, la cabecera de Estructura es grande (32)', (
    tester,
  ) async {
    final estilo = await _estiloDelTitulo(
      tester,
      _casos.firstWhere((caso) => caso.nombre == 'Estructura'),
      expandida: true,
    );

    expect(estilo?.fontSize, 32);
  });
}
