import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_seleccionable.dart';
import 'package:flutter/material.dart';

/// Paso 2 (handoff C05b): un selector Horas | Días. En horas, un bloque corto
/// (1, 2, 4, 8 h), uno largo (12, 16, 20, 24 h) y una hora exacta que se elige
/// con el reloj (2 h por defecto); en días, 2, 3, 5 o 7 días o "todo el día".
/// Debajo, la etiqueta opcional (máx. 40).
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
    final opcion = vigencia.opcion;
    final enDias = opcion.esDeDias;
    final venceExacto = vigencia.venceAtPara(ahora);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.qrEmitirVigencia, style: textos.titleLarge),
        SizedBox(height: tokens.espacio.m),
        SelectorSegmentado<bool>(
          segmentos: [
            SegmentoDeSelector(
              valor: false,
              etiqueta: l10n.qrVigenciaModoHoras,
            ),
            SegmentoDeSelector(valor: true, etiqueta: l10n.qrVigenciaModoDias),
          ],
          seleccionado: enDias,
          // Al cambiar de modo se pasa al valor por defecto de ese modo.
          alElegir: (dias) {
            if (dias != enDias) {
              alElegir(
                dias
                    ? const Vigencia(OpcionVigencia.dosDias)
                    : Vigencia.porDefecto,
              );
            }
          },
        ),
        SizedBox(height: tokens.espacio.m),
        if (enDias) ...[
          _TarjetaPlazos(
            titulo: l10n.qrVigenciaModoDias,
            plazos: OpcionVigencia.enDias,
            vigencia: vigencia,
            seleccionada: OpcionVigencia.enDias.contains(opcion),
            alElegir: alElegir,
          ),
          SizedBox(height: tokens.espacio.m),
          TarjetaSeleccionable(
            titulo: l10n.qrVigenciaFinDelDia,
            subtitulo: l10n.qrVenceHoyALas(l10n.qrFinDelDiaHora),
            seleccionada: opcion == OpcionVigencia.finDelDia,
            alElegir: () => alElegir(const Vigencia(OpcionVigencia.finDelDia)),
          ),
        ] else ...[
          _TarjetaPlazos(
            titulo: l10n.qrVigenciaCorta,
            plazos: OpcionVigencia.corta,
            vigencia: vigencia,
            seleccionada: opcion.esCorta,
            alElegir: alElegir,
          ),
          SizedBox(height: tokens.espacio.m),
          _TarjetaPlazos(
            titulo: l10n.qrVigenciaLarga,
            plazos: OpcionVigencia.larga,
            vigencia: vigencia,
            seleccionada: opcion.esLarga,
            alElegir: alElegir,
          ),
          SizedBox(height: tokens.espacio.m),
          TarjetaSeleccionable(
            titulo: l10n.qrVigenciaPersonalizada,
            subtitulo: l10n.qrVigenciaPersonalizadaAyuda,
            seleccionada: opcion == OpcionVigencia.horaExacta,
            alElegir: () => _elegirHora(context),
            etiquetaDerecha:
                opcion == OpcionVigencia.horaExacta && venceExacto != null
                ? AccesoBadge(
                    texto: formatearHora(venceExacto),
                    tono: TonoAcceso.primario,
                  )
                : Icon(Icons.schedule, size: tokens.tamano.icono),
          ),
        ],
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

/// Tarjeta con un grupo de plazos en horas; tocar la tarjeta elige el primero.
class _TarjetaPlazos extends StatelessWidget {
  const new({
    required this.titulo,
    required this.plazos,
    required this.vigencia,
    required this.seleccionada,
    required this.alElegir,
  });

  final String titulo;
  final List<OpcionVigencia> plazos;
  final Vigencia vigencia;
  final bool seleccionada;
  final ValueChanged<Vigencia> alElegir;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return TarjetaSeleccionable(
      titulo: titulo,
      seleccionada: seleccionada,
      alElegir: () => alElegir(Vigencia(plazos.first)),
      child: Wrap(
        spacing: tokens.espacio.s,
        runSpacing: tokens.espacio.s,
        children: [
          for (final plazo in plazos)
            _Pastilla(
              texto: plazo.dias != null
                  ? l10n.qrVigenciaDias(plazo.dias!)
                  : l10n.qrVigenciaHoras(plazo.horas!),
              elegida: vigencia.opcion == plazo,
              alElegir: () => alElegir(Vigencia(plazo)),
            ),
        ],
      ),
    );
  }
}

class _Pastilla extends StatelessWidget {
  const new({
    required this.texto,
    required this.elegida,
    required this.alElegir,
  });

  final String texto;
  final bool elegida;
  final VoidCallback alElegir;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    return ChoiceChip(
      label: Text(texto),
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
