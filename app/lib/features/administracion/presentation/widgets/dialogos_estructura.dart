import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/administracion/domain/estructura.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_campo_texto.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/campo_formulario.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/hoja_formulario.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Hoja inferior de alta o edición de un sitio. Devuelve los datos validados, o
/// `null` si se cancela.
Future<DatosSitio?> pedirDatosDeSitio(
  BuildContext context, {
  SitioGestionado? sitio,
}) => mostrarHojaFormulario<DatosSitio>(
  context,
  builder: (_) => _HojaSitio(sitio: sitio),
);

/// Hoja inferior de alta o edición de una puerta. Devuelve los datos
/// validados, o `null` si se cancela.
Future<DatosPuerta?> pedirDatosDePuerta(
  BuildContext context, {
  PuertaGestionada? puerta,
}) => mostrarHojaFormulario<DatosPuerta>(
  context,
  builder: (_) => _HojaPuerta(puerta: puerta),
);

class _HojaSitio extends StatefulWidget {
  const new({required this.sitio});

  final SitioGestionado? sitio;

  @override
  State<_HojaSitio> createState() => _HojaSitioEstado();
}

class _HojaSitioEstado extends State<_HojaSitio> {
  late final _nombre = TextEditingController(text: widget.sitio?.nombre);
  late final _direccion = TextEditingController(text: widget.sitio?.direccion);
  var _sinNombre = false;

  @override
  void dispose() {
    _nombre.dispose();
    _direccion.dispose();
    super.dispose();
  }

  void _guardar() {
    final nombre = _nombre.text.trim();
    if (nombre.isEmpty) {
      setState(() => _sinNombre = true);
      return;
    }
    final direccion = _direccion.text.trim();
    Navigator.of(context).pop(
      DatosSitio(
        nombre: nombre,
        direccion: direccion.isEmpty ? null : direccion,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final espacio = context.tokens.espacio;
    return HojaFormulario(
      titulo: widget.sitio == null
          ? l10n.estructuraSitioNuevo
          : l10n.estructuraSitioEditar,
      acciones: [
        AccesoBoton(
          texto: l10n.comunCancelar,
          variante: VarianteBoton.texto,
          onPressed: () => Navigator.of(context).pop(),
        ),
        AccesoBoton(texto: l10n.comunGuardar, onPressed: _guardar),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CampoFormulario(
            etiqueta: l10n.estructuraSitioNombre,
            textoError: _sinNombre ? l10n.estructuraErrorNombre : null,
            child: AccesoCampoTexto(
              controlador: _nombre,
              maxLargo: largoMaximoNombreEstructura,
              autofoco: true,
              alCambiar: (_) {
                if (_sinNombre) setState(() => _sinNombre = false);
              },
            ),
          ),
          SizedBox(height: espacio.l),
          CampoFormulario(
            etiqueta: l10n.estructuraSitioDireccion,
            child: AccesoCampoTexto(
              controlador: _direccion,
              maxLargo: largoMaximoDireccion,
              alEnviar: (_) => _guardar(),
            ),
          ),
        ],
      ),
    );
  }
}

class _HojaPuerta extends StatefulWidget {
  const new({required this.puerta});

  final PuertaGestionada? puerta;

  @override
  State<_HojaPuerta> createState() => _HojaPuertaEstado();
}

class _HojaPuertaEstado extends State<_HojaPuerta> {
  late final _nombre = TextEditingController(text: widget.puerta?.nombre);
  late final _segundos = TextEditingController(
    text: '${widget.puerta?.segundosApertura ?? segundosAperturaPorDefecto}',
  );
  var _sinNombre = false;
  var _segundosInvalidos = false;

  @override
  void dispose() {
    _nombre.dispose();
    _segundos.dispose();
    super.dispose();
  }

  void _guardar() {
    final nombre = _nombre.text.trim();
    final segundos = segundosValidos(_segundos.text);
    if (nombre.isEmpty || segundos == null) {
      setState(() {
        _sinNombre = nombre.isEmpty;
        _segundosInvalidos = segundos == null;
      });
      return;
    }
    Navigator.of(context)
        .pop(DatosPuerta(nombre: nombre, segundosApertura: segundos));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final espacio = context.tokens.espacio;
    return HojaFormulario(
      titulo: widget.puerta == null
          ? l10n.estructuraPuertaNueva
          : l10n.estructuraPuertaEditar,
      acciones: [
        AccesoBoton(
          texto: l10n.comunCancelar,
          variante: VarianteBoton.texto,
          onPressed: () => Navigator.of(context).pop(),
        ),
        AccesoBoton(texto: l10n.comunGuardar, onPressed: _guardar),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CampoFormulario(
            etiqueta: l10n.estructuraPuertaNombre,
            textoError: _sinNombre ? l10n.estructuraErrorNombre : null,
            child: AccesoCampoTexto(
              controlador: _nombre,
              maxLargo: largoMaximoNombreEstructura,
              autofoco: true,
              alCambiar: (_) {
                if (_sinNombre) setState(() => _sinNombre = false);
              },
            ),
          ),
          SizedBox(height: espacio.l),
          CampoFormulario(
            etiqueta: l10n.estructuraPuertaSegundos,
            ayuda: l10n.estructuraPuertaSegundosAyuda,
            textoError: _segundosInvalidos
                ? l10n.estructuraErrorSegundos
                : null,
            child: AccesoCampoTexto(
              controlador: _segundos,
              teclado: TextInputType.number,
              formateadores: [FilteringTextInputFormatter.digitsOnly],
              maxLargo: 2,
              alCambiar: (_) {
                if (_segundosInvalidos) {
                  setState(() => _segundosInvalidos = false);
                }
              },
              alEnviar: (_) => _guardar(),
            ),
          ),
        ],
      ),
    );
  }
}
