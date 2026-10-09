import 'dart:async';

import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/sesion/presentation/ingreso_controlador.dart';
import 'package:agrocom_acceso/features/sesion/presentation/widgets/formateador_pin.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Inicio de sesión con el PIN de acceso (ADR 0018). La página solo compone y
/// delega en `IngresoControlador`.
class IngresoPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<IngresoPagina> createState() => _IngresoPaginaEstado();
}

class _IngresoPaginaEstado extends ConsumerState<IngresoPagina> {
  final _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  /// Lanza el envío; la pantalla muestra el resultado desde el controlador.
  void _ingresar() {
    unawaited(
      ref.read(ingresoControladorProvider.notifier).ingresar(_pin.text),
    );
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(ingresoControladorProvider);
    final l10n = context.l10n;
    final tokens = context.tokens;
    final errorApi = estado.errorApi;
    final textoError = estado.pinInvalido
        ? l10n.sesionPinFormatoInvalido
        : (errorApi == null ? null : textoDeError(l10n, errorApi));

    return PlantillaAuth(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.sesionIngresoTitulo,
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          SizedBox(height: tokens.espacio.s),
          Text(
            l10n.sesionIngresoAyuda,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: tokens.colores.textoSecundario),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: tokens.espacio.xl),
          AccesoCampoTexto(
            etiqueta: l10n.sesionCampoPin,
            controlador: _pin,
            formateadores: const [FormateadorPin()],
            teclado: TextInputType.visiblePassword,
            ocultar: true,
            habilitado: !estado.enviando,
            textoError: textoError,
            accionTeclado: TextInputAction.go,
            alEnviar: (_) => _ingresar(),
          ),
          SizedBox(height: tokens.espacio.xl),
          AccesoBoton(
            texto: l10n.sesionBotonIngresar,
            cargando: estado.enviando,
            onPressed: _ingresar,
          ),
        ],
      ),
    );
  }
}
