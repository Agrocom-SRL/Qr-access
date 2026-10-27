import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/caja_icono.dart';
import 'package:flutter/material.dart';

/// Una tarjeta de la lista de Exportar datos: ícono, nombre, una línea de
/// descripción y su acción a todo el ancho. Mientras su recurso se baja, la
/// acción muestra el progreso.
class TarjetaRecursoExportable extends StatelessWidget {
  const new({
    required this.icono,
    required this.titulo,
    required this.descripcion,
    required this.textoAccion,
    required this.iconoAccion,
    required this.textoCargando,
    required this.cargando,
    required this.onPressed,
    super.key,
  });

  final IconData icono;
  final String titulo;
  final String descripcion;
  final String textoAccion;
  final IconData iconoAccion;
  final String textoCargando;

  /// Su recurso se está bajando.
  final bool cargando;

  /// `null` deja la acción apagada (otra descarga en curso).
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return AccesoTarjeta(
      relleno: EdgeInsets.all(tokens.espacio.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CajaIcono(icono: icono, tamano: tokens.tamano.iconoCaja),
              SizedBox(width: tokens.espacio.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(titulo, style: textos.titleMedium),
                    SizedBox(height: tokens.espacio.xxs),
                    Text(
                      descripcion,
                      style: textos.bodyMedium?.copyWith(
                        color: tokens.colores.textoSecundario,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: tokens.espacio.m),
          AccesoBoton(
            texto: textoAccion,
            textoCargando: textoCargando,
            icono: iconoAccion,
            cargando: cargando,
            expandido: true,
            onPressed: onPressed,
          ),
        ],
      ),
    );
  }
}
