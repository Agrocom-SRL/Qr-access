#!/usr/bin/env bash
#
# Guardarraíl de escritura de archivos (hook PreToolUse sobre Write|Edit).
#
# El .env real y los archivos de secretos (firmware, firma de Android) son
# intocables: no están versionados y no hay forma de recuperarlos. Las reglas para Bash (lectura, copia o borrado del .env)
# están en guardarrail-bash.sh.
#
set -uo pipefail

entrada=$(cat)
ruta=$(printf '%s' "$entrada" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
[ -z "$ruta" ] && exit 0

decidir() {
    jq -cn --arg d "$1" --arg r "$2" \
        '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
    exit 0
}

case "$(basename "$ruta")" in
    .env|.env.local|.env.production|.env.staging)
        decidir deny 'El .env real no se edita por herramienta: no está versionado y no hay forma de recuperarlo.' ;;
    secretos.h|key.properties|*.jks|*.keystore)
        decidir deny 'Archivo de secretos (WiFi y clave del dispositivo, o firma de Android): no se versiona ni se edita por herramienta. Usa la plantilla *.example.' ;;
esac

exit 0
