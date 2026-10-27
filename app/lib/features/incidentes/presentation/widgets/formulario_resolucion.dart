import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:agrocom_acceso/features/incidentes/presentation/textos_de_incidente.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:flutter/material.dart';

/// La decisión sobre un incidente: qué se decide y, si es confirmar, el motivo
/// (ADR 0033 §4.2). Solo recoge y valida lo que se ve; quien lo usa confirma y
/// manda. Con confirmar y el motivo vacío, no se manda: el error se ve aquí.
class FormularioResolucion extends StatefulWidget {
  const new({required this.guardando, required this.alEnviar, super.key});

  final bool guardando;

  /// Se llama con lo elegido cuando pasa la validación local.
  final void Function(ResultadoDeResolucion resultado, String motivo) alEnviar;

  @override
  State<FormularioResolucion> createState() => _FormularioResolucionState();
}

class _FormularioResolucionState extends State<FormularioResolucion> {
  final _motivo = TextEditingController();
  ResultadoDeResolucion _decision = ResultadoDeResolucion.pendiente;

  /// Hasta que se intenta guardar, el motivo vacío no se marca: no se regaña
  /// antes de tiempo.
  bool _intentado = false;

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  void _enviar() {
    setState(() => _intentado = true);
    if (!puedeGuardarResolucion(resultado: _decision, motivo: _motivo.text)) {
      return;
    }
    widget.alEnviar(_decision, _motivo.text);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final faltaMotivo =
        _intentado &&
        !puedeGuardarResolucion(resultado: _decision, motivo: _motivo.text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SelectorSegmentado<ResultadoDeResolucion>(
          segmentos: [
            for (final resultado in ResultadoDeResolucion.values)
              SegmentoDeSelector(
                valor: resultado,
                etiqueta: textoDeDecision(l10n, resultado),
              ),
          ],
          seleccionado: _decision,
          alElegir: (resultado) => setState(() => _decision = resultado),
        ),
        SizedBox(height: tokens.espacio.m),
        CampoFormulario(
          etiqueta: l10n.incidenteResolverMotivo,
          ayuda: l10n.incidenteResolverMotivoAyuda,
          textoError: faltaMotivo
              ? l10n.incidenteResolverMotivoRequerido
              : null,
          largoActual: _motivo.text.length,
          largoMaximo: maxMotivoDeResolucion,
          child: AccesoCampoTexto(
            controlador: _motivo,
            maxLargo: maxMotivoDeResolucion,
            habilitado: !widget.guardando,
            alCambiar: (_) => setState(() {}),
          ),
        ),
        SizedBox(height: tokens.espacio.l),
        AccesoBoton(
          texto: l10n.incidenteResolverGuardar,
          textoCargando: l10n.incidenteResolverGuardando,
          cargando: widget.guardando,
          expandido: true,
          onPressed: _enviar,
        ),
      ],
    );
  }
}
