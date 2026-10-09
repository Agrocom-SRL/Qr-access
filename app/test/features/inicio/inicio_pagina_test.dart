import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/sesion/permisos.dart';
import 'package:agrocom_acceso/core/sesion/sesion_controlador.dart';
import 'package:agrocom_acceso/core/sesion/sesion_estado.dart';
import 'package:agrocom_acceso/core/tiempo/reloj.dart';
import 'package:agrocom_acceso/features/eventos/eventos.dart';
import 'package:agrocom_acceso/features/inicio/inicio.dart';
import 'package:agrocom_acceso/features/puertas/puertas.dart';
import 'package:agrocom_acceso/features/qr_accesos/qr_accesos.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pantalla.dart';

final _ahora = DateTime.utc(2026, 10, 9, 14, 30);

const Set<String> _usuario = {
  Permisos.emitirQr,
  Permisos.verQr,
  Permisos.verEventos,
};
const Set<String> _administrador = {
  Permisos.emitirQr,
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
  List<RolSesion> roles = const [rolDePrueba],
}) async {
  final sesion = SesionFalsa(sesionCon(permisos: permisos, roles: roles));
  await montarPantalla(
    tester,
    pagina: const InicioPagina(),
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
              EventoAcceso(
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
    testWidgets('saluda por el primer nombre y muestra el hero Emitir QR', (
      tester,
    ) async {
      await _montar(tester, permisos: _usuario);
      final textos = textosEn(tester);

      expect(find.text(textos.inicioSaludo('Ana')), findsOneWidget);
      expect(find.text(textos.qrEmitirTitulo), findsWidgets);
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

    testWidgets('con un solo rol no ofrece cambiar de rol', (tester) async {
      await _montar(tester, permisos: _usuario);
      expect(find.text(textosEn(tester).perfilCambiarRol), findsNothing);
    });

    testWidgets('con varios roles, Cambiar rol vuelve a elegir', (
      tester,
    ) async {
      final sesion = await _montar(
        tester,
        permisos: _usuario,
        roles: const [
          rolDePrueba,
          RolSesion(id: 'r2', nombre: 'Guardia'),
        ],
      );
      await tester.tap(find.text(textosEn(tester).perfilCambiarRol));
      await tester.pump();
      expect(sesion.cambiosDeRolPedidos, 1);
    });

    testWidgets('Nuevo QR abre el formulario de emisión', (tester) async {
      await _montar(tester, permisos: _usuario);
      await tester.tap(find.text(textosEn(tester).inicioNuevoQr));
      await tester.pumpAndSettle();
      expect(find.text('destino /qr/nuevo'), findsOneWidget);
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
      expect(find.text(textos.inicioUltimosEventos), findsOneWidget);
      expect(find.text(textos.eventoMotivoQrVencido), findsOneWidget);
    });

    testWidgets('no muestra el inicio de usuario', (tester) async {
      await _montar(tester, permisos: _administrador);
      expect(find.text(textosEn(tester).inicioVigentesHoy), findsNothing);
    });

    testWidgets('la barra inferior lleva Inicio, Eventos, Admin y Perfil', (
      tester,
    ) async {
      await _montar(tester, permisos: _administrador);
      final textos = textosEn(tester);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text(textos.navAdmin), findsOneWidget);
      expect(find.text(textos.navMisQr), findsNothing);

      await tester.tap(find.text(textos.navPerfil));
      await tester.pumpAndSettle();
      expect(find.text('destino /perfil'), findsOneWidget);
    });
  });
}
