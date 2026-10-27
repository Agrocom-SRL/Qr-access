import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/acciones_propuestas.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:agrocom_acceso/features/incidentes/presentation/incidentes_controlador.dart';
import 'package:agrocom_acceso/features/incidentes/presentation/textos_de_incidente.dart';
import 'package:agrocom_acceso/features/incidentes/presentation/widgets/formulario_resolucion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/boton_salida_cabecera.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Un incidente con su evidencia (solo ids, contados aquí), su resolución y su
/// historial (ADR 0033 §4). Confirmar, descartar o dejar pendiente es un cambio
/// de estado: pide confirmación, y tras guardar la pantalla se queda aquí con
/// lo que pasó (la reincidencia, si se cruzó el umbral).
class IncidenteDetallePagina extends ConsumerStatefulWidget {
  const new({required this.id, super.key});

  final String id;

  @override
  ConsumerState<IncidenteDetallePagina> createState() =>
      _IncidenteDetallePaginaState();
}

class _IncidenteDetallePaginaState
    extends ConsumerState<IncidenteDetallePagina> {
  /// Lo último que devolvió la API al resolver, para decir qué pasó.
  RespuestaDeResolucion? _ultima;

  Future<void> _resolver(
    Incidente incidente,
    ResultadoDeResolucion resultado,
    String motivo,
  ) async {
    final l10n = context.l10n;
    final confirmado = await _confirmar(incidente, resultado);
    if (!confirmado || !mounted) return;

    final envio = await ref
        .read(resolucionIncidenteProvider.notifier)
        .resolver(
          incidente.id,
          resultado: resultado,
          motivo: motivoAEnviar(motivo),
        );
    if (!mounted) return;
    final error = envio.error;
    if (error != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(textoDeError(l10n, error))));
      return;
    }
    setState(() => _ultima = envio.respuesta);
  }

  /// La ficha "estado actual → estado destino" y el botón con el tono del
  /// estado destino (guía de pantallas §4).
  Future<bool> _confirmar(
    Incidente incidente,
    ResultadoDeResolucion resultado,
  ) {
    final l10n = context.l10n;
    final destino = estadoDeResultado(resultado);
    final (titulo, mensaje) = switch (resultado) {
      ResultadoDeResolucion.confirmado => (
        l10n.incidenteResolverConfirmarTitulo,
        l10n.incidenteResolverConfirmarMensaje,
      ),
      ResultadoDeResolucion.descartado => (
        l10n.incidenteResolverDescartarTitulo,
        l10n.incidenteResolverDescartarMensaje,
      ),
      ResultadoDeResolucion.pendiente => (
        l10n.incidenteResolverPendienteTitulo,
        l10n.incidenteResolverPendienteMensaje,
      ),
    };
    final tono = _tonoDeDecision(resultado);
    return ConfirmarDialogo.mostrar(
      context,
      titulo: titulo,
      mensaje: mensaje,
      textoConfirmar: textoDeDecision(l10n, resultado),
      detalle: nombreDeUsuario(l10n, incidente.usuarioEtiqueta),
      icono: _iconoDeDecision(resultado),
      tonoIcono: tono,
      variante: _varianteDeDecision(resultado),
      transicion: TransicionDeEstado(
        actual: textoDeEstado(l10n, incidente.estado),
        tonoActual: tonoDeEstado(incidente.estado),
        destino: textoDeEstado(l10n, destino),
        tonoDestino: tonoDeEstado(destino),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final sesion = ref.watch(sesionControladorProvider);
    final incidente = ref.watch(incidenteProvider(widget.id));
    final guardando = ref.watch(resolucionIncidenteProvider);
    final politica = ref.watch(politicaIncidentesProvider).value;
    final usuarioActual = sesion is SesionAutenticada
        ? sesion.usuario.id
        : null;
    final propio =
        incidente.value != null &&
        usuarioActual != null &&
        incidente.value!.esDeUsuario(usuarioActual);
    final puedeResolver = sesion.tiene(Permisos.resolverIncidentes);
    final nombre = incidente.value == null
        ? null
        : nombreDeUsuario(l10n, incidente.value!.usuarioEtiqueta);

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: nombre == null ? null : l10n.incidenteDetalleTitulo(nombre),
      rutaAtras: Rutas.incidentes,
      salida: SalidaDeCabecera.volver,
      alSalir: () => context.go(Rutas.incidentes),
      anchoMaximo: context.tokens.tamano.maxFormularioSecciones,
      child: incidente.when(
        loading: () => const AccesoCargando(),
        error: (error, _) => EstadoVacio(
          variante: VarianteEstadoVacio.error,
          icono: Icons.error_outline,
          titulo: l10n.incidentesErrorCargar,
          ayuda: textoDeError(l10n, error),
          textoAccion: l10n.comunReintentar,
          iconoAccion: Icons.refresh,
          alAccionar: () => ref.invalidate(incidenteProvider(widget.id)),
        ),
        data: (datos) => _Contenido(
          incidente: datos,
          propio: propio,
          puedeResolver: puedeResolver,
          guardando: guardando,
          ultima: _ultima,
          politica: politica,
          alEnviar: (resultado, motivo) => _resolver(datos, resultado, motivo),
        ),
      ),
    );
  }
}

