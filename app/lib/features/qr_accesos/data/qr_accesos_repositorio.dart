import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/api/cliente_api.dart';
import 'package:agrocom_acceso/core/api/contratos/puertas_contratos.dart';
import 'package:agrocom_acceso/core/api/contratos/qr_contratos.dart';
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
    final dto = await _api.generarQr(
      puertaIds: datos.puertaIds,
      venceAt: datos.vigencia.venceAtPara(ahora),
      etiqueta: datos.etiqueta,
      propio: datos.propio,
    );
    // El texto solo existe ahora: se guarda en el dispositivo para poder
    // volver a mostrarlo desde Mis QR (ADR 0008, addendum).
    await _guardarSinFallar(dto.id, dto.texto, dto.venceAt);
    final generado = QrGenerado(
      id: dto.id,
      texto: dto.texto,
      venceAt: dto.venceAt,
      etiqueta: dto.etiqueta,
      puertas: dto.puertas.map(_aPuertaDeQr).toList(),
    );
    if (datos.propio) await _guardarPropioSinFallar(generado);
    return generado;
  }

  @override
  Future<QrGenerado?> ultimoPropioGuardado() async {
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
        respaldo: true,
      );
    } on Object {
      return null;
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
