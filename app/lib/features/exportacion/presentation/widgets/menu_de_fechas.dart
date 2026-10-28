import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/exportacion/domain/exportacion.dart';
import 'package:agrocom_acceso/features/exportacion/presentation/exportacion_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/hoja_formulario.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Hasta cuántos años atrás deja elegir el calendario. Es un límite de la
/// pantalla para no hojear décadas, no un tope de la API.
const anosDeHistorialExportable = 5;

/// Abre la hoja de fechas de Exportar accesos: Desde, Hasta y "Quitar fechas".
/// Se abre desde el botón de la barra superior; los cambios se ven al momento
/// en el chip del rango.
Future<void> mostrarMenuDeFechas(BuildContext context) =>
    mostrarHojaFormulario<void>(context, builder: (_) => const _MenuDeFechas());

/// El texto del rango elegido, para el chip. `null` si no hay ninguna fecha.
String? textoDelRango(AppLocalizations l10n, FiltrosDeExportacion filtros) {
  final desde = filtros.desde;
  final hasta = filtros.hasta;
  if (desde != null && hasta != null) {
    return l10n.exportacionRangoAmbas(
      formatearFecha(desde),
      formatearFecha(hasta),
    );
  }
  if (desde != null) return l10n.exportacionRangoDesde(formatearFecha(desde));
  if (hasta != null) return l10n.exportacionRangoHasta(formatearFecha(hasta));
  return null;
}

class _MenuDeFechas extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final filtros = ref.watch(exportacionControladorProvider).filtros;
    final notifier = ref.read(exportacionControladorProvider.notifier);
    final sinFechas = filtros.desde == null && filtros.hasta == null;
    final sinLimite = l10n.exportacionSinLimite;

    return HojaFormulario(
      titulo: l10n.exportacionFechasTitulo,
      acciones: [
        AccesoBoton(
          texto: l10n.exportacionQuitarFechas,
          variante: VarianteBoton.secundaria,
          onPressed: sinFechas
              ? null
              : () {
                  notifier
                    ..elegirDesde(null)
                    ..elegirHasta(null);
                },
        ),
        AccesoBoton(
          texto: l10n.exportacionListo,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilaClaveValor(
            clave: l10n.exportacionDesde,
            valor: filtros.desde == null
                ? sinLimite
                : formatearFecha(filtros.desde!),
            alTocar: () =>
                _elegirDia(context, ref, filtros.desde, notifier.elegirDesde),
          ),
          FilaClaveValor(
            clave: l10n.exportacionHasta,
            valor: filtros.hasta == null
                ? sinLimite
                : formatearFecha(filtros.hasta!),
            alTocar: () =>
                _elegirDia(context, ref, filtros.hasta, notifier.elegirHasta),
            conSeparador: false,
          ),
          if (!rangoValido(filtros)) ...[
            SizedBox(height: tokens.espacio.m),
            AccesoAviso(texto: l10n.exportacionRangoInvalido),
          ],
        ],
      ),
    );
  }
}

/// El calendario de La Paz, entre hoy y cinco años atrás. Devuelve el día
/// elegido como el instante de su medianoche (ver `instanteDeDia`).
Future<void> _elegirDia(
  BuildContext context,
  WidgetRef ref,
  DateTime? actual,
  void Function(DateTime? dia) alElegir,
) async {
  final hoy = horaBolivia(ref.read(relojProvider)());
  final elegido = await showDatePicker(
    context: context,
    initialDate: actual == null ? hoy : horaBolivia(actual),
    firstDate: DateTime(hoy.year - anosDeHistorialExportable),
    lastDate: hoy,
  );
  if (elegido == null) return;
  alElegir(instanteDeDia(elegido));
}
