import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/domain/cupo.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Cuánto del cupo de usuarios del plan usa la cuenta y el aviso al 80 % y al
/// 100 % (ADR 0028 §6). Lo ve solo el Administrador, con el total de la cuenta
/// aunque solo gestione su rama. Si no se puede leer, no se muestra: no es
/// información de la que dependa nada más en la pantalla.
class BannerCupo extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cupo = ref.watch(cupoProvider).value;
    if (cupo == null) return const SizedBox.shrink();
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final maximo = cupo.maximo;
    final fraccion = maximo == null || maximo <= 0
        ? null
        : (cupo.usados / maximo).clamp(0, 1).toDouble();
    final colorBarra = switch (cupo.aviso) {
      AvisoCupo.limiteAlcanzado => tokens.colores.peligro,
      AvisoCupo.cercaDelLimite => tokens.colores.advertencia,
      null => tokens.colores.primario,
    };

    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.espacio.l,
        tokens.espacio.l,
        tokens.espacio.l,
        0,
      ),
      child: AccesoTarjeta(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.cupoTitulo, style: textos.titleMedium),
            Text(
              maximo == null
                  ? l10n.cupoSinLimite(cupo.usados)
                  : l10n.cupoUsados(cupo.usados, maximo),
              style: textos.bodyMedium?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
            ),
            if (fraccion != null) ...[
              SizedBox(height: tokens.espacio.s),
              ClipRRect(
                borderRadius: BorderRadius.circular(tokens.radio.s),
                child: LinearProgressIndicator(
                  value: fraccion,
                  minHeight: tokens.tamano.barraUso,
                  color: colorBarra,
                  backgroundColor: tokens.colores.borde,
                ),
              ),
            ],
            if (cupo.aviso != null) ...[
              SizedBox(height: tokens.espacio.m),
              AccesoAviso(
                tono: cupo.aviso == AvisoCupo.limiteAlcanzado
                    ? TonoAviso.peligro
                    : TonoAviso.advertencia,
                texto: cupo.aviso == AvisoCupo.limiteAlcanzado
                    ? l10n.cupoAvisoLimite
                    : l10n.cupoAvisoCerca,
              ),
            ],
            SizedBox(height: tokens.espacio.s),
            Text(
              l10n.cupoMaximoMiembros(cupo.maxMiembrosPorTitular),
              style: textos.bodySmall?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
