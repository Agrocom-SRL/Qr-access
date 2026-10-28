import 'dart:io';
import 'dart:typed_data';

import 'package:agrocom_acceso/features/exportacion/domain/pdf/fuente_ttf.dart';
import 'package:agrocom_acceso/features/exportacion/domain/tabla_de_exportacion.dart';

/// Las fuentes que la app empaqueta (IBM Plex), leídas del disco. Los tests de
/// PDF usan las mismas que la app, así que las tildes y las eñes se prueban
/// con la tipografía real.
FuentesDePdf fuentesDePrueba() {
  Uint8List leer(String archivo) =>
      File('assets/fuentes/$archivo').readAsBytesSync();

  return FuentesDePdf(
    normal: leerFuenteTtf(
      leer('IBMPlexSans-Regular.ttf'),
      nombre: 'IBMPlexSans-Regular',
    ),
    negrita: leerFuenteTtf(
      leer('IBMPlexSans-SemiBold.ttf'),
      nombre: 'IBMPlexSans-SemiBold',
    ),
  );
}

/// Los textos de un documento de prueba, en español como en el ARB.
TextosDeDocumento textosDePrueba({String? parte}) => TextosDeDocumento(
  titulo: 'Usuarios',
  generado: 'Generado el 27/10/2026 10:05',
  parte: parte,
  paginaDe: (pagina, paginas) => 'Página $pagina de $paginas',
);
