/// Superficie pública de la feature `qr_accesos` (ADR 0003): las pantallas que
/// el router registra y lo que el tablero necesita para "Vigentes hoy".
library;

export 'data/qr_accesos_repositorio.dart'
    show QrAccesosRepositorio, qrAccesosRepositorioProvider;
export 'domain/datos_emision_qr.dart' show PrellenadoEmision;
export 'domain/estado_qr.dart';
export 'domain/qr_acceso.dart';
export 'presentation/emitir_qr_pagina.dart' show EmitirQrPagina;
export 'presentation/mis_qr_pagina.dart' show MisQrPagina;
export 'presentation/mostrar_qr_pagina.dart' show MostrarQrPagina;
export 'presentation/widgets/tarjeta_qr.dart' show TarjetaQr;
