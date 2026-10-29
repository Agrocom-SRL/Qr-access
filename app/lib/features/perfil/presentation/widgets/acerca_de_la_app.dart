import 'package:agrocom_acceso/core/config/info_app.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/documento_legal_pagina.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Fila "Acerca de la app" de Perfil: al tocarla abre una hoja con el nombre,
/// la organización y la versión instalada, y al pie el crédito al equipo de
/// desarrollo con el copyright.
class FilaAcercaDeLaApp extends StatelessWidget {
  const new({this.conSeparador = true, super.key});

  final bool conSeparador;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return FilaClaveValor(
      clave: l10n.perfilAcercaTitulo,
      valor: l10n.perfilAcercaNombre,
      icono: Icons.info_outline,
      invertida: true,
      claveEnfatizada: true,
      conSeparador: conSeparador,
      alTocar: () => _abrir(context),
      accion: Icon(
        Icons.chevron_right,
        size: tokens.tamano.iconoNav,
        color: tokens.colores.textoSecundario,
      ),
    );
  }

  Future<void> _abrir(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => const _HojaAcercaDe(),
  );
}

class _HojaAcercaDe extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    // La versión es informativa: si la plataforma no la entrega, va un guion.
    final version = ref.watch(infoAppProvider).value?.version;
    final anio = ref.read(relojProvider)().year;
    final secundario = textos.bodySmall?.copyWith(
      color: tokens.colores.textoSecundario,
    );
    return SafeArea(
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: tokens.tamano.maxAuth),
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              tokens.espacio.l,
              0,
              tokens.espacio.l,
              tokens.espacio.l,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(l10n.perfilAcercaTitulo, style: textos.titleLarge),
                SizedBox(height: tokens.espacio.s),
                FilaClaveValor(
                  clave: l10n.perfilAcercaNombreEtiqueta,
                  valor: l10n.perfilAcercaNombre,
                ),
                FilaClaveValor(
                  clave: l10n.perfilAcercaOrganizacionEtiqueta,
                  valor: l10n.perfilAcercaOrganizacion,
                ),
                FilaClaveValor(
                  clave: l10n.perfilAcercaVersionEtiqueta,
                  valor: version ?? l10n.comunGuion,
                ),
                // Los documentos legales se abren dentro de la app (en el
                // teléfono) para poder volver sin salir de ella.
                FilaClaveValor(
                  clave: l10n.perfilAcercaTerminos,
                  icono: Icons.description_outlined,
                  invertida: true,
                  claveEnfatizada: true,
                  alTocar: () => abrirDocumentoLegal(
                    context,
                    titulo: l10n.perfilAcercaTerminos,
                    ruta: rutaTerminos,
                  ),
                  accion: const Icon(Icons.chevron_right),
                ),
                FilaClaveValor(
                  clave: l10n.perfilAcercaPrivacidad,
                  icono: Icons.privacy_tip_outlined,
                  invertida: true,
                  claveEnfatizada: true,
                  conSeparador: false,
                  alTocar: () => abrirDocumentoLegal(
                    context,
                    titulo: l10n.perfilAcercaPrivacidad,
                    ruta: rutaPrivacidad,
                  ),
                  accion: const Icon(Icons.chevron_right),
                ),
                SizedBox(height: tokens.espacio.l),
                Text(
                  l10n.perfilAcercaDesarrollo,
                  textAlign: TextAlign.center,
                  style: secundario,
                ),
                SizedBox(height: tokens.espacio.xs),
                Text(
                  l10n.perfilAcercaDerechos(anio),
                  textAlign: TextAlign.center,
                  style: secundario,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
