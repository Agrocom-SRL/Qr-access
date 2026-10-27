import 'package:agrocom_acceso/features/exportacion/domain/pdf/fuente_ttf.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Las fuentes del PDF, leídas de los assets que empaqueta la app (IBM Plex,
/// la misma tipografía: tildes y eñes). Se leen una vez y se reusan; el PDF no
/// depende de Google Fonts ni de la red (ADR 0012).
final fuentesPdfProvider = FutureProvider<FuentesDePdf>((ref) async {
  final normal = await _cargar('assets/fuentes/IBMPlexSans-Regular.ttf');
  final negrita = await _cargar('assets/fuentes/IBMPlexSans-SemiBold.ttf');
  return FuentesDePdf(
    normal: leerFuenteTtf(normal, nombre: 'IBMPlexSans-Regular'),
    negrita: leerFuenteTtf(negrita, nombre: 'IBMPlexSans-SemiBold'),
  );
});

/// Los bytes de un asset, sin copiar el búfer entero de `rootBundle`.
Future<Uint8List> _cargar(String ruta) async {
  final datos = await rootBundle.load(ruta);
  return datos.buffer.asUint8List(datos.offsetInBytes, datos.lengthInBytes);
}
