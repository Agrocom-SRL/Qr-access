import 'package:agrocom_acceso/app.dart';
import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  runApp(
    ProviderScope(
      overrides: [
        // La sesión guarda los tokens y el cliente HTTP los usa (ver core/api).
        proveedorTokensProvider.overrideWith(
          (ref) => ref.read(sesionControladorProvider.notifier),
        ),
      ],
      child: const AccesoApp(),
    ),
  );
}
