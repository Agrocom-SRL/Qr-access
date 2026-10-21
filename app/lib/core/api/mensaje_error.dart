import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';

/// Texto para mostrar ante cualquier error (ADR 0013): el `code` de la API se
/// traduce aquí, en un solo lugar. Un `code` sin traducción muestra el
/// genérico; la app nunca muestra el mensaje crudo del servidor.
String textoDeError(AppLocalizations l10n, Object error) {
  if (error is! ErrorApi) return l10n.comunErrorGenerico;
  return switch (error.code) {
    ErrorApi.sinConexion => l10n.comunErrorSinConexion,
    'sesion.credenciales_invalidas' =>
      l10n.comunErrorSesionCredencialesInvalidas,
    'sesion.bloqueada' => l10n.comunErrorSesionBloqueada,
    'sesion.refresco_invalido' ||
    'autenticacion.requerida' => l10n.comunErrorSesionRefrescoInvalido,
    'permiso.denegado' => l10n.comunErrorPermisoDenegado,
    'suscripcion.vencida' => l10n.comunErrorSuscripcionVencida,
    'puerta.no_encontrada' => l10n.comunErrorPuertaNoEncontrada,
    'qr.no_encontrado' => l10n.comunErrorQrNoEncontrado,
    'qr.propio_en_curso' => l10n.comunErrorQrPropioEnCurso,
    'qr.ya_usado' => l10n.comunErrorQrYaUsado,
    'qr.vigencia_invalida' => l10n.comunErrorQrVigenciaInvalida,
    'qr.vigencia_excedida' => l10n.comunErrorQrVigenciaExcedida,
    'validacion.invalida' => l10n.comunErrorValidacionInvalida,
    'usuario.no_encontrado' => l10n.comunErrorUsuarioNoEncontrado,
    'usuario.propio' => l10n.comunErrorUsuarioPropio,
    'rol.no_encontrado' => l10n.comunErrorRolNoEncontrado,
    'rol.permisos_excedidos' => l10n.comunErrorRolPermisosExcedidos,
    'plan.limite_usuarios' => l10n.comunErrorPlanLimiteUsuarios,
    'pin.sufijo_en_uso' => l10n.comunErrorPinSufijoEnUso,
    'sitio.nombre_existente' => l10n.comunErrorSitioNombreExistente,
    'puerta.nombre_existente' => l10n.comunErrorPuertaNombreExistente,
    'sitio.con_puertas' => l10n.comunErrorSitioConPuertas,
    'puerta.con_dispositivo' => l10n.comunErrorPuertaConDispositivo,
    'sitio.no_encontrado' => l10n.comunErrorSitioNoEncontrado,
    'sesion.sin_rol' => l10n.comunErrorSesionSinRol,
    'unidad.requerida' => l10n.comunErrorUnidadRequerida,
    'unidad.no_corresponde' => l10n.comunErrorUnidadNoCorresponde,
    'unidad.nombre_existente' => l10n.comunErrorUnidadNombreExistente,
    'usuario.nivel_no_permitido' => l10n.comunErrorUsuarioNivelNoPermitido,
    'usuario.con_dependientes' => l10n.comunErrorUsuarioConDependientes,
    'plan.limite_miembros_por_titular' => l10n.comunErrorPlanLimiteMiembros,
    _ => l10n.comunErrorGenerico,
  };
}
