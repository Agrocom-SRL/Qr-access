import 'package:agrocom_acceso/core/api/error_api.dart';
import 'package:agrocom_acceso/core/formato/fecha_hora.dart';
import 'package:agrocom_acceso/core/l10n/l10n.dart';
import 'package:agrocom_acceso/core/listados/pagina.dart';
import 'package:agrocom_acceso/core/theme/tokens.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_skeleton.dart';
import 'package:agrocom_acceso/shared/widgets/atoms/acceso_tarjeta.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/banner_sin_conexion.dart';
import 'package:agrocom_acceso/shared/widgets/molecules/estado_vacio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Una columna de la tabla (≥ 1024): título y cómo pintar la celda.
class ColumnaListado<T> {
  const new({
    required this.titulo,
    required this.celda,
    this.ancho,
    this.numerica = false,
  });

  final String titulo;
  final Widget Function(BuildContext context, T dato) celda;

  /// Ancho fijo (hora, acciones); `null` reparte el resto.
  final double? ancho;
  final bool numerica;
}

/// En qué está el listado (handoff §Estados): cargando (skeleton con la forma
/// real), con datos, vacío, con error o sin conexión (caché + banner).
sealed class EstadoListado<T> {
  const new();
}

final class ListadoCargando<T> extends EstadoListado<T> {
  const new();
}

final class ListadoConDatos<T> extends EstadoListado<T> {
  const new(this.pagina, {this.horaDeLosDatosSinConexion});

  final Pagina<T> pagina;

  /// Si hay valor, los datos son de la última carga buena y se muestra el
  /// banner de sin conexión con esa hora.
  final String? horaDeLosDatosSinConexion;
}

final class ListadoConError<T> extends EstadoListado<T> {
  const new({required this.sinConexion});

  final bool sinConexion;
}

/// Listado paginado: tarjetas con "Cargar más" en compacto y medio (una o dos
/// columnas), `DataTable` con paginación de 20 en expandido. Lo usan Mis QR,
/// Eventos, Puertas y Usuarios.
class ListadoPaginado<T> extends StatelessWidget {
  const new({
    required this.estado,
    required this.tarjeta,
    required this.columnas,
    required this.vacio,
    required this.alCambiarPagina,
    required this.alReintentar,
    required this.tituloDeError,
    this.encabezadoDe,
    this.sinRelleno = false,
    super.key,
  });

  final EstadoListado<T> estado;

  /// Tarjeta de un dato (< 1024).
  final Widget Function(BuildContext context, T dato) tarjeta;

  /// Columnas de la tabla (≥ 1024).
  final List<ColumnaListado<T>> columnas;

  /// Qué mostrar sin datos (un `EstadoVacio` con su acción).
  final Widget vacio;
  final ValueChanged<int> alCambiarPagina;
  final VoidCallback alReintentar;

  /// Título del estado de error o sin conexión ("No pudimos cargar…").
  final String tituloDeError;

  /// Encabezado de grupo antes de un dato (p. ej. "Hoy · jueves 9 oct" o el
  /// sitio): `null` si no empieza grupo.
  final String? Function(T dato, T? anterior)? encabezadoDe;
  final bool sinRelleno;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final expandida = context.esExpandida;
    final relleno = sinRelleno
        ? EdgeInsets.zero
        : EdgeInsets.all(tokens.espacio.l);
    return switch (estado) {
      ListadoCargando() => Padding(
        padding: relleno,
        child: expandida
            ? _TablaSkeleton(columnas: columnas.length)
            : const _TarjetasSkeleton(),
      ),
      ListadoConError(:final sinConexion) =>
        sinConexion
            ? EstadoVacio.sinConexion(
                titulo: tituloDeError,
                alReintentar: alReintentar,
              )
            : EstadoVacio.error(
                titulo: tituloDeError,
                alReintentar: alReintentar,
              ),
      ListadoConDatos(:final pagina, :final horaDeLosDatosSinConexion) =>
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (horaDeLosDatosSinConexion != null)
              Padding(
                padding: EdgeInsets.fromLTRB(
                  relleno.horizontal / 2,
                  tokens.espacio.l,
                  relleno.horizontal / 2,
                  0,
                ),
                child: BannerSinConexion(
                  horaDeLosDatos: horaDeLosDatosSinConexion,
                  alReintentar: alReintentar,
                ),
              ),
            Expanded(
              child: pagina.datos.isEmpty
                  ? vacio
                  : (expandida
                        ? _Tabla<T>(
                            pagina: pagina,
                            columnas: columnas,
                            alCambiarPagina: alCambiarPagina,
                            relleno: relleno,
                          )
                        : _Tarjetas<T>(
                            pagina: pagina,
                            tarjeta: tarjeta,
                            encabezadoDe: encabezadoDe,
                            alCambiarPagina: alCambiarPagina,
                            relleno: relleno,
                          )),
            ),
          ],
        ),
    };
  }
}

