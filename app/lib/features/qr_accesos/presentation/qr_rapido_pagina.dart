import 'dart:async';

import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/api/mensaje_error.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/multimedia/multimedia.dart';
import 'package:agrocom_acceso/core/router/rutas.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/qr_acceso.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/seguimiento_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/qr_rapido_controlador.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/aviso_seguimiento_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/qr_concedido.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/qr_revelado.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/seguimiento_de_qr.dart';
import 'package:agrocom_acceso/features/qr_accesos/presentation/widgets/tiempo_restante.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_cargando.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/acceso_aviso.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:agrocom_acceso/shared/widgets/templates/plantilla_pantalla_completa.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// QR rápido: la propia persona genera al instante su QR y lo muestra en este
/// mismo dispositivo para acercarlo al lector de la puerta. Sin formulario y
/// sin compartir (el QR es suyo); cerrar no pide confirmación, porque no hay
/// nada que enviar. El token vive solo en esta pantalla (ADR 0008); sin
/// internet se muestra el último QR propio guardado en el dispositivo.
class QrRapidoPagina extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<QrRapidoPagina> createState() => _QrRapidoPaginaEstado();
}

class _QrRapidoPaginaEstado extends ConsumerState<QrRapidoPagina> {
  @override
  void initState() {
    super.initState();
    // Después del primer frame: ahí ya hay contexto con los textos.
    WidgetsBinding.instance.addPostFrameCallback((_) => _generar());
  }

  void _generar() {
    if (!mounted) return;
    final l10n = context.l10n;
    final sesion = ref.read(sesionControladorProvider);
    final nombre = sesion is SesionAutenticada
        ? sesion.usuario.etiqueta?.trim()
        : null;
    final etiqueta = nombre == null || nombre.isEmpty
        ? l10n.qrRapidoEtiquetaSinNombre
        : l10n.qrRapidoEtiqueta(nombre);
    unawaited(ref.read(qrRapidoControladorProvider.notifier).generar(etiqueta));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    ref.listen(qrRapidoControladorProvider, (anterior, nuevo) {
      if (nuevo.hasValue && anterior?.hasValue != true) {
        unawaited(HapticFeedback.lightImpact());
      }
    });
    final estado = ref.watch(qrRapidoControladorProvider);
    return PlantillaPantallaCompleta(
      titulo: l10n.qrRapidoTitulo,
      alCerrar: () => context.go(Rutas.inicio),
      pie: AccesoBoton(
        texto: l10n.qrRapidoListo,
        expandido: true,
        onPressed: () => context.go(Rutas.inicio),
      ),
      child: switch (estado) {
        AsyncData(:final value) => _QrPropio(qr: value),
        AsyncError(:final error) => _Fallo(
          error: error,
          alReintentar: _generar,
        ),
        _ => SizedBox(
          height: context.tokens.tamano.qrExpandido,
          child: const AccesoCargando(),
        ),
      },
    );
  }
}

class _QrPropio extends StatelessWidget {
  const new({required this.qr});

  final QrGenerado qr;

  @override
  Widget build(BuildContext context) =>
      SeguimientoDeQr(qrId: qr.id, builder: _contenido);

  Widget _contenido(BuildContext context, SeguimientoQr? seguimiento) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    final textos = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Aceptado, el QR ya no sirve: se reemplaza por la confirmación.
        if (seguimiento?.concedido ?? false)
          const QrConcedido()
        else
          Center(child: QrRevelado(texto: qr.texto)),
        SizedBox(height: tokens.espacio.xl),
        Text(
          qr.etiqueta ?? l10n.qrSinEtiqueta,
          style: textos.headlineMedium,
          textAlign: TextAlign.center,
        ),
        SizedBox(height: tokens.espacio.xs),
        Text(
          qr.nombresDePuertas,
          style: textos.bodyLarge?.copyWith(
            color: tokens.colores.textoSecundario,
          ),
          textAlign: TextAlign.center,
        ),
        SizedBox(height: tokens.espacio.m),
        Center(child: TiempoRestante(venceAt: qr.venceAt)),
        SizedBox(height: tokens.espacio.xl),
        if (seguimiento != null) ...[
          AvisoSeguimientoQr(seguimiento: seguimiento),
          SizedBox(height: tokens.espacio.m),
        ],
        if (qr.respaldo)
          AccesoAviso(
            icono: Icons.cloud_off_outlined,
            texto: l10n.qrRapidoRespaldoAviso,
          )
        else
          AccesoAviso(icono: Icons.lock_outline, texto: l10n.qrRapidoAviso),
      ],
    );
  }
}

class _Fallo extends StatelessWidget {
  const new({required this.error, required this.alReintentar});

  final Object error;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (error is SinPuertasParaQrRapido) {
      return EstadoVacio(
        ilustracion: Multimedia.vacioPuertas,
        titulo: l10n.qrGenerarSinPuertas,
        ayuda: l10n.qrGenerarSinPuertasAyuda,
      );
    }
    return EstadoVacio(
      titulo: l10n.qrRapidoError,
      // El motivo concreto (límite de QR, cuenta suspendida…) lo dice la API
      // por su código; se traduce aquí (ADR 0013).
      ayuda: textoDeError(l10n, error),
      variante: error is ErrorApi && (error as ErrorApi).esSinConexion
          ? VarianteEstadoVacio.sinConexion
          : VarianteEstadoVacio.error,
      alAccionar: alReintentar,
    );
  }
}
