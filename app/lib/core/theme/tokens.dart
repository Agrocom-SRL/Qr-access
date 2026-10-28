import 'package:agrocom_acceso/core/theme/primitivos.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';

/// Colores semánticos (handoff V1 §Tokens): lo único de color que leen los
/// widgets.
@immutable
class ColoresSemanticos {
  const new({
    required this.fondo,
    required this.superficie,
    required this.superficieElevada,
    required this.borde,
    required this.texto,
    required this.textoSecundario,
    required this.primario,
    required this.primarioHover,
    required this.sobrePrimario,
    required this.primarioSuave,
    required this.peligro,
    required this.peligroSuave,
    required this.advertencia,
    required this.advertenciaSuave,
    required this.informacion,
    required this.informacionSuave,
    required this.acento,
    required this.sobreAcento,
    required this.hero,
    required this.heroAcento,
    required this.sobreHero,
    required this.velo,
    required this.elev1,
    required this.elev3,
  });

  static const claro = ColoresSemanticos(
    fondo: Primitivos.neutro50,
    superficie: Primitivos.neutro0,
    superficieElevada: Primitivos.neutro0,
    borde: Primitivos.neutro200,
    texto: Primitivos.neutro900,
    textoSecundario: Primitivos.neutro600,
    primario: Primitivos.verde500,
    primarioHover: Primitivos.verde600,
    sobrePrimario: Primitivos.neutro0,
    primarioSuave: Primitivos.verde50,
    peligro: Primitivos.rojo600,
    peligroSuave: Primitivos.rojo50,
    advertencia: Primitivos.ambar700,
    advertenciaSuave: Primitivos.ambar50,
    informacion: Primitivos.azul700,
    informacionSuave: Primitivos.azul50,
    acento: Primitivos.naranja600,
    sobreAcento: Primitivos.neutro0,
    hero: Primitivos.verde500,
    heroAcento: Primitivos.verde600,
    sobreHero: Primitivos.neutro0,
    velo: Primitivos.velo,
    elev1: [
      BoxShadow(color: Primitivos.sombra6, blurRadius: 2, offset: Offset(0, 1)),
      BoxShadow(color: Primitivos.sombra6, blurRadius: 3, offset: Offset(0, 1)),
    ],
    elev3: [
      BoxShadow(
        color: Primitivos.sombra10,
        blurRadius: 24,
        offset: Offset(0, 8),
      ),
      BoxShadow(color: Primitivos.sombra4, blurRadius: 4, offset: Offset(0, 2)),
    ],
  );

  /// En oscuro no hay sombra: la elevación es `superficie` (elev1) y
  /// `superficieElevada` (elev3). `primario` lleva texto verde900, no blanco
  /// (blanco da 2.4:1).
  static const oscuro = ColoresSemanticos(
    fondo: Primitivos.neutroOscuro50,
    superficie: Primitivos.neutroOscuro100,
    superficieElevada: Primitivos.neutroOscuro200,
    borde: Primitivos.neutroOscuroBorde,
    texto: Primitivos.neutroOscuro400,
    textoSecundario: Primitivos.neutroOscuro300,
    primario: Primitivos.verde300,
    primarioHover: Primitivos.verde200,
    sobrePrimario: Primitivos.verde900,
    primarioSuave: Primitivos.verde900,
    peligro: Primitivos.rojo300,
    peligroSuave: Primitivos.rojoOscuroSuave,
    advertencia: Primitivos.ambar300,
    advertenciaSuave: Primitivos.ambarOscuroSuave,
    informacion: Primitivos.azul300,
    informacionSuave: Primitivos.azulOscuroSuave,
    acento: Primitivos.naranja300,
    sobreAcento: Primitivos.naranjaOscuro,
    hero: Primitivos.verde800,
    heroAcento: Primitivos.verde700,
    sobreHero: Primitivos.neutroOscuro400,
    velo: Primitivos.velo,
    elev1: [],
    elev3: [],
  );

  final Color fondo;
  final Color superficie;

  /// Diálogos y menús; en claro es igual a [superficie].
  final Color superficieElevada;
  final Color borde;
  final Color texto;
  final Color textoSecundario;
  final Color primario;
  final Color primarioHover;
  final Color sobrePrimario;
  final Color primarioSuave;
  final Color peligro;
  final Color peligroSuave;
  final Color advertencia;
  final Color advertenciaSuave;
  final Color informacion;
  final Color informacionSuave;

  /// Color de resalte para la acción principal flotante (generar QR): se
  /// distingue del verde de la marca para que se vea de antemano.
  final Color acento;
  final Color sobreAcento;

