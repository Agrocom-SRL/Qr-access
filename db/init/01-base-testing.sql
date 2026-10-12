-- Crea la base de tests junto a la de desarrollo, solo al inicializar un volumen nuevo.
-- En un volumen existente, ver docs/gestion/entornos.md.
CREATE DATABASE IF NOT EXISTS qr_access_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON qr_access_testing.* TO 'qr_access'@'%';
-- Los tests en paralelo crean qr_access_testing_N
GRANT ALL PRIVILEGES ON `qr\_access\_testing\_%`.* TO 'qr_access'@'%';
GRANT CREATE ON *.* TO 'qr_access'@'%';
FLUSH PRIVILEGES;
