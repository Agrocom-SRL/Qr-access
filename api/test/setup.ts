/**
 * Los tests corren sobre MySQL real, SIEMPRE sobre la base de tests (CLAUDE.md, skill
 * `verificacion`). Esta guarda no se debilita: en ACRECIA una variable de entorno que pisaba
 * la de tests vació la base de desarrollo.
 */
const base = process.env.DB_DATABASE_TEST ?? 'qr_access_testing';
if (!/_testing(_\d+)?$/.test(base)) {
  throw new Error(`La base de tests tiene que terminar en _testing (recibí "${base}")`);
}

process.env.NODE_ENV = 'test';
process.env.DB_DATABASE = base;
// Sin .env: por defecto, el MySQL del docker compose publicado en el host (puerto 3307).
process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3307';
process.env.DB_USERNAME ??= 'qr_access';
process.env.DB_PASSWORD ??= 'qr_access';
// Secretos de prueba: solo existen en los tests (el entorno real los trae de .env o del servidor).
process.env.JWT_SECRETO = 'secreto-de-pruebas-jwt-0123456789abcdef0123456789abcdef';
process.env.PIN_PIMIENTA = 'cGltaWVudGEtZGUtcHJ1ZWJhcy0wMTIzNDU2Nzg5YWJjZGVm';
