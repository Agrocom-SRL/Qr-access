import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/sesion_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/usuarios_contratos.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/features/administracion/domain/cupo.dart';
import 'package:agrocom_acceso/features/administracion/domain/estadisticas_usuarios.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Usuarios y roles de la cuenta (HU-06). Los tests lo sustituyen por un
/// fake con el shape del contrato.
abstract interface class UsuariosRepositorio {
  Future<Pagina<Usuario>> listar({required int pagina, required int porPagina});
  Future<List<Rol>> roles();

  /// Crea el usuario; el PIN llega solo acá.
  Future<PinGenerado> crear(DatosUsuario datos);

  /// Solo cambia el nombre: el rol define el nivel y no se edita (ADR 0028).
  Future<Usuario> editar(String id, {required String etiqueta});

  /// Con `confirmar` la baja es en cascada (un Titular arrastra a sus
  /// Miembros). Sin él, quien tiene a otros a su cargo responde
  /// `usuario.con_dependientes`.
  Future<void> eliminar(String id, {bool confirmar = false});

  /// Anota en la bitácora que el PIN del usuario se compartió por un canal de
  /// terceros. No cambia el PIN ni obliga a cambiarlo (ADR 0028 §7).
  Future<void> registrarPinCompartido(String usuarioId);

  /// El uso del cupo de usuarios del plan (solo lo ve el Administrador).
  Future<Cupo> cupo();

  /// Inactivos, ruidosos y Titulares cerca del tope en la rama de quien
  /// pregunta (solo lo ve el Administrador).
  Future<EstadisticasDeUsuarios> estadisticas();

  /// Regenera el PIN: el anterior deja de servir.
  Future<PinGenerado> generarPin(Usuario usuario, {String? sufijo});

  Future<PuertasAsignadas> puertasAsignadas(String usuarioId);
  Future<void> asignarPuertas(String usuarioId, PuertasAsignadas puertas);
}

class UsuariosRepositorioApi implements UsuariosRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<Pagina<Usuario>> listar({
    required int pagina,
    required int porPagina,
  }) async {
    final respuesta = await _api.usuarios(pagina: pagina, porPagina: porPagina);
    return respuesta.aPagina(_aUsuario);
  }

  @override
  Future<List<Rol>> roles() async => (await _api.roles()).map(_aRol).toList();

  @override
  Future<PinGenerado> crear(DatosUsuario datos) async {
    final dto = await _api.crearUsuario(
      etiqueta: datos.etiqueta,
      rolId: datos.rolId,
      unidadSitioId: datos.unidad?.sitioId,
      unidadNombre: datos.unidad?.nombre,
      sufijo: datos.sufijoDePin,
    );
    return PinGenerado(
      usuarioId: dto.usuario.id,
      pin: dto.pin,
      usuarioEtiqueta: dto.usuario.etiqueta,
      roles: dto.usuario.roles.map(_aRol).toList(),
      esNuevo: true,
    );
  }

  @override
  Future<Usuario> editar(String id, {required String etiqueta}) async =>
      _aUsuario(await _api.editarUsuario(id, etiqueta: etiqueta));

  @override
  Future<void> eliminar(String id, {bool confirmar = false}) =>
      _api.eliminarUsuario(id, confirmar: confirmar);

  @override
  Future<void> registrarPinCompartido(String usuarioId) =>
      _api.registrarPinCompartido(usuarioId);

  @override
  Future<EstadisticasDeUsuarios> estadisticas() async {
    final dto = await _api.estadisticasDeUsuarios();
    return EstadisticasDeUsuarios(
      ventanaDias: dto.ventanaDias,
      umbralInactivoDias: dto.umbralInactivoDias,
      umbralRuidosoPorDia: dto.umbralRuidosoPorDia,
      usuarios: [
        for (final u in dto.usuarios)
          UsoDeUsuario(
            id: u.id,
            etiqueta: u.etiqueta,
            rol: u.rol,
            unidad: u.unidad,
            qrEmitidos: u.qrEmitidos,
            qrUsados: u.qrUsados,
            maxQrEnUnDia: u.maxQrEnUnDia,
            ultimoQrAt: u.ultimoQrAt,
            inactivo: u.inactivo,
            ruidoso: u.ruidoso,
          ),
      ],
      titulares: [
        for (final t in dto.titulares)
          TitularConMiembros(
            id: t.id,
            etiqueta: t.etiqueta,
            unidad: t.unidad,
            miembros: t.miembros,
            tope: t.tope,
            porcentaje: t.porcentaje,
            cercaDelTope: t.cercaDelTope,
          ),
      ],
    );
  }

  @override
  Future<Cupo> cupo() async {
    final dto = await _api.cupo();
    return Cupo(
      usados: dto.usados,
      maximo: dto.maximo,
      porcentaje: dto.porcentaje,
      aviso: switch (dto.aviso) {
        'cerca_del_limite' => AvisoCupo.cercaDelLimite,
        'limite_alcanzado' => AvisoCupo.limiteAlcanzado,
        _ => null,
      },
      maxMiembrosPorTitular: dto.maxMiembrosPorTitular,
    );
  }

  @override
  Future<PinGenerado> generarPin(Usuario usuario, {String? sufijo}) async {
    final dto = await _api.generarPin(usuario.id, sufijo: sufijo);
    return PinGenerado(
      usuarioId: usuario.id,
      pin: dto.pin,
      usuarioEtiqueta: usuario.etiqueta,
      roles: usuario.roles,
      esNuevo: false,
    );
  }

  @override
  Future<PuertasAsignadas> puertasAsignadas(String usuarioId) async {
    final dto = await _api.puertasAsignadas(usuarioId);
    return PuertasAsignadas(todas: dto.todas, puertaIds: dto.puertaIds.toSet());
  }

  @override
  Future<void> asignarPuertas(String usuarioId, PuertasAsignadas puertas) =>
      _api.asignarPuertas(
        usuarioId,
        todas: puertas.todas,
        puertaIds: puertas.todas ? const [] : puertas.puertaIds.toList(),
      );
}

Rol _aRol(RolDto dto) => Rol(id: dto.id, nombre: dto.nombre);

Usuario _aUsuario(UsuarioAdminDto dto) => Usuario(
  id: dto.id,
  etiqueta: dto.etiqueta,
  activo: dto.activo,
  roles: dto.roles.map(_aRol).toList(),
  unidad: dto.unidad == null
      ? null
      : UnidadUsuario(
          id: dto.unidad!.id,
          nombre: dto.unidad!.nombre,
          sitioId: dto.unidad!.sitioId,
        ),
  pinGeneradoAt: dto.pinGeneradoAt,
  ultimoIngresoAt: dto.ultimoIngresoAt,
  creadoAt: dto.creadoAt,
);

final usuariosRepositorioProvider = Provider<UsuariosRepositorio>(
  (ref) => UsuariosRepositorioApi(ref.watch(clienteApiProvider)),
);
