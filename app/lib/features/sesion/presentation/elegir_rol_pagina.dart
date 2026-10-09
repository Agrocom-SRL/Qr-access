import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/sesion/presentation/elegir_rol_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/tarjeta_seleccionable.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Elegir el rol activo cuando el usuario tiene varios (ADR 0004, handoff
/// C03/E03): tarjetas seleccionables con el último rol preseleccionado.
class ElegirRolPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<ElegirRolPagina> createState() => _ElegirRolPaginaEstado();
}

class _ElegirRolPaginaEstado extends ConsumerState<ElegirRolPagina> {
  String? _elegido;

  @override
  Widget build(BuildContext context) {
    final sesion = ref.watch(sesionControladorProvider);
    if (sesion is! SesionEligiendoRol) return const AccesoCargando();

    final estado = ref.watch(elegirRolControladorProvider);
    final controlador = ref.read(elegirRolControladorProvider.notifier);
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    final errorApi = estado.errorApi;
    final elegido =
        _elegido ?? sesion.rolPreferidoId ?? sesion.roles.firstOrNull?.id;

    final expandida = context.esExpandida;
    final continuar = AccesoBoton(
      texto: l10n.comunContinuar,
      textoCargando: l10n.comunCargando,
      cargando: estado.enviando,
      expandido: true,
      onPressed: elegido == null ? null : () => controlador.elegir(elegido),
    );
    final cerrar = AccesoBoton(
      texto: l10n.sesionCerrar,
      variante: VarianteBoton.texto,
      onPressed: controlador.cerrar,
    );
    final alineacion = expandida
        ? CrossAxisAlignment.center
        : CrossAxisAlignment.start;
    final centrado = expandida ? TextAlign.center : TextAlign.start;
    final tarjetas = [
      for (final rol in sesion.roles)
        TarjetaSeleccionable(
          titulo: rol.nombre,
          subtitulo: descripcionDeRol(l10n, rol.nombre),
          icono: iconoDeRol(rol.nombre),
          vertical: expandida,
          seleccionada: rol.id == elegido,
          alElegir: () => setState(() => _elegido = rol.id),
        ),
    ];

    return PlantillaAuth(
      // En expandido (E03) no hay panel de marca: tarjetas en fila, centradas.
      conPanelDeMarca: false,
      centrado: true,
      anchoMaximo: expandida ? tokens.tamano.maxFormulario : null,
      pie: expandida
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                continuar,
                SizedBox(height: tokens.espacio.s),
                cerrar,
              ],
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            crossAxisAlignment: alineacion,
            children: [
              Text(
                l10n.perfilCuentaYCodigo(
                  sesion.cuenta.nombre,
                  sesion.cuenta.codigo,
                ),
                textAlign: centrado,
                style: textos.bodyLarge?.copyWith(
                  color: tokens.colores.textoSecundario,
                ),
              ),
              SizedBox(height: tokens.espacio.s),
              Text(
                l10n.sesionElegirRolTitulo,
                textAlign: centrado,
                style: expandida ? textos.headlineMedium : textos.headlineLarge,
              ),
              SizedBox(height: tokens.espacio.s),
              Text(
                l10n.sesionElegirRolAyuda,
                textAlign: centrado,
                style: textos.bodyLarge?.copyWith(
                  color: tokens.colores.textoSecundario,
                ),
              ),
            ],
          ),
          SizedBox(height: tokens.espacio.xl),
          if (expandida)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < tarjetas.length; i++) ...[
                    Expanded(child: tarjetas[i]),
                    if (i < tarjetas.length - 1)
                      SizedBox(width: tokens.espacio.l),
                  ],
                ],
              ),
            )
          else
            for (final tarjeta in tarjetas) ...[
              tarjeta,
              SizedBox(height: tokens.espacio.m),
            ],
          if (errorApi != null) ...[
            SizedBox(height: tokens.espacio.s),
            AccesoAviso(
              tono: TonoAviso.peligro,
              texto: textoDeError(l10n, errorApi),
            ),
          ],
          if (expandida) ...[
            SizedBox(height: tokens.espacio.xl),
            Center(
              child: SizedBox(
                width: tokens.tamano.maxAuth - tokens.espacio.xxxl * 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    continuar,
                    SizedBox(height: tokens.espacio.s),
                    cerrar,
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Ícono según el nombre del rol: los roles los define cada cuenta, así que
/// es una ayuda visual para los nombres habituales, no una regla.
IconData iconoDeRol(String nombre) => switch (nombre.toLowerCase()) {
  'administrador' || 'administradora' => Icons.admin_panel_settings_outlined,
  'guardia' || 'portería' || 'porteria' => Icons.shield_outlined,
  _ => Icons.person_outline,
};

/// Descripción corta para los roles habituales; `null` para uno a medida.
String? descripcionDeRol(AppLocalizations l10n, String nombre) =>
    switch (nombre.toLowerCase()) {
      'administrador' || 'administradora' => l10n.rolDescripcionAdministrador,
      'guardia' || 'portería' || 'porteria' => l10n.rolDescripcionGuardia,
      'usuario' || 'usuaria' => l10n.rolDescripcionUsuario,
      _ => null,
    };
