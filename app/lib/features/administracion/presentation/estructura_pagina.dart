import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:agrocom_acceso/features/administracion/presentation/estructura_controlador.dart';
import 'package:agrocom_acceso/features/administracion/presentation/pestana_admin.dart';
import 'package:agrocom_acceso/features/administracion/presentation/widgets/dialogos_estructura.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_accion_fila.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_skeleton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Gestión de los sitios y las puertas de la cuenta por su administrador
/// (HU-07). Vincular la placa a una puerta sigue siendo del equipo AGROCOM.
class EstructuraPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final estructura = ref.watch(estructuraProvider);
    final puedeSitios = sesion.tiene(Permisos.administrarSitios);
    final nuevoSitio = AccesoBoton(
      texto: l10n.estructuraSitioNuevo,
      icono: Icons.add_business_outlined,
      onPressed: puedeSitios ? () => _nuevoSitio(context, ref) : null,
    );
    final cuerpo = estructura.when(
      loading: () => const _SitiosSkeleton(),
      // Sin conexión solo se muestra la ilustración (como en los listados).
      error: (error, _) => error is ErrorApi && error.esSinConexion
          ? EstadoVacio.sinConexion(
              titulo: l10n.estructuraErrorCargar,
              alReintentar: () => ref.invalidate(estructuraProvider),
            )
          : EstadoVacio.error(
              titulo: l10n.estructuraErrorCargar,
              alReintentar: () => ref.invalidate(estructuraProvider),
            ),
      data: (sitios) => sitios.isEmpty
          ? EstadoVacio(
              ilustracion: Multimedia.vacioPuertas,
              titulo: l10n.estructuraSinSitios,
              ayuda: l10n.estructuraSinSitiosAyuda,
            )
          : ListView.separated(
              padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
              // En compacto, la banda de foto va primero (como en Puertas).
              itemCount: sitios.length + (context.esCompacta ? 1 : 0),
              separatorBuilder: (_, _) => SizedBox(height: tokens.espacio.l),
              itemBuilder: (_, indice) {
                if (!context.esCompacta) {
                  return _TarjetaSitio(sitio: sitios[indice]);
                }
                return indice == 0
                    ? const _BandaDeFoto()
                    : _TarjetaSitio(sitio: sitios[indice - 1]);
              },
            ),
    );
    // La misma cabecera que el resto de listados (título grande de
    // PlantillaAdmin, con flecha para volver a Administración › Puertas). En
    // compacto, la acción va como ícono; no hay AppBar aparte.
    return PlantillaAdmin(
      destino: DestinoNav.puertas,
      rutaAtras: Rutas.adminPuertas,
      salida: SalidaDeCabecera.volver,
      alSalir: () => _volver(context, ref),
      titulo: l10n.estructuraTitulo,
      accion: puedeSitios ? nuevoSitio : null,
      accionCompacta: puedeSitios
          ? IconButton(
              tooltip: l10n.estructuraSitioNuevo,
              onPressed: () => _nuevoSitio(context, ref),
              icon: const Icon(Icons.add_business_outlined),
            )
          : null,
      child: cuerpo,
    );
  }

  void _volver(BuildContext context, WidgetRef ref) {
    ref.read(pestanaAdminProvider.notifier).elegir(PestanaAdmin.puertas);
    context.go(Rutas.admin);
  }
}

/// Banda de foto sobre la lista (compacto), como en Administración › Puertas.
class _BandaDeFoto extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ClipRRect(
      borderRadius: BorderRadius.circular(tokens.radio.xl),
      child: SizedBox(
        height: tokens.tamano.cabeceraFoto / 2,
        width: double.infinity,
        child: const AccesoFoto(
          ruta: Multimedia.fotoIntercomunicador,
          alineacion: Alignment(0.6, 0),
          fundirConFondo: true,
          verdeEnClaro: true,
        ),
      ),
    );
  }
}

/// Mientras carga: la forma de una tarjeta de sitio (encabezado y dos puertas),
/// con el mismo skeleton de los listados.
class _SitiosSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      label: context.l10n.comunCargando,
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
        children: [
          for (var i = 0; i < 2; i++) ...[
            AccesoTarjeta(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      AccesoSkeleton(
                        ancho: tokens.tamano.iconoCaja,
                        alto: tokens.tamano.iconoCaja,
                      ),
                      SizedBox(width: tokens.espacio.m),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            AccesoSkeleton(
                              ancho: tokens.tamano.railExpandido / 1.4,
                            ),
                            SizedBox(height: tokens.espacio.s),
                            AccesoSkeleton(
                              ancho: tokens.tamano.railExpandido / 2,
                              alto: tokens.espacio.m,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  for (var j = 0; j < 2; j++)
                    Padding(
                      padding: EdgeInsets.only(top: tokens.espacio.l),
                      child: Row(
                        children: [
                          AccesoSkeleton(
                            ancho: tokens.tamano.icono,
                            alto: tokens.tamano.icono,
                          ),
                          SizedBox(width: tokens.espacio.m),
                          AccesoSkeleton(
                            ancho: tokens.tamano.railExpandido / 1.6,
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            SizedBox(height: tokens.espacio.l),
          ],
        ],
      ),
    );
  }
}

/// Muestra el error de una acción, si lo hubo.
void _avisarError(BuildContext context, ErrorApi? error) {
  if (error == null || !context.mounted) return;
  ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(textoDeError(context.l10n, error))));
}

Future<void> _nuevoSitio(BuildContext context, WidgetRef ref) async {
  final datos = await pedirDatosDeSitio(context);
  if (datos == null || !context.mounted) return;
  final error = await ref
      .read(accionesEstructuraProvider.notifier)
      .crearSitio(datos);
  if (context.mounted) _avisarError(context, error);
}

