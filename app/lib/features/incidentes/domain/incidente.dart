import 'package:flutter/foundation.dart';

/// Un incidente de uso (ADR 0033 §4): un hecho que el sistema o una persona
/// registran sobre un usuario. Lo que se decide después es la resolución. Nada
/// de esto limita el acceso por sí solo: solo la reincidencia propone un paso,
/// y lo decide una persona.

/// Tipos de incidente (ADR 0033 §4.1). `api` es el valor que manda la API.
enum TipoDeIncidente {
  usoMasivo('uso_masivo'),
  usoImposible('uso_imposible'),
  pinCompartido('pin_compartido'),
  qrReenviado('qr_reenviado'),
  generacionRuidosa('generacion_ruidosa'),
  perdidaORobo('perdida_o_robo'),
  otro('otro');

  new(this.api);

  final String api;

  /// Un tipo que la app no conoce cae en `otro`: el incidente se muestra igual.
  static TipoDeIncidente desdeApi(String valor) =>
      values.firstWhere((tipo) => tipo.api == valor, orElse: () => otro);
}

enum GravedadDeIncidente {
  baja('baja'),
  media('media'),
  alta('alta');

  new(this.api);

  final String api;

  static GravedadDeIncidente desdeApi(String valor) => values.firstWhere(
    (gravedad) => gravedad.api == valor,
    orElse: () => media,
  );
}

enum OrigenDeIncidente {
  sistema('sistema'),
  persona('persona');

  new(this.api);

  final String api;

  static OrigenDeIncidente desdeApi(String valor) =>
      values.firstWhere((origen) => origen.api == valor, orElse: () => sistema);
}

/// El estado de un incidente: sin resolver todavía, o el resultado de su última
/// resolución. `api` es el valor del filtro y del campo `estado`.
enum EstadoDeIncidente {
  sinResolver('sin_resolver'),
  pendiente('pendiente'),
  confirmado('confirmado'),
  descartado('descartado');

  new(this.api);

  final String api;

  static EstadoDeIncidente desdeApi(String valor) => values.firstWhere(
    (estado) => estado.api == valor,
    orElse: () => sinResolver,
  );
}

/// Lo que se puede decidir sobre un incidente.
enum ResultadoDeResolucion {
  pendiente('pendiente'),
  confirmado('confirmado'),
  descartado('descartado');

  new(this.api);

  final String api;

  /// El resultado de una resolución que viene de la API. Uno desconocido queda
  /// pendiente: no se da por confirmado ni descartado por error.
  static ResultadoDeResolucion desdeApi(String valor) => values.firstWhere(
    (resultado) => resultado.api == valor,
    orElse: () => pendiente,
  );
}

/// Lo que el sistema puede PROPONER ante un reincidente (ADR 0033 §4.3).
enum AccionPropuesta {
  restringir('restringir'),
  suspender('suspender'),
  suspenderYAnular('suspender_y_anular');

  new(this.api);

  final String api;

  /// `null` si la API no manda una acción conocida.
  static AccionPropuesta? desdeApi(String? valor) {
    for (final accion in values) {
      if (accion.api == valor) return accion;
    }
    return null;
  }
}

/// Cuántos ids de evidencia hay de cada clase. Son ids; nunca un token.
@immutable
class EvidenciaDeIncidente {
  const new({
    required this.cuantosQr,
    required this.cuantosAccesos,
    required this.cuantosLimites,
  });

  final int cuantosQr;
  final int cuantosAccesos;
  final int cuantosLimites;

  bool get vacia => cuantosQr + cuantosAccesos + cuantosLimites == 0;
}

/// Una resolución del historial: qué se decidió, con qué motivo y por quién.
@immutable
class ResolucionDeIncidente {
  const new({
    required this.resultado,
    required this.motivo,
    required this.resueltoPor,
    required this.resueltaAt,
  });

  final ResultadoDeResolucion resultado;

  /// Texto libre; `null` si no se escribió (descartar o dejar pendiente).
  final String? motivo;

