import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Deja escribir solo lo que puede ir en un PIN, en mayúsculas y sin espacios
/// ni guiones (ADR 0018). La regla vive en `Pin.filtrarEntrada`.
class FormateadorPin extends TextInputFormatter {
  const new();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue anterior,
    TextEditingValue nuevo,
  ) {
    final texto = Pin.filtrarEntrada(nuevo.text);
    return TextEditingValue(
      text: texto,
      selection: TextSelection.collapsed(offset: texto.length),
    );
  }
}

/// Un único `TextField` con un overlay de 3 + 4 casillas (handoff C02): el
/// campo real queda invisible encima de las casillas y recibe el foco, el
/// pegado y el teclado; las casillas solo pintan lo escrito.
class CasillasPin extends StatefulWidget {
  const new({
    required this.controlador,
    required this.habilitado,
    required this.ocultar,
    required this.conError,
    this.alEnviar,
    this.alCambiar,
    super.key,
  });

  final TextEditingController controlador;
  final bool habilitado;
  final bool ocultar;
  final bool conError;
  final VoidCallback? alEnviar;
  final ValueChanged<String>? alCambiar;

  @override
  State<CasillasPin> createState() => _CasillasPinEstado();
}

class _CasillasPinEstado extends State<CasillasPin> {
  final _foco = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controlador.addListener(_repintar);
    _foco.addListener(_repintar);
  }

  @override
  void didUpdateWidget(covariant CasillasPin anterior) {
    super.didUpdateWidget(anterior);
    if (anterior.controlador != widget.controlador) {
      anterior.controlador.removeListener(_repintar);
      widget.controlador.addListener(_repintar);
    }
  }

  @override
  void dispose() {
    widget.controlador.removeListener(_repintar);
    _foco.dispose();
    super.dispose();
  }

  void _repintar() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final texto = widget.controlador.text;
    return Semantics(
      textField: true,
      label: l10n.sesionCampoPin,
      value: l10n.sesionPinProgreso(texto.length, Pin.longitud),
      child: SizedBox(
        height: tokens.tamano.casillaPinAlto,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Las siete casillas reparten el ancho en partes iguales (36 en
            // 360 dp, más en pantallas anchas, con tope) y entre el código
            // de cuenta y la clave queda solo un hueco un poco mayor (C02).
            Row(
              children: [
                for (var i = 0; i < Pin.longitud; i++) ...[
                  if (i > 0)
                    SizedBox(
                      width: i == Pin.largoCodigoCuenta
                          ? tokens.espacio.l
                          : tokens.espacio.s,
                    ),
                  Expanded(
                    child: Center(
                      child: _Casilla(
                        caracter: i < texto.length ? texto[i] : null,
                        activa:
                            widget.habilitado &&
                            _foco.hasFocus &&
                            i == texto.length.clamp(0, Pin.longitud - 1) &&
                            texto.length < Pin.longitud,
                        ocultar: widget.ocultar,
                        conError: widget.conError,
                        habilitada: widget.habilitado,
                        anchoMaximo: tokens.tamano.casillaPinAnchoMaximo,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            // El campo real: transparente, sin cursor, encima de las casillas.
            ExcludeSemantics(
              child: Opacity(
                opacity: 0,
                child: TextField(
                  controller: widget.controlador,
                  focusNode: _foco,
                  enabled: widget.habilitado,
                  autocorrect: false,
                  enableSuggestions: false,
                  showCursor: false,
                  maxLength: Pin.longitud,
                  textCapitalization: TextCapitalization.characters,
                  keyboardType: TextInputType.visiblePassword,
                  textInputAction: TextInputAction.go,
                  inputFormatters: const [FormateadorPin()],
                  onChanged: widget.alCambiar,
                  onSubmitted: (_) => widget.alEnviar?.call(),
                  decoration: const InputDecoration.collapsed(hintText: null),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Casilla extends StatelessWidget {
  const new({
    required this.caracter,
    required this.activa,
    required this.ocultar,
    required this.conError,
    required this.habilitada,
    required this.anchoMaximo,
  });

  final String? caracter;
  final bool activa;
  final bool ocultar;
  final bool conError;
  final bool habilitada;

  /// La casilla ocupa todo el ancho de su columna hasta este tope.
  final double anchoMaximo;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final color = conError
        ? colores.peligro
        : (activa ? colores.primario : colores.borde);
    final mostrado = caracter == null ? '' : (ocultar ? '•' : caracter!);
    return AnimatedContainer(
      duration: tokens.duracion.efectiva(context, tokens.duracion.rapida),
      width: double.infinity,
      constraints: BoxConstraints(maxWidth: anchoMaximo),
      height: tokens.tamano.casillaPinAlto,
      decoration: BoxDecoration(
        color: habilitada ? colores.superficie : colores.fondo,
        borderRadius: BorderRadius.circular(tokens.radio.m),
        border: Border.all(
          color: color,
          width: activa || conError
              ? tokens.tamano.bordeFoco
              : tokens.tamano.bordeFino,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        mostrado,
        style: tokens.tipografia.mono(
          tokens.tipografia.t24,
          peso: tokens.tipografia.semiNegrita,
          color: colores.texto,
        ),
      ),
    );
  }
}