/// El cuerpo del detalle, ya con el incidente cargado.
class _Contenido extends StatelessWidget {
  const new({
    required this.incidente,
    required this.propio,
    required this.puedeResolver,
    required this.guardando,
    required this.ultima,
    required this.politica,
    required this.alEnviar,
  });

  final Incidente incidente;

  /// Es un incidente de quien mira: no se resuelve desde aquí (403).
  final bool propio;
  final bool puedeResolver;
  final bool guardando;
  final RespuestaDeResolucion? ultima;

  /// El umbral de la cuenta; `null` mientras no llega.
  final PoliticaDeIncidentes? politica;
  final void Function(ResultadoDeResolucion resultado, String motivo) alEnviar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final resolverAqui = puedeResolver && !propio;
    return SingleChildScrollView(
      padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (propio)
            AccesoAviso(
              tono: TonoAviso.informacion,
              texto: l10n.incidenteDetallePropio,
            )
          else if (!puedeResolver)
            AccesoAviso(
              tono: TonoAviso.informacion,
              texto: l10n.incidenteDetalleSoloLectura,
            ),
          if (propio || !puedeResolver) SizedBox(height: tokens.espacio.l),
          _SeccionDatos(incidente: incidente),
          SizedBox(height: tokens.espacio.l),
          _SeccionResolucion(incidente: incidente),
          if (resolverAqui) ...[
            SizedBox(height: tokens.espacio.l),
            _SeccionDecidir(
              guardando: guardando,
              ultima: ultima,
              politica: politica,
              alEnviar: alEnviar,
            ),
          ],
          if (incidente.historial.length > 1) ...[
            SizedBox(height: tokens.espacio.l),
            _SeccionHistorial(incidente: incidente),
          ],
        ],
      ),
    );
  }
}

/// Qué es el incidente: a quién se refiere, el tipo, cómo se abrió y lo que
/// escribió quien lo registró (texto libre, plano).
class _SeccionDatos extends StatelessWidget {
  const new({required this.incidente});

