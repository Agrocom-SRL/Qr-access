import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';

const Set<String> _usuario = {
  Permisos.verPuertas,
  Permisos.emitirQr,
  Permisos.verQr,
  Permisos.anularQr,
  Permisos.verEventos,
};
const Set<String> _guardia = {
  Permisos.verPuertas,
  Permisos.supervisarPuertas,
  Permisos.verEventos,
  Permisos.verTodosLosEventos,
};
const Set<String> _administrador = {
  Permisos.verPuertas,
  Permisos.emitirQr,
  Permisos.verQr,
  Permisos.anularQr,
  Permisos.verEventos,
  Permisos.supervisarPuertas,
  Permisos.verTodosLosEventos,
  Permisos.verUsuarios,
  Permisos.crearUsuarios,
  Permisos.editarUsuarios,
  Permisos.eliminarUsuarios,
};

/// Tabla del handoff §Breakpoints y navegación, por permisos y no por nombre.
void main() {
  group('compacto (NavigationBar, máximo 4)', () {
    test('usuario: Inicio · Mis QR · Eventos · Perfil', () {
      expect(
        destinosPara(sesionCon(permisos: _usuario), ClasePantalla.compacta),
        [
          DestinoNav.inicio,
          DestinoNav.misQr,
          DestinoNav.eventos,
          DestinoNav.perfil,
        ],
      );
    });

    test('guardia: Inicio · Eventos · Puertas · Perfil', () {
      expect(
        destinosPara(sesionCon(permisos: _guardia), ClasePantalla.compacta),
        [
          DestinoNav.inicio,
          DestinoNav.eventos,
          DestinoNav.puertas,
          DestinoNav.perfil,
        ],
      );
    });

    test('administrador: Inicio · Eventos · Admin · Perfil', () {
      expect(
        destinosPara(
          sesionCon(permisos: _administrador),
          ClasePantalla.compacta,
        ),
        [
          DestinoNav.inicio,
          DestinoNav.eventos,
          DestinoNav.admin,
          DestinoNav.perfil,
        ],
      );
    });

    test('nunca más de 4 destinos', () {
      for (final permisos in [_usuario, _guardia, _administrador]) {
        expect(
          destinosPara(sesionCon(permisos: permisos), ClasePantalla.compacta),
          hasLength(lessThanOrEqualTo(maxDestinosCompactos)),
        );
      }
    });
  });

  group('rail (medio y expandido)', () {
    test('usuario suma Emitir QR', () {
      expect(
        destinosPara(sesionCon(permisos: _usuario), ClasePantalla.expandida),
        [
          DestinoNav.inicio,
          DestinoNav.emitirQr,
          DestinoNav.misQr,
          DestinoNav.eventos,
          DestinoNav.perfil,
        ],
      );
    });

    test('guardia es igual que en compacto', () {
      expect(destinosPara(sesionCon(permisos: _guardia), ClasePantalla.media), [
        DestinoNav.inicio,
        DestinoNav.eventos,
        DestinoNav.puertas,
        DestinoNav.perfil,
      ]);
    });

    test('administrador: Inicio · Emitir QR · Eventos · Puertas · Usuarios '
        '· Perfil', () {
      expect(
        destinosPara(
          sesionCon(permisos: _administrador),
          ClasePantalla.expandida,
        ),
        [
          DestinoNav.inicio,
          DestinoNav.emitirQr,
          DestinoNav.eventos,
          DestinoNav.puertas,
          DestinoNav.usuarios,
          DestinoNav.perfil,
        ],
      );
    });
  });

  test('sin sesión solo quedan Inicio y Perfil', () {
    expect(destinosPara(const SinSesion(), ClasePantalla.compacta), [
      DestinoNav.inicio,
      DestinoNav.perfil,
    ]);
  });

  test('el tablero de administración es para quien supervisa y ve todo', () {
    expect(veTableroDeAdministracion(sesionCon(permisos: _guardia)), isTrue);
    expect(
      veTableroDeAdministracion(sesionCon(permisos: _administrador)),
      isTrue,
    );
    expect(veTableroDeAdministracion(sesionCon(permisos: _usuario)), isFalse);
  });
}
