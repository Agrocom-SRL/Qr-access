import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/qr_contratos.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/estado_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// QR de acceso de la cuenta (ADR 0008). Los tests lo sustituyen por un fake
/// con el mismo shape que el contrato de la API.
abstract interface class QrAccesosRepositorio {
  /// Emite un QR. El `texto` del token llega solo aquí.
  Future<QrEmitido> emitir(DatosEmision datos, {required DateTime ahora});

  Future<Pagina<QrAcceso>> listar({
    required EstadoQr estado,
    required int pagina,
    required int porPagina,
  });

  /// Cuántos QR hay en cada estado (las pastillas de Mis QR).
  Future<Map<EstadoQr, int>> resumir();

  /// Anula un QR vigente. La API responde `qr.ya_usado` (409) si ya se usó.
  Future<void> anular(String id);
}

class QrAccesosRepositorioApi implements QrAccesosRepositorio {
  const new(this._api, this._almacenQr);

  final ClienteApi _api;
  final AlmacenQr _almacenQr;

  @override
  Future<QrEmitido> emitir(
    DatosEmision datos, {
    required DateTime ahora,
  }) async {
    final dto = await _api.emitirQr(
      puertaIds: datos.puertaIds,
      venceAt: datos.vigencia.venceAtPara(ahora),
      etiqueta: datos.etiqueta,
    );
    // El texto solo existe ahora: se guarda en el dispositivo para poder
    // volver a mostrarlo desde Mis QR (ADR 0008, addendum).
    await _guardarSinFallar(dto.id, dto.texto, dto.venceAt);
    return QrEmitido(
      id: dto.id,
      texto: dto.texto,
      venceAt: dto.venceAt,
      etiqueta: dto.etiqueta,
      puertas: dto.puertas.map(_aPuertaDeQr).toList(),
    );
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
  Future<void> anular(String id) async {
    await _api.anularQr(id);
    // Anulado, el texto ya no abre nada: no tiene sentido conservarlo.
    await _almacenQr.borrar(id);
  }

  /// Guardar el texto es una comodidad: si el almacén falla, el QR se emitió
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

/// El texto guardado en este dispositivo para un QR emitido, o `null` si se
/// emitió en otro dispositivo, ya venció o el almacén no lo tiene.
// ignore: specify_nonobvious_property_types, el tipo de la familia no se exporta.
final textoQrGuardadoProvider = FutureProvider.autoDispose
    .family<String?, String>((ref, id) async {
      try {
        return await ref.watch(almacenQrProvider).leer(id);
      } on Object {
        return null;
      }
    });
