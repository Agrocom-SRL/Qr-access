-- migrate:up
-- Un usuario, un rol (ADR 0028 §2): desaparece el rol activo y el rol preferido. La sesión sigue guardando
-- `rol_activo_id`, que ahora es siempre el único rol del usuario.
-- Una base que ya tenga usuarios con varios roles vigentes conserva el de mayor nivel (Administrador,
-- Titular, Guardia y después el resto) y da de baja los demás (soft delete: queda el historial).
UPDATE usuario_roles AS ur
  JOIN (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY usuario_id ORDER BY prioridad, id) AS posicion
    FROM (
      SELECT x.id, x.usuario_id,
        CASE r.nombre WHEN 'Administrador' THEN 1 WHEN 'Titular' THEN 2 WHEN 'Guardia' THEN 3 ELSE 4 END AS prioridad
      FROM usuario_roles AS x
      JOIN roles AS r ON r.id = x.rol_id
      WHERE x.deleted_at IS NULL
    ) AS con_prioridad
  ) AS ordenadas ON ordenadas.id = ur.id
  SET ur.deleted_at = NOW(3)
  WHERE ordenadas.posicion > 1;

ALTER TABLE usuario_roles ADD UNIQUE KEY uq_usuario_roles_usuario (usuario_id, vigente);
ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_rol_preferido, DROP COLUMN rol_preferido_id;

-- migrate:down
-- Los roles dados de baja por el up no vuelven: la restricción de un rol por usuario era la regla vigente.
ALTER TABLE usuarios
  ADD COLUMN rol_preferido_id BIGINT UNSIGNED NULL AFTER contrasena_hash,
  ADD CONSTRAINT fk_usuarios_rol_preferido FOREIGN KEY (rol_preferido_id) REFERENCES roles (id);
ALTER TABLE usuario_roles DROP KEY uq_usuario_roles_usuario;
