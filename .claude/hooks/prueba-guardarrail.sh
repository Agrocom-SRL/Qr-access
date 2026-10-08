#!/usr/bin/env bash
#
# Prueba del guardarraíl de bash. Se corre a mano:
#
#   .claude/hooks/prueba-guardarrail.sh
#
# Existe porque en el proyecto base el hook falló en silencio una vez: la
# excepción de "esto es solo una búsqueda" se evaluaba sobre el comando entero,
# así que un `echo` en cualquier línea desactivaba TODAS las reglas de abajo
# — push a develop, reset en duro, vaciar la base. Un guardarraíl que se puede
# apagar sin querer no es un guardarraíl.
#
# Los casos peligrosos se arman por partes para que este archivo no dispare el
# hook al escribirse o al leerse.
#
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

HOOK=.claude/hooks/guardarrail-bash.sh
fallos=0

# El hook, cuando deja pasar, no imprime nada y sale 0. "pasa" es esa ausencia.
decision() {
    local salida
    salida=$(printf '%s' "$1" | jq -Rs '{tool_input:{command:.}}' | "$HOOK" 2>/dev/null |
             jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)
    printf '%s' "${salida:-pasa}"
}

caso() {
    local esperado="$1" nombre="$2" comando="$3" real
    real=$(decision "$comando")
    if [ "$real" = "$esperado" ]; then
        printf '\033[32m  ✓ %-52s %s\033[0m\n' "$nombre" "$real"
    else
        printf '\033[31m  ✗ %-52s esperaba %s, dio %s\033[0m\n' "$nombre" "$esperado" "$real"
        fallos=$((fallos + 1))
    fi
}

ECHO_ANTES='echo encabezado del script
'
G=git
ENV_REAL='.env'

printf '\n\033[1m── Tiene que denegar ──\033[0m\n'
caso deny "borrado forzado de rama"          "$G branch -D x"
caso deny "borrado forzado, con echo antes"  "${ECHO_ANTES}$G branch -D x"
caso deny "push a develop, con echo antes"   "${ECHO_ANTES}$G push origin develop"
caso deny "reset en duro, con echo antes"    "${ECHO_ANTES}$G reset --hard origin/develop"
caso deny "push forzado, con echo antes"     "${ECHO_ANTES}$G push --force origin x"
caso deny "clean -fdx, con echo antes"       "${ECHO_ANTES}$G clean -fdx"
caso deny "dbmate drop, con echo antes"      "${ECHO_ANTES}docker compose run --rm dbmate drop"
caso deny "dbmate rollback"                  "dbmate rollback"
caso ask  "borrado de la flash del ESP32"    "pio run -t erase"
caso deny "volumen del compose, echo antes"  "${ECHO_ANTES}docker compose down -v"
caso deny "volumen de un proyecto no -verif"  "docker compose -p qr-access down -v"
caso deny "DDL destructivo, con echo antes"  "${ECHO_ANTES}mysql -e 'DROP TABLE usuarios'"
caso deny "echo encadenado con push"         "echo x && $G push origin develop"
caso deny "echo con sustitución y push"      "echo \$($G push origin develop)"
caso deny "lectura del .env, con echo antes" "${ECHO_ANTES}cat $ENV_REAL"
caso deny "rm -rf fuera del scratchpad"      "${ECHO_ANTES}rm -rf /Users/alguien/cosas"

printf '\n\033[1m── Tiene que dejar pasar ──\033[0m\n'
caso pasa "solo un echo"                     'echo hola'
caso pasa "echo que MENCIONA un destructivo" "echo 'no uses $G reset --hard nunca'"
caso pasa "grep que menciona dbmate drop"    "grep -rn 'dbmate drop' docs/"
caso pasa "varias líneas de echo"            'echo uno
echo dos'
# El hook consulta la rama en la que estás parado, así que este caso depende de
# ella: desde master o develop deniega TODO push, y con razón —`git push -u
# origin feature/algo` parado en develop empuja develop, no una rama feature.
# Desde cualquier otra rama tiene que pasar.
case "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" in
    master|develop)
        caso deny "push desde una rama base (deniega, y debe)" "$G push -u origin feature/algo" ;;
    *)
        caso pasa "push a una rama feature"          "$G push -u origin feature/algo" ;;
esac
caso pasa "echo y después un comando inocuo" "${ECHO_ANTES}$G status --short"
caso pasa "lectura del .env.example"         "cat ${ENV_REAL}.example"
caso pasa "rm -rf en el scratchpad"          'rm -rf /tmp/claude-501/algo'
caso pasa "down -v de un proyecto -verif"    'docker compose -p qr-access-verif down -v'
caso pasa "dbmate up"                          'docker compose run --rm dbmate up'
caso pasa "rollback en el descartable"       'docker compose -p qr-access-verif run --rm dbmate rollback'

printf '\n'
if [ "$fallos" -eq 0 ]; then
    printf '\033[32m✓ El guardarraíl responde como debe en los %s casos.\033[0m\n' 27
    exit 0
fi
printf '\033[31m✗ %s caso(s) mal. El guardarraíl NO está protegiendo lo que dice proteger.\033[0m\n' "$fallos"
exit 1
