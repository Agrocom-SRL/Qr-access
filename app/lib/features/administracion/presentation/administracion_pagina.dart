import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/vista_puertas.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/vista_usuarios.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

enum _Pestana { puertas, usuarios }

/// Administración en compacto (handoff C10a/C10b): Puertas y Usuarios en
/// pestañas. En expandido cada una tiene su destino en el rail.
class AdministracionPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<AdministracionPagina> createState() =>
      _AdministracionPaginaEstado();
}

class _AdministracionPaginaEstado extends ConsumerState<AdministracionPagina> {
  _Pestana? _pestana;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final vePuertas = sesion.tiene(Permisos.supervisarPuertas);
    final veUsuarios = sesion.tiene(Permisos.verUsuarios);
    final pestana =
        _pestana ?? (vePuertas ? _Pestana.puertas : _Pestana.usuarios);
    final puedeCrear = sesion.tiene(Permisos.crearUsuarios);

    // Desde "medio" cada una tiene su destino en el rail (E10a, E10b): sin
    // pestañas ni el título genérico.
    if (!context.esCompacta) {
      return vePuertas ? const PuertasAdminPagina() : const UsuariosPagina();
    }

    return PlantillaAdmin(
      destino: DestinoNav.admin,
      titulo: l10n.adminTitulo,
      accionCompacta: pestana == _Pestana.usuarios && puedeCrear
          ? IconButton(
              tooltip: l10n.usuariosNuevo,
              onPressed: () => context.go(Rutas.adminUsuarioNuevo),
              icon: const Icon(Icons.person_add_outlined),
            )
          : null,
      accion: pestana == _Pestana.usuarios && puedeCrear
          ? AccesoBoton(
              texto: l10n.usuariosNuevo,
              icono: Icons.person_add_outlined,
              onPressed: () => context.go(Rutas.adminUsuarioNuevo),
            )
          : null,
      conRelleno: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (vePuertas && veUsuarios)
            Padding(
              padding: EdgeInsets.fromLTRB(
                tokens.espacio.l,
                tokens.espacio.l,
                tokens.espacio.l,
                0,
              ),
              child: SelectorSegmentado<_Pestana>(
                segmentos: [
                  SegmentoDeSelector(
                    valor: _Pestana.puertas,
                    etiqueta: l10n.navPuertas,
                  ),
                  SegmentoDeSelector(
                    valor: _Pestana.usuarios,
                    etiqueta: l10n.navUsuarios,
                  ),
                ],
                seleccionado: pestana,
                alElegir: (elegida) => setState(() => _pestana = elegida),
              ),
            ),
          Expanded(
            child: pestana == _Pestana.puertas
                ? const VistaPuertas()
                : const VistaUsuarios(),
          ),
        ],
      ),
    );
  }
}

/// Puertas con su propio destino (medio y expandido).
class PuertasAdminPagina extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return PlantillaAdmin(
      destino: DestinoNav.puertas,
      titulo: context.l10n.navPuertas,
      conRelleno: false,
      child: const VistaPuertas(),
    );
  }
}

/// Usuarios con su propio destino (medio y expandido).
class UsuariosPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final puedeCrear = ref
        .watch(sesionControladorProvider)
        .tiene(Permisos.crearUsuarios);
    return PlantillaAdmin(
      destino: DestinoNav.usuarios,
      titulo: l10n.navUsuarios,
      accion: puedeCrear
          ? AccesoBoton(
              texto: l10n.usuariosNuevo,
              icono: Icons.person_add_outlined,
              onPressed: () => context.go(Rutas.adminUsuarioNuevo),
            )
          : null,
      accionCompacta: puedeCrear
          ? IconButton(
              tooltip: l10n.usuariosNuevo,
              onPressed: () => context.go(Rutas.adminUsuarioNuevo),
              icon: const Icon(Icons.person_add_outlined),
            )
          : null,
      conRelleno: false,
      child: const VistaUsuarios(),
    );
  }
}
