#!/usr/bin/env bash
#
# Guardarraíl de comandos destructivos (hook PreToolUse sobre Bash).
#
# Un deny de hook gana incluso sobre los modos permisivos, así que esta
# es la única capa que sigue de pie cuando no hay nadie mirando la
# pantalla. Lista negra explícita: lo que no está acá, pasa.
#
# Cada regla protege algo concreto de este repo:
#   - la historia publicada en GitHub (ADR 0006: todo entra por PR)
#   - la base de desarrollo del compose (volumen qr-access-db-data)
#   - el .env real, que vive en la raíz junto al .env.example
#   - el dispositivo conectado por USB (borrar la flash pierde su credencial)
#
set -uo pipefail

entrada=$(cat)
comando=$(printf '%s' "$entrada" | jq -r '.tool_input.command // ""' 2>/dev/null)
[ -z "$comando" ] && exit 0

# El cuerpo de un heredoc son datos, no comandos: un mensaje de commit que
# MENCIONA un comando destructivo no lo ejecuta. Se descarta ese cuerpo (no la
# línea que lo abre, que sí es un comando) antes de evaluar las reglas.
comando=$(printf '%s' "$comando" | awk '
{
    if (dentro) { if ($0 == delim) dentro = 0; next }
    print
    if (match($0, /<<-?[ \t]*(\042[^\042]+\042|\047[^\047]+\047|[A-Za-z_][A-Za-z0-9_]*)/)) {
        d = substr($0, RSTART, RLENGTH)
        sub(/^<<-?[ \t]*/, "", d)
        gsub(/[\042\047]/, "", d)
        delim = d
        dentro = 1
    }
}')

# Decisión al harness. "deny" corta; "ask" exige confirmación humana
# (que de noche, sin nadie para confirmar, equivale a cortar).
decidir() {
    jq -cn --arg d "$1" --arg r "$2" \
        '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
    exit 0
}

# `--` es obligatorio: sin él, grep lee un patrón como --force-with-lease
# como si fuera una opción suya y aborta.
coincide() { printf '%s' "$comando" | grep -qE -- "$1"; }

rama=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# --- Secretos --------------------------------------------------------
if coincide '(^|[[:space:]/"'"'"'])\.env([[:space:]"'"'"';|&]|$)' && ! coincide '\.env\.example'; then
    coincide '\b(cat|less|more|head|tail|bat|nl|od|xxd|strings|source|\.)\b' &&
        decidir deny 'Lectura del .env real. Los valores que necesites pídelos al usuario o léelos de .env.example.'
    coincide '(>>?[[:space:]]*|[[:space:]](cp|mv|rm|truncate)[[:space:]][^;&|]*)' &&
        decidir deny 'Escritura o borrado del .env real: es el único archivo del repo que no está versionado y no se puede recuperar.'
fi

# Un comando de búsqueda que solo MENCIONA un patrón peligroso no es peligroso:
# `echo "no uses git reset --hard"` no resetea nada. Esas líneas se descartan
# antes de evaluar las reglas de abajo.
#
# Se descartan LÍNEA POR LÍNEA, y esto es lo que importa: cuando la excepción se
# evaluaba sobre el comando entero, un solo `echo` en cualquier línea desactivaba
# todas las reglas que siguen. Un script de varias líneas que empezara imprimiendo
# un encabezado podía después pushear a develop, resetear en duro o vaciar la base
# sin que el hook dijera nada — y este hook es la única barrera que queda de pie
# cuando no hay nadie mirando.
#
# Una línea se descarta solo si es ENTERAMENTE una búsqueda: encadenar con `&&`,
# `;`, un backtick o un `$(...)` la vuelve a poner bajo la lupa, porque
# `echo x && git push` y `echo $(git push)` sí pushean. Un `$` suelto sigue
# permitido: `echo $RAMA` no ejecuta nada. Las reglas del .env ya se evaluaron
# arriba, sobre el comando completo: ahí leer es justamente el riesgo.
comando=$(printf '%s' "$comando" |
    grep -vE '^[[:space:]]*(grep|rg|ag|echo|printf)[[:space:]]([^;&`$]|[$][^(])*$' || true)
[ -z "$(printf '%s' "$comando" | tr -d '[:space:]')" ] && exit 0

# --- Historia de git -------------------------------------------------
if coincide '\bgit[[:space:]]+push\b'; then
    coincide '(--force([[:space:]]|$)|[[:space:]]-f([[:space:]]|$))' && ! coincide '--force-with-lease' &&
        decidir deny 'git push --force reescribe historia ya publicada en GitHub. Si de verdad hace falta, lo hace el usuario a mano.'
    coincide '\bpush\b[^;&|]*\b(master|develop)\b' &&
        decidir deny 'Push directo a master/develop. GitFlow simplificado (ADR 0006): todo entra por PR desde una rama feature/*.'
    { [ "$rama" = "master" ] || [ "$rama" = "develop" ]; } &&
        decidir deny "Estás en $rama y este push iría directo a la rama base. Crea una rama feature/* primero (ADR 0006)."
fi

coincide '\bgit[[:space:]]+reset\b[^;&|]*--hard' &&
    decidir deny 'git reset --hard descarta cambios sin papelera. Si quieres descartar, dilo y se hace archivo por archivo.'
coincide '\bgit[[:space:]]+clean\b[^;&|]*-[[:alnum:]]*[fdx]' &&
    decidir deny 'git clean borra archivos no versionados — entre ellos el .env real.'
coincide '\bgit[[:space:]]+branch\b[^;&|]*[[:space:]]-D([[:space:]]|$)' &&
    decidir deny 'Borrado forzado de rama: puede perder commits que nunca llegaron al remoto.'
coincide '\bgit[[:space:]]+filter-branch\b|\bgit[[:space:]]+reflog[[:space:]]+expire\b' &&
    decidir deny 'Reescritura de historia local. Decisión del usuario, nunca automática.'

if coincide '\bgit[[:space:]]+commit\b'; then
    [ "$rama" = "master" ] &&
        decidir deny 'Commit directo sobre master. master solo recibe merges de develop por PR (ADR 0006).'
    [ "$rama" = "develop" ] &&
        decidir ask 'Estás en develop. La convención del repo (ADR 0006) es commitear en una rama feature/* y entrar por PR. ¿Confirmas el commit directo?'
fi

# --- Base de datos ---------------------------------------------------
# Un proyecto compose descartable (`-p <algo>-verif`) sí se puede vaciar o
# bajar con sus volúmenes: es el que se levanta para probar migraciones contra
# MySQL sin tocar la base de desarrollo.
es_verif() { coincide '\bcompose[[:space:]]+(-p|--project-name)[[:space:]=]+[A-Za-z0-9_-]*-verif\b'; }

coincide '\bdbmate\b[^;&|]*[[:space:]](drop|rollback|down)\b' && ! es_verif &&
    decidir deny 'dbmate drop/rollback sobre la base del compose borra datos que el usuario cargó para revisar. Para probar una migración: un proyecto compose descartable (docker compose -p qr-access-verif ...), ver el skill modelo-datos.'
if coincide '\bdocker([[:space:]]+|-)compose\b[^;&|]*\bdown\b[^;&|]*(-v|--volumes)'; then
    es_verif ||
        decidir deny 'docker compose down -v elimina el volumen qr-access-db-data: se pierde la base de desarrollo entera. Solo se permite sobre un proyecto descartable (-p <nombre>-verif).'
fi
coincide '\bdocker[[:space:]]+volume[[:space:]]+(rm|prune)\b' &&
    decidir deny 'Borrado de volumen Docker: se pierde la base de desarrollo.'
coincide '\b(DROP[[:space:]]+(DATABASE|TABLE|SCHEMA)|TRUNCATE[[:space:]]+(TABLE[[:space:]]+)?[A-Za-z_`])' &&
    decidir deny 'DDL destructivo suelto. Todo cambio de esquema va en una migración versionada de db/migrations (ADR 0011).'

# --- Dispositivo -----------------------------------------------------
coincide '\b(pio|platformio)\b[^;&|]*-t[[:space:]]*erase\b|\besptool(\.py)?\b[^;&|]*\berase_flash\b' &&
    decidir ask 'Borrar la flash del ESP32 elimina su credencial de dispositivo y su configuración WiFi. ¿Confirmas?'

# --- Sistema de archivos ---------------------------------------------
if coincide '(^|[;&|]|[[:space:]])rm[[:space:]]+(-[[:alnum:]]*[rR][[:alnum:]]*f|-[[:alnum:]]*f[[:alnum:]]*[rR])'; then
    coincide 'rm[[:space:]]+-[[:alnum:]]+[[:space:]]+"?(/private)?/tmp/' ||
        decidir deny 'rm -rf fuera del scratchpad. Para archivos temporales usa el directorio de scratchpad de la sesión.'
fi

exit 0
