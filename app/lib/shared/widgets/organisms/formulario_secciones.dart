import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:flutter/material.dart';

/// Una sección del formulario: título en mayúsculas y sus campos.
class SeccionDeFormulario {
  const new({required this.titulo, required this.campos});

  final String titulo;
  final List<Widget> campos;
}

/// Formulario por secciones (handoff §Organismos): ancho máximo 640 centrado
/// en expandido; acciones fijas abajo en compacto, a la derecha en expandido.
class FormularioSecciones extends StatelessWidget {
  const new({
    required this.secciones,
    required this.acciones,
    this.aviso,
    super.key,
  });

  final List<SeccionDeFormulario> secciones;

  /// Botones (Cancelar, Guardar), en orden.
  final List<Widget> acciones;

  /// Un aviso (error de la API) sobre las acciones.
  final Widget? aviso;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final compacta = context.esCompacta;
    final cuerpo = SingleChildScrollView(
      padding: EdgeInsets.all(tokens.espacio.l),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: tokens.tamano.maxFormularioSecciones,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final seccion in secciones) ...[
                Padding(
                  padding: EdgeInsets.only(
                    left: tokens.espacio.xs,
                    bottom: tokens.espacio.s,
                  ),
                  child: Text(
                    seccion.titulo.toUpperCase(),
                    style: textos.labelSmall?.copyWith(
                      color: tokens.colores.textoSecundario,
                      letterSpacing: tokens.espacio.xxs / 2,
                    ),
                  ),
                ),
                AccesoTarjeta(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var i = 0; i < seccion.campos.length; i++) ...[
                        seccion.campos[i],
                        if (i < seccion.campos.length - 1)
                          SizedBox(height: tokens.espacio.l),
                      ],
                    ],
                  ),
                ),
                SizedBox(height: tokens.espacio.xl),
              ],
              if (aviso != null) ...[
                aviso!,
                SizedBox(height: tokens.espacio.l),
              ],
              if (!compacta)
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    for (var i = 0; i < acciones.length; i++) ...[
                      acciones[i],
                      if (i < acciones.length - 1)
                        SizedBox(width: tokens.espacio.m),
                    ],
                  ],
                ),
            ],
          ),
        ),
      ),
    );
    if (!compacta) return cuerpo;
    return Column(
      children: [
        Expanded(child: cuerpo),
        BarraDeAcciones(acciones: acciones),
      ],
    );
  }
}

/// Barra fija al pie con las acciones del formulario o del paso (compacto).
class BarraDeAcciones extends StatelessWidget {
  const new({required this.acciones, this.inicio, super.key});

  final List<Widget> acciones;

  /// Algo a la izquierda ("2 puertas").
  final Widget? inicio;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: EdgeInsets.all(tokens.espacio.l),
      decoration: BoxDecoration(
        color: tokens.colores.superficie,
        border: Border(top: BorderSide(color: tokens.colores.borde)),
      ),
      child: SafeArea(
        top: false,
        // Las acciones quedan pegadas al borde derecho (handoff C05). Con
        // [inicio], este es el único elástico y las acciones miden lo suyo;
        // sin él, las acciones reparten el ancho para no desbordar.
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            if (inicio != null)
              Expanded(
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: inicio,
                ),
              ),
            for (var i = 0; i < acciones.length; i++) ...[
              if (inicio == null) Flexible(child: acciones[i]) else acciones[i],
              if (i < acciones.length - 1) SizedBox(width: tokens.espacio.m),
            ],
          ],
        ),
      ),
    );
  }
}
