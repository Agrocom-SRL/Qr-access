import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/inicio/presentation/inicio_controlador.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/boton_qr_propio.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/encabezado_inicio.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/hero_accesos_de_hoy.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_skeleton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/hero_con_foto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Inicio del usuario (handoff C04a/E04a): hero "Generar QR", accesos rápidos
/// y los QR vigentes de hoy.
class InicioUsuario extends ConsumerWidget {
  const new({required this.sesion, super.key});

  final SesionAutenticada sesion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    // Sin permiso de ver QR (el guardia) ni siquiera se pide la lista.
    final vigentes = sesion.tiene(Permisos.verQr)
        ? ref.watch(qrVigentesProvider)
        : null;
    final ahora = ref.read(relojProvider)();
    final puedeGenerar = sesion.tiene(Permisos.generarQr);
    final puedeQrPropio = sesion.tiene(Permisos.generarQrPropio);
    // El guardia solo tiene su QR propio (no `generarQr`): ve el tablero de
    // vigilancia en lugar del héroe de generar.
    final guardia = esGuardia(sesion);
    final puedeCompartir = puedeGenerar;
    final veEventosAqui = guardia && sesion.tiene(Permisos.verEventos);
    final eventos = veEventosAqui ? ref.watch(ultimosEventosProvider) : null;
    final resumenDeHoy = guardia ? ref.watch(resumenDeHoyProvider) : null;
    final ultimo = vigentes?.value?.datos.firstOrNull;

    final accesos = <_AccesoRapido>[
      // Siempre visible para quien genera: sin un QR previo queda apagado en
      // vez de desaparecer, para que los accesos no cambien de lugar.
      if (puedeCompartir)
        _AccesoRapido(
          icono: Icons.replay,
          etiqueta: l10n.inicioRepetirUltimo,
          alTocar: ultimo == null
              ? null
              : () => context.go(
                  Rutas.qrNuevo,
                  extra: PrellenadoGeneracion(
                    puertaIds: ultimo.puertas.map((p) => p.id).toSet(),
                    etiqueta: ultimo.etiqueta,
                  ),
                ),
        ),
      // Genera al instante el QR propio, sin formulario, para usarlo en este
      // mismo dispositivo.
      if (puedeQrPropio)
        _AccesoRapido(
          icono: Icons.person_pin_outlined,
          etiqueta: l10n.inicioQrPropio,
          alTocar: () => context.go(Rutas.qrRapido),
        ),
      // En compacto Mis QR ya es una pestaña de la barra.
      if (sesion.tiene(Permisos.verQr) && !context.esCompacta)
        _AccesoRapido(
          icono: Icons.qr_code_2,
          etiqueta: l10n.navMisQr,
          alTocar: () => context.go(Rutas.qrMios),
        ),
      if (sesion.tiene(Permisos.verEventos))
        _AccesoRapido(
          icono: Icons.history,
          etiqueta: l10n.navEventos,
          alTocar: () => context.go(Rutas.eventos),
        ),
    ];