  final Incidente incidente;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final registradoPor = incidente.registradoPor;
    return AccesoTarjeta(
      relleno: EdgeInsets.all(tokens.espacio.l),
      child: Column(
        children: [
          FilaClaveValor(
            clave: l10n.incidenteDetalleUsuario,
            valor: nombreDeUsuario(l10n, incidente.usuarioEtiqueta),
          ),
          FilaClaveValor(
            clave: l10n.incidenteDetalleTipo,
            valor: textoDeTipoDeIncidente(l10n, incidente.tipo),
          ),
          FilaClaveValor(
            clave: l10n.incidentesColumnaGravedad,
            valor: textoDeGravedad(l10n, incidente.gravedad),
          ),
          FilaClaveValor(
            clave: l10n.incidenteDetalleOrigen,
            valor: registradoPor == null
                ? textoDeOrigen(l10n, incidente.origen)
                : l10n.incidenteDetalleOrigenYPersona(
                    textoDeOrigen(l10n, incidente.origen),
                    registradoPor,
                  ),
          ),
          FilaClaveValor(
            clave: l10n.incidenteDetalleOcurrido,
            valor: formatearFechaHora(incidente.ocurridoAt),
            valorMono: true,
          ),
          FilaClaveValor(
            clave: l10n.incidenteDetalleDescripcion,
            valor: incidente.descripcion ?? l10n.incidenteDetalleSinDescripcion,
            conSeparador: false,
          ),
          if (!incidente.evidencia.vacia)
            FilaClaveValor(
              clave: l10n.incidenteDetalleEvidencia,
              valor: l10n.incidenteDetalleEvidenciaCifras(
                incidente.evidencia.cuantosQr,
                incidente.evidencia.cuantosAccesos,
                incidente.evidencia.cuantosLimites,
              ),
              conSeparador: false,
            ),
        ],
      ),
    );
  }
}

/// La última decisión, con su estado y su motivo.
class _SeccionResolucion extends StatelessWidget {
  const new({required this.incidente});

  final Incidente incidente;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final resolucion = incidente.resolucion;
    return AccesoTarjeta(
      relleno: EdgeInsets.all(tokens.espacio.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.incidenteDetalleResolucion,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          SizedBox(height: tokens.espacio.s),
          Row(
            children: [
              AccesoBadge(
                texto: textoDeEstado(l10n, incidente.estado),
                tono: tonoDeEstado(incidente.estado),
              ),
            ],
          ),
          SizedBox(height: tokens.espacio.s),
          if (resolucion == null)
            Text(l10n.incidenteDetalleSinResolver)
          else
            _TextoDeResolucion(resolucion: resolucion),
        ],
      ),
    );
  }
}

/// Quién resolvió, cuándo y con qué motivo (o "Sin motivo").
class _TextoDeResolucion extends StatelessWidget {
  const new({required this.resolucion});

  final ResolucionDeIncidente resolucion;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final secundario = Theme.of(context).textTheme.bodyMedium
        ?.copyWith(color: tokens.colores.textoSecundario);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.incidenteDetalleResueltoPor(
            nombreDeUsuario(l10n, resolucion.resueltoPor),
            formatearFechaHora(resolucion.resueltaAt),
          ),
          style: secundario,
        ),
        SizedBox(height: tokens.espacio.xxs),
        Text(resolucion.motivo ?? l10n.incidenteDetalleSinMotivo),
      ],
    );
  }
}

/// El formulario de la decisión y, tras guardar, lo que dijo la API: el estado
/// nuevo y, si se confirmó, la reincidencia (ADR 0033 §4.3).
class _SeccionDecidir extends StatelessWidget {
  const new({
    required this.guardando,
    required this.ultima,
    required this.politica,
    required this.alEnviar,
  });

  final bool guardando;
  final RespuestaDeResolucion? ultima;
  final PoliticaDeIncidentes? politica;
  final void Function(ResultadoDeResolucion resultado, String motivo) alEnviar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final respuesta = ultima;
    return AccesoTarjeta(
      relleno: EdgeInsets.all(tokens.espacio.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.incidenteResolverTitulo,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (politica != null) ...[
            SizedBox(height: tokens.espacio.xs),
            _TextoDePolitica(politica: politica!),
          ],
          SizedBox(height: tokens.espacio.m),
          FormularioResolucion(guardando: guardando, alEnviar: alEnviar),
          if (respuesta != null) ...[
            SizedBox(height: tokens.espacio.l),
            AccesoAviso(
              tono: TonoAviso.informacion,
              titulo: l10n.incidenteResolucionGuardada(
                textoDeEstado(l10n, respuesta.incidente.estado),
              ),
              texto: _textoDeReincidencia(l10n, respuesta),
            ),
          ],
        ],
      ),
    );
  }
}

