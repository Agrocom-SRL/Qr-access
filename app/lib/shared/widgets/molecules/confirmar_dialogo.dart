import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_badge.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:flutter/material.dart';

/// Ficha "estado actual → estado destino" del diálogo (guía §3).
class TransicionDeEstado {
  const new({
    required this.actual,
    required this.tonoActual,
    required this.destino,
    required this.tonoDestino,
  });

  final String actual;
  final TonoAcceso tonoActual;
  final String destino;
  final TonoAcceso tonoDestino;
}

/// Confirmación de toda baja o cambio de estado (guía de pantallas §3,
/// handoff C07b): ícono en caja, título, qué se afecta, la ficha de
/// transición y el mensaje. El botón de confirmar lleva el tono del estado
/// destino.
class ConfirmarDialogo extends StatelessWidget {
  const new({
    required this.titulo,
    required this.mensaje,
    required this.textoConfirmar,
    this.detalle,
    this.icono,
    this.tonoIcono = TonoCaja.peligro,
    this.transicion,
    this.variante = VarianteBoton.peligroRelleno,
    this.textoCancelar,
    super.key,
  });

  final String titulo;
  final String mensaje;
  final String textoConfirmar;

  /// Qué se va a afectar ("Proveedor de gas · Portón vehicular").
  final String? detalle;

  /// Ícono arriba del título, en una caja del tono de la acción.
  final IconData? icono;
  final TonoCaja tonoIcono;
  final TransicionDeEstado? transicion;
  final VarianteBoton variante;
  final String? textoCancelar;

  /// Abre el diálogo y devuelve `true` solo si la persona confirma. Cerrarlo
  /// de cualquier otra forma cuenta como cancelar.
  static Future<bool> mostrar(
    BuildContext context, {
    required String titulo,
    required String mensaje,
    required String textoConfirmar,
    String? detalle,
    IconData? icono,
    TonoCaja tonoIcono = TonoCaja.peligro,
    TransicionDeEstado? transicion,
    VarianteBoton variante = VarianteBoton.peligroRelleno,
    String? textoCancelar,
  }) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => ConfirmarDialogo(
        titulo: titulo,
        mensaje: mensaje,
        textoConfirmar: textoConfirmar,
        detalle: detalle,
        icono: icono,
        tonoIcono: tonoIcono,
        transicion: transicion,
        variante: variante,
        textoCancelar: textoCancelar,
      ),
    );
    return confirmado ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final transicion = this.transicion;
    return AlertDialog(
      icon: icono == null
          ? null
          : Align(
              alignment: AlignmentDirectional.centerStart,
              child: CajaIcono(
                icono: icono!,
                tono: tonoIcono,
                tamano: tokens.tamano.accesoRapido,
              ),
            ),
      iconPadding: EdgeInsets.fromLTRB(
        tokens.espacio.xl,
        tokens.espacio.xl,
        tokens.espacio.xl,
        0,
      ),
      title: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Text(titulo),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (detalle != null) ...[
            Text(detalle!, style: textos.titleMedium),
            SizedBox(height: tokens.espacio.m),
          ],
          if (transicion != null) ...[
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: tokens.espacio.s,
              runSpacing: tokens.espacio.xs,
              children: [
                AccesoBadge(
                  texto: transicion.actual,
                  tono: transicion.tonoActual,
                ),
                Icon(
                  Icons.arrow_forward,
                  size: tokens.tamano.icono,
                  color: tokens.colores.textoSecundario,
                ),
                AccesoBadge(
                  texto: transicion.destino,
                  tono: transicion.tonoDestino,
                ),
              ],
            ),
            SizedBox(height: tokens.espacio.m),
          ],
          Text(mensaje),
        ],
      ),
      actions: [
        AccesoBoton(
          texto: textoCancelar ?? context.l10n.comunCancelar,
          variante: VarianteBoton.texto,
          onPressed: () => Navigator.of(context).pop(false),
        ),
        AccesoBoton(
          texto: textoConfirmar,
          variante: variante,
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ],
    );
  }
}
