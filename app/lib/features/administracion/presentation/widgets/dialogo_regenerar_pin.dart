import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/selector_sufijo_pin.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/material.dart';

/// Confirma regenerar el PIN de [nombre] y deja elegir si los 4 últimos
/// caracteres son al azar o los escribe el administrador. Devuelve `null` si
/// se cancela; si se confirma, el sufijo elegido (`null` = al azar).
Future<({String? sufijo})?> pedirRegeneracionDePin(
  BuildContext context, {
  required String nombre,
}) => showDialog<({String? sufijo})>(
  context: context,
  builder: (_) => _DialogoRegenerarPin(nombre: nombre),
);

class _DialogoRegenerarPin extends StatefulWidget {
  const new({required this.nombre});

  final String nombre;

  @override
  State<_DialogoRegenerarPin> createState() => _DialogoRegenerarPinEstado();
}

class _DialogoRegenerarPinEstado extends State<_DialogoRegenerarPin> {
  var _elegir = false;
  var _sufijo = '';
  var _conError = false;

  void _confirmar() {
    if (_elegir && !sufijoDePinValido(_sufijo)) {
      setState(() => _conError = true);
      return;
    }
    Navigator.of(context).pop((sufijo: _elegir ? _sufijo : null));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.usuariosGenerarPinTitulo),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.usuariosGenerarPinMensaje(widget.nombre)),
            SelectorSufijoPin(
              elegir: _elegir,
              sufijo: _sufijo,
              conError: _conError,
              alElegir: (elegir) => setState(() {
                _elegir = elegir;
                _sufijo = '';
                _conError = false;
              }),
              alCambiar: (valor) => setState(() {
                _sufijo = valor;
                _conError = false;
              }),
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
        AccesoBoton(texto: l10n.usuariosGenerarPin, onPressed: _confirmar),
      ],
    );
  }
}
