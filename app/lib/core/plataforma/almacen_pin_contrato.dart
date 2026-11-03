/// Guarda en este teléfono el PIN con el que la persona ingresó, para que pueda
/// verlo y copiarlo desde Perfil y entrar con él en otro dispositivo.
///
/// El servidor no puede devolverlo (ADR 0018 §3: solo guarda su índice y su
/// hash), así que la única copia es la que la app guarda aquí, en el almacén
/// seguro del sistema. En web no se guarda nada: el navegador no tiene un
/// almacén seguro (ADR 0018, enmienda de 2026-10-30).
abstract interface class AlmacenPin {
  /// `false` si esta plataforma no guarda el PIN (web): Perfil no ofrece la
  /// fila.
  bool get disponible;

  Future<String?> leer();

  Future<void> guardar(String pin);

  Future<void> borrar();
}
