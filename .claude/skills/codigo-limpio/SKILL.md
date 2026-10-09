---
name: codigo-limpio
description: Clean code, principios SOLID y comentarios en las tres partes de AGROCOM Acceso (api en TypeScript, app en Flutter, firmware en C++ con Arduino) — nombres, funciones chicas, responsabilidad única, dependencias inyectadas, errores, cuándo y cómo comentar (TSDoc, ///, //) y qué no hacer por "limpieza". Usar antes de escribir o revisar código en api/, app/ o firmware/.
---

# Código limpio — AGROCOM Acceso

El objetivo es que cualquiera (persona o agente) entienda un archivo sin abrir otros cinco. Lo que sigue no reemplaza los mapas de cada parte (`backend-node`, `app-flutter`, `firmware-esp32`): los aterriza. Ante una duda entre "más limpio" y "más simple", gana lo simple.

## Nombres

- **Dominio en español, infraestructura en inglés** (CLAUDE.md): `validarQr`, `Puerta`, `eventos_acceso`; `routes.ts`, `repository.ts`, `plugin`.
- Un nombre dice **qué es o qué hace**, no cómo: `qrVencido`, no `flag2`; `buscarPuertaPorId`, no `getData`.
- Booleanos como pregunta: `estaActiva`, `puedeAbrir`, `tieneRolActivo`.
- Unidades en el nombre cuando no hay tipo que las diga: `TIMEOUT_VALIDACION_MS`, `segundosApertura`.
- Sin abreviaturas propias (`usr`, `cfg`, `tmp`). Valen las del dominio técnico (`id`, `url`, `qr`, `jwt`).
- Números y textos con significado van en una constante con nombre (`MAX_APERTURA_S`), nunca sueltos en la lógica. En la app, además, en tokens o ARB (invariante 12).

## Funciones

- **Una función, un trabajo.** Si para describirla hace falta "y", son dos.
- Cortas: si no entra en una pantalla (~40 líneas), casi seguro mezcla niveles. Extrae el paso con un nombre que lo explique.
- **Un nivel de abstracción por función**: `ejecutar()` de una acción lee como la historia (validar → buscar → decidir → guardar), no mezcla SQL con reglas.
- **Retornos tempranos** en lugar de `if` anidados: primero los casos que rechazan, al final el camino feliz.
- Hasta 3 parámetros; más, un objeto con nombre (`DatosEmision`, `struct Resultado`).
- Sin efectos ocultos: una función que se llama `calcular…` no escribe en la base ni acciona un relé.

## SOLID, aterrizado en este repo

| Principio | Qué significa acá | Ejemplo |
|---|---|---|
| **S** — Responsabilidad única | Cada pieza tiene un motivo para cambiar. La arquitectura ya lo reparte: no lo rompas metiendo trabajo de una capa en otra. | API: `routes.ts` valida y autoriza, `actions/` decide, `repository.ts` habla SQL, `domain/` calcula. App: el widget pinta, el provider maneja estado, `data/` llama a la API. Firmware: `lib/` decide (puro), `src/` toca hardware. |
| **O** — Abierto/cerrado | Se agrega comportamiento sumando piezas, no editando un `switch` que crece en cada HU. | Un caso de uso nuevo es un archivo nuevo en `actions/`. Un motivo de rechazo nuevo es una entrada en la lista de motivos, no otro `if` en la ruta. |
| **L** — Sustitución de Liskov | Un sustituto (fake de test, implementación web o móvil) cumple el mismo contrato **con el mismo shape**, incluidos sus errores. | El fake del repositorio en los widget tests devuelve el shape real de la API. `core/plataforma/*_web.dart` y `*_movil.dart` se comportan igual ante el mismo pedido. |
| **I** — Segregación de interfaces | Contratos chicos y pensados para quien los usa. | `contracts.ts` expone lo que otro módulo necesita (un DTO, una función), nunca el repositorio entero. |
| **D** — Inversión de dependencias | La lógica recibe lo que necesita (reloj, azar, base, red); no lo crea adentro. Es lo que permite probar vencimientos y fallas sin esperar ni romper nada. | `domain/` recibe `ahora` como parámetro, no llama `new Date()`. La máquina de `lib/puerta` recibe `ahoraMs` en cada evento, no llama `millis()`. Las acciones reciben el repositorio, no abren el pool. |

**Sin sobreingeniería.** SOLID no es una excusa para capas vacías:
- No crees una interfaz con una sola implementación salvo que sea una frontera real (otro módulo, plataforma web/móvil, hardware) o que un test necesite sustituirla.
- No generalices "por si acaso": la tercera vez que algo se repite, se extrae; la primera y la segunda, no (YAGNI).
- No agregues patrones (factory, strategy, builder) si una función resuelve el caso.

## Errores

- **API**: `throw new ErrorDeDominio('qr.vencido', 422)`; el código, nunca un texto en español (invariante 11). No atrapes un error para ignorarlo; si lo atrapas, es para traducirlo o agregar contexto.
- **App**: los errores de la API se traducen por `code` en un solo lugar; un widget no interpreta excepciones de `dio`.
- **Firmware**: errores como valores (`Resultado.valida`, códigos de retorno), sin excepciones. Ante cualquier duda, el camino de error **no abre** (invariante 2).
- Nada de `catch` vacío, `// ignore:` o `eslint-disable` sin una línea que diga por qué.

## Comentarios

Un comentario cuenta **por qué**, no qué: el qué ya lo dice el código si los nombres son buenos. Siempre en español.

**Se comenta:**
1. **Todo lo exportado o público** con su comentario de documentación: qué representa y qué garantiza; los casos raros, si los hay.
2. **El porqué de una decisión no obvia**: un límite, un orden, un valor, un rodeo a un bug de una librería.
3. **Invariantes y seguridad**, citando la fuente. Es obligatorio en el aislamiento por cuenta, la validación y el consumo del QR, la autenticación de dispositivos y PIN, y todo camino que accione la cerradura:
   `// Invariante 2 (falla segura): sin respuesta válida, no abre.`
4. **Referencias** a ADR, HU o dudas cuando el código depende de ellas: `(ADR 0018)`, `[confirmar D-24]`.
5. **Encabezado de archivo** solo cuando el archivo tiene una regla que no se deduce de su nombre (p. ej. "lógica pura, sin Arduino.h").

**No se comenta:**
- Lo que el código ya dice (`// incrementa el contador` sobre `i++`).
- Código comentado: se borra; para eso está git.
- Historia del cambio ("antes hacía X", "corregido por Y"): va en el commit.
- `TODO` sueltos: un `TODO` lleva la HU o duda que lo resuelve (`// TODO(D-24): …`) o no se escribe.

**Formato por lenguaje** (el que ya usa el repo):

| Parte | Documentación (público) | Comentario de línea |
|---|---|---|
| api (TypeScript) | `/** … */` (TSDoc) sobre funciones, clases, tipos y constantes exportadas | `//` |
| app (Dart) | `///` sobre clases, miembros públicos y providers | `//` |
| firmware (C++) | `//` sobre la declaración en el `.h`; el `.cpp` comenta solo el porqué interno | `//` |

```ts
/**
 * Consume un QR de forma atómica en su primer uso válido (ADR 0008).
 * Devuelve `false` si otro request lo consumió antes: el llamador lo registra como reusado.
 */
export async function consumirQr(tx: Transaccion, qrId: string, ahora: Date): Promise<boolean> {
```

```dart
/// PIN de 7 caracteres: código de la cuenta (3 letras) + 4 alfanuméricos (ADR 0018).
/// Se normaliza a mayúsculas y sin espacios antes de enviarlo.
String normalizarPin(String entrada) => entrada.replaceAll(' ', '').toUpperCase();
```

```cpp
// Resultado de una validación, ya interpretado por lib/respuesta.
struct Resultado {
  bool valida;        // la respuesta llegó y tiene el formato esperado
  bool abrir;         // la API dijo `abrir: true`
  uint16_t segundos;  // duración del pulso pedida por la API
};
```

## Tests

También son código: nombres que describen la regla (`rechaza un QR ya usado`), un comportamiento por test, preparar → actuar → verificar, sin lógica condicional dentro del test.

## Checklist antes de dar un cambio por terminado

- [ ] Cada función hace una sola cosa y su nombre lo dice.
- [ ] Ninguna capa hace el trabajo de otra (ruta sin SQL, widget sin red, `lib/` del firmware sin Arduino).
- [ ] Reloj, azar y E/S entran por parámetro en la lógica que se prueba.
- [ ] Sin números ni textos mágicos; sin código comentado; sin `catch` vacío.
- [ ] Lo público tiene su comentario de documentación; lo crítico cita su invariante o ADR.
- [ ] Sin abstracciones que hoy no se usan.
- [ ] `bin/verify` en verde (skill `verificacion`).
