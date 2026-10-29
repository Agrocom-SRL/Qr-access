import 'dart:async';

import 'package:agrocom_acceso/core/config/entorno.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_boton.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Ruta de los términos y condiciones, publicados junto al panel de AGROCOM
/// (`web/public/terminos.html`).
const rutaTerminos = '/terminos.html';

/// Ruta de la política de privacidad (`web/public/privacidad.html`).
const rutaPrivacidad = '/privacidad.html';

/// La dirección de un documento legal. Con la URL de la API vacía (la app web
/// servida por Nginx) se resuelve contra el sitio desde el que se abrió.
Uri urlDeDocumento(String ruta) =>
    Uri.base.resolveUri(Uri.parse('${Entorno.apiUrl}$ruta'));

/// Muestra un documento legal. En el teléfono lo carga dentro de la app, en
/// una página con su flecha de volver, para no sacar a la persona de ella. En
/// la web lo abre en otra pestaña: el sitio no admite que lo embeban otras
/// páginas (`X-Frame-Options: DENY`), y la pestaña se cierra sin perder la app.
Future<void> abrirDocumentoLegal(
  BuildContext context, {
  required String titulo,
  required String ruta,
}) async {
  final url = urlDeDocumento(ruta);
  if (kIsWeb) {
    await launchUrl(url, webOnlyWindowName: '_blank');
    return;
  }
  await Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => DocumentoLegalPagina(titulo: titulo, url: url),
    ),
  );
}

/// Un documento legal dentro de la app. Solo se navega dentro del mismo sitio:
/// un enlace a otro dominio no se abre aquí.
class DocumentoLegalPagina extends StatefulWidget {
  const new({required this.titulo, required this.url, super.key});

  final String titulo;
  final Uri url;

  @override
  State<DocumentoLegalPagina> createState() => _DocumentoLegalPaginaState();
}

class _DocumentoLegalPaginaState extends State<DocumentoLegalPagina> {
  late final WebViewController _controlador;
  bool _cargando = true;
  bool _fallo = false;

  @override
  void initState() {
    super.initState();
    _controlador = WebViewController();
    unawaited(_configurar());
  }

  Future<void> _configurar() async {
    // Los documentos son HTML estático: no hace falta JavaScript.
    await _controlador.setJavaScriptMode(JavaScriptMode.disabled);
    await _controlador.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (peticion) =>
            Uri.parse(peticion.url).host == widget.url.host
            ? NavigationDecision.navigate
            : NavigationDecision.prevent,
        onPageFinished: (_) {
          if (mounted) setState(() => _cargando = false);
        },
        onWebResourceError: (error) {
          // Solo el documento principal importa: un recurso suelto que falla
          // (una imagen) no es motivo para esconderlo.
          if ((error.isForMainFrame ?? true) && mounted) {
            setState(() {
              _fallo = true;
              _cargando = false;
            });
          }
        },
      ),
    );
    await _controlador.loadRequest(widget.url);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tokens = context.tokens;
    return Scaffold(
      appBar: AppBar(title: Text(widget.titulo)),
      body: SafeArea(
        child: _fallo
            ? Center(
                child: Padding(
                  padding: EdgeInsets.all(tokens.espacio.l),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(l10n.paginaLegalError, textAlign: TextAlign.center),
                      SizedBox(height: tokens.espacio.l),
                      AccesoBoton(
                        texto: l10n.paginaLegalAbrirNavegador,
                        icono: Icons.open_in_new,
                        onPressed: () => launchUrl(
                          widget.url,
                          mode: LaunchMode.externalApplication,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : Stack(
                children: [
                  WebViewWidget(controller: _controlador),
                  if (_cargando) const LinearProgressIndicator(),
                ],
              ),
      ),
    );
  }
}
