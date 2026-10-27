import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/qr_contratos.dart';
import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show FutureProviderFamily;

/// QR de acceso de la cuenta (ADR 0008). Los tests lo sustituyen por un fake
/// con el mismo shape que el contrato de la API.
abstract interface class QrAccesosRepositorio {
  /// Genera un QR. El `texto` del token llega solo aquí.
  Future<QrGenerado> generar(DatosGeneracion datos, {required DateTime ahora});

  Future<Pagina<QrAcceso>> listar({
    required EstadoQr estado,
    required int pagina,
    required int porPagina,
  });

  /// Cuántos QR hay en cada estado (las pastillas de Mis QR).
  Future<Map<EstadoQr, int>> resumir();

  /// El último QR propio generado con conexión, guardado en este dispositivo
  /// como respaldo sin internet; `null` si no hay o ya venció.
  Future<QrGenerado?> ultimoPropioGuardado();

  /// Reabre "Mi QR" sin generar nada (ADR 0030 §2.1.2): si el QR propio
  /// guardado en este dispositivo sigue vigente y sin usar, y es para
  /// [puertaIds], lo devuelve con su token. Si ya se usó, venció o se anuló, lo
  /// olvida y devuelve `null`. Sin red lanza `sinConexion`: la pantalla usa el
  /// respaldo.
  Future<QrGenerado?> reanudarPropio(List<String> puertaIds);

  /// Qué pasó con un QR: su estado y el último intento de lectura.
  Future<SeguimientoQr> seguir(String id);

  /// Anula un QR vigente. La API responde `qr.ya_usado` (409) si ya se usó.
  Future<void> anular(String id);
}

class QrAccesosRepositorioApi implements QrAccesosRepositorio {
  const new(this._api, this._almacenQr);

  final ClienteApi _api;
  final AlmacenQr _almacenQr;

  @override
  Future<QrGenerado> generar(
    DatosGeneracion datos, {
    required DateTime ahora,
  }) async {
    var dto = await _pedirQr(datos, ahora: ahora);
    if (dto.reutilizado && dto.texto == null) {
      // Hay un QR propio vigente para estas puertas, pero su token no está en
      // este dispositivo (reinstalación u otro teléfono). Se pide reemplazarlo
      // una sola vez: el anterior queda anulado (ADR 0030 §2.1.3).
      dto = await _pedirQr(datos, ahora: ahora, reemplazar: true);
    }
    final texto = dto.texto;
    // Con `reemplazar` la API siempre genera; si no lo hace, el contrato
    // está roto.
    if (texto == null) throw const ErrorApi(code: ErrorApi.desconocido);
    // El texto solo existe ahora: se guarda en el dispositivo para poder
    // volver a mostrarlo desde Mis QR (ADR 0008, addendum).
    await _guardarSinFallar(dto.id, texto, dto.venceAt);
    final generado = QrGenerado(
      id: dto.id,
      texto: texto,
      venceAt: dto.venceAt,
      etiqueta: dto.etiqueta,
      puertas: dto.puertas.map(_aPuertaDeQr).toList(),
    );
    if (datos.propio) await _guardarPropioSinFallar(generado);
    return generado;
  }

  Future<QrGeneradoDto> _pedirQr(
    DatosGeneracion datos, {
    required DateTime ahora,
    bool reemplazar = false,
  }) => _api.generarQr(
    puertaIds: datos.puertaIds,
    venceAt: datos.vigencia.venceAtPara(ahora),
    etiqueta: datos.etiqueta,
    propio: datos.propio,
    reemplazar: reemplazar,
  );

  @override
  Future<QrGenerado?> ultimoPropioGuardado() =>
      _leerPropioLocal(respaldo: true);

  @override
  Future<QrGenerado?> reanudarPropio(List<String> puertaIds) async {
    final guardado = await _leerPropioLocal(respaldo: false);
    // Otras puertas: este QR no sirve para la petición; generar lo reemplaza.
    if (guardado == null || !_mismasPuertas(guardado.puertas, puertaIds)) {
      return null;
    }
    final SeguimientoQr seguimiento;
    try {
      seguimiento = await seguir(guardado.id);
    } on ErrorApi catch (error) {
      // Sin red se propaga: la pantalla muestra el respaldo sin generar nada.
      if (error.code != 'qr.no_encontrado') rethrow;
      await _descartarPropio(guardado.id);
      return null;
    }
    if (seguimiento.estado == EstadoQr.vigente) return guardado;
    // Usado, vencido o anulado: ya no abre nada, así que se olvida el token.
    await _descartarPropio(guardado.id);
    return null;
  }

