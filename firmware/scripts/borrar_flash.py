# Borra TODA la flash (NVS incluida: vínculo, clave sorteada y URL guardada) antes de cada carga por
# cable, para que la placa salga de fábrica y se vuelva a anunciar sin escribir `borrar`.
#
# Va aquí, en la subida, y no en el firmware: la OTA también cambia de versión y no debe desvincular
# las placas instaladas. Usa el mismo `erase_flash` del target `pio run -t erase`, que es el que
# conoce esta versión de esptool; pasarle `--erase-all` por `upload_flags` rompe la carga.
#
# Requiere `--upload-port`: la acción corre antes de que PlatformIO autodetecte el puerto.
Import("env")  # noqa: F821  (lo inyecta SCons)


def borrar_flash(source, target, env):
    print("Borrando la flash antes de cargar (vínculo, clave y URL guardadas)...")
    if env.Execute(env.subst("$ERASECMD")) != 0:
        print("No se pudo borrar la flash: ¿IO0 a GND y EN tocado? No se carga nada.")
        env.Exit(1)


env.AddPreAction("upload", borrar_flash)  # noqa: F821
