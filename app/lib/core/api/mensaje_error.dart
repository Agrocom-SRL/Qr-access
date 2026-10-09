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
    'sesion.refresco_invalido' => l10n.comunErrorSesionRefrescoInvalido,
    'qr.ya_usado' => l10n.comunErrorQrYaUsado,
    'validacion.invalida' => l10n.comunErrorValidacionInvalida,
    _ => l10n.comunErrorGenerico,
  };
}
