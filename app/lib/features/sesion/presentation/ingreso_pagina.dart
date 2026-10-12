import 'dart:async';

import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/sesion/domain/pin.dart';
import 'package:agrocom_acceso/features/sesion/presentation/ingreso_controlador.dart';
import 'package:agrocom_acceso/features/sesion/presentation/widgets/casillas_pin.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_ilustracion.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_logo.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Inicio de sesión con el PIN de acceso (ADR 0018, handoff C02–C02d, E02).
/// La página solo compone y delega en `IngresoControlador`.
class IngresoPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<IngresoPagina> createState() => _IngresoPaginaEstado();
}

class _IngresoPaginaEstado extends ConsumerState<IngresoPagina> {
  final _pin = TextEditingController();
  var _ocultar = false;
  Timer? _cuentaRegresiva;

  @override
  void initState() {
    super.initState();
    _pin.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _cuentaRegresiva?.cancel();
    _pin.dispose();
    super.dispose();
  }

  bool get _completo => _pin.text.length == Pin.longitud;

  /// Lanza el envío; la pantalla muestra el resultado desde el controlador.
  void _ingresar() {
    if (!_completo) return;
    unawaited(
      ref.read(ingresoControladorProvider.notifier).ingresar(_pin.text),
    );
  }

  /// Pega el PIN del portapapeles (quien lo recibe por mensaje no lo escribe):
  /// se queda con lo que cabe en un PIN y deja el resto fuera.
  Future<void> _pegar() async {
    final datos = await Clipboard.getData(Clipboard.kTextPlain);
    final pegado = Pin.filtrarEntrada(datos?.text ?? '');
    if (pegado.isEmpty || !mounted) return;
    _pin.value = TextEditingValue(
      text: pegado,
      selection: TextSelection.collapsed(offset: pegado.length),
    );
    ref.read(ingresoControladorProvider.notifier).limpiarError();
  }

  /// Mientras dure el bloqueo, la pantalla se repinta cada segundo.
  void _seguirBloqueo(IngresoEstado estado) {
    final ahora = ref.read(relojProvider)();
    if (!estado.bloqueadoEn(ahora)) {
      _cuentaRegresiva?.cancel();
      _cuentaRegresiva = null;
      if (estado.bloqueadoHasta != null) {
        ref.read(ingresoControladorProvider.notifier).levantarBloqueo();
      }
      return;
    }
    _cuentaRegresiva ??= Timer.periodic(
      context.tokens.duracion.segundo,
      (_) => _seguirBloqueo(ref.read(ingresoControladorProvider)),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(ingresoControladorProvider);
    ref.listen(ingresoControladorProvider, (anterior, nuevo) {
      _seguirBloqueo(nuevo);
      // Vibración fuerte al fallar el PIN, una vez por intento.
      if (nuevo.pinIncorrecto && anterior?.pinIncorrecto != true) {
        unawaited(HapticFeedback.heavyImpact());
      }
    });
    final l10n = context.l10n;
    final tokens = context.tokens;
    final colores = tokens.colores;
    final textos = Theme.of(context).textTheme;
    final ahora = ref.read(relojProvider)();
    final bloqueado = estado.bloqueadoEn(ahora);
    final errorApi = estado.errorApi;
    final textoError = estado.pinInvalido
        ? l10n.sesionPinFormatoInvalido
        : (errorApi == null || bloqueado ? null : textoDeError(l10n, errorApi));

    return PlantillaAuth(
      cabeceraConFoto: true,
      alVolver: () => context.go(Rutas.bienvenida),
      pie: AccesoBoton(
        texto: l10n.sesionBotonIngresar,
        textoCargando: l10n.sesionIngresando,
        cargando: estado.enviando,
        expandido: true,
        onPressed: _completo && !bloqueado ? _ingresar : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (context.esExpandida) ...[
            AccesoLogo(tamano: tokens.tamano.logoChico),
            SizedBox(height: tokens.espacio.xl),
          ],
          Text(l10n.sesionIngresoTitulo, style: textos.headlineLarge),
          SizedBox(height: tokens.espacio.s),
          Text(
            l10n.sesionIngresoAyuda,
            style: textos.bodyLarge?.copyWith(color: colores.textoSecundario),
          ),
          SizedBox(height: tokens.espacio.xl),
          CasillasPin(
            controlador: _pin,
            habilitado: !estado.enviando && !bloqueado,
            ocultar: _ocultar,
            conError: estado.pinIncorrecto,
            alEnviar: _ingresar,
            alCambiar: (_) =>
                ref.read(ingresoControladorProvider.notifier).limpiarError(),
          ),
          SizedBox(height: tokens.espacio.s),
          Text(
            textoError ?? l10n.sesionPinLeyenda,
            style: textos.bodyMedium?.copyWith(
              color: textoError == null
                  ? colores.textoSecundario
                  : colores.peligro,
            ),
          ),
          SizedBox(height: tokens.espacio.s),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              AccesoBoton(
                texto: l10n.sesionPegarPin,
                icono: Icons.content_paste,
                variante: VarianteBoton.texto,
                onPressed: estado.enviando || bloqueado
                    ? null
                    : () => unawaited(_pegar()),
              ),
              AccesoBoton(
                texto: _ocultar ? l10n.sesionMostrarPin : l10n.sesionOcultarPin,
                icono: _ocultar
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                variante: VarianteBoton.texto,
                onPressed: () => setState(() => _ocultar = !_ocultar),
              ),
            ],
          ),
          if (bloqueado) ...[
            SizedBox(height: tokens.espacio.l),
            const Center(child: AccesoIlustracion(ruta: Multimedia.bloqueo)),
            SizedBox(height: tokens.espacio.l),
            _AvisoBloqueo(hasta: estado.bloqueadoHasta!, ahora: ahora),
          ],
        ],
      ),
    );
  }
}

class _AvisoBloqueo extends StatelessWidget {
  const new({required this.hasta, required this.ahora});

  final DateTime hasta;
  final DateTime ahora;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final restante = hasta.difference(ahora);
    final minutos = restante.inMinutes.toString().padLeft(2, '0');
    final segundos = (restante.inSeconds % 60).toString().padLeft(2, '0');
    return AccesoAviso(
      icono: Icons.timer_outlined,
      titulo: l10n.comunErrorSesionBloqueada,
      texto: l10n.sesionBloqueoReintentarEn,
      detalle: Text(
        '$minutos:$segundos',
        style: tokens.tipografia.mono(
          tokens.tipografia.t16,
          peso: tokens.tipografia.semiNegrita,
          color: tokens.colores.advertencia,
        ),
      ),
    );
  }
}
