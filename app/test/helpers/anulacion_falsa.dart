import 'package:agrocom_acceso/features/qr_accesos/data/anulacion_masiva_repositorio.dart';
import 'package:agrocom_acceso/features/qr_accesos/domain/anulacion_masiva.dart';

/// La anulación masiva de mi rama en memoria: anota los motivos que recibió.
class AnulacionMasivaRepositorioFalso implements AnulacionMasivaRepositorio {
  new({this.qrAnulados = 3, this.error});

  final int qrAnulados;
  final Exception? error;
  final List<String> motivos = [];

  @override
  Future<ResultadoDeAnulacionMasiva> anularMiRama({
    required String motivo,
  }) async {
    motivos.add(motivo);
    if (error != null) throw error!;
    return ResultadoDeAnulacionMasiva(
      qrAnulados: qrAnulados,
      usuariosAlcanzados: 2,
    );
  }
}
