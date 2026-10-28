import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/sesion/nombre_de_dispositivo.dart';
import 'package:agrocom_acceso/core/sesion/origen_de_sesion.dart';
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
  const new(this._api, this._origen, this._nombre);

  final ClienteApi _api;
  final ProveedorOrigenDeSesion _origen;
  final ProveedorNombreDeDispositivo _nombre;

  @override
  Future<RespuestaInicio> iniciar(Pin pin) async {
    // El origen (instalación y plataforma) viaja con el PIN: la API lo usa
    // para contar aparatos distintos (ADR 0030 §4.1), nunca para decidir el
    // acceso. El nombre del aparato solo sirve para reconocer la sesión en la
    // lista de dispositivos conectados.
    final origen = await _origen.leer();
    final dto = await _api.iniciarSesion(
      pin.valor,
      instalacionId: origen.instalacionId,
      plataforma: origen.plataforma,
      dispositivo: _nombre.leer(),
    );
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
      rolActivoId: dto.rolActivoId,
    );
  }
}

final sesionRepositorioProvider = Provider<SesionRepositorio>(
  (ref) => SesionRepositorioApi(
    ref.watch(clienteApiProvider),
    ref.watch(origenDeSesionProvider),
    ref.watch(nombreDeDispositivoProvider),
  ),
);