    return RefreshIndicator(
      onRefresh: () {
        ref
          ..invalidate(ultimosEventosProvider)
          ..invalidate(resumenDeHoyProvider);
        if (vigentes == null) return Future.value();
        return ref.refresh(qrVigentesProvider.future);
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        // Con el botón flotante, el final del contenido no queda tapado.
        padding: EdgeInsets.only(
          top: tokens.espacio.l,
          bottom: puedeCompartir
              ? tokens.tamano.fab + tokens.espacio.xl
              : tokens.espacio.l,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EncabezadoInicio(
              sesion: sesion,
              accion: puedeQrPropio ? const BotonQrPropio() : null,
            ),
            SizedBox(height: tokens.espacio.xl),
            if (guardia) ...[
              // Mismo diseño que "Generar QR", pero con lo que le toca vigilar.
              HeroAccesosDeHoy(
                permitidos: resumenDeHoy?.value?.permitidos,
                rechazados: resumenDeHoy?.value?.rechazados,
                alTocar: () => context.go(Rutas.eventos),
              ),
              SizedBox(height: tokens.espacio.xl),
            ] else if (puedeCompartir) ...[
              _HeroGenerar(alGenerar: () => context.go(Rutas.qrNuevo)),
              SizedBox(height: tokens.espacio.xl),
            ],
            if (accesos.isNotEmpty) ...[
              Row(
                children: [
                  for (final acceso in accesos) Expanded(child: acceso),
                ],
              ),
              SizedBox(height: tokens.espacio.l),
            ],
            if (eventos != null) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.inicioUltimosEventos,
                      style: textos.titleLarge,
                    ),
                  ),
                  AccesoBoton(
                    texto: l10n.comunVerTodos,
                    variante: VarianteBoton.texto,
                    onPressed: () => context.go(Rutas.eventos),
                  ),
                ],
              ),
              SizedBox(height: tokens.espacio.s),
              eventos.when(
                loading: () => Column(
                  children: [
                    for (var i = 0; i < 2; i++)
                      Padding(
                        padding: EdgeInsets.only(bottom: tokens.espacio.m),
                        child: AccesoTarjeta(
                          child: AccesoSkeleton(alto: tokens.tamano.iconoCaja),
                        ),
                      ),
                  ],
                ),
                error: (error, _) => error is ErrorApi && error.esSinConexion
                    ? EstadoVacio.sinConexion(
                        titulo: l10n.inicioErrorCargar,
                        alReintentar: () =>
                            ref.invalidate(ultimosEventosProvider),
                      )
                    : EstadoVacio.error(
                        titulo: l10n.inicioErrorCargar,
                        alReintentar: () =>
                            ref.invalidate(ultimosEventosProvider),
                      ),
                data: (lista) => lista.isEmpty
                    ? EstadoVacio(
                        ilustracion: Multimedia.vacioEventos,
                        titulo: l10n.eventosSinResultados,
                        ayuda: l10n.eventosSinResultadosAyuda,
                      )
                    : AccesoTarjeta(
                        relleno: EdgeInsets.symmetric(
                          horizontal: tokens.espacio.l,
                        ),
                        child: Column(
                          children: [
                            for (var i = 0; i < lista.length; i++) ...[
                              FilaEvento(evento: lista[i]),
                              if (i < lista.length - 1) const Divider(),
                            ],
                          ],
                        ),
                      ),
              ),
            ],
            if (vigentes != null) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.inicioVigentesHoy,
                      style: textos.titleLarge,
                    ),
                  ),
                  AccesoBoton(
                    texto: l10n.comunVerTodos,
                    variante: VarianteBoton.texto,
                    onPressed: () => context.go(Rutas.qrMios),
                  ),
                ],
              ),
              SizedBox(height: tokens.espacio.s),
              vigentes.when(
                loading: () => Column(
                  children: [
                    for (var i = 0; i < 2; i++)
                      Padding(
                        padding: EdgeInsets.only(bottom: tokens.espacio.m),
                        child: AccesoTarjeta(
                          child: AccesoSkeleton(alto: tokens.tamano.iconoCaja),
                        ),
                      ),
                  ],
                ),
                error: (_, _) => EstadoVacio.error(
                  titulo: l10n.qrMisQrErrorCargar,
                  alReintentar: () => ref.invalidate(qrVigentesProvider),
                ),
                data: (pagina) => pagina.datos.isEmpty
                    ? EstadoVacio(
                        ilustracion: Multimedia.vacioQr,
                        titulo: l10n.inicioSinVigentes,
                        ayuda: l10n.inicioSinVigentesAyuda,
                        textoAccion: puedeGenerar ? l10n.qrGenerarBoton : null,
                        iconoAccion: Icons.add,
                        alAccionar: puedeGenerar
                            ? () => context.go(Rutas.qrNuevo)
                            : null,
                      )
                    : Column(
                        children: [
                          for (final qr in pagina.datos)
                            Padding(
                              padding: EdgeInsets.only(
                                bottom: tokens.espacio.m,
                              ),
                              child: TarjetaQr(
                                qr: qr,
                                ahora: ahora,
                                compacta: true,
                              ),
                            ),
                        ],
                      ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HeroGenerar extends StatelessWidget {
  const new({required this.alGenerar});

  final VoidCallback alGenerar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    return HeroConFoto(
      ruta: Multimedia.fotoMuro,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.qrGenerarTitulo,
                  style: textos.headlineLarge?.copyWith(
                    color: colores.sobreHero,
                  ),
                ),
                SizedBox(height: tokens.espacio.xs),
                Text(
                  l10n.inicioHeroAyudaFinDelDia,
                  style: textos.bodyLarge?.copyWith(color: colores.sobreHero),
                ),
                SizedBox(height: tokens.espacio.l),
                FilledButton.icon(
                  onPressed: alGenerar,
                  style: FilledButton.styleFrom(
                    backgroundColor: colores.superficie,
                    foregroundColor: colores.primario,
                  ),
                  icon: const Icon(Icons.add),
                  label: Text(l10n.inicioNuevoQr),
                ),
              ],
            ),
          ),
          SizedBox(width: tokens.espacio.l),
          CajaIcono(
            icono: Icons.qr_code_2,
            tono: TonoCaja.hero,
            tamano: tokens.tamano.accesoRapido,
          ),
        ],
      ),
    );
  }
}

class _AccesoRapido extends StatelessWidget {
  const new({
    required this.icono,
    required this.etiqueta,
    required this.alTocar,
  });

  final IconData icono;
  final String etiqueta;

  /// `null` apaga el acceso (se ve atenuado y no responde).
  final VoidCallback? alTocar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      button: true,
      enabled: alTocar != null,
      label: etiqueta,
      child: Opacity(
        opacity: alTocar == null ? opacidadDeshabilitado : 1,
        child: InkWell(
          onTap: alTocar,
          borderRadius: BorderRadius.circular(tokens.radio.l),
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: tokens.espacio.s),
            child: Column(
              children: [
                CajaIcono(
                  icono: icono,
                  tono: TonoCaja.superficie,
                  tamano: tokens.tamano.accesoRapido,
                ),
                SizedBox(height: tokens.espacio.s),
                Text(
                  etiqueta,
                  style: Theme.of(context).textTheme.labelSmall,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
