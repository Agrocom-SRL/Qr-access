import 'package:agrocom_acceso/app.dart';
import 'package:agrocom_acceso/core/api/api_providers.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Las ilustraciones SVG quedan en caché antes del primer estado vacío.
  await Multimedia.precachearIlustraciones();
  runApp(
    ProviderScope(
      overrides: [
        // La sesión guarda los tokens y el cliente HTTP los usa (ver core/api).
        proveedorTokensProvider.overrideWith(
          (ref) => ref.read(sesionControladorProvider.notifier),
        ),
        // La caché sin conexión se separa por usuario y rol (invariante 1).
        ambitoCacheProvider.overrideWith(
          (ref) =>
              () => switch (ref.read(sesionControladorProvider)) {
                SesionAutenticada(:final usuario, :final rolActivo) =>
                  '${usuario.id}:${rolActivo.id}',
                _ => null,
              },
        ),
      ],
      child: const AccesoApp(),
    ),
  );
}
