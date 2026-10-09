import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/navegacion/destinos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tema_controlador.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/perfil/presentation/widgets/selector_idioma.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_avatar.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_interruptor.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/fila_clave_valor.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_admin.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Días de suscripción por debajo de los cuales la fila pasa a advertencia.
const diasDeAvisoDeSuscripcion = 15;

/// Perfil y cuenta (handoff C09/E09): quién soy, la cuenta y su plan, el rol
/// activo con "Cambiar rol", el tema y "Cerrar sesión".
class PerfilPagina extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionControladorProvider);
    if (sesion is! SesionAutenticada) return const AccesoCargando();
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final modo = ref.watch(temaProvider);
    final ahora = ref.read(relojProvider)();
    final suscripcion = sesion.suscripcion;
    final dias = suscripcion == null
        ? null
        : diasRestantes(suscripcion.hasta, ahora);
    final enAviso = dias != null && dias < diasDeAvisoDeSuscripcion;
    final oscuro = switch (modo) {
      ThemeMode.dark => true,
      ThemeMode.light => false,
      ThemeMode.system =>
        MediaQuery.platformBrightnessOf(context) == Brightness.dark,
    };

    return PlantillaAdmin(
      destino: DestinoNav.perfil,
      titulo: l10n.perfilTitulo,
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
                      Text(
                        sesion.usuario.etiqueta ?? l10n.qrSinEtiqueta,
                        style: textos.headlineSmall,
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
                    accion: sesion.tieneVariosRoles
                        ? AccesoBoton(
                            texto: l10n.perfilCambiarRol,
                            variante: VarianteBoton.tonal,
                            onPressed: ref
                                .read(sesionControladorProvider.notifier)
                                .pedirCambioDeRol,
                          )
                        : null,
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
                  ),
                  const FilaIdioma(),
                  FilaClaveValor(
                    clave: l10n.perfilTemaOscuro,
                    valor: l10n.perfilTemaOscuroAyuda,
                    icono: Icons.dark_mode_outlined,
                    invertida: true,
                    claveEnfatizada: true,
                    conSeparador: false,
                    accion: AccesoInterruptor(
                      activo: oscuro,
                      etiqueta: l10n.perfilTemaOscuro,
                      alCambiar: (valor) => ref
                          .read(temaProvider.notifier)
                          .activarOscuro(oscuro: valor),
                    ),
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
            SizedBox(height: tokens.espacio.l),
            Text(
              l10n.perfilVersion,
              style: tokens.tipografia.mono(
                tokens.tipografia.t12,
                color: colores.textoSecundario,
              ),
              textAlign: context.esExpandida
                  ? TextAlign.start
                  : TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// La cuenta en verde: nombre, código y plan con su vencimiento.
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
    return Container(
      padding: EdgeInsets.all(tokens.espacio.xl),
      decoration: BoxDecoration(
        color: colores.hero,
        borderRadius: BorderRadius.circular(tokens.radio.xl),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sesion.cuenta.nombre,
                  style: textos.titleLarge?.copyWith(color: colores.sobreHero),
                ),
                SizedBox(height: tokens.espacio.xs),
                Text(
                  suscripcion == null
                      ? l10n.perfilSinSuscripcion
                      : l10n.perfilPlanVence(
                          suscripcion.plan,
                          formatearFecha(suscripcion.hasta),
                        ),
                  style: textos.bodyLarge?.copyWith(color: colores.sobreHero),
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
              color: colores.heroAcento,
              borderRadius: BorderRadius.circular(tokens.radio.m),
            ),
            child: Text(
              sesion.cuenta.codigo,
              style: tokens.tipografia.mono(
                tokens.tipografia.t16,
                peso: tokens.tipografia.semiNegrita,
                color: colores.sobreHero,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
