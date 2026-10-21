import 'dart:convert';

import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';

/// Clave en las preferencias del dispositivo donde queda la última sesión.
const claveSesionGuardada = 'sesion_guardada';

/// La última sesión conocida como texto, para reabrir la app sin internet con
/// el mismo rol. Solo lleva lo que la pantalla ya muestra (usuario, cuenta,
/// rol y permisos); lo sensible, el refresco, va aparte en `AlmacenRefresco`.
/// La autoridad de los permisos sigue siendo la API (ADR 0004).
String codificarSesion(SesionAutenticada sesion) => jsonEncode({
  'usuario': {'id': sesion.usuario.id, 'etiqueta': sesion.usuario.etiqueta},
  'cuenta': {
    'id': sesion.cuenta.id,
    'codigo': sesion.cuenta.codigo,
    'nombre': sesion.cuenta.nombre,
  },
  'rol': {'id': sesion.rolActivo.id, 'nombre': sesion.rolActivo.nombre},
  'permisos': sesion.permisos.toList(),
  if (sesion.suscripcion != null)
    'suscripcion': {
      'plan': sesion.suscripcion!.plan,
      'hasta': sesion.suscripcion!.hasta.toIso8601String(),
    },
});

/// Lo inverso de [codificarSesion]; `null` si el texto no sirve (formato viejo
/// o dañado): en ese caso se pide ingresar de nuevo.
SesionAutenticada? decodificarSesion(String texto) {
  try {
    final json = jsonDecode(texto) as Map<String, dynamic>;
    final usuario = json['usuario'] as Map<String, dynamic>;
    final cuenta = json['cuenta'] as Map<String, dynamic>;
    final rol = json['rol'] as Map<String, dynamic>;
    final suscripcion = json['suscripcion'] as Map<String, dynamic>?;
    return SesionAutenticada(
      usuario: UsuarioSesion(
        id: usuario['id'] as String,
        etiqueta: usuario['etiqueta'] as String?,
      ),
      cuenta: CuentaSesion(
        id: cuenta['id'] as String,
        codigo: cuenta['codigo'] as String,
        nombre: cuenta['nombre'] as String,
      ),
      rolActivo: RolSesion(
        id: rol['id'] as String,
        nombre: rol['nombre'] as String,
      ),
      permisos: (json['permisos'] as List<dynamic>).cast<String>().toSet(),
      suscripcion: suscripcion == null
          ? null
          : SuscripcionSesion(
              plan: suscripcion['plan'] as String,
              hasta: DateTime.parse(suscripcion['hasta'] as String),
            ),
    );
  } on Object {
    return null;
  }
}
