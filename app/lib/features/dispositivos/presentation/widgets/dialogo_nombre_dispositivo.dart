import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:flutter/material.dart';

/// Pide el nombre de este dispositivo. Devuelve el nombre nuevo (recortado) o
/// `null` si se cancela, si queda vacío o si no cambió. Vacío no se manda: el
/// diálogo lo marca y sigue abierto.
Future<String?> pedirNombreDispositivo(
  BuildContext context, {
  required String? actual,
}) => showDialog<String>(
  context: context,
  builder: (_) => _DialogoNombreDispositivo(actual: actual),
);

class _DialogoNombreDispositivo extends StatefulWidget {
  const new({required this.actual});

  final String? actual;

  @override
  State<_DialogoNombreDispositivo> createState() =>
      _DialogoNombreDispositivoEstado();
}

class _DialogoNombreDispositivoEstado extends State<_DialogoNombreDispositivo> {
  late final _nombre = TextEditingController(text: widget.actual);
  var _vacio = false;

  @override
  void dispose() {
    _nombre.dispose();
    super.dispose();
  }

  void _guardar() {
    final nombre = _nombre.text.trim();
    if (nombre.isEmpty) {
      setState(() => _vacio = true);
      return;
    }
    Navigator.of(context).pop(nombre == widget.actual ? null : nombre);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.dispositivosRenombrarTitulo),
      content: SingleChildScrollView(
        child: CampoFormulario(
          etiqueta: l10n.dispositivosRenombrarCampo,
          ayuda: l10n.dispositivosRenombrarAyuda,
          textoError: _vacio ? l10n.dispositivosRenombrarVacio : null,
          child: AccesoCampoTexto(
            controlador: _nombre,
            maxLargo: largoMaximoNombreDispositivo,
            autofoco: true,
            alCambiar: (_) {
              if (_vacio) setState(() => _vacio = false);
            },
            alEnviar: (_) => _guardar(),
          ),
        ),
      ),
      actions: [
        AccesoBoton(
          texto: l10n.comunCancelar,
          variante: VarianteBoton.texto,
          onPressed: () => Navigator.of(context).pop(),
        ),
        AccesoBoton(texto: l10n.comunGuardar, onPressed: _guardar),
      ],
    );
  }
}
