/// Superficie pública de la feature `eventos` (ADR 0003): la pantalla que el
/// router registra y lo que el tablero necesita para "Últimos eventos".
library;

export 'data/eventos_repositorio.dart'
    show EventosRepositorio, eventosRepositorioProvider;
export 'domain/evento_acceso.dart';
export 'presentation/evento_vista.dart'
    show
        textoDetalleEvento,
        textoMotivoEvento,
        textoResultadoEvento,
        tonoResultadoEvento;
export 'presentation/eventos_pagina.dart' show EventosPagina;
export 'presentation/widgets/fila_evento.dart' show FilaEvento;
