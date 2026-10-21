/// Nivel de un usuario en el árbol de la cuenta (ADR 0028): Administrador →
/// Titular y Guardia → Miembro. Sale del nombre de su único rol base, igual que
/// en la API (`domain/jerarquia.ts`).
enum NivelUsuario { administrador, titular, miembro, guardia }

const _nivelPorRol = <String, NivelUsuario>{
  'Administrador': NivelUsuario.administrador,
  'Titular': NivelUsuario.titular,
  'Miembro': NivelUsuario.miembro,
  'Guardia': NivelUsuario.guardia,
};

/// El nivel de un rol por su nombre; `null` para un rol sin nivel (la API no le
/// deja crear a nadie).
NivelUsuario? nivelDeRol(String nombreDelRol) => _nivelPorRol[nombreDelRol];

/// Qué niveles crea cada uno: solo el de abajo, nunca un igual ni un superior
/// (ADR 0028 §3). Es presentación: la autoridad es la API.
const _nivelesQueCrea = <NivelUsuario, Set<NivelUsuario>>{
  NivelUsuario.administrador: {NivelUsuario.titular, NivelUsuario.guardia},
  NivelUsuario.titular: {NivelUsuario.miembro},
  NivelUsuario.miembro: {},
  NivelUsuario.guardia: {},
};

/// ¿Puede `actor` crear usuarios de nivel `creado`? Un nivel desconocido, no.
bool puedeCrearNivel(NivelUsuario? actor, NivelUsuario? creado) {
  if (actor == null || creado == null) return false;
  return _nivelesQueCrea[actor]!.contains(creado);
}
