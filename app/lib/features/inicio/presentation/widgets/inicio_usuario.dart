import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/inicio/presentation/inicio_controlador.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/encabezado_inicio.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_skeleton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Inicio del usuario (handoff C04a/E04a): hero "Emitir QR", accesos rápidos
/// y los QR vigentes de hoy.
class InicioUsuario extends ConsumerWidget {
  const new({required this.sesion, super.key});

  final SesionAutenticada sesion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final vigentes = ref.watch(qrVigentesProvider);
    final ahora = ref.read(relojProvider)();
    final puedeEmitir = sesion.tiene(Permisos.emitirQr);
    final ultimo = vigentes.value?.datos.firstOrNull;

    final accesos = <_AccesoRapido>[
      if (puedeEmitir && ultimo != null)
        _AccesoRapido(
          icono: Icons.replay,
          etiqueta: l10n.inicioRepetirUltimo,
          alTocar: () => context.go(
            Rutas.qrNuevo,
            extra: PrellenadoEmision(
              puertaIds: ultimo.puertas.map((p) => p.id).toSet(),
              etiqueta: ultimo.etiqueta,
            ),
          ),
        ),
      if (sesion.tiene(Permisos.verQr))
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
      if (sesion.tieneVariosRoles)
        _AccesoRapido(
          icono: Icons.swap_horiz,
          etiqueta: l10n.perfilCambiarRol,
          alTocar: ref
              .read(sesionControladorProvider.notifier)
              .pedirCambioDeRol,
        ),
    ];

    return RefreshIndicator(
      onRefresh: () => ref.refresh(qrVigentesProvider.future),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EncabezadoInicio(sesion: sesion),
            SizedBox(height: tokens.espacio.xl),
            if (puedeEmitir) ...[
              _HeroEmitir(alEmitir: () => context.go(Rutas.qrNuevo)),
              SizedBox(height: tokens.espacio.xl),
            ],
            if (accesos.isNotEmpty) ...[
              Row(
                children: [
                  for (final acceso in accesos) Expanded(child: acceso),
                ],
              ),
              SizedBox(height: tokens.espacio.xxl),
            ],
            if (sesion.tiene(Permisos.verQr)) ...[
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
                        icono: Icons.qr_code_2,
                        titulo: l10n.inicioSinVigentes,
                        ayuda: l10n.inicioSinVigentesAyuda,
                        textoAccion: puedeEmitir ? l10n.qrEmitirBoton : null,
                        iconoAccion: Icons.add,
                        alAccionar: puedeEmitir
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

class _HeroEmitir extends StatelessWidget {
  const new({required this.alEmitir});

  final VoidCallback alEmitir;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    return Container(
      padding: EdgeInsets.all(tokens.espacio.xl),
      decoration: BoxDecoration(
        color: colores.hero,
        borderRadius: BorderRadius.circular(tokens.radio.xl),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.qrEmitirTitulo,
                  style: textos.headlineLarge?.copyWith(
                    color: colores.sobreHero,
                  ),
                ),
                SizedBox(height: tokens.espacio.xs),
                Text(
                  l10n.inicioHeroAyuda(l10n.qrFinDelDiaHora),
                  style: textos.bodyLarge?.copyWith(color: colores.sobreHero),
                ),
                SizedBox(height: tokens.espacio.l),
                FilledButton.icon(
                  onPressed: alEmitir,
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
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      button: true,
      label: etiqueta,
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
    );
  }
}
