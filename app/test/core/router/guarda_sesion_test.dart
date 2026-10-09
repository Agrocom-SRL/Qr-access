import 'package:agrocom_acceso/core/router/guarda_sesion.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';

const _eligiendo = SesionEligiendoRol(
  usuario: usuarioDePrueba,
  cuenta: cuentaDePrueba,
  roles: [RolSesion(id: 'r1', nombre: 'Usuario')],
);

void main() {
  group('sin sesión', () {
    test('la app lleva a la bienvenida desde cualquier pantalla', () {
      expect(
        redireccionDeSesion(const SinSesion(), Rutas.inicio),
        Rutas.bienvenida,
      );
    });

    test('se queda en la bienvenida y en el ingreso', () {
      expect(redireccionDeSesion(const SinSesion(), Rutas.bienvenida), isNull);
      expect(redireccionDeSesion(const SinSesion(), Rutas.ingreso), isNull);
    });

    test('mientras se restaura la sesión, espera en el arranque', () {
      expect(
        redireccionDeSesion(const SesionArrancando(), Rutas.ingreso),
        Rutas.arranque,
      );
    });
  });

  group('eligiendo rol', () {
    test('va a elegir rol antes que a cualquier otra pantalla', () {
      expect(redireccionDeSesion(_eligiendo, Rutas.ingreso), Rutas.elegirRol);
      expect(redireccionDeSesion(_eligiendo, Rutas.qrMios), Rutas.elegirRol);
    });

    test('se queda en elegir rol', () {
      expect(redireccionDeSesion(_eligiendo, Rutas.elegirRol), isNull);
    });
  });

  group('con sesión', () {
    final sesion = sesionCon(permisos: {Permisos.emitirQr});

    test('las pantallas de entrada llevan al tablero', () {
      for (final entrada in [
        Rutas.bienvenida,
        Rutas.ingreso,
        Rutas.elegirRol,
        Rutas.arranque,
      ]) {
        expect(redireccionDeSesion(sesion, entrada), Rutas.inicio);
      }
    });

    test('una ruta con permiso se abre si el rol activo lo tiene', () {
      expect(redireccionDeSesion(sesion, Rutas.qrNuevo), isNull);
    });

    test('una ruta sin el permiso del rol activo vuelve al tablero', () {
      expect(redireccionDeSesion(sesion, Rutas.eventos), Rutas.inicio);
      expect(redireccionDeSesion(sesion, Rutas.adminUsuarios), Rutas.inicio);
      expect(
        redireccionDeSesion(sesion, Rutas.adminUsuarioEditar),
        Rutas.inicio,
      );
    });

    test('la pestaña Admin se abre con cualquiera de sus permisos', () {
      expect(redireccionDeSesion(sesion, Rutas.admin), Rutas.inicio);
      expect(
        redireccionDeSesion(
          sesionCon(permisos: {Permisos.supervisarPuertas}),
          Rutas.admin,
        ),
        isNull,
      );
      expect(
        redireccionDeSesion(
          sesionCon(permisos: {Permisos.verUsuarios}),
          Rutas.admin,
        ),
        isNull,
      );
    });

    test('el permiso es del rol activo, no de otro rol de la cuenta', () {
      final sinEmitir = sesionCon();
      expect(redireccionDeSesion(sinEmitir, Rutas.qrNuevo), Rutas.inicio);
    });

    test('una pantalla sin permiso requerido se abre con cualquier sesión', () {
      expect(redireccionDeSesion(sesionCon(), Rutas.inicio), isNull);
      expect(redireccionDeSesion(sesionCon(), Rutas.perfil), isNull);
    });
  });
}
