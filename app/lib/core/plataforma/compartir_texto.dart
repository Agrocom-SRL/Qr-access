import 'package:agrocom_acceso/core/plataforma/compartir_imagen.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

/// Comparte un texto con el menú del sistema (WhatsApp, correo…). Lo usa el
/// PIN de un usuario nuevo (ADR 0028 §7): un canal de terceros, por eso la
/// pantalla avisa y la API deja registrado cada envío.
abstract interface class CompartirTexto {
  /// `compartido` si salió por algún canal; `copiado` si el dispositivo no
  /// tiene menú de compartir y el texto quedó en el portapapeles; `cancelado`
  /// si la persona cerró el menú.
  Future<ResultadoCompartir> compartir(String texto);
}

/// Implementación con `share_plus`.
class CompartirTextoConSistema implements CompartirTexto {
  const new();

  @override
  Future<ResultadoCompartir> compartir(String texto) async {
    final resultado = await SharePlus.instance.share(ShareParams(text: texto));
    switch (resultado.status) {
      case ShareResultStatus.success:
        return ResultadoCompartir.compartido;
      case ShareResultStatus.dismissed:
        return ResultadoCompartir.cancelado;
      case ShareResultStatus.unavailable:
        // Sin menú de compartir (web sin Web Share) el PIN no puede quedar
        // sin salida: se deja en el portapapeles para pegarlo donde se quiera.
        await Clipboard.setData(ClipboardData(text: texto));
        return ResultadoCompartir.copiado;
    }
  }
}

final compartirTextoProvider = Provider<CompartirTexto>(
  (ref) => const CompartirTextoConSistema(),
);
