import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/router.dart';
import 'package:agrocom_acceso/core/theme/tema.dart';
import 'package:agrocom_acceso/core/theme/tema_controlador.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Raíz de la app: tema claro y oscuro (el que elija la persona en Perfil, o
/// el del sistema), textos del ARB y el router con la guarda de sesión.
class AccesoApp extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      onGenerateTitle: (context) => context.l10n.appTitulo,
      theme: Tema.claro,
      darkTheme: Tema.oscuro,
      themeMode: ref.watch(temaProvider),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: ref.watch(routerProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