  /// Fondo del bloque de marca (bienvenida, tarjeta de cuenta, "Generar QR").
  final Color hero;
  final Color heroAcento;
  final Color sobreHero;
  final Color velo;

  /// Sombra de tarjeta y de diálogo; vacías en oscuro.
  final List<BoxShadow> elev1;
  final List<BoxShadow> elev3;

  /// Alias de dominio (handoff): un acceso permitido es primario y uno
  /// rechazado, peligro.
  Color get accesoPermitido => primario;
  Color get accesoDenegado => peligro;

  /// Módulos y fondo del QR: negro sobre blanco en ambos temas (§1.8).
  Color get qrModulo => Primitivos.qrModulo;
  Color get qrFondo => Primitivos.qrFondo;

  /// Placa del logo: solo se usa sobre el hero verde, donde el logo (verde y
  /// naranja sobre transparente) no contrasta. Sobre las superficies, claras u
  /// oscuras, el logo va sin placa.
  Color get placaLogo => Primitivos.neutro0;
}

/// Espaciado en base 4 (handoff: 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48).
@immutable
class Espacios {
  const new();
  double get xxs => 2;
  double get xs => 4;
  double get s => 8;
  double get m => 12;
  double get l => 16;
  double get xl => 24;
  double get xxl => 32;
  double get xxxl => 48;
}

/// Opacidad de lo que está apagado (un acceso sin acción posible).
const double opacidadDeshabilitado = 0.4;

/// Opacidades de los velos sobre las fotos de marca (ADR 0012: los valores
/// viven en el tema, no sueltos en un widget). El velo del hero es parejo y
/// alto a propósito, para que el texto sobre la foto se lea.
const double opacidadVeloHero = 0.86;

/// Fundido de la foto hacia el fondo, y el acento verde de arriba.
const double opacidadFundidoFoto = 0.88;
const double opacidadAcentoFoto = 0.45;

/// Tamaño de la inicial del avatar: el lado dividido entre este número.
const double divisorInicialAvatar = 2.6;

/// Radios de esquina: chips 6 · campos e íconos 10 · tarjetas 14 · hero y
/// diálogos 20 · completo para botones y badges.
@immutable
class Radios {
  const new();
  double get s => 6;
  double get m => 10;
  double get l => 14;
  double get xl => 20;
  double get completo => 999;
}

/// Duraciones de movimiento: 120 hover y foco · 200 pastillas y badges ·
/// 300 pasos, diálogos y rutas. Con "reducir movimiento" pasan a cero.
@immutable
class Duraciones {
  const new();
  Duration get rapida => const Duration(milliseconds: 120);
  Duration get normal => const Duration(milliseconds: 200);
  Duration get lenta => const Duration(milliseconds: 300);

  /// Periodo del barrido de brillo del skeleton de carga.
  Duration get pulso => const Duration(milliseconds: 1200);

  /// Paso de una cuenta regresiva (bloqueo del PIN).
  Duration get segundo => const Duration(seconds: 1);
  Curve get curva => Curves.easeOutCubic;

  /// Tope del splash animado: lo que dura el Lottie de arranque.
  Duration get splash => const Duration(milliseconds: 800);

  /// Cada cuánto se actualiza el "tiempo restante" de un QR (sin segundos).
  Duration get refrescoTiempoRestante => const Duration(seconds: 30);

  /// Cada cuánto se pregunta a la API qué pasó con el QR que se está mostrando.
  Duration get refrescoSeguimientoQr => const Duration(seconds: 3);

  /// Cada cuánto se vuelve a preguntar si las placas de las puertas reportan.
  Duration get refrescoEstadoPuertas => const Duration(seconds: 15);

  /// Cada cuánto se refresca el tablero del administrador.
  Duration get refrescoTablero => const Duration(seconds: 30);

  /// Refresco en segundo plano de un listado (Mis QR, Lecturas, Notificaciones)
  /// mientras la pantalla está abierta y la app en primer plano. Un minuto
  /// basta para la bitácora y deja holgura al rate limit (limites-y-abuso).
  Duration get refrescoListado => const Duration(seconds: 60);

  /// `duracion` o cero si la persona pidió reducir el movimiento.
  Duration efectiva(BuildContext context, Duration duracion) =>
      MediaQuery.disableAnimationsOf(context) ? Duration.zero : duracion;
}

/// Medidas de componente (handoff). No son espaciado: son constantes.
@immutable
class Tamanos {
  const new();

  double get badge => 24;
  double get chipPaso => 32;
  double get interruptor => 32;
  double get pastillaFiltro => 40;

  /// Mínimo táctil.
  double get controlMinimo => 44;

