import 'package:agrocom_acceso/core/l10n/acciones_propuestas.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/notificaciones/domain/notificacion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:flutter/material.dart';

/// Cómo se nombra cada tipo de aviso. Los textos son de la app, nunca del
/// servidor; un tipo sin texto propio cae en el genérico.
String textoDeTipo(
  AppLocalizations l10n,
  TipoNotificacion tipo,
) => switch (tipo) {
  TipoNotificacion.placaCaidaSostenida =>
    l10n.notificacionTipoPlacaCaidaSostenida,
  TipoNotificacion.placaDesaparecida => l10n.notificacionTipoPlacaDesaparecida,
  TipoNotificacion.placaLectorSinRespuesta =>
    l10n.notificacionTipoPlacaLectorSinRespuesta,
  TipoNotificacion.placaRecuperada => l10n.notificacionTipoPlacaRecuperada,
  TipoNotificacion.aperturaFallida => l10n.notificacionTipoAperturaFallida,
  TipoNotificacion.propuestaIncidente =>
    l10n.notificacionTipoPropuestaIncidente,
  TipoNotificacion.senalUsoMasivo => l10n.notificacionTipoSenalUsoMasivo,
  TipoNotificacion.senalUsoImposible => l10n.notificacionTipoSenalUsoImposible,
  TipoNotificacion.senalQrReenviado => l10n.notificacionTipoSenalQrReenviado,
  TipoNotificacion.senalPinCompartido =>
    l10n.notificacionTipoSenalPinCompartido,
  TipoNotificacion.bolsaAviso => l10n.notificacionTipoBolsaAviso,
  TipoNotificacion.bolsaSuperada => l10n.notificacionTipoBolsaSuperada,
  TipoNotificacion.flujoAtipico => l10n.notificacionTipoFlujoAtipico,
  TipoNotificacion.desconocido => l10n.notificacionTipoDesconocido,
};

String textoDeSeveridad(AppLocalizations l10n, Severidad severidad) =>
    switch (severidad) {
      Severidad.info => l10n.notificacionSeveridadInfo,
      Severidad.aviso => l10n.notificacionSeveridadAviso,
      Severidad.critica => l10n.notificacionSeveridadCritica,
    };

/// El color de la severidad: la crítica en peligro, el aviso en advertencia y
/// lo informativo en información (colores semánticos, nunca literales).
TonoAcceso tonoDeSeveridad(Severidad severidad) => switch (severidad) {
  Severidad.info => TonoAcceso.informacion,
  Severidad.aviso => TonoAcceso.advertencia,
  Severidad.critica => TonoAcceso.peligro,
};

TonoCaja tonoCajaDeSeveridad(Severidad severidad) => switch (severidad) {
  Severidad.info => TonoCaja.informacion,
  Severidad.aviso => TonoCaja.advertencia,
  Severidad.critica => TonoCaja.peligro,
};

IconData iconoDeSeveridad(Severidad severidad) => switch (severidad) {
  Severidad.info => Icons.info_outline,
  Severidad.aviso => Icons.warning_amber_outlined,
  Severidad.critica => Icons.error_outline,
};

/// Lo que dice a quién o a dónde se refiere el aviso, en una línea: primero
/// las puertas, luego el usuario y luego el sitio. Todo es texto plano.
String? detalleDeNotificacion(AppLocalizations l10n, Notificacion aviso) {
  final propuesta = aviso.propuesta;
  if (propuesta != null) return _detalleDePropuesta(l10n, aviso, propuesta);
  if (aviso.puertas.isNotEmpty) {
    return l10n.notificacionDetallePuertas(aviso.puertas.join(', '));
  }
  if (aviso.usuario != null) {
    return l10n.notificacionDetalleUsuario(aviso.usuario!);
  }
  if (aviso.sitio != null) {
    return l10n.notificacionDetalleSitio(aviso.sitio!);
  }
  return null;
}

/// La propuesta dice a quién se refiere, qué paso sugiere y con cuántas cifras.
/// Si el sistema ya aplicó la restricción, dice eso (ADR 0033 §4.4). El usuario
/// sin etiqueta se nombra como en los incidentes.
String _detalleDePropuesta(
  AppLocalizations l10n,
  Notificacion aviso,
  PropuestaDeIncidente propuesta,
) {
  final usuario = aviso.usuario ?? l10n.incidentesUsuarioSinNombre;
  if (propuesta.aplicadaAutomaticamente) {
    return l10n.incidenteReincidenciaAplicada(usuario);
  }
  return l10n.notificacionDetallePropuesta(
    usuario,
    textoDeAccionPropuesta(l10n, propuesta.accion),
    propuesta.confirmados,
    propuesta.minimo,
    propuesta.ventanaDias,
  );
}
