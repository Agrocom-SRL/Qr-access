import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/vencimiento_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:flutter/material.dart';

/// Resumen con `FilaClaveValor` (paso 3 en compacto; fijo a la derecha en
/// expandido): puertas, sitio, vence, etiqueta y usos.
class ResumenEmision extends StatelessWidget {
  const new({
    required this.puertas,
    required this.seleccionadas,
    required this.vigencia,
    required this.etiqueta,
    required this.ahora,
    this.titulo,
    this.pie,
    super.key,
  });

  final List<Puerta> puertas;
  final Set<String> seleccionadas;
  final Vigencia vigencia;
  final String etiqueta;
  final DateTime ahora;

  /// "Resumen" en el panel lateral; sin título en el paso 3.
  final String? titulo;

  /// Botón del panel lateral (Siguiente / Emitir QR).
  final Widget? pie;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final elegidas = puertas
        .where((p) => seleccionadas.contains(p.id))
        .toList();
    final sitios = elegidas.map((p) => p.sitioNombre).toSet();
    final vence = vigencia.venceAtPara(ahora);
    final textoVencimiento = vence == null
        ? l10n.comunHoyALas(l10n.qrFinDelDiaHora)
        : textoHoraCorta(l10n, vence, ahora);
    return AccesoTarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (titulo != null) ...[
            Text(titulo!, style: textos.titleMedium),
            SizedBox(height: tokens.espacio.s),
          ],
          FilaClaveValor(
            clave: l10n.qrResumenPuertas,
            valorWidget: elegidas.isEmpty
                ? Text(
                    l10n.comunNinguna,
                    style: textos.bodyMedium?.copyWith(
                      color: tokens.colores.textoSecundario,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      for (final puerta in elegidas)
                        Text(puerta.nombre, style: textos.titleMedium),
                    ],
                  ),
          ),
          if (sitios.isNotEmpty)
            FilaClaveValor(
              clave: l10n.qrResumenSitio,
              valor: sitios.join(' · '),
            ),
          FilaClaveValor(
            clave: l10n.qrResumenVence,
            valor: textoVencimiento,
            valorMono: true,
          ),
          FilaClaveValor(
            clave: l10n.qrEmitirEtiqueta,
            valor: etiqueta.trim().isEmpty ? l10n.comunGuion : etiqueta.trim(),
          ),
          FilaClaveValor(
            clave: l10n.qrResumenUsos,
            valor: l10n.qrResumenUnSoloUso,
            conSeparador: pie != null,
          ),
          if (pie != null) ...[SizedBox(height: tokens.espacio.l), pie!],
        ],
      ),
    );
  }
}
