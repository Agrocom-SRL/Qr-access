# Placa perforada del controlador (ESP32-ETH01 + RS485 + relé)

**Estado:** Borrador para soldar (2026-10-29), hecho a partir de las fotos de la placa de pruebas. Es la placa **artesanal** con los tres módulos que ya tienes. Los pines son los de `firmware/include/pines.h` (rama `ACCESO_ETH01`) y la lógica de conexión es la de `README.md` de esta carpeta.

Planos (ábrelos en el navegador):

- `placa-perforada-superior.svg`: **dónde va cada pin** (lado de los componentes, girada igual que tu foto).
- `placa-perforada-inferior.svg`: **cables y soldaduras** (lado de cobre).

## Cómo leer los planos

- La placa se cuenta como en la foto: **35 columnas × 25 filas**, porque las líneas blancas separan bloques de 5 agujeros (7 bloques de ancho, 5 de alto). Cada agujero es `C<columna>·F<fila>`, con C1·F1 en la esquina superior izquierda de la vista superior.
- Vista superior: RJ45 hacia abajo, como en tu foto. Vista inferior: se voltea la placa **como la hoja de un libro** (eje vertical); el RJ45 sigue abajo y las columnas quedan invertidas (C35 a la izquierda).
- Los tres módulos se quedan donde están en la foto; solo se desplaza un poco el RS485 a la izquierda para dejar sitio a las dos resistencias.

## Dónde va cada módulo

| Módulo | Cómo queda | Pines en la placa |
|---|---|---|
| **RS485** (MAX485, "C25B") | Pines hacia abajo, borne verde arriba | Cabezal superior en **F4**, C4–C7: `DI DE RE RO`. Cabezal inferior en **F21**, C4–C7: `GND A B VCC` |
| **ESP32-ETH01** | Tiras de pines hacia abajo, RJ45 abajo | Columna **C12** (F7–F19) y columna **C21** (F7–F19) |
| **Relé** (JQC-3FF-S-Z) | Atornillado en C24–C35; **no se suelda** | Solo bornes de tornillo: arriba `IN`, `DC−`, `DC+` (de izquierda a derecha); abajo `NO`, `COM`, `NC` |

### ESP32-ETH01 (según la serigrafía de la cara inferior del módulo, foto 6)

| Fila | C12 (columna izquierda) | C21 (columna derecha) |
|---|---|---|
| F7 | EN | TXO |
| F8 | **GND** | RXO |
| F9 | 3V3 | IO0 |
| F10 | EN | GND |
| F11 | CFG (GPIO32) | IO39 |
| F12 | 485_EN (GPIO33) | IO36 |
| F13 | **RXD (GPIO5)** | IO15 |
| F14 | **TXD (GPIO17)** | IO14 |
| F15 | **GND** | IO12 |
| F16 | 3V3 | IO35 |
| F17 | **GND** | **IO4** |
| F18 | **5V** | IO2 |
| F19 | LINK | **GND** |

En negrita, los que se cablean. El resto se suelda igual, solo por firmeza.

## Conexiones (lado de cobre)

Hilo aislado de 26–28 AWG, pelado solo en los extremos. Las rutas están dibujadas en `placa-perforada-inferior.svg`.

| # | Red | Desde | Hacia | Ruta |
|---|---|---|---|---|
| 1 | GND | RS485 `DE` (C5·F4) y `RE` (C6·F4) | ESP32 GND (C12·F8) | Puentecito DE–RE; `RE` sube a F3, va por F3 hasta C11 y baja por C11 hasta F8 |
| 2 | GND | RS485 `GND` (C4·F21) | ESP32 GND (C12·F17) | Sube por C4 hasta F17 y sigue por F17 hasta C12 |
| 3 | +5 V | RS485 `VCC` (C7·F21) | ESP32 `5V` (C12·F18) | Sube por C7 hasta F18 y sigue por F18 hasta C12 |
| 4 | RO | RS485 `RO` (C7·F4) | R1 pata 1 (C9·F7) | Por F4 hasta C9 y baja por C9 |
| 5 | RXD | R1 pata 2 (C9·F11) y R2 pata 1 (C10·F11) | ESP32 `RXD` (C12·F13) | Puente C9·F11–C10·F11; del nodo por F11 a C11, baja por C11 a F13 y entra a C12 |
| 6 | GND | R2 pata 2 (C10·F15) | ESP32 GND (C12·F15) | Directo por F15 |
| 7 | TXD (opcional) | ESP32 `TXD` (C12·F14) | RS485 `DI` (C4·F4) | Por F14 hasta C3, sube por C3 hasta F4 y entra a C4 |
| 8 | Relé IN | ESP32 `IO4` (C21·F17) | pad C23·F17 | Directo por F17 |
| 9 | Relé GND | ESP32 GND (C21·F19) | pad C23·F19 | Directo por F19 |
| 10 | H1 (programación) | ESP32 `TXO`, `RXO`, `IO0`, GND (C21·F7–F10) | pads C23·F7–F10 | Directo por cada fila |

Componentes del lado de arriba: **R1 = 1 kΩ** entre C9·F7 y C9·F11, **R2 = 2 kΩ** entre C10·F11 y C10·F15. Forman el divisor que baja el `RO` del MAX485 (5 V) a 3,3 V para el `RXD` de la ESP32.

