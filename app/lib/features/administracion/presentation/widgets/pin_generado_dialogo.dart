import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:agrocom_acceso/core/plataforma/compartir_texto.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

/// El PIN en mono 32 con "Compartir" (la hoja del sistema; sin ella, queda en
/// el portapapeles) y la advertencia de que solo se ve ahora.
class ContenidoPinGenerado extends ConsumerStatefulWidget {
  const new({required this.pin, this.enDialogo = false, super.key});

  final PinGenerado pin;
  final bool enDialogo;

  @override
  ConsumerState<ContenidoPinGenerado> createState() =>
      _ContenidoPinGeneradoEstado();
}

class _ContenidoPinGeneradoEstado extends ConsumerState<ContenidoPinGenerado> {
  var _compartiendo = false;

  /// Comparte el PIN con el menú del sistema y, si salió, deja registrado que
  /// se compartió (ADR 0028 §7). Si el registro falla no se bloquea nada: el
  /// PIN ya salió y la persona no puede hacer más.
  Future<void> _compartir() async {
    if (_compartiendo) return;
    setState(() => _compartiendo = true);
    try {
      final resultado = await ref
          .read(compartirTextoProvider)
          .compartir(context.l10n.usuariosPinMensajeCompartir(widget.pin.pin));
      final usuarioId = widget.pin.usuarioId;
      final salio =
          resultado == ResultadoCompartir.compartido ||
          resultado == ResultadoCompartir.copiado;
      if (resultado == ResultadoCompartir.copiado && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.usuariosPinCopiadoParaCompartir)),
        );
      }
      if (salio && usuarioId != null) {
        try {
          await ref
              .read(usuariosRepositorioProvider)
              .registrarPinCompartido(usuarioId);
        } on ErrorApi {
          // Sin red o sin permiso: el envío ya ocurrió y no se puede deshacer.
        }
      }
    } finally {
      if (mounted) setState(() => _compartiendo = false);
    }
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
    final botonCompartir = AccesoBoton(
      texto: l10n.usuariosPinCompartir,
      icono: Icons.ios_share,
      variante: VarianteBoton.tonal,
      cargando: _compartiendo,
      onPressed: _compartir,
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
                    botonCompartir,
                  ],
                )
              : Column(
                  children: [
                    Center(child: valor),
                    SizedBox(height: tokens.espacio.l),
                    botonCompartir,
                  ],
                ),
        ),
        SizedBox(height: tokens.espacio.l),
        AccesoAviso(
          texto: pin.esNuevo
              ? l10n.usuariosPinAvisoNuevo
              : l10n.usuariosPinAvisoRegenerado(primerNombre),
        ),
        SizedBox(height: tokens.espacio.m),
        AccesoAviso(texto: l10n.usuariosPinAvisoCompartir),
      ],
    );
  }
}
