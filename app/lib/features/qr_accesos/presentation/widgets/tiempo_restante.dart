import 'dart:async';

import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Unidad en que se muestra lo que le queda a un QR.
enum UnidadRestante { dias, horas, minutos }

/// Desde cuántas horas restantes se cuenta en días (2 días).
const horasParaContarEnDias = 48;

/// Lo que le queda a un QR, en una sola unidad y sin segundos:
///
/// - de 2 días en adelante, en **días** (1 día y medio ya se cuenta en horas);
/// - menos de 2 días y desde 1 hora, en **horas**;
/// - menos de 1 hora, en **minutos** (nunca menos de 1).
///
/// No es una cuenta regresiva: solo avisa cuánto tiempo de validez queda.
({UnidadRestante unidad, int cantidad}) tiempoRestante(
  DateTime venceAt,
  DateTime ahora,
) {
  final resto = venceAt.difference(ahora);
  if (resto.inHours >= horasParaContarEnDias) {
    return (unidad: UnidadRestante.dias, cantidad: resto.inDays);
  }
  if (resto.inHours >= 1) {
    return (unidad: UnidadRestante.horas, cantidad: resto.inHours);
  }
  final minutos = (resto.inSeconds / 60).ceil();
  // Entre 1 y 59: faltando 59 min 30 s se ve "59", no "60 minutos".
  return (unidad: UnidadRestante.minutos, cantidad: minutos.clamp(1, 59));
}

/// "Válido por 3 días", "Válido por 5 horas" o "Válido por 20 minutos"; se
/// actualiza solo cada 30 s para que el minuto no se quede viejo.
class TiempoRestante extends ConsumerStatefulWidget {
  const new({required this.venceAt, super.key});

  final DateTime venceAt;

  @override
  ConsumerState<TiempoRestante> createState() => _TiempoRestanteEstado();
}

class _TiempoRestanteEstado extends ConsumerState<TiempoRestante> {
  Timer? _refresco;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _refresco ??= Timer.periodic(
      context.tokens.duracion.refrescoTiempoRestante,
      (_) => setState(() {}),
    );
  }

  @override
  void dispose() {
    _refresco?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final ahora = ref.read(relojProvider)();
    final (:unidad, :cantidad) = tiempoRestante(widget.venceAt, ahora);
    final texto = switch (unidad) {
      UnidadRestante.dias => l10n.qrValidezDias(cantidad),
      UnidadRestante.horas => l10n.qrValidezHoras(cantidad),
      UnidadRestante.minutos => l10n.qrValidezMinutos(cantidad),
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.timer_outlined,
          size: tokens.tamano.icono,
          color: tokens.colores.textoSecundario,
        ),
        SizedBox(width: tokens.espacio.xs),
        Flexible(
          child: Text(
            texto,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: tokens.colores.textoSecundario),
          ),
        ),
      ],
    );
  }
}