Los cables de los pads **C23·F17** y **C23·F19** son flexibles: bajan del lado de arriba (se meten por el agujero y se sueldan abajo) y van a los bornes `IN` y `DC−` del relé. En H1 se suelda una tira de 4 pines macho; con un puente entre `IO0` y `GND` y un reinicio, la ESP32 entra en modo de carga.

## Cableado externo (a bornes de tornillo)

| Cable | Va a |
|---|---|
| Lector, rojo (12 V) | `DC+` del relé, junto con el + de la fuente de 12 V y la entrada del buck |
| Lector, negro (GND) | `DC−` del relé, junto con el − de la fuente. De aquí sale también el cable al pad C23·F19: es la tierra común |
| Lector, azul (485A) | Borne verde del RS485, tornillo `A` |
| Lector, naranja (485B) | Borne verde del RS485, tornillo `B` |
| Relé `COM`–`NO` | Entrada de apertura del equipo de la puerta (contactos secos) |
| Salida del buck 12→5 V | `+5 V` al agujero C9·F18 y `GND` al agujero C9·F17 (son agujeros de los cables 2 y 3) |

Los 12 V **no entran a la placa perforada**: solo llegan a los bornes del relé y al buck.

## Antes de soldar: lo que debes confirmar

1. **Cuenta los agujeros** de tu placa (bloques de 5). Si no son 35 × 25, el dibujo se corre pero las distancias entre pines no cambian.
2. **Ajuste en seco** del ESP32: las dos filas de pines deben caer en C12 y C21 (9 pasos = 22,86 mm). Si en tu módulo son 10 pasos (25,4 mm), mueve la columna derecha a C22 y los pads de C23 a C24.
3. **Ajuste en seco** del RS485: los dos cabezales deben caer en F4 y F21 (17 pasos = 43,2 mm). Si no coinciden con la cuadrícula, sube o baja uno de los cabezales con cable en vez de forzarlo.
4. **Voltaje del RS485.** El módulo de la foto es un MAX485 de 5 V (README, «Lector RS485 en la mesa de trabajo»), por eso lleva VCC a 5 V y el divisor R1/R2. Si el chip resulta ser un SP3485 o MAX3485 (3,3 V), pasa VCC al `3V3` (C12·F16) y reemplaza R1 y R2 por un solo cable `RO` → `RXD`.
5. **Alimentación de 5 V.** La ESP32-ETH01 no tiene USB: necesita 5 V en su pin `5V`, **nunca 12 V**. La propuesta es un buck 12→5 V de 2 A pegado dentro de la caja (no cabe en la placa), alimentado desde `DC+`/`DC−`. Si ya tienes una fuente de 5 V, úsala en los mismos agujeros.
6. **Jumper del relé en `H`** (nivel alto), como en tus fotos: el firmware activa la cerradura con `HIGH` (`CERRADURA_NIVEL_ACTIVO`). Confirma la serigrafía de los bornes (`DC+`, `DC−`, `IN`) en tu módulo antes de conectar.
7. **El relé con 3,3 V en `IN`.** Casi todos los módulos con optoacoplador lo aceptan, pero pruébalo antes de cerrar la caja (ver pruebas).

## Orden de armado

1. Ajuste en seco de los tres módulos y marca los agujeros.
2. Suelda R1 y R2 (lado de arriba).
3. Cambia la tira de pines del ESP32 y del RS485 para que queden hacia abajo, con el separador de plástico apoyado en la placa: el módulo ESP32 tiene patas soldadas del RJ45 por debajo y no deben tocar las islas de cobre.
4. Suelda ESP32 y RS485 (todos los pines, usados o no).
5. Cables de las filas 1 a 10 por la cara de cobre; revisa con lupa que no haya puentes de estaño entre agujeros vecinos.
6. Atornilla el relé y conecta los cables flexibles `IN` y `DC−`.
7. Conecta el lector, la fuente y el buck a los bornes.

## Pruebas

1. **Sin energía:** continuidad entre todos los GND (C12·F8, F15, F17; C21·F10, F19; `DC−` del relé) y **sin corto** entre `5V` y GND.
2. Con 12 V y **sin** la ESP32 puesta (si usas sockets) o con ella: el buck da 5,0 V en C12·F18.
3. Arranque por H1 (TXO/RXO a 115200): aparece el log y el RJ45 enciende su LED con el cable de red.
4. Lector: al pasar un QR llega una línea por RXD; si no llega, invierte `A` y `B` en el borne verde.
5. Relé: con una apertura válida, el relé hace clic y hay continuidad `COM`–`NO` durante `segundos_apertura`; en reposo, abierto. Si no acciona, mide `IO4` en C23·F17: debe dar ~3,3 V al activarse.

## Pines libres para después

Estos pines no se cablean hoy (tomados de `pines.h`); agrégalos cuando los necesites, sin tocar lo de arriba.

| Función | Pin | Nota |
|---|---|---|
| Pulsador de salida (NO) | `IO12` (C21·F15) a GND | **Sin pull-up externo**: IO12 es pin de arranque y debe estar bajo al encender |
| Sensor de puerta (reed) | `IO14` (C21·F14) a GND | Pull-up interno |
| LED verde / rojo / azul | `IO2` (C21·F18) / `CFG` (C12·F11) / `485_EN` (C12·F12) | Cada uno con 330 Ω a GND |
