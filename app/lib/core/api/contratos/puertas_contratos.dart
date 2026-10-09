/// Puerta de un listado de `GET /puertas` (contrato común V1).
class PuertaDto {
  const new({required this.id, required this.nombre, required this.sitio});

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String,
      sitio = ReferenciaDto.desde(json['sitio'] as Map<String, dynamic>);

  final String id;
  final String nombre;
  final ReferenciaDto sitio;
}

/// Referencia corta `{id, nombre}` a otro recurso (puerta, sitio).
class ReferenciaDto {
  const new({required this.id, required this.nombre});

  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String;

  final String id;
  final String nombre;
}
