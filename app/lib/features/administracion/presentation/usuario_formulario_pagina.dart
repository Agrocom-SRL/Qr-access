import 'dart:async';

import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/data/usuarios_repositorio.dart';
import 'package:agrocom_acceso/features/administracion/domain/nivel_usuario.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/pestana_admin.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/pin_generado_dialogo.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/seccion_puertas_asignadas.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/seccion_unidad.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/selector_de_rol.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/selector_sufijo_pin.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/chip_etiqueta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/formulario_secciones.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Alta de un usuario (etiqueta, rol y, para un Titular, su unidad → PIN una
/// sola vez) o edición de uno existente (HU-06, ADR 0028). El rol define el
/// nivel y no se edita: al editar solo cambian el nombre y las puertas. Tras
/// guardar una edición vuelve a la lista de usuarios con el aviso de "Cambios
/// guardados".
class UsuarioFormularioPagina extends ConsumerStatefulWidget {
  const new({this.usuarioId, super.key});

  /// `null` para crear.
  final String? usuarioId;

  @override
  ConsumerState<UsuarioFormularioPagina> createState() =>
      _UsuarioFormularioPaginaEstado();
}

/// Texto del aviso que nombra un campo con error: falta, o no cumple el
/// formato o el largo.
String _textoDeFalta(AppLocalizations l10n, ErrorDatosUsuario error) =>
    switch (error) {
      ErrorDatosUsuario.sinEtiqueta => l10n.usuariosFaltaCampo(
        l10n.usuariosCampoEtiqueta,
      ),
      ErrorDatosUsuario.sinRol => l10n.usuariosFaltaCampo(
        l10n.usuariosSeccionRoles,
      ),
      ErrorDatosUsuario.sinPropiedad => l10n.usuariosFaltaCampo(
        l10n.usuariosCampoPropiedad,
      ),
      ErrorDatosUsuario.sinNombreDeUnidad => l10n.usuariosFaltaCampo(
        l10n.usuariosCampoUnidad,
      ),
      ErrorDatosUsuario.etiquetaLarga => l10n.usuariosRevisaCampo(
        l10n.usuariosCampoEtiqueta,
      ),
      ErrorDatosUsuario.nombreDeUnidadLargo => l10n.usuariosRevisaCampo(
        l10n.usuariosCampoUnidad,
      ),
      ErrorDatosUsuario.sufijoInvalido => l10n.usuariosRevisaCampo(
        l10n.usuariosPinSufijoCampo,
      ),
    };

