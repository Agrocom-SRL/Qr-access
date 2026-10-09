import 'dart:async';

import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/pin_generado_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/formulario_secciones.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Alta de un usuario (etiqueta y roles → PIN una sola vez) o edición de uno
/// existente (HU-06). Tras guardar una edición, se queda en el formulario.
class UsuarioFormularioPagina extends ConsumerStatefulWidget {
  const new({this.usuarioId, super.key});

  /// `null` para crear.
  final String? usuarioId;

  @override
  ConsumerState<UsuarioFormularioPagina> createState() =>
      _UsuarioFormularioPaginaEstado();
}

class _UsuarioFormularioPaginaEstado
    extends ConsumerState<UsuarioFormularioPagina> {
  final _etiqueta = TextEditingController();
  var _cargado = false;

  bool get _esNuevo => widget.usuarioId == null;

  @override
  void dispose() {
    _etiqueta.dispose();
    super.dispose();
  }

  void _cargarDesde(Usuario usuario) {
    if (_cargado) return;
    _cargado = true;
    _etiqueta.text = usuario.etiqueta ?? '';
    unawaited(
      Future.microtask(
        () => ref.read(formularioUsuarioProvider.notifier).cargar(usuario),
      ),
    );
  }

  Future<void> _guardar() async {
    final controlador = ref.read(formularioUsuarioProvider.notifier);
    if (_esNuevo) {
      final pin = await controlador.crear();
      if (pin != null && mounted) await mostrarPinGenerado(context, pin);
      if (mounted && context.esExpandida && pin != null) {
        context.go(Rutas.adminUsuarios);
      }
      return;
    }
    await controlador.editar(widget.usuarioId!);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(formularioUsuarioProvider);
    final controlador = ref.read(formularioUsuarioProvider.notifier);
    final roles = ref.watch(rolesProvider);
    final errorApi = estado.errorApi;
    final errorDatos = estado.errorDatos;

    if (!_esNuevo && !_cargado) {
      final usuarios = ref.watch(usuariosProvider);
      final usuario = usuarios.value?.datos
          .where((u) => u.id == widget.usuarioId)
          .firstOrNull;
      if (usuario != null) {
        _cargarDesde(usuario);
      } else if (!usuarios.isLoading) {
        return PlantillaAdmin(
          destino: DestinoNav.usuarios,
          titulo: l10n.usuariosEditarTitulo,
          child: EstadoVacio.error(
            titulo: l10n.usuariosErrorCargar,
            alReintentar: () => ref.invalidate(usuariosProvider),
          ),
        );
      } else {
        return PlantillaAdmin(
          destino: DestinoNav.usuarios,
          titulo: l10n.usuariosEditarTitulo,
          child: const AccesoCargando(),
        );
      }
    }

    return PlantillaAdmin(
      destino: DestinoNav.usuarios,
      titulo: _esNuevo ? l10n.usuariosNuevo : l10n.usuariosEditarTitulo,
      conRelleno: false,
      child: FormularioSecciones(
        secciones: [
          SeccionDeFormulario(
            titulo: l10n.usuariosSeccionDatos,
            campos: [
              CampoFormulario(
                etiqueta: l10n.usuariosCampoEtiqueta,
                ayuda: l10n.usuariosCampoEtiquetaAyuda,
                textoError: switch (errorDatos) {
                  ErrorDatosUsuario.sinEtiqueta =>
                    l10n.usuariosErrorSinEtiqueta,
                  ErrorDatosUsuario.etiquetaLarga =>
                    l10n.usuariosErrorEtiquetaLarga(
                      DatosUsuario.largoMaximoEtiqueta,
                    ),
                  _ => null,
                },
                largoActual: estado.etiqueta.length,
                largoMaximo: DatosUsuario.largoMaximoEtiqueta,
                child: AccesoCampoTexto(
                  controlador: _etiqueta,
                  placeholder: l10n.usuariosCampoEtiquetaEjemplo,
                  maxLargo: DatosUsuario.largoMaximoEtiqueta,
                  autofoco: _esNuevo,
                  alCambiar: controlador.cambiarEtiqueta,
                ),
              ),
            ],
          ),
          SeccionDeFormulario(
            titulo: l10n.usuariosSeccionRoles,
            campos: [
              roles.when(
                loading: () => const AccesoCargando(),
                error: (error, _) => AccesoAviso(
                  tono: TonoAviso.peligro,
                  texto: textoDeError(l10n, error),
                ),
                data: (lista) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final rol in lista)
                      CheckboxListTile(
                        value: estado.rolIds.contains(rol.id),
                        onChanged: (_) => controlador.alternarRol(rol.id),
                        title: Text(rol.nombre),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                      ),
                    if (errorDatos == ErrorDatosUsuario.sinRoles)
                      Padding(
                        padding: EdgeInsets.only(top: tokens.espacio.s),
                        child: Text(
                          l10n.usuariosErrorSinRoles,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: tokens.colores.peligro),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
        aviso: errorApi != null
            ? AccesoAviso(
                tono: TonoAviso.peligro,
                texto: textoDeError(l10n, errorApi),
              )
            : (estado.guardado
                  ? AccesoAviso(
                      tono: TonoAviso.primario,
                      texto: l10n.usuariosGuardado,
                    )
                  : (_esNuevo
                        ? AccesoAviso(
                            tono: TonoAviso.informacion,
                            texto: l10n.usuariosNuevoAviso,
                          )
                        : null)),
        acciones: [
          AccesoBoton(
            texto: l10n.comunCancelar,
            variante: VarianteBoton.texto,
            onPressed: () => context.go(Rutas.adminUsuarios),
          ),
          AccesoBoton(
            texto: _esNuevo ? l10n.usuariosGenerarPin : l10n.comunGuardar,
            textoCargando: _esNuevo
                ? l10n.usuariosGenerando
                : l10n.comunGuardando,
            icono: _esNuevo ? Icons.key_outlined : null,
            cargando: estado.enviando,
            onPressed: _guardar,
          ),
        ],
      ),
    );
  }
}
