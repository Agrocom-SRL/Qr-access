import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:flutter/material.dart';

/// Largo de `usuarios.etiqueta` en la API.
const largoMaximoNombre = 80;

/// Pide el nuevo nombre del usuario. Devuelve `null` si se cancela o si no
/// cambió.
Future<String?> pedirNombre(BuildContext context, {required String? actual}) =>
    showDialog<String>(
      context: context,
      builder: (_) => _DialogoNombre(actual: actual),
    );

class _DialogoNombre extends StatefulWidget {
  const new({required this.actual});

  final String? actual;

  @override
  State<_DialogoNombre> createState() => _DialogoNombreEstado();
}

class _DialogoNombreEstado extends State<_DialogoNombre> {
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
      title: Text(l10n.perfilEditarNombre),
      content: CampoFormulario(
        etiqueta: l10n.perfilNombreCampo,
        textoError: _vacio ? l10n.perfilNombreError : null,
        child: AccesoCampoTexto(
          controlador: _nombre,
          maxLargo: largoMaximoNombre,
          autofoco: true,
          alCambiar: (_) {
            if (_vacio) setState(() => _vacio = false);
          },
          alEnviar: (_) => _guardar(),
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
