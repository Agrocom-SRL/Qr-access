/// Superficie pública de la feature `administracion` (ADR 0003): las pantallas
/// que el router registra.
library;

export 'domain/usuario.dart' show PinGenerado;
export 'presentation/administracion_pagina.dart'
    show AdministracionPagina, PuertasAdminPagina, UsuariosPagina;
export 'presentation/pin_generado_pagina.dart' show PinGeneradoPagina;
export 'presentation/usuario_formulario_pagina.dart'
    show UsuarioFormularioPagina;
