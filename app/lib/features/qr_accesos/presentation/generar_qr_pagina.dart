import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_generacion_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/estado_qr_vista.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/generar_qr_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/paso_puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/paso_vigencia.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/resumen_generacion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/cabecera_titulo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/indicador_pasos.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/formulario_secciones.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Generar un QR (HU-11, handoff C05a–c/E05): stepper de puertas, vigencia y
/// confirmación. Al generarlo, pasa a la pantalla que lo muestra.
class GenerarQrPagina extends ConsumerStatefulWidget {
  const new({this.prellenado, super.key});

  /// "Repetir último": puertas y etiqueta del QR anterior.
  final PrellenadoGeneracion? prellenado;

  @override
  ConsumerState<GenerarQrPagina> createState() => _GenerarQrPaginaEstado();
}

class _GenerarQrPaginaEstado extends ConsumerState<GenerarQrPagina> {
  late final TextEditingController _etiqueta;

  @override
  void initState() {
    super.initState();
    _etiqueta = TextEditingController(text: widget.prellenado?.etiqueta ?? '');
    final prellenado = widget.prellenado;
    if (prellenado != null) {
      unawaited(
        Future.microtask(
          () => ref
              .read(generarQrControladorProvider.notifier)
              .prellenar(prellenado),
        ),
      );
    }
  }

  @override
  void dispose() {
    _etiqueta.dispose();
    super.dispose();
  }

  Future<void> _generar() async {
    final qr = await ref.read(generarQrControladorProvider.notifier).generar();
    if (qr == null || !mounted) return;
    unawaited(HapticFeedback.lightImpact());
    context.go(Rutas.qrGenerado, extra: qr);
  }

  void _cerrar() => context.go(Rutas.inicio);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(generarQrControladorProvider);
    final controlador = ref.read(generarQrControladorProvider.notifier);
    final puertas = ref.watch(puertasDisponiblesProvider);
    final ahora = ref.read(relojProvider)();
    final expandida = context.esExpandida;
    // En teléfono horizontal el resumen va a la derecha, siempre visible, como
    // en expandido; el paso 3 no lo repite.
    final apaisada = !expandida && esTelefonoApaisado(context);
    final errorDatos = estado.errorDatos;
    final errorApi = estado.errorApi;
    final pasos = [
      l10n.qrGenerarPasoPuertas,
      l10n.qrGenerarPasoVigencia,
      l10n.qrGenerarPasoConfirmar,
    ];
    final esUltimo = estado.paso == PasoGeneracion.confirmar;

