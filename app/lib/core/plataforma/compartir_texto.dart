import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

/// Comparte un texto con el menú del sistema (WhatsApp, correo…). Lo usa el
/// PIN de un usuario nuevo (ADR 0028 §7): un canal de terceros, por eso la
/// pantalla avisa y la API deja registrado cada envío.
abstract interface class CompartirTexto {
  /// `compartido` si salió por algún canal; `cancelado` si la persona cerró el
  /// menú o el dispositivo no tiene dónde compartir (para eso está "Copiar").
  Future<ResultadoCompartir> compartir(String texto);
}

/// Implementación con `share_plus`.
class CompartirTextoConSistema implements CompartirTexto {
  const new();

  @override
  Future<ResultadoCompartir> compartir(String texto) async {
    final resultado = await SharePlus.instance.share(ShareParams(text: texto));
    return resultado.status == ShareResultStatus.success
        ? ResultadoCompartir.compartido
        : ResultadoCompartir.cancelado;
  }
}

final compartirTextoProvider = Provider<CompartirTexto>(
  (ref) => const CompartirTextoConSistema(),
);
