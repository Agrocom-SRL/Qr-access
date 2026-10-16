import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Hora actual. Se inyecta para que los vencimientos se prueben sin esperar y
/// sin depender del reloj del equipo (skill `codigo-limpio`, principio D).
final relojProvider = Provider<DateTime Function()>((ref) => DateTime.now);