    final contenidoDelPaso = switch (estado.paso) {
      PasoGeneracion.puertas => puertas.when(
        loading: () => const ListadoPaginado<Puerta>(
          estado: ListadoCargando(),
          tarjeta: _nada,
          columnas: [],
          vacio: SizedBox.shrink(),
          alCambiarPagina: _ignorar,
          alReintentar: _nadaQueHacer,
          tituloDeError: '',
          sinRelleno: true,
        ),
        error: (error, _) => EstadoVacio(
          titulo: l10n.qrGenerarErrorPuertas,
          variante: error is ErrorApi && error.esSinConexion
              ? VarianteEstadoVacio.sinConexion
              : VarianteEstadoVacio.error,
          alAccionar: () => ref.invalidate(puertasDisponiblesProvider),
        ),
        data: (lista) => lista.isEmpty
            ? EstadoVacio(
                icono: Icons.door_front_door_outlined,
                titulo: l10n.qrGenerarSinPuertas,
                ayuda: l10n.qrGenerarSinPuertasAyuda,
              )
            : PasoPuertas(
                puertas: lista,
                seleccionadas: estado.puertaIds,
                alAlternar: controlador.alternarPuerta,
                alAlternarTodas: controlador.alternarTodas,
              ),
      ),
      PasoGeneracion.vigencia => PasoVigencia(
        vigencia: estado.vigencia,
        alElegir: controlador.elegirVigencia,
        etiqueta: estado.etiqueta,
        controladorEtiqueta: _etiqueta,
        alCambiarEtiqueta: controlador.cambiarEtiqueta,
        textoError:
            errorDatos == null || errorDatos == ErrorDatosGeneracion.sinPuertas
            ? null
            : textoErrorDatosGeneracion(l10n, errorDatos),
        ahora: ahora,
      ),
      PasoGeneracion.confirmar => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.qrGenerarRevisa,
            style: Theme.of(context).textTheme.bodyLarge
                ?.copyWith(color: tokens.colores.textoSecundario),
          ),
          SizedBox(height: tokens.espacio.l),
          if (!expandida && !apaisada)
            ResumenGeneracion(
              puertas: puertas.value ?? const [],
              seleccionadas: estado.puertaIds,
              vigencia: estado.vigencia,
              etiqueta: estado.etiqueta,
              ahora: ahora,
            ),
          SizedBox(height: tokens.espacio.l),
          AccesoAviso(
            tono: TonoAviso.informacion,
            texto: l10n.qrGenerarAvisoUnSoloUso,
          ),
        ],
      ),
    };

    final avisoDeError = <Widget>[
      if (errorDatos == ErrorDatosGeneracion.sinPuertas &&
          estado.paso == PasoGeneracion.puertas)
        AccesoAviso(
          tono: TonoAviso.peligro,
          texto: textoErrorDatosGeneracion(l10n, errorDatos!),
        ),
      if (errorApi != null)
        AccesoAviso(
          tono: TonoAviso.peligro,
          texto: l10n.qrGenerarErrorGenerar(textoDeError(l10n, errorApi)),
        ),
    ];

    final botonPrincipal = AccesoBoton(
      texto: esUltimo ? l10n.qrGenerarBoton : l10n.comunSiguiente,
      textoCargando: l10n.qrGenerando,
      cargando: estado.enviando,
      expandido: expandida || apaisada,
      onPressed: esUltimo ? _generar : controlador.siguiente,
    );
    final botonAtras = AccesoBoton(
      texto: l10n.comunAtras,
      variante: VarianteBoton.texto,
      onPressed: estado.paso == PasoGeneracion.puertas
          ? null
          : controlador.atras,
    );

    final cuerpo = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        IndicadorPasos(pasos: pasos, actual: estado.paso.index),
        SizedBox(height: tokens.espacio.l),
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                contenidoDelPaso,
                for (final aviso in avisoDeError) ...[
                  SizedBox(height: tokens.espacio.l),
                  aviso,
                ],
                SizedBox(height: tokens.espacio.xl),
              ],
            ),
          ),
        ),
      ],
    );

    if (expandida) {
      return PlantillaAdmin(
        destino: DestinoNav.generarQr,
        titulo: l10n.qrGenerarTitulo,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: cuerpo),
            SizedBox(width: tokens.espacio.xl),
            SizedBox(
              width: tokens.tamano.resumenLateral,
              child: ResumenGeneracion(
                titulo: l10n.qrResumenTitulo,
                puertas: puertas.value ?? const [],
                seleccionadas: estado.puertaIds,
                vigencia: estado.vigencia,
                etiqueta: estado.etiqueta,
                ahora: ahora,
                pie: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    botonPrincipal,
                    if (estado.paso != PasoGeneracion.puertas) ...[
                      SizedBox(height: tokens.espacio.s),
                      botonAtras,
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Teléfono en horizontal: los pasos a la izquierda, el resumen y la acción
    // a la derecha. Es la misma información que en vertical, sin apilarla.
    final cuerpoApaisado = Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.espacio.l,
        tokens.espacio.s,
        tokens.espacio.l,
        tokens.espacio.l,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(flex: 3, child: cuerpo),
          SizedBox(width: tokens.espacio.xl),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    child: ResumenGeneracion(
                      titulo: l10n.qrResumenTitulo,
                      puertas: puertas.value ?? const [],
                      seleccionadas: estado.puertaIds,
                      vigencia: estado.vigencia,
                      etiqueta: estado.etiqueta,
                      ahora: ahora,
                    ),
                  ),
                ),
                SizedBox(height: tokens.espacio.l),
                botonPrincipal,
                if (estado.paso != PasoGeneracion.puertas) ...[
                  SizedBox(height: tokens.espacio.s),
                  botonAtras,
                ],
              ],
            ),
          ),
        ],
      ),
    );

    final cantidad = estado.puertaIds.length;
    return PopScope(
      // "Atrás" retrocede un paso; en el primero, cierra el flujo.
      canPop: false,
      onPopInvokedWithResult: (salio, _) {
        if (salio) return;
        if (estado.paso == PasoGeneracion.puertas) {
          _cerrar();
        } else {
          controlador.atras();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          // El primer paso se descarta (X); los demás vuelven un paso (flecha).
          leading: BotonSalidaCabecera(
            salida: estado.paso == PasoGeneracion.puertas
                ? SalidaDeCabecera.cerrar
                : SalidaDeCabecera.volver,
            alPulsar: estado.paso == PasoGeneracion.puertas
                ? _cerrar
                : controlador.atras,
          ),
          // Mismo estilo que el título de las demás pantallas (cabecera común).
          title: Text(
            l10n.qrGenerarTitulo,
            style: CabeceraTitulo.estiloDe(context),
          ),
        ),
        body: SafeArea(
          child: apaisada
              ? cuerpoApaisado
              : Column(
                  children: [
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          tokens.espacio.l,
                          tokens.espacio.s,
                          tokens.espacio.l,
                          0,
                        ),
                        child: cuerpo,
                      ),
                    ),
                    BarraDeAcciones(
                      inicio: estado.paso == PasoGeneracion.puertas
                          ? Text.rich(
                              TextSpan(
                                text: '$cantidad ',
                                style: Theme.of(context).textTheme.titleMedium,
                                children: [
                                  TextSpan(
                                    text: l10n.qrGenerarPuertasContadas(
                                      cantidad,
                                    ),
                                    style: Theme.of(context).textTheme.bodyLarge
                                        ?.copyWith(
                                          color: tokens.colores.textoSecundario,
                                        ),
                                  ),
                                ],
                              ),
                            )
                          : botonAtras,
                      acciones: [botonPrincipal],
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

Widget _nada(BuildContext context, Puerta puerta) => const SizedBox.shrink();
void _ignorar(int pagina) {}
void _nadaQueHacer() {}
