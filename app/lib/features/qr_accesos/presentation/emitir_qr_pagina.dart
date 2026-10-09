import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/emitir_qr_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/estado_qr_vista.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/selector_puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/selector_vigencia.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_error.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Emitir un QR (HU-11): elegir puertas, vigencia y una etiqueta opcional. Al
/// emitirlo, pasa a la pantalla que lo muestra.
class EmitirQrPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<EmitirQrPagina> createState() => _EmitirQrPaginaEstado();
}

class _EmitirQrPaginaEstado extends ConsumerState<EmitirQrPagina> {
  final _etiqueta = TextEditingController();

  @override
  void dispose() {
    _etiqueta.dispose();
    super.dispose();
  }

  Future<void> _emitir() async {
    final qr = await ref.read(emitirQrControladorProvider.notifier).emitir();
    if (qr != null && mounted) context.go(Rutas.qrEmitido, extra: qr);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(emitirQrControladorProvider);
    final controlador = ref.read(emitirQrControladorProvider.notifier);
    final puertas = ref.watch(puertasDisponiblesProvider);
    final errorDatos = estado.errorDatos;
    final errorApi = estado.errorApi;

    return PlantillaPantalla(
      titulo: l10n.qrEmitirTitulo,
      esFormulario: true,
      child: SingleChildScrollView(
        padding: EdgeInsets.all(tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.qrEmitirSeccionPuertas,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            SizedBox(height: tokens.espacio.s),
            puertas.when(
              loading: () => const AccesoCargando(),
              error: (error, _) => EstadoError(
                mensaje: textoDeError(l10n, error),
                alReintentar: () => ref.invalidate(puertasDisponiblesProvider),
              ),
              data: (lista) => lista.isEmpty
                  ? EstadoVacio(
                      icono: Icons.door_front_door_outlined,
                      titulo: l10n.qrEmitirSinPuertas,
                      ayuda: l10n.qrEmitirSinPuertasAyuda,
                    )
                  : SelectorPuertas(
                      puertas: lista,
                      seleccionadas: estado.puertaIds,
                      alAlternar: controlador.alternarPuerta,
                    ),
            ),
            if (errorDatos == ErrorDatosEmision.sinPuertas) ...[
              SizedBox(height: tokens.espacio.xs),
              Text(
                textoErrorDatosEmision(l10n, ErrorDatosEmision.sinPuertas),
                style: TextStyle(color: tokens.colores.peligro),
              ),
            ],
            SizedBox(height: tokens.espacio.xl),
            SelectorVigencia(
              seleccionada: estado.vigencia,
              alElegir: controlador.elegirVigencia,
            ),
            SizedBox(height: tokens.espacio.xl),
            AccesoCampoTexto(
              etiqueta: l10n.qrEmitirEtiqueta,
              ayuda: l10n.qrEmitirEtiquetaAyuda,
              controlador: _etiqueta,
              habilitado: !estado.enviando,
              textoError: errorDatos == ErrorDatosEmision.etiquetaLarga
                  ? textoErrorDatosEmision(
                      l10n,
                      ErrorDatosEmision.etiquetaLarga,
                    )
                  : null,
              alCambiar: controlador.cambiarEtiqueta,
              alEnviar: (_) => _emitir(),
            ),
            if (errorApi != null) ...[
              SizedBox(height: tokens.espacio.m),
              Text(
                textoDeError(l10n, errorApi),
                style: TextStyle(color: tokens.colores.peligro),
                textAlign: TextAlign.center,
              ),
            ],
            SizedBox(height: tokens.espacio.xl),
            AccesoBoton(
              texto: l10n.qrEmitirBoton,
              cargando: estado.enviando,
              onPressed: _emitir,
            ),
          ],
        ),
      ),
    );
  }
}
