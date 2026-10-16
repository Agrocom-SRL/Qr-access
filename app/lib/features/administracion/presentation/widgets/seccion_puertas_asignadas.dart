import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Las puertas de la cuenta para asignárselas a un usuario: todas, o las que
/// se marquen. De ellas ve los eventos un guardia.
class SeccionPuertasAsignadas extends ConsumerWidget {
  const new({
    required this.asignadas,
    required this.alAlternarTodas,
    required this.alAlternarPuerta,
    super.key,
  });

  final PuertasAsignadas asignadas;
  final void Function({required bool todas}) alAlternarTodas;
  final ValueChanged<String> alAlternarPuerta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final puertas = ref.watch(puertasDisponiblesProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.usuariosPuertasAyuda,
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(color: tokens.colores.textoSecundario),
        ),
        CheckboxListTile(
          value: asignadas.todas,
          onChanged: (valor) => alAlternarTodas(todas: valor ?? false),
          title: Text(l10n.usuariosPuertasTodas),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          visualDensity: VisualDensity.compact,
        ),
        puertas.when(
          loading: () => const AccesoCargando(),
          error: (error, _) => AccesoAviso(
            tono: TonoAviso.peligro,
            texto: textoDeError(l10n, error),
          ),
          data: (lista) => lista.isEmpty
              ? Text(l10n.usuariosPuertasSinPuertas)
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final puerta in lista)
                      CheckboxListTile(
                        value:
                            asignadas.todas ||
                            asignadas.puertaIds.contains(puerta.id),
                        onChanged: asignadas.todas
                            ? null
                            : (_) => alAlternarPuerta(puerta.id),
                        title: Text(puerta.nombre),
                        subtitle: Text(puerta.sitioNombre),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
