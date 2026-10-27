import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/incidentes/domain/incidente.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';

/// Los textos de cada valor de un incidente. Son de la app, nunca de la API:
/// la API manda el valor, y aquí se nombra.

String textoDeTipoDeIncidente(AppLocalizations l10n, TipoDeIncidente tipo) =>
    switch (tipo) {
      TipoDeIncidente.usoMasivo => l10n.incidentesTipoUsoMasivo,
      TipoDeIncidente.usoImposible => l10n.incidentesTipoUsoImposible,
      TipoDeIncidente.pinCompartido => l10n.incidentesTipoPinCompartido,
      TipoDeIncidente.qrReenviado => l10n.incidentesTipoQrReenviado,
      TipoDeIncidente.generacionRuidosa => l10n.incidentesTipoGeneracionRuidosa,
      TipoDeIncidente.perdidaORobo => l10n.incidentesTipoPerdidaORobo,
      TipoDeIncidente.otro => l10n.incidentesTipoOtro,
    };

String textoDeGravedad(AppLocalizations l10n, GravedadDeIncidente gravedad) =>
    switch (gravedad) {
      GravedadDeIncidente.baja => l10n.incidentesGravedadBaja,
      GravedadDeIncidente.media => l10n.incidentesGravedadMedia,
      GravedadDeIncidente.alta => l10n.incidentesGravedadAlta,
    };

String textoDeOrigen(AppLocalizations l10n, OrigenDeIncidente origen) =>
    switch (origen) {
      OrigenDeIncidente.sistema => l10n.incidentesOrigenSistema,
      OrigenDeIncidente.persona => l10n.incidentesOrigenPersona,
    };

String textoDeEstado(AppLocalizations l10n, EstadoDeIncidente estado) =>
    switch (estado) {
      EstadoDeIncidente.sinResolver => l10n.incidentesEstadoSinResolver,
      EstadoDeIncidente.pendiente => l10n.incidentesEstadoPendiente,
      EstadoDeIncidente.confirmado => l10n.incidentesEstadoConfirmado,
      EstadoDeIncidente.descartado => l10n.incidentesEstadoDescartado,
    };

/// El tono del estado: lo confirmado pesa (peligro), lo pendiente pide
/// atención (advertencia) y lo que nadie resolvió aún es informativo.
TonoAcceso tonoDeEstado(EstadoDeIncidente estado) => switch (estado) {
  EstadoDeIncidente.sinResolver => TonoAcceso.informacion,
  EstadoDeIncidente.pendiente => TonoAcceso.advertencia,
  EstadoDeIncidente.confirmado => TonoAcceso.peligro,
  EstadoDeIncidente.descartado => TonoAcceso.neutro,
};

/// El estado al que pasa una resolución (lo que dice "Quedó guardado como…" y
/// la ficha de transición).
EstadoDeIncidente estadoDeResultado(ResultadoDeResolucion resultado) =>
    switch (resultado) {
      ResultadoDeResolucion.pendiente => EstadoDeIncidente.pendiente,
      ResultadoDeResolucion.confirmado => EstadoDeIncidente.confirmado,
      ResultadoDeResolucion.descartado => EstadoDeIncidente.descartado,
    };

/// La opción con la que se decide (el verbo del selector y del botón).
String textoDeDecision(
  AppLocalizations l10n,
  ResultadoDeResolucion resultado,
) => switch (resultado) {
  ResultadoDeResolucion.pendiente => l10n.incidenteResolverPendiente,
  ResultadoDeResolucion.confirmado => l10n.incidenteResolverConfirmar,
  ResultadoDeResolucion.descartado => l10n.incidenteResolverDescartar,
};

/// Quien no tiene etiqueta se nombra como "Usuario sin nombre".
String nombreDeUsuario(AppLocalizations l10n, String? etiqueta) =>
    etiqueta ?? l10n.incidentesUsuarioSinNombre;
