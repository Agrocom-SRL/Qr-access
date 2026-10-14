// Versión del firmware que informa el latido. La compilación de desarrollo
// lleva el sufijo "-dev" para que la API la distinga de una publicable.
#pragma once

#ifdef ACCESO_DESARROLLO
#define FIRMWARE_VERSION "0.5.0-dev"
#else
#define FIRMWARE_VERSION "0.5.0"
#endif
