/// Superficie pública de la feature `puertas` (ADR 0003): lo único que otras
/// features pueden importar.
library;

export 'data/puertas_repositorio.dart'
    show PuertasRepositorio, puertasRepositorioProvider;
export 'domain/puerta.dart';
export 'presentation/puertas_providers.dart' show puertasDisponiblesProvider;
