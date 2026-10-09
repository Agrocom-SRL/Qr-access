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
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
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

    // Las notas solo caben en expandido; en compacto (C04b) las tarjetas
    // llevan rótulo y cifra, nada más.
    final indicadores = [
      TarjetaIndicador(
        etiqueta: l10n.inicioAccesosDeHoy,
        icono: Icons.login,
        valor: datos?.resumenDeHoy.permitidos,
        nota: datos == null || !expandida
            ? null
            : l10n.inicioPermitidosPorPuertas(datos.puertas.length),
        variante: VarianteIndicador.hero,
        alTocar: () => context.go(Rutas.eventos),
      ),
      TarjetaIndicador(
        etiqueta: l10n.inicioRechazados,
        icono: Icons.block,
        valor: datos?.resumenDeHoy.rechazados,
        nota: switch (expandida ? datos?.resumenDeHoy.motivoPrincipal : null) {
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
        nota: datos == null || datos.puertasSinConexion.isEmpty || !expandida
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
                        // Relleno primario con ícono blanco (C04b); el tema
                        // de IconButton pinta el ícono en texto.
                        style: IconButton.styleFrom(
                          backgroundColor: tokens.colores.primario,
                          foregroundColor: tokens.colores.sobrePrimario,
                        ),
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
              // Las dos tarjetas miden lo mismo aunque un rótulo ocupe dos
              // líneas ("Puertas sin conexión").
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: indicadores[1]),
                    SizedBox(width: tokens.espacio.l),
                    Expanded(child: indicadores[2]),
                  ],
                ),
              ),
            ],
            SizedBox(height: tokens.espacio.xxl),
            if (expandida && datos != null && datos.ultimosEventos.isNotEmpty)
              _TablaUltimosEventos(eventos: datos.ultimosEventos)
            else ...[
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
                        if (i < datos.ultimosEventos.length - 1)
                          const Divider(),
                      ],
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

/// "Últimos eventos" en expandido (E04b): una tabla con hora, puerta, sitio,
/// QR, resultado y motivo dentro de la tarjeta, con "Ver todos" en el título.
class _TablaUltimosEventos extends StatelessWidget {
  const new({required this.eventos});

  final List<EventoAcceso> eventos;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final secundario = textos.bodyMedium?.copyWith(
      color: tokens.colores.textoSecundario,
    );
    final cabecera = textos.labelSmall?.copyWith(
      color: tokens.colores.textoSecundario,
    );
    Widget celda(Widget hijo) => Padding(
      padding: EdgeInsets.symmetric(
        horizontal: tokens.espacio.xs,
        vertical: tokens.espacio.m,
      ),
      child: hijo,
    );

    return AccesoTarjeta(
      relleno: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(
              tokens.espacio.xl,
              tokens.espacio.m,
              tokens.espacio.m,
              tokens.espacio.m,
            ),
            child: Row(
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
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: tokens.espacio.xl),
            child: Table(
              columnWidths: const {
                0: FlexColumnWidth(0.8),
                1: FlexColumnWidth(1.5),
                2: FlexColumnWidth(1.4),
                3: FlexColumnWidth(2),
                4: FlexColumnWidth(1.2),
                5: FlexColumnWidth(1.4),
              },
              defaultVerticalAlignment: TableCellVerticalAlignment.middle,
              border: TableBorder(
                horizontalInside: BorderSide(color: tokens.colores.borde),
              ),
              children: [
                TableRow(
                  decoration: BoxDecoration(color: tokens.colores.fondo),
                  children: [
                    for (final titulo in [
                      l10n.eventosColumnaHora,
                      l10n.eventosColumnaPuerta,
                      l10n.eventosColumnaSitio,
                      l10n.eventosColumnaQr,
                      l10n.eventosColumnaResultado,
                      l10n.eventosColumnaMotivo,
                    ])
                      celda(Text(titulo, style: cabecera)),
                  ],
                ),
                for (final evento in eventos)
                  TableRow(
                    children: [
                      celda(
                        Text(
                          formatearHora(evento.ocurridoAt),
                          style: tokens.tipografia.mono(
                            tokens.tipografia.t14,
                            color: tokens.colores.texto,
                          ),
                        ),
                      ),
                      celda(
                        Text(evento.puertaNombre, style: textos.titleSmall),
                      ),
                      celda(Text(evento.sitioNombre, style: secundario)),
                      celda(
                        Text(
                          evento.qrEtiqueta == null &&
                                  evento.emisorEtiqueta == null
                              ? l10n.comunGuion
                              : l10n.eventoQrDe(
                                  evento.qrEtiqueta ?? l10n.qrSinEtiqueta,
                                  evento.emisorEtiqueta ?? l10n.comunGuion,
                                ),
                          style: secundario,
                        ),
                      ),
                      celda(
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: AccesoBadge(
                            texto: textoResultadoEvento(l10n, evento.resultado),
                            tono: tonoResultadoEvento(evento.resultado),
                          ),
                        ),
                      ),
                      celda(
                        Text(
                          evento.esPermitido
                              ? l10n.comunGuion
                              : textoMotivoEvento(l10n, evento.motivoCode),
                          style: secundario,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          SizedBox(height: tokens.espacio.s),
        ],
      ),
    );
  }
}
