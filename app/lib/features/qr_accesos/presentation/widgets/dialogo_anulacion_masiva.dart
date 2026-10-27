import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/anulacion_masiva.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/anulacion_masiva_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Abre la confirmación de la anulación masiva de mi rama y, si la persona
/// confirma, anula y dice cuántos QR se anularon. Cancelar o cerrar no llama a
/// la API. Lo llama Perfil (ADR 0033 §3).
Future<void> abrirAnulacionMasiva(BuildContext context, WidgetRef ref) async {
  final l10n = context.l10n;
  final motivo = await showDialog<String>(
    context: context,
    builder: (_) => const DialogoAnulacionMasiva(),
  );
  if (motivo == null || !context.mounted) return;

  final envio = await ref
      .read(anulacionMasivaProvider.notifier)
      .anularMiRama(motivo);
  if (!context.mounted) return;
  final error = envio.error;
  final resultado = envio.resultado;
  final texto = error != null
      ? textoDeError(l10n, error)
      : l10n.qrAnulacionMiRamaResultado(resultado?.qrAnulados ?? 0);
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
}

/// Pide el motivo (obligatorio, hasta 200) y confirma. Devuelve el motivo solo
/// si se confirma; con el motivo vacío, el botón de confirmar no responde.
class DialogoAnulacionMasiva extends StatefulWidget {
  const new({super.key});

  @override
  State<DialogoAnulacionMasiva> createState() => _DialogoAnulacionMasivaState();
}

class _DialogoAnulacionMasivaState extends State<DialogoAnulacionMasiva> {
  final _motivo = TextEditingController();

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final motivo = motivoDeAnulacion(_motivo.text);
    return AlertDialog(
      icon: Align(
        alignment: AlignmentDirectional.centerStart,
        child: CajaIcono(
          icono: Icons.block,
          tono: TonoCaja.peligro,
          tamano: tokens.tamano.accesoRapido,
        ),
      ),
      iconPadding: EdgeInsets.fromLTRB(
        tokens.espacio.xl,
        tokens.espacio.xl,
        tokens.espacio.xl,
        0,
      ),
      title: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Text(l10n.qrAnulacionMiRamaTitulo),
      ),
      // Con el teclado o una pantalla baja, el mensaje y el campo tienen que
      // poder desplazarse; si no, el diálogo se desborda.
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.qrAnulacionMiRamaMensaje),
            SizedBox(height: tokens.espacio.s),
            Text(
              l10n.qrAnulacionMiRamaIrreversible,
              style: textos.bodyMedium?.copyWith(
                color: tokens.colores.textoSecundario,
              ),
            ),
            SizedBox(height: tokens.espacio.l),
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
      ),
      actions: [
        AccesoBoton(
          texto: l10n.comunCancelar,
          variante: VarianteBoton.texto,
          onPressed: () => Navigator.of(context).pop(),
        ),
        AccesoBoton(
          texto: l10n.qrAnulacionMiRamaConfirmar,
          variante: VarianteBoton.peligroRelleno,
          onPressed: motivo == null
              ? null
              : () => Navigator.of(context).pop(motivo),
        ),
      ],
    );
  }
}
