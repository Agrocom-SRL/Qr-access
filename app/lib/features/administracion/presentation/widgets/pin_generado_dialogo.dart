import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

/// Muestra el PIN una sola vez: en compacto a pantalla completa (C10c), en
/// expandido en un diálogo (E10b). El PIN no se guarda en el cliente.
Future<void> mostrarPinGenerado(BuildContext context, PinGenerado pin) async {
  if (context.esExpandida) {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (contexto) => AlertDialog(
        title: Text(contexto.l10n.usuariosPinGeneradoTitulo),
        content: SizedBox(
          width: contexto.tokens.tamano.maxFormularioSecciones,
          child: ContenidoPinGenerado(pin: pin, enDialogo: true),
        ),
        actions: [
          AccesoBoton(
            texto: contexto.l10n.usuariosPinListo,
            onPressed: () => Navigator.of(contexto).pop(),
          ),
        ],
      ),
    );
    return;
  }
  context.go(Rutas.adminPinGenerado, extra: pin);
}

/// El PIN en mono 32 con "Copiar" (que pasa a "Copiado" 2 s) y la advertencia
/// de que solo se ve ahora.
class ContenidoPinGenerado extends StatefulWidget {
  const new({required this.pin, this.enDialogo = false, super.key});

  final PinGenerado pin;
  final bool enDialogo;

  @override
  State<ContenidoPinGenerado> createState() => _ContenidoPinGeneradoEstado();
}

class _ContenidoPinGeneradoEstado extends State<ContenidoPinGenerado> {
  var _copiado = false;

  Future<void> _copiar() async {
    await Clipboard.setData(ClipboardData(text: widget.pin.pin));
    if (!mounted) return;
    setState(() => _copiado = true);
    await Future<void>.delayed(context.tokens.duracion.confirmacionCopiado);
    if (mounted) setState(() => _copiado = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final pin = widget.pin;
    final nombre = pin.usuarioEtiqueta ?? l10n.qrSinEtiqueta;
    final roles = pin.roles.map((r) => r.nombre).join(' · ');
    final primerNombre = AccesoAvatar.primerNombre(nombre);

    final valor = Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: pin.codigoDeCuenta,
            style: TextStyle(color: colores.textoSecundario),
          ),
          const TextSpan(text: ' '),
          TextSpan(text: pin.clave),
        ],
      ),
      style: tokens.tipografia
          .mono(
            tokens.tipografia.t32,
            peso: tokens.tipografia.semiNegrita,
            color: colores.texto,
          )
          .copyWith(letterSpacing: tokens.tipografia.espaciadoPin),
      semanticsLabel: l10n.usuariosPinSemantica(pin.pin),
    );
    final botonCopiar = AccesoBoton(
      texto: _copiado ? l10n.comunCopiado : l10n.comunCopiar,
      icono: _copiado ? Icons.check : Icons.content_copy_outlined,
      variante: VarianteBoton.tonal,
      onPressed: _copiar,
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.enDialogo)
          Text(
            l10n.usuariosPinPara(nombre, roles),
            style: textos.bodyMedium?.copyWith(color: colores.textoSecundario),
          )
        else ...[
          Text(
            l10n.usuariosPinParaRotulo,
            style: textos.bodyMedium?.copyWith(color: colores.textoSecundario),
          ),
          Text(nombre, style: textos.headlineMedium),
          Text(
            roles,
            style: textos.bodyLarge?.copyWith(color: colores.textoSecundario),
          ),
        ],
        SizedBox(height: tokens.espacio.xl),
        AccesoTarjeta(
          color: widget.enDialogo ? colores.fondo : null,
          relleno: EdgeInsets.all(tokens.espacio.xl),
          child: widget.enDialogo
              ? Row(
                  children: [
                    Expanded(child: valor),
                    SizedBox(width: tokens.espacio.l),
                    botonCopiar,
                  ],
                )
              : Column(
                  children: [
                    Center(child: valor),
                    SizedBox(height: tokens.espacio.l),
                    botonCopiar,
                  ],
                ),
        ),
        SizedBox(height: tokens.espacio.l),
        AccesoAviso(
          texto: pin.esNuevo
              ? l10n.usuariosPinAvisoNuevo
              : l10n.usuariosPinAvisoRegenerado(primerNombre),
        ),
      ],
    );
  }
}
