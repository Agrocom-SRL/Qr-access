// Asignación de pines: única fuente (docs/hardware/README.md).
// Evitar GPIO 0, 2, 12 y 15 (arranque) y 34-39 como salida (solo entrada).
#pragma once

#ifdef ACCESO_ETH01
// ESP32-ETH01 (LAN8720 por RMII): la PHY ocupa los GPIO 0, 18, 19, 21, 22, 23, 25, 26 y 27,
// y el 16 enciende su oscilador. Con eso quedan estos pines libres del conector.
#define ETH_PHY_ADDR_LAN8720 1
#define ETH_PIN_ENERGIA 16  // habilita el oscilador de 50 MHz de la PHY
#define ETH_PIN_MDC 23
#define ETH_PIN_MDIO 18

#define PIN_LECTOR_RX 5   // salida RO del módulo TTL-RS485 -> pin "RXD" del conector de la placa
#define PIN_LECTOR_TX 17  // pin "TXD" -> entrada DI del módulo (sin uso mientras DE esté a GND)
#define PIN_CERRADURA 4   // relé o MOSFET de la cerradura (pulso)
#define PIN_SENSOR_PUERTA 14
#define PIN_PULSADOR_SALIDA 12  // con INPUT_PULLUP; al arrancar GPIO12 debe estar bajo
#define PIN_LED_VERDE 2
#define PIN_LED_ROJO 32  // pin "CFG" del conector
#define PIN_LED_AZUL 33  // pin "485_EN" del conector
#define PIN_BUZZER 4  // comparte IO4 con el relé: suena solo mientras la cerradura está activa
#else

#define PIN_LECTOR_RX 16  // TX del lector QR -> RX2 del ESP32
#define PIN_LECTOR_TX 17  // RX2 del ESP32 -> RX del lector (configuración)
#define PIN_CERRADURA 25  // relé o MOSFET de la cerradura (pulso)
#define PIN_SENSOR_PUERTA 26
#define PIN_PULSADOR_SALIDA 27
#define PIN_LED_VERDE 18
#define PIN_LED_ROJO 19
#define PIN_LED_AZUL 21
#define PIN_BUZZER 22
#endif

// Nivel que activa la cerradura (depende del módulo de relé, D-04).
#define CERRADURA_NIVEL_ACTIVO HIGH

// La polaridad del sensor de puerta (INPUT_PULLUP) ya no se fija al compilar: la dicta el servidor
// (`sensor_puerta.nivel_abierto`) y su valor por omisión, PENDIENTE DE CONFIRMAR EN CAMPO, vive en
// lib/confirmacion (NIVEL_ABIERTO_POR_OMISION).
