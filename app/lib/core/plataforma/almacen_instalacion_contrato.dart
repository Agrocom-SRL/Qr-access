/// Guarda el `instalacion_id` de este aparato o navegador (ADR 0030 §4.1).
///
/// Es un identificador aleatorio y estable: sirve para contar instalaciones
/// distintas de un mismo usuario, no para identificar a la persona. No es un
/// secreto, pero se guarda donde ya viven los datos sensibles del dispositivo
/// para no inventar un almacén nuevo por cada plataforma.
abstract interface class AlmacenInstalacion {
  /// El identificador guardado, o `null` la primera vez.
  Future<String?> leer();

  Future<void> guardar(String instalacionId);
}
