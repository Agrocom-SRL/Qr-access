import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/inicio/inicio.dart';
import 'package:agrocom_acceso/features/inicio/presentation/widgets/encabezado_inicio.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:agrocom_acceso/shared/widgets/organisms/barra_navegacion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const Set<String> _usuario = {
  Permisos.generarQr,
  Permisos.generarQrPropio,
  Permisos.verQr,
  Permisos.verEventos,
};
const Set<String> _guardia = {
  Permisos.generarQrPropio,
  Permisos.verEventos,
  Permisos.verEventosAsignados,
  Permisos.supervisarPuertas,
};
const Set<String> _administrador = {
  Permisos.generarQr,
  Permisos.generarQrPropio,
  Permisos.verQr,
  Permisos.verEventos,
  Permisos.supervisarPuertas,
  Permisos.verTodosLosEventos,
  Permisos.verUsuarios,
};

final _qrVigente = QrAcceso(
  id: 'qr1',
  etiqueta: 'Proveedor de gas',
  estado: EstadoQr.vigente,
  venceAt: DateTime.utc(2026, 10, 9, 23, 59),
  usadoAt: null,
  anuladoAt: null,
  creadoAt: DateTime.utc(2026, 10, 9, 12),
  puertas: const [PuertaDeQr(id: 'p1', nombre: 'Portón vehicular')],
);

const _puertas = [
  Puerta(
    id: 'p1',
    nombre: 'Portón vehicular',
    sitioId: 's1',
    sitioNombre: 'Planta',
    dispositivo: DispositivoDePuerta(
      id: 'd1',
      nombre: 'LECT-1',
      enLinea: true,
      ultimoLatidoAt: null,
    ),
  ),
  Puerta(id: 'p2', nombre: 'Depósito 2', sitioId: 's1', sitioNombre: 'Planta'),
];

Future<SesionFalsa> _montar(
  WidgetTester tester, {
  required Set<String> permisos,
  List<QrAcceso> vigentes = const [],
  bool apaisada = false,
}) async {
  final sesion = SesionFalsa(sesionCon(permisos: permisos));
  await montarPantalla(
    tester,
    pagina: const InicioPagina(),
    apaisada: apaisada,
    overrides: [
      sesionControladorProvider.overrideWith(() => sesion),
      relojProvider.overrideWithValue(() => _ahora),
      qrAccesosRepositorioProvider.overrideWithValue(
        QrAccesosRepositorioFalso(
          listado: Pagina(
            datos: vigentes,
            pagina: 1,
            porPagina: 5,
            total: vigentes.length,
          ),
        ),
      ),
      puertasRepositorioProvider.overrideWithValue(
        PuertasRepositorioFalso(_puertas),
      ),
      eventosRepositorioProvider.overrideWithValue(
        EventosRepositorioFalso(
          Pagina(
            datos: [
              Lectura(
                id: 'e1',
                ocurridoAt: _ahora,
                resultado: ResultadoEvento.rechazado,
                motivoCode: 'qr.vencido',
                puertaNombre: 'Depósito 2',
                sitioNombre: 'Planta',
              ),
            ],
            pagina: 1,
            porPagina: 5,
            total: 1,
          ),
          resumen: const ResumenEventos(
            permitidos: 148,
            rechazados: 12,
            rechazadosPorMotivo: {'qr.vencido': 5},
          ),
        ),
      ),
    ],
  );
  await tester.pump();
  await tester.pump();
  return sesion;
}

