import 'package:agrocom_acceso/features/administracion/domain/nivel_usuario.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('todos los errores del alta (para marcar cada campo a la vez)', () {
    List<ErrorDatosUsuario> errores({
      String etiqueta = 'Jorge Rivero',
      String? rolId = 'r2',
      NivelUsuario? nivel = NivelUsuario.titular,
      String? sitioId = 's1',
      String unidad = 'Casa 12',
    }) => DatosUsuario.erroresDe(
      etiqueta: etiqueta,
      rolId: rolId,
      nivel: nivel,
      sitioId: sitioId,
      unidad: unidad,
    );

    test(
      'un Titular sin propiedad ni unidad recibe los tres errores en orden',
      () {
        expect(errores(sitioId: null, unidad: ''), [
          ErrorDatosUsuario.sinPropiedad,
          ErrorDatosUsuario.sinNombreDeUnidad,
        ]);
        expect(errores(etiqueta: '', sitioId: null, unidad: ''), [
          ErrorDatosUsuario.sinEtiqueta,
          ErrorDatosUsuario.sinPropiedad,
          ErrorDatosUsuario.sinNombreDeUnidad,
        ]);
      },
    );

    test('sin rol se marca el rol, aunque los demás datos estén bien', () {
      expect(errores(rolId: null, nivel: null, sitioId: null, unidad: ''), [
        ErrorDatosUsuario.sinRol,
      ]);
    });

    test('un Guardia o un Miembro no exige propiedad ni unidad', () {
      expect(
        errores(nivel: NivelUsuario.guardia, sitioId: null, unidad: ''),
        isEmpty,
      );
      expect(
        errores(nivel: NivelUsuario.miembro, sitioId: null, unidad: ''),
        isEmpty,
      );
    });

    test('el nombre de la unidad o la etiqueta demasiado largos se marcan', () {
      expect(errores(unidad: 'u' * (DatosUnidad.largoMaximoNombre + 1)), [
        ErrorDatosUsuario.nombreDeUnidadLargo,
      ]);
      expect(errores(etiqueta: 'a' * (DatosUsuario.largoMaximoEtiqueta + 1)), [
        ErrorDatosUsuario.etiquetaLarga,
      ]);
    });

    test('con datos válidos no hay errores', () {
      expect(errores(), isEmpty);
    });

    test(
      'errorDe devuelve el primero de la lista, en el orden del formulario',
      () {
        expect(
          DatosUsuario.errorDe(
            etiqueta: '',
            rolId: null,
            nivel: NivelUsuario.titular,
          ),
          ErrorDatosUsuario.sinEtiqueta,
        );
        expect(
          DatosUsuario.errorDe(
            etiqueta: 'Ana',
            rolId: 'r2',
            nivel: NivelUsuario.titular,
          ),
          ErrorDatosUsuario.sinPropiedad,
        );
        expect(
          DatosUsuario.errorDe(
            etiqueta: 'Ana',
            rolId: 'r2',
            nivel: NivelUsuario.titular,
            sitioId: 's1',
          ),
          ErrorDatosUsuario.sinNombreDeUnidad,
        );
      },
    );
  });
}
