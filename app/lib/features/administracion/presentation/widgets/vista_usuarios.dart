import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/baja_de_usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/banner_cupo.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/dialogo_regenerar_pin.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/pin_generado_dialogo.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/tarjeta_estadisticas.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/vista_apaisada.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_accion_fila.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/chip_etiqueta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Usuarios de la cuenta con sus roles (handoff C10b/E10b, HU-06): "Generar
/// PIN" muestra el PIN una sola vez; editar y eliminar según permisos.
class VistaUsuarios extends ConsumerWidget {
  const new({this.conBotonFlotante = false, super.key});

  /// Quien la muestra pone el botón flotante "Nuevo usuario" (compacto, también
  /// en horizontal). La lista y su estado vacío dejan ese espacio al pie.
  final bool conBotonFlotante;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final usuarios = ref.watch(usuariosProvider);
    final enCurso = ref.watch(accionesUsuarioProvider);
    final ahora = ref.read(relojProvider)();
    final puedeEditar = sesion.tiene(Permisos.editarUsuarios);
    final puedeEliminar = sesion.tiene(Permisos.eliminarUsuarios);
    final propioId = sesion is SesionAutenticada ? sesion.usuario.id : null;

    Widget botonPin(Usuario usuario, {required bool corto}) => AccesoBoton(
      texto: corto ? l10n.usuariosPin : l10n.usuariosGenerarPin,
      icono: Icons.key_outlined,
      variante: VarianteBoton.texto,
      cargando: enCurso == usuario.id,
      onPressed: puedeEditar ? () => _generarPin(context, ref, usuario) : null,
    );

