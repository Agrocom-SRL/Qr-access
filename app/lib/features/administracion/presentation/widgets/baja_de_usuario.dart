import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/confirmar_dialogo.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Da de baja a un usuario con las confirmaciones de siempre: la baja se
/// confirma y, si quien cae tiene a otros a su cargo (un Titular con Miembros),
/// un segundo diálogo dice cuántos caerían con él antes de seguir (ADR 0028
/// §7). Lo usan el listado de usuarios y las estadísticas de uso.
Future<void> pedirBajaDeUsuario(
  BuildContext context,
  WidgetRef ref, {
  required String id,
  required String? etiqueta,
}) async {
  final l10n = context.l10n;
  final nombre = etiqueta ?? l10n.qrSinEtiqueta;
  final confirmado = await ConfirmarDialogo.mostrar(
    context,
    titulo: l10n.usuariosEliminarTitulo(nombre),
    mensaje: l10n.usuariosEliminarMensaje,
    textoConfirmar: l10n.comunEliminar,
  );
  if (!confirmado || !context.mounted) return;
  final acciones = ref.read(accionesUsuarioProvider.notifier);
  var error = await acciones.eliminar(id);
  // La API responde 409 con cuántos caerían; se muestra antes de confirmar.
  if (error?.code == 'usuario.con_dependientes' && context.mounted) {
    final cantidad = _dependientesDe(error!);
    final deAcuerdo = await ConfirmarDialogo.mostrar(
      context,
      titulo: l10n.usuariosEliminarTitulo(nombre),
      mensaje: l10n.usuariosEliminarCascadaMensaje(cantidad),
      textoConfirmar: l10n.comunEliminar,
    );
    if (!deAcuerdo || !context.mounted) return;
    error = await acciones.eliminar(id, confirmar: true);
  }
  if (error != null && context.mounted) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(textoDeError(l10n, error))));
  }
}

/// Cuántos usuarios caerían, según el 409 de la API; 0 si no vino el dato.
int _dependientesDe(ErrorApi error) => switch (error.detalles['dependientes']) {
  final int cantidad => cantidad,
  final num cantidad => cantidad.toInt(),
  _ => 0,
};
