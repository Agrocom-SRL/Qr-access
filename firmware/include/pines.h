// Asignación de pines: única fuente (docs/hardware/README.md, ESP32-DevKitC).
// Evitar GPIO 0, 2, 12 y 15 (arranque) y 34-39 como salida (solo entrada).
#pragma once

#define PIN_LECTOR_RX 16  // TX del lector QR -> RX2 del ESP32
#define PIN_LECTOR_TX 17  // RX2 del ESP32 -> RX del lector (configuración)
#define PIN_CERRADURA 25  // relé o MOSFET de la cerradura (pulso)
#define PIN_SENSOR_PUERTA 26
#define PIN_PULSADOR_SALIDA 27
#define PIN_LED_VERDE 18
#define PIN_LED_ROJO 19
#define PIN_LED_AZUL 21
#define PIN_BUZZER 22

// Nivel que activa la cerradura (depende del módulo de relé, D-04).
#define CERRADURA_NIVEL_ACTIVO HIGH

// Nivel del sensor de puerta (INPUT_PULLUP) cuando la puerta está abierta:
// reed NC con la puerta cerrada = contacto a masa = LOW; abierta = HIGH.
#define SENSOR_PUERTA_NIVEL_ABIERTA HIGH
