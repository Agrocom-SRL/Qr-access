-- migrate:up
-- Los usuarios de cuenta creados antes del árbol (ADR 0028) no tienen superior y, con la visibilidad por
-- rama, su Administrador no los vería. Cada uno cuelga del primer Administrador de su cuenta (el de menor
-- id); los Administradores quedan como raíz (`superior_id` NULL). Solo toca a quien aún no tiene superior.
UPDATE usuarios AS u
  JOIN (
    SELECT ur.tenant_id, MIN(ur.usuario_id) AS administrador_id
    FROM usuario_roles AS ur
    JOIN roles AS r ON r.id = ur.rol_id AND r.nombre = 'Administrador' AND r.protegido = 1 AND r.deleted_at IS NULL
    WHERE ur.deleted_at IS NULL AND ur.tenant_id IS NOT NULL
    GROUP BY ur.tenant_id
  ) AS primero ON primero.tenant_id = u.tenant_id
  SET u.superior_id = primero.administrador_id
  WHERE u.superior_id IS NULL
    AND u.deleted_at IS NULL
    AND u.id <> primero.administrador_id
    AND u.id NOT IN (
      SELECT ur2.usuario_id
      FROM usuario_roles AS ur2
      JOIN roles AS r2 ON r2.id = ur2.rol_id AND r2.nombre = 'Administrador' AND r2.protegido = 1
      WHERE ur2.deleted_at IS NULL
    );

-- migrate:down
-- No se distingue lo que puso esta migración de lo que se creó después: al revertir el vínculo se pierde.
UPDATE usuarios SET superior_id = NULL;
