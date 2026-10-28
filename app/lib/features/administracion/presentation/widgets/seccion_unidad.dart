import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/features/administracion/domain/usuario.dart';
import 'package:agrocom_acceso/features/administracion/presentation/estructura_controlador.dart';
import 'package:agrocom_acceso/features/administracion/presentation/usuarios_controlador.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_selector.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Propiedad y nombre de la unidad de un Titular nuevo (ADR 0028): su unidad
/// nace con él, en una propiedad de la cuenta. Son obligatorios: sin ellos el
/// Titular no tiene dónde responder.
class SeccionUnidad extends ConsumerWidget {
  const new({required this.controlador, required this.errores, super.key});

  /// Controla el texto del nombre de la unidad.
  final TextEditingController controlador;

  /// Los errores del alta; se marcan los de propiedad y de nombre de unidad.
  final Set<ErrorDatosUsuario> errores;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final sitios = ref.watch(estructuraProvider);
    final sitioId = ref.watch(
      formularioUsuarioProvider.select((e) => e.sitioId),
    );
    final accion = ref.read(formularioUsuarioProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        sitios.when(
          loading: () => const AccesoCargando(),
          error: (error, _) => AccesoAviso(
            tono: TonoAviso.peligro,
            texto: textoDeError(l10n, error),
          ),
          data: (lista) => lista.isEmpty
              ? AccesoAviso(
                  tono: TonoAviso.informacion,
                  texto: l10n.usuariosSinPropiedades,
                )
              : CampoFormulario(
                  etiqueta: l10n.usuariosCampoPropiedad,
                  obligatorio: true,
                  textoError: errores.contains(ErrorDatosUsuario.sinPropiedad)
                      ? l10n.usuariosErrorSinPropiedad
                      : null,
                  child: AccesoSelector<String>(
                    opciones: [
                      for (final sitio in lista)
                        OpcionSelector(valor: sitio.id, etiqueta: sitio.nombre),
                    ],
                    seleccionado: sitioId,
                    alElegir: accion.elegirPropiedad,
                    placeholder: l10n.usuariosCampoPropiedadPlaceholder,
                    iconoInicial: Icons.apartment_outlined,
                  ),
                ),
        ),
        CampoFormulario(
          etiqueta: l10n.usuariosCampoUnidad,
          obligatorio: true,
          ayuda: l10n.usuariosCampoUnidadAyuda,
          textoError: _errorDeNombre(l10n),
          child: AccesoCampoTexto(
            controlador: controlador,
            placeholder: l10n.usuariosCampoUnidadEjemplo,
            maxLargo: DatosUnidad.largoMaximoNombre,
            alCambiar: accion.cambiarUnidad,
          ),
        ),
      ],
    );
  }

  String? _errorDeNombre(AppLocalizations l10n) {
    if (errores.contains(ErrorDatosUsuario.sinNombreDeUnidad)) {
      return l10n.usuariosErrorSinNombreUnidad;
    }
    if (errores.contains(ErrorDatosUsuario.nombreDeUnidadLargo)) {
      return l10n.usuariosErrorUnidadLarga(DatosUnidad.largoMaximoNombre);
    }
    return null;
  }
}