  /// El QR propio guardado en este dispositivo, o `null` si no hay o si el
  /// almacén no se puede leer (el respaldo es una comodidad, no un requisito).
  Future<QrGenerado?> _leerPropioLocal({required bool respaldo}) async {
    try {
      final qr = await _almacenQr.leerUltimoPropio();
      if (qr == null) return null;
      return QrGenerado(
        id: qr.id,
        texto: qr.texto,
        venceAt: qr.venceAt,
        etiqueta: qr.etiqueta,
        puertas: [
          for (final p in qr.puertas) PuertaDeQr(id: p.id, nombre: p.nombre),
        ],
        respaldo: respaldo,
      );
    } on Object {
      return null;
    }
  }

  static bool _mismasPuertas(List<PuertaDeQr> delQr, List<String> puertaIds) =>
      delQr.length == puertaIds.toSet().length &&
      delQr.every((p) => puertaIds.contains(p.id));

  Future<void> _descartarPropio(String id) async {
    try {
      await _almacenQr.borrar(id);
      await _almacenQr.borrarUltimoPropio(id);
    } on Object {
      // Sin borrar, el token caduca solo al vencer: no bloquea generar otro.
    }
  }

  @override
  Future<Pagina<QrAcceso>> listar({
    required EstadoQr estado,
    required int pagina,
    required int porPagina,
  }) async {
    final respuesta = await _api.qrAccesos(
      estado: estado.valorApi,
      pagina: pagina,
      porPagina: porPagina,
    );
    return respuesta.aPagina(_aQrAcceso);
  }

  @override
  Future<Map<EstadoQr, int>> resumir() async {
    final dto = await _api.resumenQr();
    return {
      EstadoQr.vigente: dto.vigentes,
      EstadoQr.usado: dto.usados,
      EstadoQr.vencido: dto.vencidos,
      EstadoQr.anulado: dto.anulados,
    };
  }

  @override
  Future<SeguimientoQr> seguir(String id) async {
    final dto = await _api.estadoQr(id);
    final intento = dto.ultimoIntento;
    return SeguimientoQr(
      estado: EstadoQr.desdeApi(dto.estado),
      ultimoIntento: intento == null
          ? null
          : IntentoQr(
              ocurridoAt: intento.ocurridoAt,
              permitido: intento.resultado == 'permitido',
              motivoCode: intento.motivoCode,
              puertaNombre: intento.puerta.nombre,
            ),
    );
  }

  @override
  Future<void> anular(String id) async {
    await _api.anularQr(id);
    // Anulado, el texto ya no abre nada: no tiene sentido conservarlo.
    await _almacenQr.borrar(id);
    await _almacenQr.borrarUltimoPropio(id);
  }

  /// Respaldo sin internet (ADR 0008): cada QR propio generado con conexión
  /// reemplaza al anterior. Si el almacén falla, el QR se generó igual.
  Future<void> _guardarPropioSinFallar(QrGenerado qr) async {
    try {
      await _almacenQr.guardarUltimoPropio(
        QrPropioGuardado(
          id: qr.id,
          texto: qr.texto,
          venceAt: qr.venceAt,
          etiqueta: qr.etiqueta,
          puertas: [for (final p in qr.puertas) (id: p.id, nombre: p.nombre)],
        ),
      );
    } on Object {
      // Sin respaldo, sin internet simplemente no habrá QR que mostrar.
    }
  }

  /// Guardar el texto es una comodidad: si el almacén falla, el QR se generó
  /// igual y se muestra y comparte como siempre.
  Future<void> _guardarSinFallar(
    String id,
    String texto,
    DateTime venceAt,
  ) async {
    try {
      await _almacenQr.guardar(id, texto, venceAt);
    } on Object {
      // Sin almacén, "Ver QR" simplemente no aparecerá para este QR.
    }
  }

  QrAcceso _aQrAcceso(QrAccesoDto dto) => QrAcceso(
    id: dto.id,
    etiqueta: dto.etiqueta,
    estado: EstadoQr.desdeApi(dto.estado),
    venceAt: dto.venceAt,
    usadoAt: dto.usadoAt,
    anuladoAt: dto.anuladoAt,
    creadoAt: dto.creadoAt,
    puertas: dto.puertas.map(_aPuertaDeQr).toList(),
  );
}

PuertaDeQr _aPuertaDeQr(ReferenciaDto dto) =>
    PuertaDeQr(id: dto.id, nombre: dto.nombre);

final qrAccesosRepositorioProvider = Provider<QrAccesosRepositorio>(
  (ref) => QrAccesosRepositorioApi(
    ref.watch(clienteApiProvider),
    ref.watch(almacenQrProvider),
  ),
);

/// El texto guardado en este dispositivo para un QR generado, o `null` si se
/// generó en otro dispositivo, ya venció o el almacén no lo tiene.
final FutureProviderFamily<String?, String> textoQrGuardadoProvider =
    FutureProvider.autoDispose.family<String?, String>((ref, id) async {
      try {
        return await ref.watch(almacenQrProvider).leer(id);
      } on Object {
        return null;
      }
    });
