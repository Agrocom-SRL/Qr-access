/// Guarda en este teléfono el PIN con el que la persona ingresó, para que pueda
/// verlo y copiarlo desde Perfil y entrar con él en otro dispositivo.
///
/// El servidor no puede devolverlo (ADR 0018 §3: solo guarda su índice y su
/// hash), así que la única copia es la que la app guarda aquí, en el almacén
/// seguro del sistema. En web se guarda en el `localStorage` del navegador, de
/// forma temporal y solo para el primer lanzamiento controlado (ADR 0018,
/// enmienda de 2026-11-07).
abstract interface class AlmacenPin {
  /// `false` si esta plataforma no guarda el PIN: Perfil no ofrece la fila.
  bool get disponible;

  /// `true` si, al vencer o perderse la sesión, la app ingresa sola con el PIN
  /// guardado (web). En móvil la sesión vive en el almacén seguro y, si el
  /// servidor la rechaza, se pide el PIN.
  bool get reingresoAutomatico;

  Future<String?> leer();

  Future<void> guardar(String pin);

  Future<void> borrar();
}
