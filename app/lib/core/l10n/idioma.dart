import 'dart:ui';

/// Idiomas de la app (ADR 0013). Cada uno lleva el país cuya bandera lo
/// representa y su nombre en su propio idioma: ese nombre no se traduce
/// (quien busca su idioma lo reconoce por cómo se escribe), por eso vive aquí
/// y no en los ARB.
enum Idioma {
  es(codigo: 'es', pais: 'ES', nombre: 'Español'),
  en(codigo: 'en', pais: 'US', nombre: 'English'),
  pt(codigo: 'pt', pais: 'BR', nombre: 'Português');

  new({required this.codigo, required this.pais, required this.nombre});

  /// Código ISO 639-1, el mismo del archivo `app_<codigo>.arb`.
  final String codigo;

  /// Código ISO 3166-1 del país de la bandera.
  final String pais;
  final String nombre;

  Locale get locale => Locale(codigo);

  /// El idioma de un código guardado o de un `Locale`; `null` si la app no lo
  /// tiene.
  static Idioma? deCodigo(String? codigo) =>
      Idioma.values.where((i) => i.codigo == codigo).firstOrNull;
}

/// Idioma que se usa cuando la persona no eligió ninguno y el del dispositivo
/// no está entre los de la app.
const Idioma idiomaPorDefecto = Idioma.es;
