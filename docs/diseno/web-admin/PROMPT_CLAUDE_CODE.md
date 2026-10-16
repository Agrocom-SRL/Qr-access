# Prompt para Claude Code

Copia la carpeta `design_handoff_agrocom_web_admin/` en la raíz del repo del frontend React (por ejemplo `docs/diseno/web-admin/`) y pega esto en Claude Code:

---

Vas a implementar el panel web de administración de AGROCOM Acceso en este repo de React. El diseño ya está aprobado en Claude Design y no se puede consultar desde aquí: la única fuente de diseño es la carpeta `docs/diseno/web-admin/` (ajusta la ruta si la pusiste en otro lado).

**Fuentes de verdad, en este orden:**
1. `/Users/miguel/Applications/AndroidStudio/Qr-access/docs`: negocio, API (módulos, endpoints, DTOs, códigos de error) y reglas. Si algo del diseño contradice estos documentos, mandan los documentos. Anota la diferencia en el PR.
2. `docs/diseno/web-admin/capturas/**.png`: el aspecto aprobado. Cada pantalla debe verse igual que su PNG (mismo id: A01…A12, AD02, AD05a, PE…).
3. `docs/diseno/web-admin/README.md`: medidas, tokens, componentes, comportamiento y datos que necesita cada pantalla.
4. `docs/diseno/web-admin/ARQUITECTURA_REACT.md`: cómo organizar el código.
5. `docs/diseno/web-admin/diseño/*.dc.html`: referencia HTML abrible en el navegador; sirve para leer valores exactos (no se copia).

**Antes de escribir código:**
- Lee todo lo anterior y explora este repo: estructura, dependencias, router, estilos, cliente HTTP y lo que ya funciona.
- Lee `docs/` de la API y arma el mapa de módulos. Los módulos del frontend llevan los mismos nombres.
- Busca en el proyecto Flutter (`/Users/miguel/Applications/AndroidStudio/Qr-access`, `pubspec.yaml` → `assets` y `fonts`) los recursos que ya existen (ilustraciones unDraw verdes, Lottie, logo, fuentes) para copiarlos y reutilizarlos. Los íconos son Material Symbols Outlined, los mismos de la app.
- Entrégame un plan corto: inventario del repo, mapa de módulos API → frontend, assets a copiar, dependencias nuevas (justificadas) y orden de PRs. Espera mi visto bueno.

**Al implementar:**
- Cambios orgánicos e incrementales, en armonía con lo que ya existe. Nada de reescribir todo de golpe; adapta lo útil a la nueva arquitectura.
- Arquitectura por módulos espejo de la API (`domain` / `api` / `application` / `ui` por módulo), principios SOLID (repositorios por interfaz e inyectados), atomic design en `shared/ui` (átomos → plantillas) con los nombres de componente del README, e i18n con i18next (español con tuteo, nunca voseo ni "usted"; nada de texto literal en JSX; errores de API traducidos por código).
- Tokens: usa `tokens/acceso-tokens.css` y `tokens/theme.ts` tal cual. Ningún color, espacio, radio ni tamaño fuera de esa escala. Tema claro y oscuro con `data-tema`.
- Cada listado tiene sus 4 estados (carga, vacío con ilustración y acción, error con reintento, sin conexión) como en `capturas/estados/`.
- No inventes endpoints, campos ni reglas. Si `docs/` no lo cubre, deja `// TODO(docs): …` y pregúntame.

**Para cerrar cada pantalla:**
- Compárala con su PNG en 1440×900 y revísala a 768 px (rail colapsado a 80). Si puedes, saca una captura con el mismo tamaño y ponla junto al PNG.
- Revisa claro y oscuro, contraste AA, foco visible y teclado.
- Tests de las reglas de dominio y de un caso de uso con repositorio mock.
- En el PR: id de pantalla, archivos de `docs/` consultados, assets copiados desde Flutter y diferencias con el diseño (si las hay, con el motivo).

Empieza por el plan.

---
