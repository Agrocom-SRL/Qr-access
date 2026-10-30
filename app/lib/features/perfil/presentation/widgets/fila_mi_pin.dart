import 'dart:async';

import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/plataforma/almacen_pin.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// "Mi PIN" en Perfil: el PIN con el que se ingresó, oculto, con un ojo para
/// verlo unos segundos y un botón para copiarlo. Sirve para entrar en otro
/// dispositivo cuando se olvidó. No aparece en web (no se guarda allí).
class FilaMiPin extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<FilaMiPin> createState() => _FilaMiPinState();
}

class _FilaMiPinState extends ConsumerState<FilaMiPin> {
  bool _mostrado = false;
  Timer? _tapar;

  @override
  void dispose() {
    _tapar?.cancel();
    super.dispose();
  }

  void _alternar() {
    _tapar?.cancel();
    setState(() => _mostrado = !_mostrado);
    if (_mostrado) {
      _tapar = Timer(context.tokens.duracion.pinVisible, () {
        if (mounted) setState(() => _mostrado = false);
      });
    }
  }

  Future<void> _copiar(String pin) async {
    await Clipboard.setData(ClipboardData(text: pin));
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(context.l10n.perfilMiPinCopiado)));
  }

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(almacenPinProvider).disponible) {
      return const SizedBox.shrink();
    }
    final l10n = context.l10n;
    final tokens = context.tokens;
    final pin = ref.watch(pinGuardadoProvider).value;
    final estiloPin = tokens.tipografia.mono(
      tokens.tipografia.t16,
      color: tokens.colores.texto,
    );
    return FilaClaveValor(
      clave: l10n.perfilMiPin,
      icono: Icons.pin_outlined,
      invertida: true,
      claveEnfatizada: true,
      valorWidget: pin == null
          ? Text(
              l10n.perfilMiPinNoGuardado,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: tokens.colores.textoSecundario),
            )
          : Text(_mostrado ? pin : '\u2022' * pin.length, style: estiloPin),
      accion: pin == null
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: _mostrado
                      ? l10n.perfilMiPinOcultar
                      : l10n.perfilMiPinMostrar,
                  onPressed: _alternar,
                  icon: Icon(
                    _mostrado
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                  ),
                ),
                IconButton(
                  tooltip: l10n.perfilMiPinCopiar,
                  onPressed: () => _copiar(pin),
                  icon: const Icon(Icons.copy_outlined),
                ),
              ],
            ),
    );
  }
}