  /// Alto de botón y de campo.
  double get control => 48;
  double get appBar => 56;
  double get fab => 56;
  double get accesoRapido => 56;
  double get filaPerfil => 64;
  double get navBar => 80;
  double get logo => 80;
  double get logoChico => 48;
  double get avatar => 44;
  double get avatarGrande => 56;
  double get avatarChico => 32;

  /// Diámetro de la bandera de un idioma (la hoja de idiomas usa `avatar`).
  double get bandera => 28;
  double get iconoCaja => 40;
  double get railMedio => 80;
  double get railExpandido => 240;

  /// Casilla del PIN: 36×56 en compacto, 44×56 en expandido.
  double get casillaPinAncho => 36;
  double get casillaPinAnchoExpandido => 44;
  double get casillaPinAlto => 56;

  /// Ancho máximo de una casilla del PIN cuando se reparte el ancho.
  double get casillaPinAnchoMaximo => 56;

  /// Ancho máximo del contenido: 400 en auth, 640 en formularios de
  /// secciones, 720 en formularios, 1200 en listas y tableros.
  double get maxAuth => 400;
  double get maxFormularioSecciones => 640;
  double get maxFormulario => 720;
  double get maxContenido => 1200;

  /// Resumen fijo a la derecha del stepper en expandido.
  double get resumenLateral => 360;

  /// Columna de resumen (cupo, estadísticas, foto) junto a la lista en un
  /// teléfono en horizontal, y la altura de su foto. Lo justo para que las
  /// tarjetas se lean sin dejar sin alto a la lista.
  double get columnaApaisada => 300;
  double get fotoApaisada => 96;

  /// Lado mínimo del QR: 240 dp (320 en expandido) + 16 dp de silencio.
  /// Lienzo del Lottie del splash y ancho del logo que lleva encima.
  double get splash => 200;
  double get splashLogo => 120;

  /// Cabecera con foto del ingreso (compacto) y su placa de logo.
  double get cabeceraFoto => 220;
  double get placaCabecera => 88;

  /// Ilustración de un estado vacío, de error, sin conexión o de bloqueo.
  double get ilustracion => 160;
  double get ilustracionExpandida => 200;

  /// Ilustración cuando la altura es poca (teléfono en horizontal): el estado
  /// vacío entra junto al título y la barra inferior sin desbordar.
  double get ilustracionAlturaCorta => 88;

  /// Ilustración de una pantalla completa en horizontal de teléfono: tiene
  /// toda la columna izquierda para ella, así que puede ser más grande.
  double get ilustracionApaisada => 240;

  /// Ilustración sobre el botón, en la columna lateral de un teléfono en
  /// horizontal (Exportar accesos): lo que cabe con un título y un botón.
  double get ilustracionColumna => 120;

  /// Diámetro del círculo de un formato de descarga (PDF, Excel) en su hoja;
  /// su ícono a color mide `iconoCaja`.
  double get iconoFormato => 72;
  double get qrMinimo => 240;
  double get qrExpandido => 320;
  double get qrZonaSilencio => 16;

  /// Zona de silencio del QR, en módulos (la norma pide 4).
  int get qrZonaSilencioModulos => 4;

  double get icono => 20;
  double get iconoNav => 24;
  double get iconoGrande => 48;
  double get spinner => 16;
  double get bordeFoco => 2;
  double get bordeSeleccion => 2;
  double get bordeFino => 1;
  double get barraResultado => 4;

  /// Alto de la barra de uso (p. ej. el cupo de usuarios).
  double get barraUso => 8;
  double get puntoBadge => 6;

  /// Ancho mínimo de una tarjeta antes de pasar a otra columna.
  double get tarjetaMinima => 280;

  /// Ancho de las columnas de acciones y de hora en las tablas.
  double get columnaHora => 96;

  /// Filas por página en las tablas (≥ 1024).
  int get filasPorPagina => 20;

  /// Cuántas filas muestra el tablero en "últimos eventos" y "vigentes hoy".
  int get filasDelTablero => 5;
}

/// Breakpoints: compacto < 600 · medio 600–1023 · expandido ≥ 1024.
@immutable
class Breakpoints {
  const new();
  double get medio => 600;
  double get expandido => 1024;

  /// Lado corto (dp) a partir del cual un dispositivo deja de ser teléfono: el
  /// umbral estándar de Material. Un teléfono, en vertical o en horizontal,
  /// tiene el lado corto por debajo de 600 (393 dp en un iPhone en horizontal).
  double get ladoCorto => 600;

  /// Alto por debajo del cual hay poco lugar vertical (teléfono en horizontal):
  /// la barra y las cabeceras se achican para que el contenido quepa.
  double get alturaCorta => 500;
}

