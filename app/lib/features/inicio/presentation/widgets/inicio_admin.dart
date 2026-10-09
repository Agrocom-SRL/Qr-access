import 'dart:async';

import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/inicio/presentation/inicio_controlador.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/encabezado_inicio.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_indicador.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Tablero del administrador y del guardia (handoff C04b/E04b): accesos de
/// hoy, rechazados, puertas sin conexión y últimos eventos. Se refresca cada
/// 30 s y con pull-to-refresh.
class InicioAdmin extends ConsumerStatefulWidget {
  const new({required this.sesion, super.key});

  final SesionAutenticada sesion;

  @override
  ConsumerState<InicioAdmin> createState() => _InicioAdminEstado();
}

class _InicioAdminEstado extends ConsumerState<InicioAdmin> {
  Timer? _refresco;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _refresco ??= Timer.periodic(
      context.tokens.duracion.refrescoTablero,
      (_) => ref.invalidate(tableroProvider),
    );
  }

  @override
  void dispose() {
    _refresco?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final tablero = ref.watch(tableroProvider);
    final datos = tablero.value;
    final expandida = context.esExpandida;
    final puedeEmitir = widget.sesion.tiene(Permisos.emitirQr);

    final indicadores = [
      TarjetaIndicador(
        etiqueta: l10n.inicioAccesosDeHoy,
        icono: Icons.login,
        valor: datos?.resumenDeHoy.permitidos,
        nota: datos == null
            ? null
            : l10n.inicioPermitidosPorPuertas(datos.puertas.length),
        variante: VarianteIndicador.hero,
        alTocar: () => context.go(Rutas.eventos),
      ),
      TarjetaIndicador(
        etiqueta: l10n.inicioRechazados,
        icono: Icons.block,
        valor: datos?.resumenDeHoy.rechazados,
        nota: switch (datos?.resumenDeHoy.motivoPrincipal) {
          null => null,
          final motivo => l10n.inicioRechazadosPorMotivo(
            motivo.value,
            textoMotivoEvento(l10n, motivo.key),
          ),
        },
        variante: VarianteIndicador.alerta,
        alTocar: () => context.go(Rutas.eventos),
      ),
      TarjetaIndicador(
        etiqueta: l10n.inicioPuertasSinConexion,
        icono: Icons.wifi_off,
        valor: datos?.puertasSinConexion.length,
        nota: datos == null || datos.puertasSinConexion.isEmpty
            ? null
            : datos.puertasSinConexion.map((p) => p.nombre).join(' · '),
        variante: VarianteIndicador.alerta,
        alTocar: widget.sesion.tiene(Permisos.supervisarPuertas)
            ? () => context.go(Rutas.adminPuertas)
            : null,
      ),
    ];

    return RefreshIndicator(
      onRefresh: () => ref.refresh(tableroProvider.future),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (expandida)
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.inicioHoy, style: textos.headlineLarge),
                        Text(
                          l10n.inicioActualizado(
                            widget.sesion.cuenta.nombre,
                            datos == null
                                ? l10n.comunGuion
                                : formatearHora(datos.actualizadoAt),
                          ),
                          style: textos.bodyLarge?.copyWith(
                            color: tokens.colores.textoSecundario,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (puedeEmitir)
                    AccesoBoton(
                      texto: l10n.qrEmitirBoton,
                      icono: Icons.qr_code_2,
                      onPressed: () => context.go(Rutas.qrNuevo),
                    ),
                ],
              )
            else ...[
              EncabezadoInicio(
                sesion: widget.sesion,
                accion: puedeEmitir
                    ? IconButton.filled(
                        tooltip: l10n.qrEmitirBoton,
                        onPressed: () => context.go(Rutas.qrNuevo),
                        icon: const Icon(Icons.qr_code_2),
                      )
                    : null,
              ),
              SizedBox(height: tokens.espacio.xl),
              Row(
                children: [
                  Expanded(
                    child: Text(l10n.inicioHoy, style: textos.titleLarge),
                  ),
                  if (datos != null)
                    Text(
                      l10n.inicioActualizadoCorto(
                        formatearHora(datos.actualizadoAt),
                      ),
                      style: tokens.tipografia.mono(
                        tokens.tipografia.t14,
                        color: tokens.colores.textoSecundario,
                      ),
                    ),
                ],
              ),
            ],
            SizedBox(height: tokens.espacio.l),
            if (tablero.hasError && datos == null)
              EstadoVacio.error(
                titulo: l10n.inicioErrorCargar,
                alReintentar: () => ref.invalidate(tableroProvider),
              )
            else if (expandida)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < indicadores.length; i++) ...[
                    Expanded(child: indicadores[i]),
                    if (i < indicadores.length - 1)
                      SizedBox(width: tokens.espacio.xl),
                  ],
                ],
              )
            else ...[
              indicadores[0],
              SizedBox(height: tokens.espacio.l),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: indicadores[1]),
                  SizedBox(width: tokens.espacio.l),
                  Expanded(child: indicadores[2]),
                ],
              ),
            ],
            SizedBox(height: tokens.espacio.xxl),
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
            if (datos != null && datos.ultimosEventos.isEmpty)
              EstadoVacio(
                icono: Icons.history,
                titulo: l10n.eventosSinResultados,
                ayuda: l10n.eventosSinResultadosAyuda,
              )
            else if (datos != null)
              AccesoTarjeta(
                relleno: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
                child: Column(
                  children: [
                    for (var i = 0; i < datos.ultimosEventos.length; i++) ...[
                      FilaEvento(evento: datos.ultimosEventos[i]),
                      if (i < datos.ultimosEventos.length - 1) const Divider(),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
