import 'dart:async';

import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/inicio/presentation/inicio_controlador.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/acciones_de_cabecera.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/encabezado_inicio.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/estado_de_puertas.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/hero_accesos_de_hoy.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
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
    final puedeGenerar = widget.sesion.tiene(Permisos.generarQr);
    final puedeQrPropio = widget.sesion.tiene(Permisos.generarQrPropio);

    // Mientras carga, el conteo de puertas es una tarjeta de indicador con su
    // esqueleto; con datos lo reemplaza el estado de cada puerta.
    final cargandoPuertas = TarjetaIndicador(
      etiqueta: l10n.inicioPuertasSinConexion,
      icono: Icons.wifi_off,
      variante: VarianteIndicador.alerta,
    );
    final hero = HeroAccesosDeHoy(
      permitidos: datos?.resumenDeHoy.permitidos,
      rechazados: datos?.resumenDeHoy.rechazados,
      alTocar: () => context.go(Rutas.eventos),
    );
    final estadoDePuertas = datos == null
        ? cargandoPuertas
        : EstadoDePuertas(
            puertas: datos.puertas,
            alVerPuertas: widget.sesion.tiene(Permisos.supervisarPuertas)
                ? () => context.go(Rutas.adminPuertas)
                : null,
          );

    return RefreshIndicator(
      onRefresh: () => ref.refresh(tableroProvider.future),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        // El botón flotante no tapa el final del contenido.
        padding: EdgeInsets.only(
          top: tokens.espacio.l,
          bottom: puedeGenerar && !expandida
              ? tokens.tamano.fab + tokens.espacio.xl
              : tokens.espacio.l,
        ),
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
                  // La bandeja también va aquí: en expandido no hay cabecera de
                  // teléfono que la lleve.
                  if (widget.sesion.tiene(Permisos.verNotificaciones)) ...[
                    const BotonNotificaciones(),
                    SizedBox(width: tokens.espacio.m),
                  ],
                  if (puedeQrPropio)
                    AccesoBoton(
                      texto: l10n.inicioQrPropio,
                      // El mismo ícono que el botón del QR propio del teléfono.
                      icono: Icons.how_to_reg,
                      variante: VarianteBoton.tonal,
                      onPressed: () => context.go(Rutas.qrRapido),
                    ),
                  if (puedeGenerar) ...[
                    SizedBox(width: tokens.espacio.m),
                    AccesoBoton(
                      texto: l10n.qrGenerarBoton,
                      icono: Icons.qr_code_2,
                      variante: VarianteBoton.acento,
                      onPressed: () => context.go(Rutas.qrNuevo),
                    ),
                  ],
                ],
              )
            else ...[
              EncabezadoInicio(
                sesion: widget.sesion,
                // Solo el QR propio y la bandeja: Mis QR es una pestaña y
                // "Generar QR" es el botón flotante de la página.
                accion: accionesDeCabecera(
                  widget.sesion,
                  qrPropio: puedeQrPropio,
                ),
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
              // Pantalla ancha: el hero con su foto y el estado de las puertas
              // en dos columnas, igual alto.
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: hero),
                    SizedBox(width: tokens.espacio.xl),
                    Expanded(child: estadoDePuertas),
                  ],
                ),
              )
            else ...[
              // Mismo card con foto de fondo que ve el guardia, siempre a todo
              // el ancho, en vertical y en horizontal.
              hero,
              SizedBox(height: tokens.espacio.l),
              estadoDePuertas,
            ],
            SizedBox(height: tokens.espacio.xxl),
            if (expandida && datos != null && datos.ultimosEventos.isNotEmpty)
              _TablaUltimosEventos(eventos: datos.ultimosEventos)
            else ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.inicioUltimasLecturas,
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
                  ilustracion: Multimedia.vacioEventos,
                  titulo: l10n.lecturasSinResultados,
                  ayuda: l10n.lecturasSinResultadosAyuda,
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

  final List<Lectura> eventos;

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
                    l10n.inicioUltimasLecturas,
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
                      l10n.lecturasColumnaHora,
                      l10n.lecturasColumnaPuerta,
                      l10n.lecturasColumnaSitio,
                      l10n.lecturasColumnaQr,
                      l10n.lecturasColumnaResultado,
                      l10n.lecturasColumnaMotivo,
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
                                  evento.generadorEtiqueta == null
                              ? l10n.comunGuion
                              : l10n.lecturaQrDe(
                                  evento.qrEtiqueta ?? l10n.qrSinEtiqueta,
                                  evento.generadorEtiqueta ?? l10n.comunGuion,
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
