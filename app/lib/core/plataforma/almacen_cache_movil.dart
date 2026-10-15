import 'package:agrocom_acceso/core/plataforma/almacen_cache_contrato.dart';
import 'package:sqflite/sqflite.dart';

const _archivo = 'cache_respuestas.db';
const _tabla = 'cache_respuestas';

/// Lo guardado hace más de esto ya no sirve de respaldo y se descarta al abrir.
const int _vigenciaMs = 30 * Duration.millisecondsPerDay;

/// Implementación móvil con SQLite: una tabla clave → respuesta JSON.
class AlmacenCacheMovil implements AlmacenCache {
  Future<Database>? _base;

  Future<Database> get _abierta => _base ??= _abrir();

  Future<Database> _abrir() async {
    final base = await openDatabase(
      '${await getDatabasesPath()}/$_archivo',
      version: 1,
      onCreate: (db, _) => db.execute('''
CREATE TABLE $_tabla (
  clave TEXT PRIMARY KEY,
  cuerpo TEXT NOT NULL,
  guardado_at INTEGER NOT NULL
)'''),
    );
    await base.delete(
      _tabla,
      where: 'guardado_at < ?',
      whereArgs: [DateTime.now().millisecondsSinceEpoch - _vigenciaMs],
    );
    return base;
  }

  @override
  Future<EntradaCache?> leer(String clave) async {
    final filas = await (await _abierta).query(
      _tabla,
      where: 'clave = ?',
      whereArgs: [clave],
      limit: 1,
    );
    if (filas.isEmpty) return null;
    return EntradaCache(
      cuerpo: filas.first['cuerpo']! as String,
      guardadoAt: DateTime.fromMillisecondsSinceEpoch(
        filas.first['guardado_at']! as int,
      ),
    );
  }

  @override
  Future<void> guardar(String clave, String cuerpo) async {
    await (await _abierta).insert(_tabla, {
      'clave': clave,
      'cuerpo': cuerpo,
      'guardado_at': DateTime.now().millisecondsSinceEpoch,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  @override
  Future<void> borrarTodo() async {
    await (await _abierta).delete(_tabla);
  }
}

AlmacenCache crearAlmacenCache() => AlmacenCacheMovil();
