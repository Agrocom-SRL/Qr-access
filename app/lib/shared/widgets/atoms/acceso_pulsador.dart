import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Pulsador industrial para abrir una puerta sin QR (ADR 0035): tapa roja con
/// un brillo dentro de un bisel oscuro. Dibujado con `CustomPaint`, sin
/// imágenes.
///
/// - Al pulsarlo la tapa se hunde y vuelve al soltar.
/// - Con [cargando] queda hundido y con un anillo girando alrededor: la orden
///   va en camino. No responde mientras tanto, pero no se ve apagado.
/// - Sin [alPulsar] (la placa de la puerta no está en línea) no responde y se
///   ve apagado.
///
/// [etiqueta] es lo que leen los lectores de pantalla; el texto visible va
/// debajo, en la pantalla que lo usa.
class AccesoPulsador extends StatefulWidget {
  const new({
    required this.etiqueta,
    this.alPulsar,
    this.cargando = false,
    super.key,
  });

  final String etiqueta;

  /// `null` para deshabilitarlo.
  final VoidCallback? alPulsar;

  final bool cargando;

  @override
  State<AccesoPulsador> createState() => _AccesoPulsadorState();
}

class _AccesoPulsadorState extends State<AccesoPulsador> {
  bool _presionado = false;
  bool _sobre = false;
  bool _enfocado = false;

  void _cambiarPresion({required bool presionado}) {
    if (_presionado == presionado) return;
    setState(() => _presionado = presionado);
  }

  /// Los avisos de puntero y de foco pueden llegar cuando el widget ya se fue.
  void _cambiarResaltado({bool? sobre, bool? enfocado}) {
    if (!mounted) return;
    setState(() {
      _sobre = sobre ?? _sobre;
      _enfocado = enfocado ?? _enfocado;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colores = tokens.colores;
    final tamano = tokens.tamano;
    final duracion = tokens.duracion.efectiva(context, tokens.duracion.rapida);
    final habilitado = widget.alPulsar != null && !widget.cargando;
    final apagado = widget.alPulsar == null && !widget.cargando;
    // Hundido mientras se pulsa o mientras la orden va en camino.
    final hundido = widget.cargando || _presionado;
    // El contorno de foco y de puntero sobre el pulsador: el mismo aro para
    // Tab y para el mouse, y solo cuando puede responder.
    final resaltado = habilitado && (_sobre || _enfocado);

    final pulsador = TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: hundido ? 1 : 0),
      duration: duracion,
      curve: tokens.duracion.curva,
      builder: (context, hundimiento, _) => CustomPaint(
        size: Size.square(tamano.pulsador),
        painter: _PulsadorPintor(
          hundimiento: hundimiento,
          tapa: colores.pulsadorTapa,
          bisel: colores.pulsadorBisel,
          brillo: colores.pulsadorBrillo,
          grosorBisel: tamano.pulsadorBisel,
          recorrido: tamano.pulsadorRecorrido,
        ),
      ),
    );

    return Semantics(
      button: true,
      enabled: habilitado,
      label: widget.etiqueta,
      child: MouseRegion(
        // El cursor de «clic» solo donde el pulsador responde.
        cursor: habilitado
            ? SystemMouseCursors.click
            : SystemMouseCursors.basic,
        onEnter: (_) => _cambiarResaltado(sobre: true),
        onExit: (_) => _cambiarResaltado(sobre: false),
        child: Opacity(
          opacity: apagado ? opacidadDeshabilitado : 1,
          // InkWell atiende Enter y Espacio (activación por teclado) y recibe
          // foco con Tab, además del toque y el clic.
          child: InkWell(
            customBorder: const CircleBorder(),
            onFocusChange: (enfocado) => _cambiarResaltado(enfocado: enfocado),
            onTap: habilitado ? widget.alPulsar : null,
            onTapDown: habilitado
                ? (_) => _cambiarPresion(presionado: true)
                : null,
            onTapUp: (_) => _cambiarPresion(presionado: false),
            onTapCancel: () => _cambiarPresion(presionado: false),
            child: SizedBox.square(
              dimension: tamano.pulsadorArea,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // El aro de foco y de puntero rodea el área táctil. Sin
                  // resaltado su ancho es cero: no se ve.
                  AnimatedContainer(
                    width: tamano.pulsadorArea,
                    height: tamano.pulsadorArea,
                    duration: duracion,
                    curve: tokens.duracion.curva,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        width: resaltado ? tamano.bordeFoco : 0,
                        color: colores.primario,
                      ),
                    ),
                    child: Center(child: pulsador),
                  ),
                  if (widget.cargando)
                    ExcludeSemantics(
                      child: SizedBox.square(
                        dimension: tamano.pulsadorArea,
                        child: CircularProgressIndicator(
                          strokeWidth: tamano.anilloPulsador,
                          color: colores.primario,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Pinta el bisel, la tapa (que baja al hundirse) y su brillo. La tapa deja a
/// la vista el borde del bisel al bajar: ese labio es lo que hace leer el
/// hundido.
class _PulsadorPintor extends CustomPainter {
  const new({
    required this.hundimiento,
    required this.tapa,
    required this.bisel,
    required this.brillo,
    required this.grosorBisel,
    required this.recorrido,
  });

  /// De 0 (tapa arriba) a 1 (hundida).
  final double hundimiento;
  final Color tapa;
  final Color bisel;
  final Color brillo;
  final double grosorBisel;
  final double recorrido;

  @override
  void paint(Canvas canvas, Size size) {
    final centro = size.center(Offset.zero);
    final radioBisel = size.shortestSide / 2;
    canvas.drawCircle(centro, radioBisel, Paint()..color = bisel);

    final radioTapa = radioBisel - grosorBisel;
    final centroTapa = centro + Offset(0, recorrido * hundimiento);
    canvas.drawCircle(centroTapa, radioTapa, Paint()..color = tapa);

    final radioBrillo = radioTapa * proporcionBrilloPulsador;
    final centroBrillo =
        centroTapa + Offset(-radioTapa, -radioTapa) * corrimientoBrilloPulsador;
    canvas.drawCircle(centroBrillo, radioBrillo, Paint()..color = brillo);
  }

  @override
  bool shouldRepaint(_PulsadorPintor antiguo) =>
      antiguo.hundimiento != hundimiento ||
      antiguo.tapa != tapa ||
      antiguo.bisel != bisel ||
      antiguo.brillo != brillo ||
      antiguo.grosorBisel != grosorBisel ||
      antiguo.recorrido != recorrido;
}