class _Tarjetas<T> extends StatelessWidget {
  const new({
    required this.pagina,
    required this.tarjeta,
    required this.encabezadoDe,
    required this.alCambiarPagina,
    required this.relleno,
  });

  final Pagina<T> pagina;
  final Widget Function(BuildContext context, T dato) tarjeta;
  final String? Function(T dato, T? anterior)? encabezadoDe;
  final ValueChanged<int> alCambiarPagina;
  final EdgeInsets relleno;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final columnas = context.clasePantalla == ClasePantalla.media ? 2 : 1;
    final elementos = <Widget>[];
    T? anterior;
    for (final dato in pagina.datos) {
      final encabezado = encabezadoDe?.call(dato, anterior);
      if (encabezado != null) {
        elementos.add(_Encabezado(texto: encabezado));
      }
      elementos.add(tarjeta(context, dato));
      anterior = dato;
    }
    return SingleChildScrollView(
      padding: relleno,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (columnas == 1)
            for (final elemento in elementos) ...[
              elemento,
              SizedBox(height: tokens.espacio.m),
            ]
          else
            LayoutBuilder(
              builder: (context, restricciones) {
                final ancho =
                    (restricciones.maxWidth - tokens.espacio.l) / columnas;
                return Wrap(
                  spacing: tokens.espacio.l,
                  runSpacing: tokens.espacio.l,
                  children: [
                    for (final elemento in elementos)
                      SizedBox(
                        width: elemento is _Encabezado
                            ? restricciones.maxWidth
                            : ancho,
                        child: elemento,
                      ),
                  ],
                );
              },
            ),
          if (pagina.tieneSiguiente) ...[
            SizedBox(height: tokens.espacio.s),
            Center(
              child: TextButton.icon(
                onPressed: () => alCambiarPagina(pagina.pagina + 1),
                icon: Icon(Icons.expand_more, size: tokens.tamano.icono),
                label: Text(context.l10n.comunCargarMas),
              ),
            ),
          ],
          if (pagina.tieneAnterior)
            Center(
              child: TextButton(
                onPressed: () => alCambiarPagina(pagina.pagina - 1),
                child: Text(context.l10n.comunPaginaAnterior),
              ),
            ),
        ],
      ),
    );
  }
}

class _Encabezado extends StatelessWidget {
  const new({required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: EdgeInsets.only(
        top: tokens.espacio.s,
        bottom: tokens.espacio.xs,
      ),
      child: Text(
        texto.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: tokens.colores.textoSecundario,
          letterSpacing: tokens.espacio.xxs / 2,
        ),
      ),
    );
  }
}

class _Tabla<T> extends StatelessWidget {
  const new({
    required this.pagina,
    required this.columnas,
    required this.alCambiarPagina,
    required this.relleno,
  });

