import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/datos_emision_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/emitir_qr_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/estado_qr_vista.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/paso_puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/paso_vigencia.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/resumen_emision.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/indicador_pasos.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/formulario_secciones.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/listado_paginado.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Emitir un QR (HU-11, handoff C05a–c/E05): stepper de puertas, vigencia y
/// confirmación. Al emitirlo, pasa a la pantalla que lo muestra.
class EmitirQrPagina extends ConsumerStatefulWidget {
  const new({this.prellenado, super.key});

  /// "Repetir último": puertas y etiqueta del QR anterior.
  final PrellenadoEmision? prellenado;

  @override
  ConsumerState<EmitirQrPagina> createState() => _EmitirQrPaginaEstado();
}

class _EmitirQrPaginaEstado extends ConsumerState<EmitirQrPagina> {
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
              .read(emitirQrControladorProvider.notifier)
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

  Future<void> _emitir() async {
    final qr = await ref.read(emitirQrControladorProvider.notifier).emitir();
    if (qr == null || !mounted) return;
    unawaited(HapticFeedback.lightImpact());
    context.go(Rutas.qrEmitido, extra: qr);
  }

  void _cerrar() => context.go(Rutas.inicio);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final estado = ref.watch(emitirQrControladorProvider);
    final controlador = ref.read(emitirQrControladorProvider.notifier);
    final puertas = ref.watch(puertasDisponiblesProvider);
    final ahora = ref.read(relojProvider)();
    final expandida = context.esExpandida;
    final errorDatos = estado.errorDatos;
    final errorApi = estado.errorApi;
    final pasos = [
      l10n.qrEmitirPasoPuertas,
      l10n.qrEmitirPasoVigencia,
      l10n.qrEmitirPasoConfirmar,
    ];
    final esUltimo = estado.paso == PasoEmision.confirmar;

    final contenidoDelPaso = switch (estado.paso) {
      PasoEmision.puertas => puertas.when(
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
          titulo: l10n.qrEmitirErrorPuertas,
          variante: error is ErrorApi && error.esSinConexion
              ? VarianteEstadoVacio.sinConexion
              : VarianteEstadoVacio.error,
          alAccionar: () => ref.invalidate(puertasDisponiblesProvider),
        ),
        data: (lista) => lista.isEmpty
            ? EstadoVacio(
                icono: Icons.door_front_door_outlined,
                titulo: l10n.qrEmitirSinPuertas,
                ayuda: l10n.qrEmitirSinPuertasAyuda,
              )
            : PasoPuertas(
                puertas: lista,
                seleccionadas: estado.puertaIds,
                alAlternar: controlador.alternarPuerta,
                alAlternarTodas: controlador.alternarTodas,
              ),
      ),
      PasoEmision.vigencia => PasoVigencia(
        vigencia: estado.vigencia,
        alElegir: controlador.elegirVigencia,
        etiqueta: estado.etiqueta,
        controladorEtiqueta: _etiqueta,
        alCambiarEtiqueta: controlador.cambiarEtiqueta,
        textoError:
            errorDatos == null || errorDatos == ErrorDatosEmision.sinPuertas
            ? null
            : textoErrorDatosEmision(l10n, errorDatos),
        ahora: ahora,
      ),
      PasoEmision.confirmar => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.qrEmitirRevisa,
            style: Theme.of(context).textTheme.bodyLarge
                ?.copyWith(color: tokens.colores.textoSecundario),
          ),
          SizedBox(height: tokens.espacio.l),
          if (!expandida)
            ResumenEmision(
              puertas: puertas.value ?? const [],
              seleccionadas: estado.puertaIds,
              vigencia: estado.vigencia,
              etiqueta: estado.etiqueta,
              ahora: ahora,
            ),
          SizedBox(height: tokens.espacio.l),
          AccesoAviso(
            tono: TonoAviso.informacion,
            texto: l10n.qrEmitirAvisoUnSoloUso,
          ),
        ],
      ),
    };

    final avisoDeError = <Widget>[
      if (errorDatos == ErrorDatosEmision.sinPuertas &&
          estado.paso == PasoEmision.puertas)
        AccesoAviso(
          tono: TonoAviso.peligro,
          texto: textoErrorDatosEmision(l10n, errorDatos!),
        ),
      if (errorApi != null)
        AccesoAviso(
          tono: TonoAviso.peligro,
          texto: l10n.qrEmitirErrorEmitir(textoDeError(l10n, errorApi)),
        ),
    ];

    final botonPrincipal = AccesoBoton(
      texto: esUltimo ? l10n.qrEmitirBoton : l10n.comunSiguiente,
      textoCargando: l10n.qrEmitiendo,
      cargando: estado.enviando,
      expandido: expandida,
      onPressed: esUltimo ? _emitir : controlador.siguiente,
    );
    final botonAtras = AccesoBoton(
      texto: l10n.comunAtras,
      variante: VarianteBoton.texto,
      onPressed: estado.paso == PasoEmision.puertas ? null : controlador.atras,
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
        destino: DestinoNav.emitirQr,
        titulo: l10n.qrEmitirTitulo,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: cuerpo),
            SizedBox(width: tokens.espacio.xl),
            SizedBox(
              width: tokens.tamano.resumenLateral,
              child: ResumenEmision(
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
                    if (estado.paso != PasoEmision.puertas) ...[
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

    final cantidad = estado.puertaIds.length;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: estado.paso == PasoEmision.puertas
              ? l10n.comunCerrar
              : l10n.comunAtras,
          icon: Icon(
            estado.paso == PasoEmision.puertas ? Icons.close : Icons.arrow_back,
          ),
          onPressed: estado.paso == PasoEmision.puertas
              ? _cerrar
              : controlador.atras,
        ),
        title: Text(l10n.qrEmitirTitulo),
      ),
      body: SafeArea(
        child: Column(
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
              inicio: estado.paso == PasoEmision.puertas
                  ? Text.rich(
                      TextSpan(
                        text: '$cantidad ',
                        style: Theme.of(context).textTheme.titleMedium,
                        children: [
                          TextSpan(
                            text: l10n.qrEmitirPuertasContadas(cantidad),
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
    );
  }
}

Widget _nada(BuildContext context, Puerta puerta) => const SizedBox.shrink();
void _ignorar(int pagina) {}
void _nadaQueHacer() {}
