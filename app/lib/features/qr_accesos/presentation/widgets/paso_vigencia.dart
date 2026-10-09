import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_seleccionable.dart';
import 'package:flutter/material.dart';

/// Paso 2 (handoff C05b): "Hasta el fin del día" por defecto, o "Más corto"
/// con 1 h, 4 h u hora; y la etiqueta opcional (máx. 40).
class PasoVigencia extends StatelessWidget {
  const new({
    required this.vigencia,
    required this.alElegir,
    required this.etiqueta,
    required this.controladorEtiqueta,
    required this.alCambiarEtiqueta,
    required this.textoError,
    required this.ahora,
    super.key,
  });

  final Vigencia vigencia;
  final ValueChanged<Vigencia> alElegir;
  final String etiqueta;
  final TextEditingController controladorEtiqueta;
  final ValueChanged<String> alCambiarEtiqueta;
  final String? textoError;
  final DateTime ahora;

  Future<void> _elegirHora(BuildContext context) async {
    final local = ahora.toLocal();
    final inicial = vigencia.minutosDelDia;
    final hora = await showTimePicker(
      context: context,
      initialTime: inicial == null
          ? TimeOfDay(hour: local.hour, minute: local.minute)
          : TimeOfDay(hour: inicial ~/ 60, minute: inicial % 60),
    );
    if (hora == null) return;
    alElegir(
      Vigencia(
        OpcionVigencia.horaExacta,
        minutosDelDia: hora.hour * 60 + hora.minute,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final masCorta = vigencia.opcion.esMasCorta;
    final venceExacto = vigencia.venceAtPara(ahora);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.qrEmitirVigencia, style: textos.titleLarge),
        SizedBox(height: tokens.espacio.m),
        TarjetaSeleccionable(
          titulo: l10n.qrVigenciaFinDelDia,
          subtitulo: l10n.qrVenceHoyALas(l10n.qrFinDelDiaHora),
          seleccionada: !masCorta,
          alElegir: () => alElegir(Vigencia.porDefecto),
          etiquetaDerecha: AccesoBadge(
            texto: l10n.qrVigenciaPorDefecto,
            tono: TonoAcceso.primario,
          ),
        ),
        SizedBox(height: tokens.espacio.m),
        TarjetaSeleccionable(
          titulo: l10n.qrVigenciaMasCorta,
          seleccionada: masCorta,
          alElegir: () => alElegir(const Vigencia(OpcionVigencia.unaHora)),
          child: Wrap(
            spacing: tokens.espacio.s,
            runSpacing: tokens.espacio.s,
            children: [
              _Pastilla(
                texto: l10n.qrVigenciaUnaHora,
                elegida: vigencia.opcion == OpcionVigencia.unaHora,
                alElegir: () =>
                    alElegir(const Vigencia(OpcionVigencia.unaHora)),
              ),
              _Pastilla(
                texto: l10n.qrVigenciaCuatroHoras,
                elegida: vigencia.opcion == OpcionVigencia.cuatroHoras,
                alElegir: () =>
                    alElegir(const Vigencia(OpcionVigencia.cuatroHoras)),
              ),
              _Pastilla(
                texto:
                    vigencia.opcion == OpcionVigencia.horaExacta &&
                        venceExacto != null
                    ? formatearHora(venceExacto)
                    : l10n.qrVigenciaHora,
                icono: Icons.schedule,
                elegida: vigencia.opcion == OpcionVigencia.horaExacta,
                alElegir: () => _elegirHora(context),
              ),
            ],
          ),
        ),
        SizedBox(height: tokens.espacio.xl),
        CampoFormulario(
          etiqueta: l10n.qrEmitirEtiqueta,
          opcional: true,
          ayuda: l10n.qrEmitirEtiquetaAyuda,
          textoError: textoError,
          largoActual: etiqueta.length,
          largoMaximo: DatosEmision.largoMaximoEtiqueta,
          child: AccesoCampoTexto(
            controlador: controladorEtiqueta,
            placeholder: l10n.qrEmitirEtiquetaEjemplo,
            maxLargo: DatosEmision.largoMaximoEtiqueta,
            alCambiar: alCambiarEtiqueta,
          ),
        ),
      ],
    );
  }
}

class _Pastilla extends StatelessWidget {
  const new({
    required this.texto,
    required this.elegida,
    required this.alElegir,
    this.icono,
  });

  final String texto;
  final bool elegida;
  final VoidCallback alElegir;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    return ChoiceChip(
      label: Text(texto),
      avatar: icono == null
          ? null
          : Icon(
              icono,
              size: tokens.tamano.icono,
              color: elegida ? colores.sobrePrimario : colores.texto,
            ),
      selected: elegida,
      onSelected: (_) => alElegir(),
      showCheckmark: false,
      selectedColor: colores.primario,
      backgroundColor: colores.superficie,
      side: BorderSide(color: elegida ? colores.primario : colores.borde),
      shape: const StadiumBorder(),
      labelStyle: tokens.tipografia.mono(
        tokens.tipografia.t16,
        color: elegida ? colores.sobrePrimario : colores.texto,
      ),
      padding: EdgeInsets.symmetric(
        horizontal: tokens.espacio.m,
        vertical: tokens.espacio.m,
      ),
    );
  }
}
