import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/anulacion_masiva.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/anulacion_masiva_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_ilustracion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla_completa.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Anular los QR vigentes de mis usuarios (ADR 0033 §3), desde Perfil. Es una
/// pantalla completa con X para salir: lo que se anula no se puede deshacer,
/// así que el motivo es obligatorio y el botón solo responde con motivo
/// escrito. Tras anular, dice cuántos QR se anularon (SnackBar) y vuelve a
/// Perfil.
class AnularQrPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<AnularQrPagina> createState() => _AnularQrPaginaEstado();
}

class _AnularQrPaginaEstado extends ConsumerState<AnularQrPagina> {
  final _motivo = TextEditingController();

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  /// Manda la anulación. Con error, se queda en la pantalla y lo dice; con
  /// éxito, vuelve a Perfil (el SnackBar del messenger raíz sigue en pantalla).
  Future<void> _anular(String motivo) async {
    final l10n = context.l10n;
    final envio = await ref
        .read(anulacionMasivaProvider.notifier)
        .anularMiRama(motivo);
    if (!mounted) return;
    final error = envio.error;
    final texto = error != null
        ? textoDeError(l10n, error)
        : l10n.qrAnulacionMiRamaResultado(envio.resultado?.qrAnulados ?? 0);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
    if (error == null) context.go(Rutas.perfil);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final anulando = ref.watch(anulacionMasivaProvider);
    final motivo = motivoDeAnulacion(_motivo.text);
    return PlantillaPantallaCompleta(
      titulo: l10n.qrAnulacionMiRamaTitulo,
      // Salir mientras se anula dejaría el resultado sin mostrar: se espera.
      alCerrar: () {
        if (!anulando) context.go(Rutas.perfil);
      },
      // En horizontal de teléfono la ilustración tiene su propia columna, así
      // que va grande; en vertical se achica sola para que el motivo y el
      // botón sigan visibles.
      visual: const AccesoIlustracion(ruta: Multimedia.anulacion, grande: true),
      pie: AccesoBoton(
        texto: l10n.qrAnulacionMiRamaConfirmar,
        variante: VarianteBoton.peligroRelleno,
        cargando: anulando,
        expandido: true,
        onPressed: motivo == null || anulando ? null : () => _anular(motivo),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.qrAnulacionMiRamaMensaje),
          SizedBox(height: tokens.espacio.s),
          Text(
            l10n.qrAnulacionMiRamaIrreversible,
            style: textos.bodyMedium?.copyWith(
              color: tokens.colores.textoSecundario,
            ),
          ),
          SizedBox(height: tokens.espacio.xl),
          CampoFormulario(
            etiqueta: l10n.qrAnulacionMiRamaMotivo,
            ayuda: l10n.qrAnulacionMiRamaMotivoAyuda,
            largoActual: _motivo.text.length,
            largoMaximo: maxMotivoDeAnulacion,
            child: AccesoCampoTexto(
              controlador: _motivo,
              maxLargo: maxMotivoDeAnulacion,
              alCambiar: (_) => setState(() {}),
            ),
          ),
        ],
      ),
    );
  }
}
