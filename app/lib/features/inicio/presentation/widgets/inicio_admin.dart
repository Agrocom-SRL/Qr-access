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
import 'package:agrocom_acceso/features/inicio/presentation/widgets/hero_accesos_de_hoy.dart';
import 'package:agrocom_acceso/features/notificaciones/notificaciones.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
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
    // El administrador no tiene "Mis QR" en la barra (se llena con Admin):
    // llega desde aquí a los QR que generó, para volver a compartirlos.
    final puedeVerMisQr = widget.sesion.tiene(Permisos.verQr);

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
                      icono: Icons.person_pin_outlined,
                      variante: VarianteBoton.tonal,
                      onPressed: () => context.go(Rutas.qrRapido),
                    ),
                  if (puedeVerMisQr) ...[
                    SizedBox(width: tokens.espacio.m),
                    AccesoBoton(
                      texto: l10n.navMisQr,
                      icono: Icons.list_alt,
                      variante: VarianteBoton.tonal,
                      onPressed: () => context.go(Rutas.qrMios),
                    ),
                  ],
                  if (puedeGenerar) ...[
                    SizedBox(width: tokens.espacio.m),
                    AccesoBoton(
                      texto: l10n.qrGenerarBoton,
                      icono: Icons.qr_code_2,
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
              // Las tres tarjetas miden lo mismo, lleven nota o no.
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < indicadores.length; i++) ...[
                      Expanded(child: indicadores[i]),
                      if (i < indicadores.length - 1)
                        SizedBox(width: tokens.espacio.xl),
                    ],
                  ],
                ),
              )
            else ...[
              // Mismo card con foto de fondo que ve el guardia, siempre a todo
              // el ancho, en vertical y en horizontal.
              HeroAccesosDeHoy(
                permitidos: datos?.resumenDeHoy.permitidos,
                rechazados: datos?.resumenDeHoy.rechazados,
                alTocar: () => context.go(Rutas.eventos),
              ),
              SizedBox(height: tokens.espacio.l),
              // Con datos, el conteo de puertas sin conexión es la cabecera de
              // la tarjeta de estado de cada puerta; mientras carga, queda la
              // tarjeta de indicador con su esqueleto.
              if (datos == null)
                indicadores[2]
              else
                _EstadoDePuertas(
                  puertas: datos.puertas,
                  alVerPuertas: widget.sesion.tiene(Permisos.supervisarPuertas)
                      ? () => context.go(Rutas.adminPuertas)
                      : null,
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

/// Estado de las puertas: la cabecera dice cuántas están sin conexión y debajo
/// va cada puerta con su sitio y si su lector reporta, las caídas primero.
/// Muestra las primeras que caben; el resto está en Administración.
class _EstadoDePuertas extends StatelessWidget {
  const new({required this.puertas, required this.alVerPuertas});

  /// Con ancho suficiente (horizontal) las filas van en dos columnas.
  static const _anchoDosColumnas = 560.0;
  static const _maximoUnaColumna = 4;
  static const _maximoDosColumnas = 6;

  final List<Puerta> puertas;

  /// `null` si el rol no supervisa puertas: no se ofrece el enlace.
  final VoidCallback? alVerPuertas;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final ordenadas = [...puertas]
      ..sort((a, b) {
        if (a.sinConexion == b.sinConexion) return 0;
        return a.sinConexion ? -1 : 1;
      });
    final caidas = ordenadas.where((p) => p.sinConexion).length;
    return AccesoTarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CajaIcono(
                icono: caidas > 0 ? Icons.wifi_off : Icons.wifi,
                tono: caidas > 0 ? TonoCaja.peligro : TonoCaja.primario,
                tamano: tokens.tamano.iconoCaja,
              ),
              SizedBox(width: tokens.espacio.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.inicioPuertasSinConexion,
                      style: textos.bodyMedium?.copyWith(
                        color: tokens.colores.textoSecundario,
                      ),
                    ),
                    Text(
                      '$caidas',
                      style: textos.headlineSmall?.copyWith(
                        color: caidas > 0
                            ? tokens.colores.peligro
                            : tokens.colores.texto,
                      ),
                    ),
                  ],
                ),
              ),
              if (alVerPuertas != null)
                AccesoBoton(
                  texto: l10n.inicioVerPuertas,
                  variante: VarianteBoton.texto,
                  onPressed: alVerPuertas,
                ),
            ],
          ),
          if (ordenadas.isNotEmpty) ...[
            SizedBox(height: tokens.espacio.s),
            const Divider(),
            LayoutBuilder(
              builder: (context, restricciones) {
                final dosColumnas = restricciones.maxWidth >= _anchoDosColumnas;
                final visibles = ordenadas.take(
                  dosColumnas ? _maximoDosColumnas : _maximoUnaColumna,
                );
                final ancho = dosColumnas
                    ? (restricciones.maxWidth - tokens.espacio.xl) / 2
                    : restricciones.maxWidth;
                return Wrap(
                  spacing: tokens.espacio.xl,
                  children: [
                    for (final puerta in visibles)
                      SizedBox(
                        width: ancho,
                        child: _FilaDePuerta(puerta: puerta),
                      ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

/// Una puerta del estado: nombre, sitio y su badge de conexión.
class _FilaDePuerta extends StatelessWidget {
  const new({required this.puerta});

  final Puerta puerta;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: tokens.espacio.s),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(puerta.nombre, style: textos.titleSmall),
                Text(
                  puerta.sitioNombre,
                  style: textos.bodySmall?.copyWith(
                    color: tokens.colores.textoSecundario,
                  ),
                ),
              ],
            ),
          ),
          AccesoBadge(
            texto: puerta.sinConexion
                ? l10n.puertaSinConexion
                : l10n.puertaEnLinea,
            tono: puerta.sinConexion ? TonoAcceso.peligro : TonoAcceso.primario,
          ),
        ],
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
