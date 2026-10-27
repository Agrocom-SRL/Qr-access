import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/administracion/domain/estadisticas_usuarios.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/baja_de_usuario.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/chip_etiqueta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/linea_sincronizacion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/pestanas_deslizables.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/selector_segmentado.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_fila.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Qué lista de las estadísticas se está viendo.
enum _Vista { inactivos, ruidosos, titulares }

/// Uso de los usuarios de la rama (ADR 0028 §4): quiénes no generan ni usan
/// QR (candidatos a baja), quiénes generan QR a cada rato y qué Titulares ya
/// usan casi todo su tope de Miembros. Es informativa: los umbrales son fijos
/// y no se hace nada solo; desde acá se puede dar de baja a quien corresponda.
class EstadisticasUsuariosPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<EstadisticasUsuariosPagina> createState() =>
      _EstadisticasUsuariosPaginaEstado();
}

class _EstadisticasUsuariosPaginaEstado
    extends ConsumerState<EstadisticasUsuariosPagina> {
  _Vista _vista = _Vista.inactivos;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final estadisticas = ref.watch(estadisticasProvider);
    final sincronizacion = ref.watch(sincronizacionEstadisticasProvider);
    final ahora = ref.read(relojProvider)();
    final rutaLista = context.esCompacta ? Rutas.admin : Rutas.adminUsuarios;
    // Con datos ya cargados, un refresco que falla no los borra: se muestran
    // con la línea de sincronización ("Sin conexión"). El error de pantalla
    // solo aparece cuando no hay nada que mostrar.
    final datos = estadisticas.value;

    return PlantillaAdmin(
      destino: context.esCompacta ? DestinoNav.admin : DestinoNav.usuarios,
      rutaAtras: rutaLista,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(rutaLista),
      titulo: l10n.estadisticasTitulo,
      conRelleno: false,
      child: datos != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LineaSincronizacion(estado: sincronizacion, ahora: ahora),
                Expanded(
                  child: PestanasDeslizables<_Vista>(
                    segmentos: [
                      SegmentoDeSelector(
                        valor: _Vista.inactivos,
                        etiqueta: l10n.estadisticasInactivos,
                        conteo: datos.inactivos.length,
                      ),
                      SegmentoDeSelector(
                        valor: _Vista.ruidosos,
                        etiqueta: l10n.estadisticasRuidosos,
                        conteo: datos.ruidosos.length,
                      ),
                      SegmentoDeSelector(
                        valor: _Vista.titulares,
                        etiqueta: l10n.estadisticasTitulares,
                        conteo: datos.titularesCercaDelTope.length,
                      ),
                    ],
                    seleccionado: _vista,
                    alElegir: (vista) => setState(() => _vista = vista),
                    paginaDe: (context, vista) => _pagina(datos, vista),
                  ),
                ),
              ],
            )
          : estadisticas.hasError
          ? EstadoVacio.error(
              titulo: textoDeError(l10n, estadisticas.error!),
              alReintentar: () => ref.invalidate(estadisticasProvider),
            )
          : const AccesoCargando(),
    );
  }

  /// La lista de una vista con el aviso informativo: arriba cuando hay filas
  /// y debajo de la ilustración cuando la lista está vacía, para que no
  /// compita con ella. Tirar hacia abajo pide las estadísticas de nuevo,
  /// también con la lista vacía (`AlwaysScrollableScrollPhysics`).
  Widget _pagina(EstadisticasDeUsuarios datos, _Vista vista) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final filas = _filas(datos, vista);
    final vacia = filas.length == 1 && filas.first is EstadoVacio;
    final aviso = AccesoAviso(
      tono: TonoAviso.informacion,
      texto: context.l10n.estadisticasAviso(
        datos.umbralInactivoDias,
        datos.umbralRuidosoPorDia,
      ),
    );
    final separacion = SizedBox(height: tokens.espacio.l);
    return RefreshIndicator(
      onRefresh: () =>
          ref.read(sincronizacionEstadisticasProvider.notifier).refrescar(),
      color: colores.primario,
      backgroundColor: colores.superficie,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(tokens.espacio.l),
        children: vacia
            ? [...filas, separacion, aviso]
            : [aviso, separacion, ...filas],
      ),
    );
  }

  List<Widget> _filas(EstadisticasDeUsuarios datos, _Vista vista) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final puedeEliminar = ref
        .watch(sesionControladorProvider)
        .tiene(Permisos.eliminarUsuarios);
    final enCurso = ref.watch(accionesUsuarioProvider);
    Widget separada(Widget fila) => Padding(
      padding: EdgeInsets.only(bottom: tokens.espacio.m),
      child: fila,
    );

    switch (vista) {
      case _Vista.inactivos || _Vista.ruidosos:
        final lista = vista == _Vista.inactivos
            ? datos.inactivos
            : datos.ruidosos;
        if (lista.isEmpty) {
          return [
            EstadoVacio(
              ilustracion: Multimedia.vacioQr,
              titulo: vista == _Vista.inactivos
                  ? l10n.estadisticasSinInactivos
                  : l10n.estadisticasSinRuidosos,
            ),
          ];
        }
        return [
          for (final uso in lista)
            separada(
              TarjetaFila(
                titulo: uso.etiqueta ?? l10n.qrSinEtiqueta,
                inicio: AccesoAvatar(etiqueta: uso.etiqueta, neutro: true),
                subtituloWidget: Padding(
                  padding: EdgeInsets.only(top: tokens.espacio.xs),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: tokens.espacio.s,
                        runSpacing: tokens.espacio.xs,
                        children: [
                          if (uso.rol != null) ChipEtiqueta(texto: uso.rol!),
                          if (uso.unidad != null)
                            ChipEtiqueta(texto: uso.unidad!),
                        ],
                      ),
                      SizedBox(height: tokens.espacio.xs),
                      Text(
                        _detalle(uso, datos),
                        style: Theme.of(context).textTheme.bodySmall
                            ?.copyWith(color: tokens.colores.textoSecundario),
                      ),
                    ],
                  ),
                ),
                pie: puedeEliminar
                    ? Align(
                        alignment: Alignment.centerRight,
                        child: AccesoBoton(
                          texto: l10n.comunEliminar,
                          icono: Icons.person_remove_outlined,
                          variante: VarianteBoton.texto,
                          cargando: enCurso == uso.id,
                          onPressed: enCurso == null
                              ? () => pedirBajaDeUsuario(
                                  context,
                                  ref,
                                  id: uso.id,
                                  etiqueta: uso.etiqueta,
                                )
                              : null,
                        ),
                      )
                    : null,
              ),
            ),
        ];
      case _Vista.titulares:
        final lista = datos.titularesCercaDelTope;
        if (lista.isEmpty) {
          return [
            EstadoVacio(
              ilustracion: Multimedia.vacioEventos,
              titulo: l10n.estadisticasSinTitulares,
            ),
          ];
        }
        return [
          for (final titular in lista)
            separada(
              TarjetaFila(
                titulo: titular.etiqueta ?? l10n.qrSinEtiqueta,
                inicio: AccesoAvatar(etiqueta: titular.etiqueta, neutro: true),
                subtitulo: l10n.estadisticasTitularDetalle(
                  titular.unidad ?? l10n.estadisticasSinUnidad,
                  titular.miembros,
                  titular.tope,
                ),
              ),
            ),
        ];
    }
  }

  /// "Sin QR en 30 días · último 02/09/2026" o "Hasta 14 QR en un día".
  String _detalle(UsoDeUsuario uso, EstadisticasDeUsuarios datos) {
    final l10n = context.l10n;
    if (uso.ruidoso) {
      return l10n.estadisticasDetalleRuidoso(uso.maxQrEnUnDia, uso.qrGenerados);
    }
    final ultimo = uso.ultimoQrAt;
    return ultimo == null
        ? l10n.estadisticasDetalleNuncaGeneroQr(datos.ventanaDias)
        : l10n.estadisticasDetalleInactivo(
            datos.ventanaDias,
            formatearFecha(ultimo),
          );
  }
}