/// Tamaños y pesos de la tipografía (IBM Plex Sans; Mono para cifras).
@immutable
class Tipografia {
  const new();

  String get familia => 'IBMPlexSans';
  String get familiaMono => 'IBMPlexMono';

  double get t12 => 12;
  double get t14 => 14;
  double get t16 => 16;
  double get t20 => 20;
  double get t24 => 24;
  double get t32 => 32;

  FontWeight get regular => FontWeight.w400;
  FontWeight get medio => FontWeight.w500;
  FontWeight get semiNegrita => FontWeight.w600;

  double get interlineadoTitulo => 1.3;
  double get interlineadoCuerpo => 1.5;

  /// Espaciado entre letras del PIN grande (mono 32).
  double get espaciadoPin => 6;

  /// Mono con cifras tabulares, para PIN, códigos, horas y cifras.
  TextStyle mono(double tamano, {FontWeight? peso, Color? color}) => TextStyle(
    fontFamily: familiaMono,
    fontSize: tamano,
    fontWeight: peso ?? medio,
    color: color,
    fontFeatures: const [FontFeature.tabularFigures()],
  );
}

/// Tokens del sistema de diseño (ADR 0012), disponibles con `context.tokens`.
@immutable
class AccesoTokens extends ThemeExtension<AccesoTokens> {
  const new({required this.colores});

  final ColoresSemanticos colores;
  Espacios get espacio => const Espacios();
  Radios get radio => const Radios();
  Duraciones get duracion => const Duraciones();
  Tamanos get tamano => const Tamanos();
  Breakpoints get breakpoint => const Breakpoints();
  Tipografia get tipografia => const Tipografia();

  @override
  AccesoTokens copyWith({ColoresSemanticos? colores}) =>
      AccesoTokens(colores: colores ?? this.colores);

  @override
  AccesoTokens lerp(AccesoTokens? other, double t) =>
      t < 0.5 || other == null ? this : other;
}

/// Acceso a los tokens desde cualquier widget: `context.tokens.espacio.m`.
extension TokensContexto on BuildContext {
  AccesoTokens get tokens => Theme.of(this).extension<AccesoTokens>()!;
}

/// Clase de pantalla según el ancho (§2.6): compacto, medio o expandido.
enum ClasePantalla { compacta, media, expandida }

extension ClasePantallaContexto on BuildContext {
  /// Clasifica el área disponible con los breakpoints del tema.
  ///
  /// Un teléfono es siempre compacto, también en horizontal (852×393 en un
  /// iPhone): lo decide el lado corto de la pantalla y no el ancho, porque en
  /// horizontal el ancho es de tablet. Un teléfono en la web (navegador en el
  /// teléfono) cuenta igual, por la plataforma que reporta Flutter. La web de
  /// escritorio y las tablets siguen por ancho: rail en medio, expandido en
  /// 1024 o más.
  ClasePantalla get clasePantalla {
    final tamano = MediaQuery.sizeOf(this);
    final breakpoint = tokens.breakpoint;
    if (esTelefono(tamano.shortestSide)) return ClasePantalla.compacta;
    if (tamano.width < breakpoint.medio) return ClasePantalla.compacta;
    if (tamano.width >= breakpoint.expandido) return ClasePantalla.expandida;
    return ClasePantalla.media;
  }

  /// Teléfono: plataforma móvil (o navegador móvil) y lado corto menor que
  /// [Breakpoints.ladoCorto]. Un tablet tiene el lado corto por encima.
  bool esTelefono(double ladoCorto) {
    final plataforma = defaultTargetPlatform;
    final esMovil =
        plataforma == TargetPlatform.android ||
        plataforma == TargetPlatform.iOS;
    return esMovil && ladoCorto < tokens.breakpoint.ladoCorto;
  }

  /// Teléfono en horizontal (852×393 en un iPhone): compacto por el lado corto,
  /// con ancho de sobra para una pestaña más en la barra inferior. Tablet y
  /// web no entran: su compacto es de ventana angosta, no de teléfono.
  bool get esTelefonoEnHorizontal {
    final tamano = MediaQuery.sizeOf(this);
    return esTelefono(tamano.shortestSide) && tamano.width > tamano.height;
  }

  bool get esExpandida => clasePantalla == ClasePantalla.expandida;
  bool get esCompacta => clasePantalla == ClasePantalla.compacta;

  /// Poco alto (teléfono en horizontal): las cabeceras con foto y la barra
  /// inferior se achican para que el contenido tenga dónde mostrarse.
  bool get esAlturaCorta =>
      MediaQuery.sizeOf(this).height < tokens.breakpoint.alturaCorta;
}