  final Pagina<T> pagina;
  final List<ColumnaListado<T>> columnas;
  final ValueChanged<int> alCambiarPagina;
  final EdgeInsets relleno;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final l10n = context.l10n;
    final desde = (pagina.pagina - 1) * pagina.porPagina + 1;
    final hasta = desde + pagina.datos.length - 1;
    return SingleChildScrollView(
      padding: relleno,
      child: AccesoTarjeta(
        relleno: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(tokens.radio.l),
              ),
              child: LayoutBuilder(
                builder: (context, restricciones) => SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minWidth: restricciones.maxWidth,
                    ),
                    child: DataTable(
                      columnSpacing: tokens.espacio.xl,
                      horizontalMargin: tokens.espacio.xl,
                      headingRowHeight: tokens.tamano.control,
                      dataRowMinHeight: tokens.tamano.appBar,
                      dataRowMaxHeight: tokens.tamano.filaPerfil,
                      columns: [
                        for (final columna in columnas)
                          DataColumn(
                            label: Text(columna.titulo),
                            numeric: columna.numerica,
                          ),
                      ],
                      rows: [
                        for (final dato in pagina.datos)
                          DataRow(
                            cells: [
                              for (final columna in columnas)
                                DataCell(
                                  columna.ancho == null
                                      ? columna.celda(context, dato)
                                      : SizedBox(
                                          width: columna.ancho,
                                          child: columna.celda(context, dato),
                                        ),
                                ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const Divider(),
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: tokens.espacio.xl,
                vertical: tokens.espacio.s,
              ),
              child: Row(
                children: [
                  Text(
                    l10n.comunRangoDe(desde, hasta, pagina.total),
                    style: tokens.tipografia.mono(
                      tokens.tipografia.t12,
                      color: tokens.colores.textoSecundario,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: l10n.comunPaginaAnterior,
                    onPressed: pagina.tieneAnterior
                        ? () => alCambiarPagina(pagina.pagina - 1)
                        : null,
                    icon: const Icon(Icons.chevron_left),
                  ),
                  IconButton(
                    tooltip: l10n.comunPaginaSiguiente,
                    onPressed: pagina.tieneSiguiente
                        ? () => alCambiarPagina(pagina.pagina + 1)
                        : null,
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton con la forma de una tarjeta: ícono, dos líneas y un badge.
class _TarjetasSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      label: context.l10n.comunCargando,
      child: Column(
        children: [
          for (var i = 0; i < tokens.tamano.filasDelTablero; i++) ...[
            AccesoTarjeta(
              child: Row(
                children: [
                  AccesoSkeleton(
                    ancho: tokens.tamano.iconoCaja,
                    alto: tokens.tamano.iconoCaja,
                  ),
                  SizedBox(width: tokens.espacio.m),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AccesoSkeleton(
                          ancho: tokens.tamano.railExpandido / 1.4,
                        ),
                        SizedBox(height: tokens.espacio.s),
                        AccesoSkeleton(
                          ancho: tokens.tamano.railExpandido / 2,
                          alto: tokens.espacio.m,
                        ),
                      ],
                    ),
                  ),
                  AccesoSkeleton(
                    ancho: tokens.tamano.railMedio,
                    alto: tokens.tamano.badge,
                  ),
                ],
              ),
            ),
            SizedBox(height: tokens.espacio.m),
          ],
        ],
      ),
    );
  }
}

class _TablaSkeleton extends StatelessWidget {
  const new({required this.columnas});

  final int columnas;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Semantics(
      label: context.l10n.comunCargando,
      child: AccesoTarjeta(
        child: Column(
          children: [
            for (var fila = 0; fila < tokens.tamano.filasDelTablero + 1; fila++)
              Padding(
                padding: EdgeInsets.symmetric(vertical: tokens.espacio.m),
                child: Row(
                  children: [
                    for (var c = 0; c < columnas; c++) ...[
                      Expanded(
                        child: AccesoSkeleton(
                          alto: fila == 0 ? tokens.espacio.m : tokens.espacio.l,
                        ),
                      ),
                      if (c < columnas - 1) SizedBox(width: tokens.espacio.xl),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Traduce el `AsyncValue` de una página a lo que pinta `ListadoPaginado`:
/// si falla la red pero había datos de antes, se muestran con el banner de
/// sin conexión y la hora de esa carga (handoff §Estados).
EstadoListado<T> estadoDesdeAsync<T>(
  AsyncValue<Pagina<T>> valor, {
  required DateTime ahora,
}) {
  final sinConexion =
      valor.error is ErrorApi && (valor.error! as ErrorApi).esSinConexion;
  if (valor.hasValue && valor.value != null) {
    return ListadoConDatos(
      valor.value!,
      horaDeLosDatosSinConexion: valor.hasError && sinConexion
          ? formatearHora(ahora)
          : null,
    );
  }
  if (valor.hasError) return ListadoConError(sinConexion: sinConexion);
  return const ListadoCargando();
}
