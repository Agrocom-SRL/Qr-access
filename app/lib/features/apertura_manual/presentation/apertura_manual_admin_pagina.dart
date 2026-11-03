import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/apertura_manual/domain/apertura_manual.dart';
import 'package:agrocom_acceso/features/apertura_manual/presentation/apertura_manual_admin_controlador.dart';
import 'package:agrocom_acceso/features/apertura_manual/presentation/apertura_manual_providers.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_interruptor.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// El administrador de la cuenta enciende o apaga la apertura sin QR (ADR 0035
/// §5): en todas las puertas con el interruptor general, o en cada una. Una
/// puerta sin placa no tiene nada que encender: dice "Sin placa".
class AperturaManualAdminPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final puertas = ref.watch(puertasAbriblesProvider);
    final cambio = ref.watch(aperturaManualAdminProvider);
    final controlador = ref.read(aperturaManualAdminProvider.notifier);

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.aperturaManualTitulo,
      rutaAtras: Rutas.perfil,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.perfil),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AccesoAviso(
            tono: TonoAviso.informacion,
            texto: l10n.aperturaManualAyuda,
          ),
          if (cambio.hasError) ...[
            SizedBox(height: tokens.espacio.m),
            AccesoAviso(
              tono: TonoAviso.peligro,
              texto: textoDeError(l10n, cambio.error!),
            ),
          ],
          SizedBox(height: tokens.espacio.l),
          puertas.when(
            loading: () => Padding(
              padding: EdgeInsets.all(tokens.espacio.xl),
              child: const AccesoCargando(),
            ),
            error: (error, _) => EstadoVacio.error(
              titulo: textoDeError(l10n, error),
              alReintentar: () => ref.invalidate(puertasAbriblesProvider),
            ),
            data: (lista) => _Interruptores(
              puertas: lista,
              ocupado: cambio.isLoading,
              alCambiarCuenta: controlador.cuenta,
              alCambiarPuerta: (puerta, {required habilitada}) =>
                  controlador.puerta(puerta.id, habilitada: habilitada),
            ),
          ),
        ],
      ),
    );
  }
}

class _Interruptores extends StatelessWidget {
  const new({
    required this.puertas,
    required this.ocupado,
    required this.alCambiarCuenta,
    required this.alCambiarPuerta,
  });

  final List<PuertaAbrible> puertas;
  final bool ocupado;
  final void Function({required bool habilitada}) alCambiarCuenta;
  final void Function(PuertaAbrible puerta, {required bool habilitada})
  alCambiarPuerta;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    // El general muestra "encendido" si todas las puertas lo están; al tocarlo
    // la API fija todas las puertas y el valor de las que se registren.
    final todas = puertas.isNotEmpty && puertas.every((p) => p.habilitada);
    return AccesoTarjeta(
      relleno: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
      child: Column(
        children: [
          FilaClaveValor(
            clave: l10n.aperturaManualTodas,
            valor: l10n.aperturaManualTodasEstado(
              puertas.where((p) => p.habilitada).length,
              puertas.length,
            ),
            icono: Icons.lock_open,
            invertida: true,
            claveEnfatizada: true,
            accion: AccesoInterruptor(
              activo: todas,
              etiqueta: l10n.aperturaManualTodas,
              alCambiar: ocupado
                  ? null
                  : (valor) => alCambiarCuenta(habilitada: valor),
            ),
          ),
          for (final puerta in puertas)
            FilaClaveValor(
              clave: puerta.nombre,
              valor: _estadoDe(l10n, puerta),
              icono: Icons.door_front_door_outlined,
              invertida: true,
              claveEnfatizada: true,
              accion: puerta.tienePlaca
                  ? AccesoInterruptor(
                      activo: puerta.habilitada,
                      etiqueta: puerta.nombre,
                      alCambiar: ocupado
                          ? null
                          : (valor) =>
                                alCambiarPuerta(puerta, habilitada: valor),
                    )
                  : AccesoBadge(
                      texto: l10n.aperturaManualSinPlaca,
                      tono: TonoAcceso.neutro,
                    ),
              conSeparador: puerta != puertas.last,
            ),
        ],
      ),
    );
  }
}

/// La segunda línea de una puerta: dónde está y si la apertura está encendida;
/// sin placa, por qué no se puede encender.
String _estadoDe(AppLocalizations l10n, PuertaAbrible puerta) {
  if (!puerta.tienePlaca) return l10n.aperturaManualSinPlacaAyuda;
  final estado = puerta.habilitada
      ? l10n.aperturaManualEncendida
      : l10n.aperturaManualApagada;
  return '${puerta.sitioNombre} · $estado';
}
