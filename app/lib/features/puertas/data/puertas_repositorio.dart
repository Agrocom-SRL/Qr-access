import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';
import 'package:agrocom_acceso/features/puertas/domain/puerta.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Acceso a las puertas de la cuenta. Los tests lo sustituyen por un fake con
/// el mismo shape que la API.
abstract interface class PuertasRepositorio {
  /// Todas las puertas de la cuenta, recorriendo las páginas.
  Future<List<Puerta>> listarTodas();
}

/// Tamaño de página al listar todo: el máximo que la API acepta por consulta.
const _porPaginaAlListarTodo = 100;

class PuertasRepositorioApi implements PuertasRepositorio {
  const new(this._api);

  final ClienteApi _api;

  @override
  Future<List<Puerta>> listarTodas() async {
    final puertas = <Puerta>[];
    var pagina = 1;
    var totalPaginas = 1;
    do {
      final respuesta = await _api.puertas(
        pagina: pagina,
        porPagina: _porPaginaAlListarTodo,
      );
      final actual = respuesta.aPagina(_aPuerta);
      puertas.addAll(actual.datos);
      totalPaginas = actual.totalPaginas;
      pagina++;
    } while (pagina <= totalPaginas);
    return puertas;
  }
}

Puerta _aPuerta(PuertaDto dto) => Puerta(
  id: dto.id,
  nombre: dto.nombre,
  sitioId: dto.sitio.id,
  sitioNombre: dto.sitio.nombre,
  dispositivo: switch (dto.dispositivo) {
    null => null,
    final d => DispositivoDePuerta(
      id: d.id,
      nombre: d.nombre,
      enLinea: d.enLinea,
      ultimoLatidoAt: d.ultimoLatidoAt,
    ),
  },
);

final puertasRepositorioProvider = Provider<PuertasRepositorio>(
  (ref) => PuertasRepositorioApi(ref.watch(clienteApiProvider)),
);
