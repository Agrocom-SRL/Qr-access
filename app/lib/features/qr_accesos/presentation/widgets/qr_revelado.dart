import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/visor_qr.dart';
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Revela el QR recién emitido: primero el Lottie `qr_emitido` una vez (1 s)
/// en el mismo espacio que ocupa el [VisorQr], y luego el QR con un
/// `AnimatedSwitcher` de 300 ms. Con "reducir movimiento" muestra el QR de
/// inmediato. El visor no lleva nada encima: el QR se lee limpio.
class QrRevelado extends StatefulWidget {
  const new({required this.texto, super.key});

  /// Token del QR (`AQ1.<token>`), tal como lo recibe [VisorQr].
  final String texto;

  @override
  State<QrRevelado> createState() => _QrReveladoEstado();
}

class _QrReveladoEstado extends State<QrRevelado>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controlador = AnimationController(vsync: this)
    ..addStatusListener((estado) {
      if (estado == AnimationStatus.completed && mounted) {
        setState(() => _reproducido = true);
      }
    });
  var _iniciado = false;
  var _reproducido = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_iniciado) return;
    _iniciado = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _reproducido = true;
      return;
    }
    _controlador.duration = context.tokens.duracion.segundo;
    _controlador.forward();
  }

  @override
  void dispose() {
    _controlador.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    // Mismo espacio que el visor: el QR más su zona de silencio.
    final lado =
        (context.esExpandida
            ? tokens.tamano.qrExpandido
            : tokens.tamano.qrMinimo) +
        2 * tokens.tamano.qrZonaSilencio;
    return AnimatedSwitcher(
      duration: tokens.duracion.efectiva(context, tokens.duracion.lenta),
      switchInCurve: tokens.duracion.curva,
      switchOutCurve: tokens.duracion.curva,
      child: _reproducido
          ? VisorQr(key: const ValueKey('qr'), texto: widget.texto)
          : ExcludeSemantics(
              key: const ValueKey('animacion'),
              child: SizedBox.square(
                dimension: lado,
                child: Lottie.asset(
                  Multimedia.lottieQrEmitido,
                  controller: _controlador,
                  fit: BoxFit.contain,
                  // Si el Lottie no carga, se pasa al QR sin esperar.
                  errorBuilder: (_, _, _) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) setState(() => _reproducido = true);
                    });
                    return const SizedBox.shrink();
                  },
                ),
              ),
            ),
    );
  }
}
