import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/dispositivos/domain/sesion_conectada.dart';
import 'package:agrocom_acceso/features/dispositivos/presentation/dispositivos_controlador.dart';
import 'package:agrocom_acceso/features/dispositivos/presentation/widgets/dialogo_nombre_dispositivo.dart';
import 'package:agrocom_acceso/features/dispositivos/presentation/widgets/presentacion_de_sesion.dart';
import 'package:agrocom_acceso/features/dispositivos/presentation/widgets/tarjeta_sesion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_accion_fila.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// "Dispositivos conectados" (ADR 0030 §4.1): los aparatos donde tengo mi
/// sesión abierta, con la de este aparato marcada. Este aparato se puede
/// nombrar; cerrar una o todas las demás es una baja de acceso, así que cada
/// una pide confirmación. Cerrar sesiones no anula mis QR vigentes (ADR 0031
/// §3): eso lo dice el diálogo.
class DispositivosPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final listado = ref.watch(misSesionesProvider);
    final cerrando = ref.watch(cierreDeSesionesProvider);
    final renombrando = ref.watch(renombrarDispositivoProvider);
    final ahora = ref.read(relojProvider)();
    final otras = cuantasOtrasSesiones(listado.value?.datos ?? const []);
    final cerrarTodas = otras > 0 && !cerrando
        ? () => _cerrarOtras(context, ref)
        : null;

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.dispositivosTitulo,
      rutaAtras: Rutas.ajustes,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.ajustes),
      accion: otras > 0
          ? AccesoBoton(
              texto: l10n.dispositivosCerrarTodas,
              icono: Icons.logout,
              variante: VarianteBoton.peligroTonal,
              onPressed: cerrarTodas,
            )
          : null,
      accionCompacta: otras > 0
          ? IconButton(
              tooltip: l10n.dispositivosCerrarTodas,
              color: colores.peligro,
              onPressed: cerrarTodas,
              icon: const Icon(Icons.logout),
            )
          : null,
      conRelleno: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
            child: AccesoAviso(
              tono: TonoAviso.informacion,
              texto: l10n.dispositivosAyuda,
            ),
          ),
          Expanded(
            child: ListadoPaginado<SesionConectada>(
              estado: estadoDesdeAsync(listado, ahora: ahora),
              tituloDeError: l10n.dispositivosErrorCargar,
              alReintentar: () => ref.invalidate(misSesionesProvider),
              // Una sola página: el control de paginar nunca se muestra.
              alCambiarPagina: (_) {},
              vacio: EstadoVacio(
                ilustracion: Multimedia.vacioEventos,
                titulo: l10n.dispositivosSinSesiones,
              ),
              tarjeta: (context, sesion) => TarjetaSesion(
                sesion: sesion,
                ultimaActividad: formatearFechaHora(sesion.ultimaActividadAt),
                cerrando: cerrando || renombrando,
                alCerrar: sesion.puedeCerrarse
                    ? () => _cerrarUna(context, ref, sesion)
                    : null,
                alRenombrar: sesion.actual
                    ? () => _renombrar(context, ref, sesion)
                    : null,
              ),
              columnas: [
                ColumnaListado(
                  titulo: l10n.dispositivosColumnaDispositivo,
                  celda: (context, sesion) => Text(
                    sesion.dispositivo ?? l10n.dispositivosSinNombre,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.dispositivosColumnaPlataforma,
                  celda: (context, sesion) => Text(
                    textoDePlataforma(l10n, sesion.plataforma),
                    style: Theme.of(context).textTheme.bodyMedium
                        ?.copyWith(color: colores.textoSecundario),
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.dispositivosColumnaActividad,
                  celda: (context, sesion) => Text(
                    formatearFechaHora(sesion.ultimaActividadAt),
                    style: tokens.tipografia.mono(
                      tokens.tipografia.t14,
                      color: colores.texto,
                    ),
                  ),
                ),
                ColumnaListado(
                  titulo: l10n.comunEstado,
                  celda: (context, sesion) => sesion.actual
                      ? AccesoBadge(
                          texto: l10n.dispositivosEsteAparato,
                          tono: TonoAcceso.primario,
                        )
                      : const SizedBox.shrink(),
                ),
                ColumnaListado(
                  titulo: l10n.comunAcciones,
                  celda: (context, sesion) => _celdaDeAcciones(
                    context,
                    ref,
                    sesion,
                    cerrando: cerrando || renombrando,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// En este aparato, cambiar el nombre; en los demás, cerrar la sesión.
  Widget _celdaDeAcciones(
    BuildContext context,
    WidgetRef ref,
    SesionConectada sesion, {
    required bool cerrando,
  }) {
    final l10n = context.l10n;
    if (sesion.actual) {
      return AccesoAccionFila(
        accion: AccionDeFila.editar,
        etiqueta: l10n.dispositivosRenombrar,
        onPressed: cerrando ? null : () => _renombrar(context, ref, sesion),
      );
    }
    if (!sesion.puedeCerrarse) return const SizedBox.shrink();
    return AccesoAccionFila(
      accion: AccionDeFila.eliminar,
      etiqueta: l10n.dispositivosCerrarUna,
      onPressed: cerrando ? null : () => _cerrarUna(context, ref, sesion),
    );
  }

  /// Pide el nombre nuevo y lo guarda. Cancelar o dejarlo igual no llama a la
  /// API; si falla, dice por qué.
  Future<void> _renombrar(
    BuildContext context,
    WidgetRef ref,
    SesionConectada sesion,
  ) async {
    final l10n = context.l10n;
    final nombre = await pedirNombreDispositivo(
      context,
      actual: sesion.dispositivo,
    );
    if (nombre == null || !context.mounted) return;
    final error = await ref
        .read(renombrarDispositivoProvider.notifier)
        .renombrar(nombre);
    if (!context.mounted) return;
    _avisar(
      context,
      error == null ? l10n.dispositivosRenombrado : textoDeError(l10n, error),
    );
  }

  /// Pide confirmación, cierra esa sesión y avisa el resultado.
  Future<void> _cerrarUna(
    BuildContext context,
    WidgetRef ref,
    SesionConectada sesion,
  ) async {
    final l10n = context.l10n;
    final confirmado = await ConfirmarDialogo.mostrar(
      context,
      titulo: l10n.dispositivosCerrarUnaTitulo,
      mensaje: l10n.dispositivosCerrarUnaMensaje,
      textoConfirmar: l10n.dispositivosCerrarUnaConfirmar,
      detalle: sesion.dispositivo ?? l10n.dispositivosSinNombre,
      icono: Icons.logout,
    );
    if (!confirmado || !context.mounted) return;
    final resultado = await ref
        .read(cierreDeSesionesProvider.notifier)
        .cerrar(sesion.id);
    if (!context.mounted) return;
    final error = resultado.error;
    _avisar(
      context,
      error == null ? l10n.dispositivosCerradaUna : textoDeError(l10n, error),
    );
  }

  /// Pide confirmación con lo que cambia (y lo que no), cierra las demás y
  /// dice cuántas cerró.
  Future<void> _cerrarOtras(BuildContext context, WidgetRef ref) async {
    final l10n = context.l10n;
    final confirmado = await ConfirmarDialogo.mostrar(
      context,
      titulo: l10n.dispositivosCerrarTodasTitulo,
      mensaje: l10n.dispositivosCerrarTodasMensaje,
      textoConfirmar: l10n.dispositivosCerrarTodasConfirmar,
      icono: Icons.logout,
    );
    if (!confirmado || !context.mounted) return;
    final resultado = await ref
        .read(cierreDeSesionesProvider.notifier)
        .cerrarOtras();
    if (!context.mounted) return;
    final error = resultado.error;
    _avisar(
      context,
      error == null
          ? l10n.dispositivosCerradas(resultado.cerradas)
          : textoDeError(l10n, error),
    );
  }

  void _avisar(BuildContext context, String texto) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
  }
}
