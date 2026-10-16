import 'package:flutter/foundation.dart';

/// PIN de acceso de un usuario de cuenta (ADR 0018, D-22).
///
/// Son 7 caracteres sin separadores: los 3 primeros son el código de la
/// cuenta (letras `A`–`Z`), y los 4 siguientes, al azar, letras `A`–`Z` o
/// dígitos. Nunca se usa `Ñ`. Ej.: `AGR7K2Q`.
///
/// Es un objeto de valor puro: no sabe de widgets ni de red (skill
/// `codigo-limpio`, principio D).
@immutable
final class Pin {
  const new _(this.valor);

  /// Largo total del PIN.
  static const longitud = 7;

  /// Largo del código de la cuenta, al inicio del PIN.
  static const largoCodigoCuenta = 3;

  static final _formato = RegExp('^[A-Z]{$largoCodigoCuenta}[A-Z0-9]{4}\$');
  static final _letra = RegExp('[A-Z]');
  static final _letraODigito = RegExp('[A-Z0-9]');
  static final _espacio = RegExp(r'\s');

  /// PIN en mayúsculas, sin espacios. Es lo que se envía a la API.
  final String valor;

  /// Código de la cuenta (3 primeros caracteres). No es secreto: lo usa el
  /// servidor para encontrar la cuenta.
  String get codigoCuenta => valor.substring(0, largoCodigoCuenta);

  /// Normaliza lo que escribió la persona: mayúsculas y sin espacios. El
  /// servidor hace lo mismo, así que la app no depende de ello para acertar.
  static String normalizar(String entrada) =>
      entrada.replaceAll(_espacio, '').toUpperCase();

  /// El PIN si `entrada`, normalizada, tiene el formato de ADR 0018; si no,
  /// `null`.
  static Pin? desde(String entrada) {
    final normalizado = normalizar(entrada);
    return _formato.hasMatch(normalizado) ? Pin._(normalizado) : null;
  }

  /// Filtra la entrada mientras la persona escribe: solo deja pasar lo que
  /// puede ir en cada posición (letra en las 3 primeras, letra o dígito
  /// después) y corta en 7 caracteres. Así un PIN pegado con espacios o en
  /// minúsculas queda bien formado.
  static String filtrarEntrada(String entrada) {
    final normalizado = normalizar(entrada);
    final salida = StringBuffer();
    for (var i = 0; i < normalizado.length && salida.length < longitud; i++) {
      final caracter = normalizado[i];
      final aceptado = salida.length < largoCodigoCuenta
          ? _letra.hasMatch(caracter)
          : _letraODigito.hasMatch(caracter);
      if (aceptado) salida.write(caracter);
    }
    return salida.toString();
  }

  /// Nunca muestra el PIN completo en logs ni en mensajes de depuración: solo
  /// el código de la cuenta (invariante 6).
  @override
  String toString() => 'Pin($codigoCuenta****)';

  @override
  bool operator ==(Object other) => other is Pin && other.valor == valor;

  @override
  int get hashCode => valor.hashCode;
}
