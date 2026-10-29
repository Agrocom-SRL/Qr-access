/// Superficie pública de la feature `apertura_manual` (ADR 0003): abrir una
/// puerta desde la app sin QR y que el administrador la encienda por puerta
/// (ADR 0035). Lo único que otras features pueden importar.
library;

export 'presentation/abrir_puerta_pagina.dart' show AbrirPuertaPagina;
export 'presentation/apertura_manual_admin_pagina.dart'
    show AperturaManualAdminPagina;
