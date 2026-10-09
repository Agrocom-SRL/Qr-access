import 'dart:async';

import 'package:agrocom_acceso/core/l10n/idioma.dart';
import 'package:agrocom_acceso/core/l10n/idioma_controlador.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_bandera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Fila "Idioma" de Perfil: la bandera del idioma activo y, al tocarla, una
/// hoja con los idiomas (bandera + su nombre) y la opción de seguir al
/// dispositivo.
class FilaIdioma extends ConsumerWidget {
  const new({this.conSeparador = true, super.key});

  final bool conSeparador;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final activo = Idioma.deCodigo(l10n.localeName) ?? idiomaPorDefecto;
    return FilaClaveValor(
      clave: l10n.perfilIdioma,
      valor: activo.nombre,
      icono: Icons.language,
      invertida: true,
      claveEnfatizada: true,
      conSeparador: conSeparador,
      alTocar: () => _abrir(context),
      accion: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AccesoBandera(idioma: activo),
          SizedBox(width: tokens.espacio.s),
          Icon(
            Icons.chevron_right,
            size: tokens.tamano.iconoNav,
            color: tokens.colores.textoSecundario,
          ),
        ],
      ),
    );
  }

  Future<void> _abrir(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => const _HojaDeIdiomas(),
  );
}

class _HojaDeIdiomas extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final elegido = ref.watch(idiomaProvider);
    final controlador = ref.read(idiomaProvider.notifier);

    void elegir(Idioma? idioma) {
      Navigator.of(context).pop();
      unawaited(controlador.elegir(idioma));
    }

    return SafeArea(
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: tokens.tamano.maxAuth),
          child: Padding(
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
                Text(l10n.perfilIdiomaTitulo, style: textos.titleLarge),
                SizedBox(height: tokens.espacio.s),
                for (final idioma in Idioma.values)
                  _OpcionIdioma(
                    idioma: idioma,
                    elegida: elegido == idioma,
                    alElegir: () => elegir(idioma),
                  ),
                TextButton(
                  onPressed: elegido == null ? null : () => elegir(null),
                  child: Text(l10n.perfilIdiomaSistema),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OpcionIdioma extends StatelessWidget {
  const new({
    required this.idioma,
    required this.elegida,
    required this.alElegir,
  });

  final Idioma idioma;
  final bool elegida;
  final VoidCallback alElegir;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      button: true,
      selected: elegida,
      label: idioma.nombre,
      child: InkWell(
        onTap: alElegir,
        borderRadius: BorderRadius.circular(tokens.radio.m),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: tokens.espacio.m),
          child: Row(
            children: [
              AccesoBandera(idioma: idioma, tamano: tokens.tamano.avatar),
              SizedBox(width: tokens.espacio.l),
              Expanded(
                child: Text(
                  idioma.nombre,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (elegida)
                Icon(
                  Icons.check,
                  color: tokens.colores.primario,
                  size: tokens.tamano.iconoNav,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
