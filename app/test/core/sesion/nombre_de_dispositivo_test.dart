import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/nombre_de_dispositivo.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

final AppLocalizations _es = lookupAppLocalizations(const Locale('es'));
final AppLocalizations _en = lookupAppLocalizations(const Locale('en'));

/// Nombre que la app mandaría para una plataforma y un lado corto dados.
String _nombre({
  bool web = false,
  TargetPlatform plataforma = TargetPlatform.android,
  double? lado,
  AppLocalizations? textos,
}) => nombreDeAparato(
  aparatoDe(web: web, plataforma: plataforma, ladoCortoLogico: lado),
  textos ?? _es,
);

void main() {
  group('nombre por plataforma', () {
    test('la app web se llama Navegador web, sea cual sea el sistema', () {
      expect(
        _nombre(web: true, plataforma: TargetPlatform.iOS),
        'Navegador web',
      );
      expect(
        _nombre(web: true, plataforma: TargetPlatform.windows),
        'Navegador web',
      );
    });

    test('Android se nombra Android', () {
      expect(_nombre(), 'Android');
    });

    test('iOS en teléfono es iPhone', () {
      expect(_nombre(plataforma: TargetPlatform.iOS, lado: 393), 'iPhone');
    });

    test('iOS con el lado corto de tableta es iPad', () {
      expect(_nombre(plataforma: TargetPlatform.iOS, lado: 820), 'iPad');
    });

    test('el corte de tableta cuenta desde 600 incluido', () {
      expect(_nombre(plataforma: TargetPlatform.iOS, lado: 599.9), 'iPhone');
      expect(_nombre(plataforma: TargetPlatform.iOS, lado: 600), 'iPad');
    });

    test('iOS sin dato de pantalla cae en iPhone', () {
      expect(_nombre(plataforma: TargetPlatform.iOS), 'iPhone');
    });

    test('macOS es Mac', () {
      expect(_nombre(plataforma: TargetPlatform.macOS), 'Mac');
    });

    test('Windows es Windows', () {
      expect(_nombre(plataforma: TargetPlatform.windows), 'Windows');
    });

    test('Linux es Linux', () {
      expect(_nombre(plataforma: TargetPlatform.linux), 'Linux');
    });

    test('una plataforma no reconocida usa el valor neutro', () {
      expect(_nombre(plataforma: TargetPlatform.fuchsia), 'Otro dispositivo');
    });

    test('los textos de la web y del neutro siguen el idioma', () {
      expect(_nombre(web: true, textos: _en), 'Web browser');
      expect(
        _nombre(plataforma: TargetPlatform.fuchsia, textos: _en),
        'Other device',
      );
    });

    test('las marcas no cambian de idioma', () {
      expect(
        _nombre(plataforma: TargetPlatform.iOS, lado: 393, textos: _en),
        'iPhone',
      );
      expect(_nombre(textos: _en), 'Android');
    });
  });

  group('ProveedorNombreDeDispositivo', () {
    test('entrega el nombre del aparato con los textos inyectados', () {
      final proveedor = ProveedorNombreDeDispositivo(
        () => AparatoDeSesion.ipad,
        () => _en,
      );

      expect(proveedor.leer(), 'iPad');
    });

    test('lee el aparato en cada llamada, no lo guarda', () {
      var aparato = AparatoDeSesion.android;
      final proveedor = ProveedorNombreDeDispositivo(() => aparato, () => _es);

      expect(proveedor.leer(), 'Android');
      aparato = AparatoDeSesion.mac;
      expect(proveedor.leer(), 'Mac');
    });
  });
}