class _UsuarioFormularioPaginaEstado
    extends ConsumerState<UsuarioFormularioPagina> {
  final _etiqueta = TextEditingController();
  final _unidad = TextEditingController();
  var _cargado = false;

  /// Una clave por sección con campos: al fallar, la pantalla baja hasta el
  /// primer campo que falta.
  final GlobalKey _claveEtiqueta = GlobalKey();
  final GlobalKey _claveRol = GlobalKey();
  final GlobalKey _claveUnidad = GlobalKey();
  final GlobalKey _clavePin = GlobalKey();

  /// El usuario que se edita: se muestran su rol y su unidad, sin editarlos.
  Usuario? _usuario;

  bool get _esNuevo => widget.usuarioId == null;

  /// El Titular no elige rol (ADR 0028 §3): todo lo que crea es Miembro, así
  /// que se deja puesto apenas llegan los roles y no se muestra selector.
  void _fijarMiembroSiEsTitular() {
    if (!(_esNuevo && _actorEsTitular)) return;
    final miembro = ref
        .watch(rolesProvider)
        .value
        ?.where((r) => nivelDeRol(r.nombre) == NivelUsuario.miembro)
        .firstOrNull;
    if (miembro == null) return;
    if (ref.read(formularioUsuarioProvider).rol?.id == miembro.id) return;
    // Fuera del build: no se puede cambiar un provider mientras se arma.
    unawaited(
      Future.microtask(
        () => ref.read(formularioUsuarioProvider.notifier).elegirRol(miembro),
      ),
    );
  }

  bool get _actorEsTitular {
    final sesion = ref.read(sesionControladorProvider);
    return sesion is SesionAutenticada &&
        nivelDeRol(sesion.rolActivo.nombre) == NivelUsuario.titular;
  }

  @override
  void initState() {
    super.initState();
    // Salga por donde salga (guardar, cancelar o "atrás"), se vuelve a la
    // pestaña de Usuarios de Administración y no a la primera.
    unawaited(
      Future.microtask(
        () => ref
            .read(pestanaAdminProvider.notifier)
            .elegir(PestanaAdmin.usuarios),
      ),
    );
  }

  @override
  void dispose() {
    _etiqueta.dispose();
    _unidad.dispose();
    super.dispose();
  }

  void _cargarDesde(Usuario usuario) {
    if (_cargado) return;
    _cargado = true;
    _usuario = usuario;
    _etiqueta.text = usuario.etiqueta ?? '';
    unawaited(
      Future.microtask(
        () => ref.read(formularioUsuarioProvider.notifier).cargar(usuario),
      ),
    );
    if (_puedeAsignar) unawaited(_cargarPuertas(usuario.id));
  }

  bool get _puedeAsignar =>
      ref.read(sesionControladorProvider).tiene(Permisos.asignarGuardias);

  /// Lee las puertas que el usuario ya tiene asignadas. Si falla, no se
  /// marca como cargada: guardar no pisa la asignación real con una vacía, y
  /// el formulario lo dice en vez de mostrar una selección falsa.
  Future<void> _cargarPuertas(String usuarioId) async {
    try {
      final asignadas = await ref
          .read(usuariosRepositorioProvider)
          .puertasAsignadas(usuarioId);
      if (mounted) {
        ref.read(formularioUsuarioProvider.notifier).cargarPuertas(asignadas);
      }
    } on Object {
      if (mounted) {
        ref.read(formularioUsuarioProvider.notifier).fallarCargaDePuertas();
      }
    }
  }

  /// La lista de usuarios: la pestaña de Admin en compacto; su propio destino
  /// en medio y expandido.
  String get _rutaLista =>
      context.esCompacta ? Rutas.admin : Rutas.adminUsuarios;

  /// Guardar o generar con un campo que falta o no vale: nombra el primero en
  /// un aviso y baja hasta él. Cada campo con error ya lleva su mensaje.
  void _avisarSiFaltan() {
    final errores = ref.read(formularioUsuarioProvider).errores;
    final primero = ErrorDatosUsuario.values
        .where(errores.contains)
        .firstOrNull;
    if (primero == null || !mounted) return;
    final l10n = context.l10n;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(_textoDeFalta(l10n, primero))));
    final contexto = _claveDe(primero).currentContext;
    if (contexto != null) {
      Scrollable.ensureVisible(
        contexto,
        duration: context.tokens.duracion.efectiva(
          context,
          context.tokens.duracion.normal,
        ),
      );
    }
  }

  /// La sección donde se corrige cada error.
  GlobalKey _claveDe(ErrorDatosUsuario error) => switch (error) {
    ErrorDatosUsuario.sinEtiqueta ||
    ErrorDatosUsuario.etiquetaLarga => _claveEtiqueta,
    ErrorDatosUsuario.sinRol => _claveRol,
    ErrorDatosUsuario.sinPropiedad ||
    ErrorDatosUsuario.sinNombreDeUnidad ||
    ErrorDatosUsuario.nombreDeUnidadLargo => _claveUnidad,
    ErrorDatosUsuario.sufijoInvalido => _clavePin,
  };

  Future<void> _guardar() async {
    final controlador = ref.read(formularioUsuarioProvider.notifier);
    if (_esNuevo) {
      final pin = await controlador.crear(asignarPuertas: _puedeAsignar);
      if (!mounted) return;
      if (pin == null) {
        _avisarSiFaltan();
        return;
      }
      await mostrarPinGenerado(context, pin);
      if (mounted && context.esExpandida) context.go(Rutas.adminUsuarios);
      return;
    }
    final guardado = await controlador.editar(
      widget.usuarioId!,
      asignarPuertas: _puedeAsignar,
    );
    if (!mounted) return;
    if (!guardado) {
      _avisarSiFaltan();
      return;
    }
    // El aviso va en la lista de usuarios, no en el formulario que se cierra.
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(context.l10n.usuariosGuardado)));
    context.go(_rutaLista);
  }

  /// El error de la etiqueta, si lo hay.
  String? _errorDeEtiqueta(
    AppLocalizations l10n,
    Set<ErrorDatosUsuario> errores,
  ) {
    if (errores.contains(ErrorDatosUsuario.sinEtiqueta)) {
      return l10n.usuariosErrorSinEtiqueta;
    }
    if (errores.contains(ErrorDatosUsuario.etiquetaLarga)) {
      return l10n.usuariosErrorEtiquetaLarga(DatosUsuario.largoMaximoEtiqueta);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    _fijarMiembroSiEsTitular();
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(formularioUsuarioProvider);
    final controlador = ref.read(formularioUsuarioProvider.notifier);
    final errores = estado.errores;
    final errorApi = estado.errorApi;
    final puedeAsignar = ref
        .watch(sesionControladorProvider)
        .tiene(Permisos.asignarGuardias);

    if (!_esNuevo && !_cargado) {
      final usuarios = ref.watch(usuariosProvider);
      final usuario = usuarios.value?.datos
          .where((u) => u.id == widget.usuarioId)
          .firstOrNull;
      if (usuario != null) {
        _cargarDesde(usuario);
      } else if (!usuarios.isLoading) {
        return PlantillaAdmin(
          destino: context.esCompacta ? DestinoNav.admin : DestinoNav.usuarios,
          rutaAtras: _rutaLista,
          salida: SalidaDeCabecera.cerrar,
          alSalir: () => context.go(_rutaLista),
          titulo: l10n.usuariosEditarTitulo,
          child: EstadoVacio.error(
            titulo: l10n.usuariosErrorCargar,
            alReintentar: () => ref.invalidate(usuariosProvider),
          ),
        );
      } else {
        return PlantillaAdmin(
          destino: context.esCompacta ? DestinoNav.admin : DestinoNav.usuarios,
          rutaAtras: _rutaLista,
          salida: SalidaDeCabecera.cerrar,
          alSalir: () => context.go(_rutaLista),
          titulo: l10n.usuariosEditarTitulo,
          child: const AccesoCargando(),
        );
      }
    }

    return PlantillaAdmin(
      destino: context.esCompacta ? DestinoNav.admin : DestinoNav.usuarios,
      rutaAtras: _rutaLista,
      salida: SalidaDeCabecera.cerrar,
      alSalir: () => context.go(_rutaLista),
      titulo: _esNuevo ? l10n.usuariosNuevo : l10n.usuariosEditarTitulo,
      conRelleno: false,
      child: FormularioSecciones(
        secciones: [
          SeccionDeFormulario(
            titulo: l10n.usuariosSeccionDatos,
            campos: [
              KeyedSubtree(
                key: _claveEtiqueta,
                child: CampoFormulario(
                  etiqueta: l10n.usuariosCampoEtiqueta,
                  obligatorio: true,
                  ayuda: l10n.usuariosCampoEtiquetaAyuda,
                  textoError: _errorDeEtiqueta(l10n, errores),
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
              ),
            ],
          ),
          if (!(_esNuevo && _actorEsTitular))
            SeccionDeFormulario(
              // Al crear, el rol es obligatorio: se marca en el título.
              titulo: _esNuevo
                  ? '${l10n.usuariosSeccionRoles}${l10n.comunMarcaObligatorio}'
                  : l10n.usuariosSeccionRoles,
              campos: [
                if (_esNuevo)
                  KeyedSubtree(
                    key: _claveRol,
                    child: SelectorDeRol(
                      conError: errores.contains(ErrorDatosUsuario.sinRol),
                    ),
                  )
                else
                  Wrap(
                    spacing: tokens.espacio.s,
                    runSpacing: tokens.espacio.xs,
                    children: [
                      for (final rol in _usuario?.roles ?? const <Rol>[])
                        ChipEtiqueta(texto: rol.nombre),
                    ],
                  ),
              ],
            ),
          if (_esNuevo && estado.nivel == NivelUsuario.titular)
            SeccionDeFormulario(
              titulo: l10n.usuariosSeccionUnidad,
              campos: [
                KeyedSubtree(
                  key: _claveUnidad,
                  child: SeccionUnidad(controlador: _unidad, errores: errores),
                ),
              ],
            )
          else if (_usuario?.unidad case final unidad?)
            SeccionDeFormulario(
              titulo: l10n.usuariosSeccionUnidad,
              campos: [ChipEtiqueta(texto: unidad.nombre)],
            ),
          if (_esNuevo)
            SeccionDeFormulario(
              titulo: l10n.usuariosSeccionPin,
              campos: [
                KeyedSubtree(
                  key: _clavePin,
                  child: SelectorSufijoPin(
                    elegir: estado.elegirSufijo,
                    sufijo: estado.sufijo,
                    conError: errores.contains(
                      ErrorDatosUsuario.sufijoInvalido,
                    ),
                    alElegir: (elegir) =>
                        controlador.alternarSufijoElegido(elegir: elegir),
                    alCambiar: controlador.cambiarSufijo,
                  ),
                ),
              ],
            ),
          if (puedeAsignar)
            SeccionDeFormulario(
              titulo: l10n.usuariosSeccionPuertas,
              campos: [
                SeccionPuertasAsignadas(
                  asignadas: estado.puertas,
                  // Al editar, se espera a leer lo guardado antes de marcar.
                  cargando:
                      !_esNuevo &&
                      !estado.puertasCargadas &&
                      !estado.puertasNoCargadas,
                  conError: estado.puertasNoCargadas,
                  alAlternarTodas: controlador.alternarTodasLasPuertas,
                  alAlternarPuerta: controlador.alternarPuerta,
                ),
              ],
            ),
        ],
        aviso: errorApi != null
            ? AccesoAviso(
                tono: TonoAviso.peligro,
                texto: textoDeError(l10n, errorApi),
              )
            : (_esNuevo
                  ? AccesoAviso(
                      tono: TonoAviso.informacion,
                      texto: l10n.usuariosNuevoAviso,
                    )
                  : null),
        acciones: [
          AccesoBoton(
            texto: l10n.comunCancelar,
            variante: VarianteBoton.texto,
            onPressed: () => context.go(_rutaLista),
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
