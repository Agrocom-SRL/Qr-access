import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Inicio de sesión con PIN (ADR 0018). Los tests lo sustituyen por un fake
/// con el mismo shape que la API.
abstract interface class SesionRepositorio {
  /// Envía el PIN y devuelve los tokens y el usuario. Lanza `ErrorApi`.
  Future<RespuestaInicio> iniciar(Pin pin);
}

class SesionRepositorioApi implements SesionRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<RespuestaInicio> iniciar(Pin pin) async {
    final dto = await _api.iniciarSesion(pin.valor);
    return RespuestaInicio(
      acceso: dto.acceso,
      refresco: dto.refresco,
      usuario: UsuarioSesion(
        id: dto.usuario.id,
        etiqueta: dto.usuario.etiqueta,
      ),
      cuenta: CuentaSesion(
        id: dto.cuenta.id,
        codigo: dto.cuenta.codigo,
        nombre: dto.cuenta.nombre,
      ),
      roles: [
        for (final rol in dto.roles) RolSesion(id: rol.id, nombre: rol.nombre),
      ],
      rolActivoId: dto.rolActivoId,
    );
  }
}

final sesionRepositorioProvider = Provider<SesionRepositorio>(
  (ref) => SesionRepositorioApi(ref.watch(clienteApiProvider)),
);
