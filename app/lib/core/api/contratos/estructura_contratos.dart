import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';

/// Una puerta de `GET /sitios` con lo que el administrador configura.
class PuertaDeEstructuraDto {
  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String,
      segundosApertura = json['segundos_apertura'] as int,
      activa = json['activa'] as bool,
      dispositivo = json['dispositivo'] == null
          ? null
          : DispositivoDto.desde(json['dispositivo'] as Map<String, dynamic>);

  final String id;
  final String nombre;
  final int segundosApertura;
  final bool activa;
  final DispositivoDto? dispositivo;
}

/// Un sitio de `GET /sitios` con todas sus puertas.
class SitioDeEstructuraDto {
  new desde(Map<String, dynamic> json)
    : id = json['id'] as String,
      nombre = json['nombre'] as String,
      direccion = json['direccion'] as String?,
      zonaHoraria = json['zona_horaria'] as String,
      activo = json['activo'] as bool,
      puertas = [
        for (final p in json['puertas'] as List<dynamic>)
          PuertaDeEstructuraDto.desde(p as Map<String, dynamic>),
      ];

  final String id;
  final String nombre;
  final String? direccion;
  final String zonaHoraria;
  final bool activo;
  final List<PuertaDeEstructuraDto> puertas;
}

/// `GET /usuarios/{id}/puertas-asignadas`: `todas` o la lista de puertas.
class PuertasAsignadasDto {
  const new({required this.todas, required this.puertaIds});

  new desde(Map<String, dynamic> json)
    : todas = json['todas'] as bool,
      puertaIds = [
        for (final id in json['puerta_ids'] as List<dynamic>) id as String,
      ];

  final bool todas;
  final List<String> puertaIds;
}
