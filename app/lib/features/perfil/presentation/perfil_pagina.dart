import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/data/perfil_repositorio.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/dialogo_nombre.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/menu_perfil.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_foto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Días de suscripción por debajo de los cuales la fila pasa a advertencia.
const diasDeAvisoDeSuscripcion = 15;

/// Perfil y cuenta (handoff C09/E09): quién soy, la cuenta y su plan, el rol y
/// "Cerrar sesión". Lo demás (ajustes, incidentes, apertura manual, seguridad)
/// cuelga del menú de tres puntos, según el rol.
class PerfilPagina extends ConsumerWidget {
  const new({super.key});

  /// Cada persona edita solo su nombre; el PIN lo administra la cuenta.
  Future<void> _cambiarNombre(
    BuildContext context,
    WidgetRef ref,
    String? actual,
  ) async {
    final nombre = await pedirNombre(context, actual: actual);
    if (nombre == null || !context.mounted) return;
    try {
      await ref.read(perfilRepositorioProvider).cambiarNombre(nombre);
      await ref.read(sesionControladorProvider.notifier).refrescarDatos();
    } on Object catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(textoDeError(context.l10n, error))),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionControladorProvider);
    if (sesion is! SesionAutenticada) return const AccesoCargando();
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final ahora = ref.read(relojProvider)();
    final suscripcion = sesion.suscripcion;
    final dias = suscripcion == null
        ? null
        : diasRestantes(suscripcion.hasta, ahora);
    final enAviso = dias != null && dias < diasDeAvisoDeSuscripcion;

    // Sin título de pantalla: la página empieza por el bloque del usuario.
    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      anchoMaximo: tokens.tamano.maxFormulario,
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(vertical: tokens.espacio.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                AccesoAvatar(
                  etiqueta: sesion.usuario.etiqueta,
                  tamano: tokens.tamano.avatarGrande,
                ),
                SizedBox(width: tokens.espacio.l),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              sesion.usuario.etiqueta ?? l10n.qrSinEtiqueta,
                              style: textos.headlineSmall,
                            ),
                          ),
                          IconButton(
                            tooltip: l10n.perfilEditarNombre,
                            onPressed: () => _cambiarNombre(
                              context,
                              ref,
                              sesion.usuario.etiqueta,
                            ),
                            icon: const Icon(Icons.edit_outlined),
                          ),
                        ],
                      ),
                      Text(
                        l10n.perfilPinDeCuenta(sesion.cuenta.codigo),
                        style: tokens.tipografia.mono(
                          tokens.tipografia.t14,
                          color: colores.textoSecundario,
                        ),
                      ),
                    ],
                  ),
                ),
                const MenuPerfil(),
              ],
            ),
            SizedBox(height: tokens.espacio.xl),
            _TarjetaCuenta(sesion: sesion),
            SizedBox(height: tokens.espacio.l),
            AccesoTarjeta(
              relleno: EdgeInsets.symmetric(horizontal: tokens.espacio.l),
              child: Column(
                children: [
                  FilaClaveValor(
                    clave: l10n.perfilRolActivo,
                    valor: sesion.rolActivo.nombre,
                    icono: Icons.badge_outlined,
                    invertida: true,
                  ),
                  FilaClaveValor(
                    clave: l10n.perfilSuscripcion,
                    valor: suscripcion == null
                        ? l10n.perfilSinSuscripcion
                        : l10n.perfilSuscripcionActiva(dias!),
                    valorEnAdvertencia: enAviso || suscripcion == null,
                    icono: Icons.workspace_premium_outlined,
                    invertida: true,
                    claveEnfatizada: true,
                    conSeparador: false,
                  ),
                ],
              ),
            ),
            SizedBox(height: tokens.espacio.xxl),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: AccesoBoton(
                texto: l10n.sesionCerrar,
                textoCargando: l10n.sesionSaliendo,
                icono: Icons.logout,
                variante: VarianteBoton.peligroTonal,
                expandido: !context.esExpandida,
                onPressed: ref.read(sesionControladorProvider.notifier).cerrar,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// La cuenta: franja de foto arriba y debajo, sobre la superficie, el nombre,
/// el plan con su vencimiento y el código. Sin bloque verde: el color de marca
/// queda para el código.
class _TarjetaCuenta extends StatelessWidget {
  const new({required this.sesion});

  final SesionAutenticada sesion;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final suscripcion = sesion.suscripcion;
    return ClipRRect(
      borderRadius: BorderRadius.circular(tokens.radio.xl),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colores.superficie,
          border: Border.all(
            color: colores.borde,
            width: tokens.tamano.bordeFino,
          ),
          borderRadius: BorderRadius.circular(tokens.radio.xl),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: tokens.tamano.cabeceraFoto / 2,
              child: const AccesoFoto(
                ruta: Multimedia.fotoPorton,
                fundirConFondo: true,
                verdeEnClaro: true,
              ),
            ),
            Padding(
              padding: EdgeInsets.all(tokens.espacio.l),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(sesion.cuenta.nombre, style: textos.titleLarge),
                        SizedBox(height: tokens.espacio.xs),
                        Text(
                          suscripcion == null
                              ? l10n.perfilSinSuscripcion
                              : l10n.perfilPlanVence(
                                  suscripcion.plan,
                                  formatearFecha(suscripcion.hasta),
                                ),
                          style: textos.bodyMedium?.copyWith(
                            color: colores.textoSecundario,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: tokens.espacio.l),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: tokens.espacio.m,
                      vertical: tokens.espacio.xs,
                    ),
                    decoration: BoxDecoration(
                      color: colores.primarioSuave,
                      borderRadius: BorderRadius.circular(tokens.radio.m),
                    ),
                    child: Text(
                      sesion.cuenta.codigo,
                      style: tokens.tipografia.mono(
                        tokens.tipografia.t16,
                        peso: tokens.tipografia.semiNegrita,
                        color: colores.primario,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
