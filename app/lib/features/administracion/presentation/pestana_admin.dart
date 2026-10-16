import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Pestañas de Administración en compacto.
enum PestanaAdmin { puertas, usuarios }

/// La pestaña elegida de Administración, guardada fuera de la pantalla: al
/// volver de un formulario (Usuarios) o de la gestión de sitios (Puertas) se
/// regresa a la pestaña de donde se salió, no siempre a la primera. `null`
/// deja que la pantalla elija según los permisos.
class PestanaAdminControlador extends Notifier<PestanaAdmin?> {
  @override
  PestanaAdmin? build() => null;

  /// Recuerda la pestaña elegida.
  // ignore: use_setters_to_change_properties, un setter no sirve de callback.
  void elegir(PestanaAdmin pestana) => state = pestana;
}

final NotifierProvider<PestanaAdminControlador, PestanaAdmin?>
pestanaAdminProvider = NotifierProvider<PestanaAdminControlador, PestanaAdmin?>(
  PestanaAdminControlador.new,
);