/// Qué dice la reincidencia tras confirmar: si la restricción automática ya
/// aplicó algo, si el sistema propone un paso o si todavía no se cruza el
/// umbral. Quien no confirmó no tiene reincidencia y no hay nada que decir.
String _textoDeReincidencia(
  AppLocalizations l10n,
  RespuestaDeResolucion respuesta,
) {
  final reincidencia = respuesta.reincidencia;
  final usuario = nombreDeUsuario(l10n, respuesta.incidente.usuarioEtiqueta);
  if (reincidencia == null) return l10n.incidenteReincidenciaSinPropuesta;
  if (reincidencia.aplicadaAutomaticamente) {
    return l10n.incidenteReincidenciaAplicada(usuario);
  }
  final propuesta = reincidencia.propuesta;
  if (propuesta == null) return l10n.incidenteReincidenciaSinPropuesta;
  return l10n.incidenteReincidenciaPropuesta(
    textoDeAccionPropuesta(l10n, propuesta.api),
    usuario,
    reincidencia.confirmados,
    reincidencia.minimo,
    reincidencia.ventanaDias,
  );
}

/// Todas las resoluciones, de la más reciente a la más antigua.
class _SeccionHistorial extends StatelessWidget {
  const new({required this.incidente});

  final Incidente incidente;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return AccesoTarjeta(
      relleno: EdgeInsets.all(tokens.espacio.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.incidenteDetalleHistorial,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          SizedBox(height: tokens.espacio.s),
          for (final resolucion in incidente.historial)
            Padding(
              padding: EdgeInsets.only(bottom: tokens.espacio.m),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AccesoBadge(
                    texto: textoDeEstado(
                      l10n,
                      estadoDeResultado(resolucion.resultado),
                    ),
                    tono: tonoDeEstado(estadoDeResultado(resolucion.resultado)),
                  ),
                  SizedBox(height: tokens.espacio.xxs),
                  _TextoDeResolucion(resolucion: resolucion),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

TonoCaja _tonoDeDecision(ResultadoDeResolucion resultado) =>
    switch (resultado) {
      ResultadoDeResolucion.confirmado => TonoCaja.peligro,
      ResultadoDeResolucion.descartado => TonoCaja.primario,
      ResultadoDeResolucion.pendiente => TonoCaja.advertencia,
    };

IconData _iconoDeDecision(ResultadoDeResolucion resultado) =>
    switch (resultado) {
      ResultadoDeResolucion.confirmado => Icons.gpp_maybe_outlined,
      ResultadoDeResolucion.descartado => Icons.check_circle_outline,
      ResultadoDeResolucion.pendiente => Icons.schedule,
    };

VarianteBoton _varianteDeDecision(ResultadoDeResolucion resultado) =>
    switch (resultado) {
      ResultadoDeResolucion.confirmado => VarianteBoton.peligroRelleno,
      ResultadoDeResolucion.descartado => VarianteBoton.primaria,
      ResultadoDeResolucion.pendiente => VarianteBoton.secundaria,
    };

/// El umbral de la cuenta, junto al formulario: cuántos confirmados hacen
/// falta para que el sistema proponga un paso (ADR 0033 §4.5).
class _TextoDePolitica extends StatelessWidget {
  const new({required this.politica});

  final PoliticaDeIncidentes politica;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final secundario = Theme.of(context).textTheme.bodyMedium
        ?.copyWith(color: tokens.colores.textoSecundario);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.incidentesPolitica(politica.minimo, politica.ventanaDias),
          style: secundario,
        ),
        if (politica.restriccionAutomatica) ...[
          SizedBox(height: tokens.espacio.xxs),
          Text(l10n.incidentesPoliticaRestriccion, style: secundario),
        ],
      ],
    );
  }
}