class _TarjetaSitio extends ConsumerWidget {
  const new({required this.sitio});

  final SitioGestionado sitio;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final sesion = ref.watch(sesionControladorProvider);
    final enCurso = ref.watch(accionesEstructuraProvider);
    final puedeSitios = sesion.tiene(Permisos.administrarSitios);
    final puedePuertas = sesion.tiene(Permisos.administrarPuertas);
    return AccesoTarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const CajaIcono(icono: Icons.domain_outlined),
              SizedBox(width: tokens.espacio.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sitio.nombre,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (sitio.direccion != null)
                      Text(
                        sitio.direccion!,
                        style: Theme.of(context).textTheme.bodyMedium
                            ?.copyWith(color: tokens.colores.textoSecundario),
                      ),
                  ],
                ),
              ),
              if (puedeSitios) ...[
                AccesoAccionFila(
                  accion: AccionDeFila.editar,
                  etiqueta: l10n.estructuraSitioEditar,
                  onPressed: enCurso ? null : () => _editar(context, ref),
                ),
                SizedBox(width: tokens.espacio.s),
                AccesoAccionFila(
                  accion: AccionDeFila.eliminar,
                  etiqueta: l10n.comunEliminar,
                  onPressed: enCurso ? null : () => _eliminar(context, ref),
                ),
              ],
            ],
          ),
          SizedBox(height: tokens.espacio.m),
          if (sitio.puertas.isEmpty)
            Text(
              l10n.estructuraSinPuertas,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: tokens.colores.textoSecundario),
            )
          else
            for (final puerta in sitio.puertas) _FilaPuerta(puerta: puerta),
          if (puedePuertas)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: AccesoBoton(
                texto: l10n.estructuraPuertaNueva,
                icono: Icons.add,
                variante: VarianteBoton.texto,
                onPressed: enCurso ? null : () => _nuevaPuerta(context, ref),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _editar(BuildContext context, WidgetRef ref) async {
    final datos = await pedirDatosDeSitio(context, sitio: sitio);
    if (datos == null || !context.mounted) return;
    final error = await ref
        .read(accionesEstructuraProvider.notifier)
        .editarSitio(sitio.id, datos);
    if (context.mounted) _avisarError(context, error);
  }

  Future<void> _eliminar(BuildContext context, WidgetRef ref) async {
    final l10n = context.l10n;
    final confirmado = await ConfirmarDialogo.mostrar(
      context,
      titulo: l10n.estructuraEliminarSitioTitulo(sitio.nombre),
      mensaje: l10n.estructuraEliminarSitioMensaje,
      textoConfirmar: l10n.comunEliminar,
    );
    if (!confirmado || !context.mounted) return;
    final error = await ref
        .read(accionesEstructuraProvider.notifier)
        .eliminarSitio(sitio.id);
    if (context.mounted) _avisarError(context, error);
  }

  Future<void> _nuevaPuerta(BuildContext context, WidgetRef ref) async {
    final datos = await pedirDatosDePuerta(context);
    if (datos == null || !context.mounted) return;
    final error = await ref
        .read(accionesEstructuraProvider.notifier)
        .crearPuerta(sitio.id, datos);
    if (context.mounted) _avisarError(context, error);
  }
}

class _FilaPuerta extends ConsumerWidget {
  const new({required this.puerta});

  final PuertaGestionada puerta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final puedePuertas = ref
        .watch(sesionControladorProvider)
        .tiene(Permisos.administrarPuertas);
    final enCurso = ref.watch(accionesEstructuraProvider);
    return Padding(
      padding: EdgeInsets.symmetric(vertical: tokens.espacio.s),
      child: Row(
        children: [
          Icon(
            Icons.door_front_door_outlined,
            size: tokens.tamano.icono,
            color: tokens.colores.textoSecundario,
          ),
          SizedBox(width: tokens.espacio.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  puerta.nombre,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  l10n.estructuraPuertaSegundosValor(puerta.segundosApertura),
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: tokens.colores.textoSecundario),
                ),
              ],
            ),
          ),
          if (puedePuertas) ...[
            AccesoAccionFila(
              accion: AccionDeFila.editar,
              etiqueta: l10n.estructuraPuertaEditar,
              onPressed: enCurso ? null : () => _editar(context, ref),
            ),
            SizedBox(width: tokens.espacio.s),
            AccesoAccionFila(
              accion: AccionDeFila.eliminar,
              etiqueta: l10n.comunEliminar,
              onPressed: enCurso ? null : () => _eliminar(context, ref),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _editar(BuildContext context, WidgetRef ref) async {
    final datos = await pedirDatosDePuerta(context, puerta: puerta);
    if (datos == null || !context.mounted) return;
    final error = await ref
        .read(accionesEstructuraProvider.notifier)
        .editarPuerta(puerta.id, datos);
    if (context.mounted) _avisarError(context, error);
  }

  Future<void> _eliminar(BuildContext context, WidgetRef ref) async {
    final l10n = context.l10n;
    final confirmado = await ConfirmarDialogo.mostrar(
      context,
      titulo: l10n.estructuraEliminarPuertaTitulo(puerta.nombre),
      mensaje: l10n.estructuraEliminarPuertaMensaje,
      textoConfirmar: l10n.comunEliminar,
    );
    if (!confirmado || !context.mounted) return;
    final error = await ref
        .read(accionesEstructuraProvider.notifier)
        .eliminarPuerta(puerta.id);
    if (context.mounted) _avisarError(context, error);
  }
}
