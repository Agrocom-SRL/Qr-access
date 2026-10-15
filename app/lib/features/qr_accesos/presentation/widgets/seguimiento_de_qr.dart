import 'dart:async';

import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/seguimiento_qr_controlador.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Vigila un QR mientras se muestra: lo consulta a la API cada
/// `refrescoSeguimientoQr` y entrega a [builder] lo último que se sabe, o
/// `null` mientras no hay respuesta. Un fallo de red no borra lo ya sabido: el
/// QR sigue en pantalla y se reintenta en el siguiente ciclo.
class SeguimientoDeQr extends ConsumerStatefulWidget {
  const new({required this.qrId, required this.builder, super.key});

  final String qrId;
  final Widget Function(BuildContext context, SeguimientoQr? seguimiento)
  builder;

  @override
  ConsumerState<SeguimientoDeQr> createState() => _SeguimientoDeQrEstado();
}

class _SeguimientoDeQrEstado extends ConsumerState<SeguimientoDeQr> {
  Timer? _refresco;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _refresco ??= Timer.periodic(
      context.tokens.duracion.refrescoSeguimientoQr,
      (_) => ref.invalidate(seguimientoQrProvider(widget.qrId)),
    );
  }

  @override
  void dispose() {
    _refresco?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final seguimiento = ref.watch(seguimientoQrProvider(widget.qrId)).value;
    return widget.builder(context, seguimiento);
  }
}
