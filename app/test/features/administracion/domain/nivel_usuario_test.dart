import 'package:agrocom_acceso/features/administracion/domain/nivel_usuario.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('nivel de un usuario (ADR 0028)', () {
    test('sale del nombre del rol base; otro nombre no tiene nivel', () {
      expect(nivelDeRol('Administrador'), NivelUsuario.administrador);
      expect(nivelDeRol('Titular'), NivelUsuario.titular);
      expect(nivelDeRol('Miembro'), NivelUsuario.miembro);
      expect(nivelDeRol('Guardia'), NivelUsuario.guardia);
      expect(nivelDeRol('Usuario'), isNull);
      expect(nivelDeRol('administrador'), isNull);
    });

    test('cada nivel crea solo el de abajo', () {
      expect(
        puedeCrearNivel(NivelUsuario.administrador, NivelUsuario.titular),
        isTrue,
      );
      expect(
        puedeCrearNivel(NivelUsuario.administrador, NivelUsuario.guardia),
        isTrue,
      );
      expect(
        puedeCrearNivel(NivelUsuario.titular, NivelUsuario.miembro),
        isTrue,
      );
    });

    test('nunca un igual, un superior ni saltarse un nivel', () {
      expect(
        puedeCrearNivel(NivelUsuario.administrador, NivelUsuario.miembro),
        isFalse,
      );
      expect(
        puedeCrearNivel(NivelUsuario.administrador, NivelUsuario.administrador),
        isFalse,
      );
      expect(
        puedeCrearNivel(NivelUsuario.titular, NivelUsuario.titular),
        isFalse,
      );
      expect(
        puedeCrearNivel(NivelUsuario.titular, NivelUsuario.guardia),
        isFalse,
      );
      expect(
        puedeCrearNivel(NivelUsuario.miembro, NivelUsuario.miembro),
        isFalse,
      );
      expect(
        puedeCrearNivel(NivelUsuario.guardia, NivelUsuario.miembro),
        isFalse,
      );
    });

    test('un nivel desconocido no crea ni se crea', () {
      expect(puedeCrearNivel(null, NivelUsuario.miembro), isFalse);
      expect(puedeCrearNivel(NivelUsuario.administrador, null), isFalse);
    });
  });

  group('validación del alta de un usuario', () {
    ErrorDatosUsuario? error({
      String etiqueta = 'Jorge',
      String? rolId = 'r2',
      NivelUsuario? nivel = NivelUsuario.titular,
      String? sitioId = 's1',
      String unidad = 'Casa 12',
    }) => DatosUsuario.errorDe(
      etiqueta: etiqueta,
      rolId: rolId,
      nivel: nivel,
      sitioId: sitioId,
      unidad: unidad,
    );

    test('un Titular completo es válido', () {
      expect(error(), isNull);
    });

    test('pide nombre, rol, propiedad y unidad, en ese orden', () {
      expect(error(etiqueta: '  '), ErrorDatosUsuario.sinEtiqueta);
      expect(error(etiqueta: 'a' * 81), ErrorDatosUsuario.etiquetaLarga);
      expect(error(rolId: null), ErrorDatosUsuario.sinRol);
      expect(error(sitioId: null), ErrorDatosUsuario.sinPropiedad);
      expect(error(unidad: '   '), ErrorDatosUsuario.sinNombreDeUnidad);
      expect(error(unidad: 'u' * 81), ErrorDatosUsuario.nombreDeUnidadLargo);
    });

    test('quien no es Titular no necesita propiedad ni unidad', () {
      expect(
        error(nivel: NivelUsuario.guardia, sitioId: null, unidad: ''),
        isNull,
      );
      expect(
        error(nivel: NivelUsuario.miembro, sitioId: null, unidad: ''),
        isNull,
      );
    });

    test('al editar solo cuenta el nombre', () {
      expect(DatosUsuario.errorDeEtiqueta('Ana'), isNull);
      expect(DatosUsuario.errorDeEtiqueta(' '), ErrorDatosUsuario.sinEtiqueta);
      expect(
        DatosUsuario.errorDeEtiqueta('a' * 81),
        ErrorDatosUsuario.etiquetaLarga,
      );
    });
  });
}
