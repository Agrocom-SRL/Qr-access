import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Inicio de sesión con código de cuenta + PIN (ADR 0018). Esqueleto: el
/// envío a la API llega con la HU-04.
class IngresoPagina extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final texto = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(tokens.espacio.xl),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: tokens.tamano.formularioMaximo,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l10n.sesionIngresoTitulo,
                    style: texto.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: tokens.espacio.s),
                  Text(
                    l10n.sesionIngresoAyuda,
                    style: texto.bodyMedium?.copyWith(
                      color: tokens.colores.textoSecundario,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: tokens.espacio.xl),
                  TextField(
                    decoration: InputDecoration(
                      labelText: l10n.sesionCampoCuenta,
                    ),
                    textInputAction: TextInputAction.next,
                    autocorrect: false,
                  ),
                  SizedBox(height: tokens.espacio.l),
                  TextField(
                    decoration: InputDecoration(labelText: l10n.sesionCampoPin),
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    obscureText: true,
                  ),
                  SizedBox(height: tokens.espacio.xl),
                  // Sin acción hasta la HU-04: no se simula un login.
                  FilledButton(
                    onPressed: null,
                    child: Text(l10n.sesionBotonIngresar),
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
