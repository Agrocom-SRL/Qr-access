-- migrate:up
-- Índice para contar los QR que generó una cuenta en el mes (la bolsa, ADR 0030 §2): `(tenant_id, created_at)`.
-- El conteo por usuario y día ya lo cubre `idx_qr_accesos_generador (tenant_id, generado_por, created_at)`.
ALTER TABLE qr_accesos ADD KEY idx_qr_accesos_creado (tenant_id, created_at);

-- migrate:down
ALTER TABLE qr_accesos DROP KEY idx_qr_accesos_creado;