    final listado = ListadoPaginado<Usuario>(
      estado: estadoDesdeAsync(usuarios, ahora: ahora),
      tituloDeError: l10n.usuariosErrorCargar,
      alReintentar: () => ref.invalidate(usuariosProvider),
      alCambiarPagina: (pagina) =>
          ref.read(paginaUsuariosProvider.notifier).pagina = pagina,
      vacio: EstadoVacio(
        ilustracion: Multimedia.vacioQr,
        titulo: l10n.usuariosSinUsuarios,
        ayuda: l10n.usuariosSinUsuariosAyuda,
      ),
      tarjeta: (context, usuario) => TarjetaFila(
        titulo: usuario.etiqueta ?? l10n.qrSinEtiqueta,
        inicio: AccesoAvatar(etiqueta: usuario.etiqueta, neutro: true),
        alTocar: puedeEditar
            ? () => context.go(Rutas.adminUsuario(usuario.id))
            : null,
        subtituloWidget: Padding(
          padding: EdgeInsets.only(top: tokens.espacio.xs),
          child: Wrap(
            spacing: tokens.espacio.s,
            runSpacing: tokens.espacio.xs,
            children: [
              for (final rol in usuario.roles) ChipEtiqueta(texto: rol.nombre),
              if (usuario.unidad != null)
                ChipEtiqueta(texto: usuario.unidad!.nombre),
            ],
          ),
        ),
        fin: puedeEditar ? botonPin(usuario, corto: true) : null,
      ),
      columnas: [
        ColumnaListado(
          titulo: l10n.usuariosColumnaEtiqueta,
          celda: (context, usuario) => Row(
            children: [
              AccesoAvatar(
                etiqueta: usuario.etiqueta,
                neutro: true,
                tamano: tokens.tamano.avatarChico,
              ),
              SizedBox(width: tokens.espacio.m),
              Flexible(
                child: Text(
                  usuario.etiqueta ?? l10n.qrSinEtiqueta,
                  style: Theme.of(context).textTheme.titleSmall,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        ColumnaListado(
          titulo: l10n.usuariosColumnaRoles,
          celda: (context, usuario) => Wrap(
            spacing: tokens.espacio.s,
            runSpacing: tokens.espacio.xs,
            children: [
              for (final rol in usuario.roles) ChipEtiqueta(texto: rol.nombre),
              if (usuario.unidad != null)
                ChipEtiqueta(texto: usuario.unidad!.nombre),
            ],
          ),
        ),
        ColumnaListado(
          titulo: l10n.usuariosColumnaPin,
          celda: (context, usuario) => Text(
            l10n.perfilPinDeCuenta(
              sesion is SesionAutenticada ? sesion.cuenta.codigo : '',
            ),
            style: tokens.tipografia.mono(
              tokens.tipografia.t14,
              color: tokens.colores.textoSecundario,
            ),
          ),
        ),
        ColumnaListado(
          titulo: l10n.usuariosColumnaUltimoIngreso,
          celda: (context, usuario) => Text(
            switch (usuario.ultimoIngresoAt) {
              null => l10n.usuariosNuncaIngreso,
              final fecha when mismoDiaLocal(fecha, ahora) => l10n.comunHoyALas(
                formatearHora(fecha),
              ),
              final fecha => formatearFechaHora(fecha),
            },
            style: tokens.tipografia.mono(
              tokens.tipografia.t14,
              color: tokens.colores.textoSecundario,
            ),
          ),
        ),
        ColumnaListado(
          titulo: l10n.comunAcciones,
          celda: (context, usuario) => Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (puedeEditar) botonPin(usuario, corto: false),
              if (puedeEditar) ...[
                SizedBox(width: tokens.espacio.s),
                AccesoAccionFila(
                  accion: AccionDeFila.editar,
                  etiqueta: l10n.comunEditar,
                  onPressed: () => context.go(Rutas.adminUsuario(usuario.id)),
                ),
              ],
              if (puedeEliminar && usuario.id != propioId) ...[
                SizedBox(width: tokens.espacio.s),
                AccesoAccionFila(
                  accion: AccionDeFila.eliminar,
                  etiqueta: l10n.comunEliminar,
                  onPressed: enCurso == null
                      ? () => pedirBajaDeUsuario(
                          context,
                          ref,
                          id: usuario.id,
                          etiqueta: usuario.etiqueta,
                        )
                      : null,
                ),
              ],
            ],
          ),
        ),
      ],
    );
    final verCupo = sesion.tiene(Permisos.verCupo);
    final verEstadisticas = sesion.tiene(Permisos.verEstadisticas);
    // El botón flotante deja su alto al pie de la lista (margen del Scaffold y
    // una separación), para que el último usuario y el estado vacío no queden
    // debajo de él.
    final lista = conBotonFlotante
        ? Padding(
            padding: EdgeInsets.only(
              bottom: tokens.tamano.fab + tokens.espacio.xl,
            ),
            child: listado,
          )
        : listado;
    // Orden del resumen, de arriba abajo: foto, cupo y actividad de usuarios.
    // Horizontal de teléfono: ese resumen a la izquierda y la lista a la
    // derecha; "Nuevo usuario" es el botón flotante, no va en el resumen.
    if (estaApaisada(context)) {
      return VistaApaisada(
        resumen: [
          const FotoApaisada(
            ruta: Multimedia.fotoCerradura,
            alineacion: Alignment(0.2, -0.2),
          ),
          if (verCupo) const BannerCupo(),
          if (verEstadisticas) const TarjetaEstadisticas(),
        ],
        listado: lista,
      );
    }
    // En compacto, una banda de foto sobre el listado, como en Puertas; en
    // medio y expandido la tabla ya llena la pantalla.
    if (context.clasePantalla != ClasePantalla.compacta) {
      if (!verCupo && !verEstadisticas) return listado;
      return Column(
        children: [
          if (verCupo) const BannerCupo(),
          if (verEstadisticas) const TarjetaEstadisticas(),
          Expanded(child: listado),
        ],
      );
    }
    return Column(
      children: [
        Padding(
          padding: EdgeInsets.all(tokens.espacio.l),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(tokens.radio.xl),
            child: SizedBox(
              height: tokens.tamano.cabeceraFoto / 2,
              width: double.infinity,
              child: const AccesoFoto(
                ruta: Multimedia.fotoCerradura,
                alineacion: Alignment(0.2, -0.2),
                fundirConFondo: true,
                verdeEnClaro: true,
              ),
            ),
          ),
        ),
        if (verCupo) const BannerCupo(),
        if (verEstadisticas) const TarjetaEstadisticas(),
        Expanded(child: lista),
      ],
    );
  }

  /// Regenerar invalida el PIN anterior: se confirma antes (guía §3).
  Future<void> _generarPin(
    BuildContext context,
    WidgetRef ref,
    Usuario usuario,
  ) async {
    final l10n = context.l10n;
    final nombre = usuario.etiqueta ?? l10n.qrSinEtiqueta;
    final eleccion = await pedirRegeneracionDePin(context, nombre: nombre);
    if (eleccion == null || !context.mounted) return;
    final resultado = await ref
        .read(accionesUsuarioProvider.notifier)
        .generarPin(usuario, sufijo: eleccion.sufijo);
    if (!context.mounted) return;
    final error = resultado.error;
    if (error != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(textoDeError(l10n, error))));
      return;
    }
    await mostrarPinGenerado(context, resultado.pin!);
  }
}