  /// Etiqueta de quien resolvió; `null` si el usuario no tiene nombre.
  final String? resueltoPor;
  final DateTime resueltaAt;
}

@immutable
class Incidente {
  const new({
    required this.id,
    required this.usuarioId,
    required this.usuarioEtiqueta,
    required this.tipo,
    required this.gravedad,
    required this.origen,
    required this.registradoPor,
    required this.descripcion,
    required this.evidencia,
    required this.estado,
    required this.resolucion,
    required this.ocurridoAt,
    required this.historial,
  });

  final String id;

  /// El usuario al que se refiere el incidente. Quien lo ve sobre sí mismo no
  /// puede resolverlo (403 `incidente.propio`).
  final String usuarioId;

  /// Etiqueta del usuario, texto libre; `null` si no tiene nombre.
  final String? usuarioEtiqueta;
  final TipoDeIncidente tipo;
  final GravedadDeIncidente gravedad;
  final OrigenDeIncidente origen;

  /// Quién lo registró a mano; `null` si lo abrió el sistema.
  final String? registradoPor;

  /// Texto libre de quien lo registró; se muestra tal cual.
  final String? descripcion;
  final EvidenciaDeIncidente evidencia;
  final EstadoDeIncidente estado;

  /// La última resolución; `null` si nadie lo resolvió.
  final ResolucionDeIncidente? resolucion;
  final DateTime ocurridoAt;

  /// Todas las resoluciones, de la más reciente a la más antigua. Solo el
  /// detalle las trae.
  final List<ResolucionDeIncidente> historial;

  bool esDeUsuario(String usuarioActualId) => usuarioId == usuarioActualId;
}

/// La política de reincidencia de la cuenta (ADR 0033 §4.5).
@immutable
class PoliticaDeIncidentes {
  const new({
    required this.minimo,
    required this.ventanaDias,
    required this.restriccionAutomatica,
  });

  /// Cuántos incidentes CONFIRMADOS hacen falta para proponer un paso.
  final int minimo;
  final int ventanaDias;
  final bool restriccionAutomatica;
}

/// Las cifras de la reincidencia que devuelve confirmar un incidente.
@immutable
class ReincidenciaDeIncidente {
  const new({
    required this.confirmados,
    required this.minimo,
    required this.ventanaDias,
    required this.propuesta,
    required this.aplicadaAutomaticamente,
  });

  final int confirmados;
  final int minimo;
  final int ventanaDias;

  /// `null` si todavía no corresponde ningún paso.
  final AccionPropuesta? propuesta;
  final bool aplicadaAutomaticamente;
}

/// Lo que devuelve resolver un incidente: el incidente ya actualizado y, si se
/// evaluó la reincidencia, sus cifras.
@immutable
class RespuestaDeResolucion {
  const new({required this.incidente, required this.reincidencia});

  final Incidente incidente;

  /// Solo al confirmar; `null` en los demás resultados.
  final ReincidenciaDeIncidente? reincidencia;
}

/// Largo máximo del motivo de una resolución: lo mismo que la API
/// (`MAX_MOTIVO_DE_RESOLUCION`).
const maxMotivoDeResolucion = 200;

/// Confirmar exige motivo (422 `incidente.motivo_requerido`); descartar y dejar
/// pendiente, no.
bool exigeMotivo(ResultadoDeResolucion resultado) =>
    resultado == ResultadoDeResolucion.confirmado;

/// Se puede mandar la resolución: confirmar exige un motivo con algo escrito.
bool puedeGuardarResolucion({
  required ResultadoDeResolucion resultado,
  required String motivo,
}) => !exigeMotivo(resultado) || motivo.trim().isNotEmpty;

/// El motivo tal como se manda: sin espacios sobrantes, o `null` si está vacío
/// (la API lo acepta ausente cuando no hace falta).
String? motivoAEnviar(String motivo) {
  final limpio = motivo.trim();
  return limpio.isEmpty ? null : limpio;
}