void main() {
  group('inicio de usuario (C04a)', () {
    testWidgets('saluda por el primer nombre y muestra el hero Generar QR', (
      tester,
    ) async {
      await _montar(tester, permisos: _usuario);
      final textos = textosEn(tester);

      expect(find.text(textos.inicioSaludo('Ana')), findsOneWidget);
      expect(find.text(textos.qrGenerarTitulo), findsWidgets);
      expect(find.text(textos.inicioNuevoQr), findsOneWidget);
      expect(find.text(textos.inicioVigentesHoy), findsOneWidget);
    });

    testWidgets('lista los QR vigentes de hoy y ofrece repetir el último', (
      tester,
    ) async {
      await _montar(tester, permisos: _usuario, vigentes: [_qrVigente]);
      final textos = textosEn(tester);

      expect(find.text('Proveedor de gas'), findsOneWidget);
      expect(find.text(textos.inicioRepetirUltimo), findsOneWidget);

      await tester.tap(find.text(textos.inicioRepetirUltimo));
      await tester.pumpAndSettle();
      expect(find.text('destino /qr/nuevo'), findsOneWidget);
    });

    testWidgets('sin QR vigentes, lo dice con el estado vacío', (tester) async {
      await _montar(tester, permisos: _usuario);
      expect(find.text(textosEn(tester).inicioSinVigentes), findsOneWidget);
    });

    testWidgets('Nuevo QR abre el formulario de generación', (tester) async {
      await _montar(tester, permisos: _usuario);
      await tester.tap(find.text(textosEn(tester).inicioNuevoQr));
      await tester.pumpAndSettle();
      expect(find.text('destino /qr/nuevo'), findsOneWidget);
    });

    testWidgets('el botón flotante, sin texto, genera un QR nuevo', (
      tester,
    ) async {
      await _montar(tester, permisos: _usuario);
      final fab = find.byType(FloatingActionButton);
      expect(fab, findsOneWidget);
      expect(
        find.descendant(of: fab, matching: find.byType(Text)),
        findsNothing,
      );
      expect(
        tester.widget<FloatingActionButton>(fab).tooltip,
        textosEn(tester).qrGenerarBoton,
      );
      await tester.tap(fab);
      await tester.pumpAndSettle();
      expect(find.text('destino /qr/nuevo'), findsOneWidget);
    });

    testWidgets('la cabecera lleva el QR propio y abre /qr/rapido', (
      tester,
    ) async {
      await _montar(tester, permisos: _usuario);
      final qrPropio = find.byTooltip(textosEn(tester).inicioQrPropio);
      expect(qrPropio, findsOneWidget);
      expect(
        find.descendant(of: qrPropio, matching: find.byIcon(Icons.how_to_reg)),
        findsOneWidget,
      );
      await tester.tap(qrPropio);
      await tester.pumpAndSettle();
      expect(find.text('destino /qr/rapido'), findsOneWidget);
    });

    testWidgets('el guardia no ve el botón de generar, pero sí su QR propio', (
      tester,
    ) async {
      await _montar(tester, permisos: _guardia);
      expect(find.byType(FloatingActionButton), findsNothing);
      final qrPropio = find.byTooltip(textosEn(tester).inicioQrPropio);
      expect(qrPropio, findsOneWidget);
      await tester.tap(qrPropio);
      await tester.pumpAndSettle();
      expect(find.text('destino /qr/rapido'), findsOneWidget);
    });
  });

  group('tablero de administración (C04b)', () {
    testWidgets('muestra accesos de hoy, rechazados y puertas sin conexión', (
      tester,
    ) async {
      await _montar(tester, permisos: _administrador);
      final textos = textosEn(tester);

      expect(find.text(textos.inicioAccesosDeHoy), findsOneWidget);
      expect(find.text('148'), findsOneWidget);
      expect(find.text(textos.inicioRechazados), findsOneWidget);
      expect(find.text('12'), findsOneWidget);
      expect(find.text(textos.inicioPuertasSinConexion), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
      expect(find.text(textos.inicioUltimasLecturas), findsOneWidget);
      expect(find.text(textos.lecturaMotivoQrVencido), findsOneWidget);
    });

    testWidgets('la cabecera lleva el QR propio y el botón flotante genera', (
      tester,
    ) async {
      await _montar(tester, permisos: _administrador);
      final textos = textosEn(tester);

      expect(find.byTooltip(textos.inicioQrPropio), findsOneWidget);
      final fab = find.byType(FloatingActionButton);
      expect(
        tester.widget<FloatingActionButton>(fab).tooltip,
        textos.qrGenerarBoton,
      );
      await tester.tap(fab);
      await tester.pumpAndSettle();
      expect(find.text('destino /qr/nuevo'), findsOneWidget);
    });

    testWidgets('no muestra el inicio de usuario', (tester) async {
      await _montar(tester, permisos: _administrador);
      expect(find.text(textosEn(tester).inicioVigentesHoy), findsNothing);
    });

    testWidgets('la barra inferior lleva Inicio, Mis QR, Admin y Perfil', (
      tester,
    ) async {
      await _montar(tester, permisos: _administrador);
      final textos = textosEn(tester);
      expect(find.byType(BarraNavegacion), findsOneWidget);
      // Solo la pestaña elegida muestra su texto; las demás, su ícono.
      expect(find.text(textos.navInicio), findsOneWidget);
      final barra = find.byType(BarraNavegacion);
      Finder enBarra(IconData icono) =>
          find.descendant(of: barra, matching: find.byIcon(icono));
      expect(enBarra(Icons.qr_code_2), findsWidgets);
      expect(enBarra(Icons.tune), findsWidgets);
      expect(enBarra(Icons.history), findsNothing);

      await tester.tap(enBarra(Icons.person_outline).first);
      await tester.pumpAndSettle();
      expect(find.text('destino /perfil'), findsOneWidget);
    });
  });

  group('en horizontal (852×393)', () {
    testWidgets('el tablero de administración cabe y deja la barra inferior', (
      tester,
    ) async {
      await _montar(tester, permisos: _administrador, apaisada: true);

      expect(find.byType(BarraNavegacion), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
      // La cabecera (avatar y campanita) no se corta arriba ni abajo.
      final cabecera = tester.getRect(find.byType(EncabezadoInicio));
      expect(cabecera.top, greaterThanOrEqualTo(0));
      expect(cabecera.bottom, lessThanOrEqualTo(393));
    });

    testWidgets('el administrador ve el estado de cada puerta bajo el hero', (
      tester,
    ) async {
      await _montar(tester, permisos: _administrador, apaisada: true);
      final textos = textosEn(tester);

      expect(find.text(textos.inicioPuertasSinConexion), findsOneWidget);
      expect(find.text(textos.inicioVerPuertas), findsOneWidget);
      // Cada puerta con su sitio y su estado; la caída (Depósito 2) primero.
      expect(find.text(textos.puertaEnLinea), findsOneWidget);
      expect(find.text(textos.puertaSinConexion), findsOneWidget);
      expect(find.text('Portón vehicular'), findsOneWidget);
    });

    testWidgets('el inicio de usuario cabe y deja la barra inferior', (
      tester,
    ) async {
      await _montar(tester, permisos: _usuario, apaisada: true);

      expect(find.byType(BarraNavegacion), findsOneWidget);
    });
  });
}
