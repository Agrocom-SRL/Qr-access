import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/domain/nivel_usuario.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Los roles que quien está creando puede dar, para elegir uno (ADR 0028 §3):
/// el Administrador crea Titulares y Guardias; el Titular crea solo Miembros y
/// no ve selector. Es
/// presentación: la API vuelve a comprobarlo y responde 403 si no corresponde.
class SelectorDeRol extends ConsumerWidget {
  const new({required this.conError, super.key});

  /// Se eligió nada y se intentó guardar.
  final bool conError;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final roles = ref.watch(rolesProvider);
    final elegido = ref.watch(formularioUsuarioProvider.select((e) => e.rol));
    final sesion = ref.watch(sesionControladorProvider);
    final nivelDelActor = sesion is SesionAutenticada
        ? nivelDeRol(sesion.rolActivo.nombre)
        : null;

    return roles.when(
      loading: () => const AccesoCargando(),
      error: (error, _) => AccesoAviso(
        tono: TonoAviso.peligro,
        texto: textoDeError(l10n, error),
      ),
      data: (lista) {
        final asignables = [
          for (final rol in lista)
            if (puedeCrearNivel(nivelDelActor, nivelDeRol(rol.nombre))) rol,
        ];
        if (asignables.isEmpty) {
          return AccesoAviso(
            tono: TonoAviso.informacion,
            texto: l10n.usuariosSinRolesParaCrear,
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            RadioGroup<String>(
              groupValue: elegido?.id,
              onChanged: (id) {
                final rol = asignables.where((r) => r.id == id).firstOrNull;
                if (rol != null) {
                  ref.read(formularioUsuarioProvider.notifier).elegirRol(rol);
                }
              },
              child: Column(
                children: [
                  for (final rol in asignables)
                    RadioListTile<String>(
                      value: rol.id,
                      title: Text(rol.nombre),
                      subtitle: _descripcionDe(l10n, rol),
                      contentPadding: EdgeInsets.zero,
                    ),
                ],
              ),
            ),
            if (conError)
              Padding(
                padding: EdgeInsets.only(top: tokens.espacio.s),
                child: Text(
                  l10n.usuariosErrorSinRoles,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: tokens.colores.peligro),
                ),
              ),
          ],
        );
      },
    );
  }
}

Widget? _descripcionDe(AppLocalizations l10n, Rol rol) =>
    switch (nivelDeRol(rol.nombre)) {
      NivelUsuario.titular => Text(l10n.usuariosRolDescripcionTitular),
      NivelUsuario.guardia => Text(l10n.usuariosRolDescripcionGuardia),
      NivelUsuario.miembro => Text(l10n.usuariosRolDescripcionMiembro),
      _ => null,
    };
