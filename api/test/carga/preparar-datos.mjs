#!/usr/bin/env node
// Prepara un entorno de prueba para las pruebas de carga, solo por la API (nunca por la base de datos):
// una cuenta con su Administrador, un sitio, N puertas, N placas vinculadas, U Titulares de prueba y los QR
// pregenerados que consumen los escenarios. Escribe un JSON en api/test/carga/datos/generados/ (excluido de git).
//
// Guardarraíles: exige CARGA_ENTORNO=prueba, un host de prueba declarado y rechaza cualquier dominio de AGROCOM.
// Las credenciales salen de variables de entorno (CARGA_ROOT_CLAVE, obligatoria). Nunca se imprimen claves,
// tokens ni PIN: el JSON resultante sí los contiene, por eso va a una carpeta ignorada y con permisos 0600.
//
// Uso (desde la raíz del repo):
//   CARGA_ENTORNO=prueba CARGA_URL=http://127.0.0.1:3000 CARGA_ROOT_CLAVE=... \
//     node api/test/carga/preparar-datos.mjs --puertas 5 --usuarios 10 --qr 200 --qr-confirmacion 20 --qr-repeticion 5
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuracionDeCarga, exigirEntornoDePrueba } from './lib/guarda.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SALIDA_POR_OMISION = resolve(RAIZ, 'api/test/carga/datos/generados/prueba.json');
const ESPERA_MAXIMA_S = 310;
/** Tope de pendientes y de QR diarios por usuario en el plan (configuracion_limites, ADR 0030 §2). */
const QR_POR_USUARIO_MAXIMO = 50;

const AYUDA = `Uso: node api/test/carga/preparar-datos.mjs [opciones]

  --puertas N          puertas (y placas vinculadas, una por puerta). Por omisión 5.
  --usuarios N         Titulares de prueba que generan QR. Por omisión 10 (máximo 90).
  --qr N               QR de primer uso para la validación (escenarios a, d, f1). Por omisión 100.
  --qr-confirmacion N  QR de primer uso para las confirmaciones (escenario e). Por omisión 0.
  --qr-repeticion N    QR que se consumen aquí y se reusan en la prueba de repetición. Por omisión 5.
  --salida RUTA        JSON de salida. Por omisión api/test/carga/datos/generados/prueba.json.

Variables: CARGA_ENTORNO=prueba (obligatoria), CARGA_URL (origen, p. ej. http://127.0.0.1:3000),
CARGA_HOSTS_DE_PRUEBA (hosts no locales permitidos), CARGA_ROOT_CLAVE (obligatoria),
CARGA_ROOT_USUARIO (por omisión root), CARGA_PLAN_ID (opcional), CARGA_CODIGO (3 letras, código de la cuenta; opcional, si no se sortea).
`;

function entero(texto, nombre) {
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${nombre} debe ser un entero mayor o igual a 0 (recibido ${texto}).`);
  return n;
}

function opcionesDe(argv) {
  const o = {
    puertas: 5,
    usuarios: 10,
    qr: 100,
    qrConfirmacion: 0,
    qrRepeticion: 5,
    salida: SALIDA_POR_OMISION,
  };
  for (let i = 0; i < argv.length; i++) {
    const opcion = argv[i];
    const valor = () => {
      if (argv[i + 1] === undefined) throw new Error(`Falta el valor de ${opcion}.`);
      i += 1;
      return argv[i];
    };
    switch (opcion) {
      case '--puertas': o.puertas = entero(valor(), opcion); break;
      case '--usuarios': o.usuarios = entero(valor(), opcion); break;
      case '--qr': o.qr = entero(valor(), opcion); break;
      case '--qr-confirmacion': o.qrConfirmacion = entero(valor(), opcion); break;
      case '--qr-repeticion': o.qrRepeticion = entero(valor(), opcion); break;
      case '--salida': o.salida = resolve(valor()); break;
      case '-h':
      case '--ayuda':
        process.stdout.write(AYUDA);
        process.exit(0);
        break;
      default:
        throw new Error(`Opción desconocida: ${opcion}\n\n${AYUDA}`);
    }
  }
  if (o.puertas < 1 || o.puertas > 50) throw new Error('--puertas debe estar entre 1 y 50.');
  if (o.usuarios < 1 || o.usuarios > 90) throw new Error('--usuarios debe estar entre 1 y 90 (el plan admite 100 usuarios).');
  if (o.qrRepeticion < 0) throw new Error('--qr-repeticion no puede ser negativo.');
  const total = o.qr + o.qrConfirmacion + o.qrRepeticion;
  if (total / o.usuarios > QR_POR_USUARIO_MAXIMO) {
    throw new Error(
      `Con ${total} QR y ${o.usuarios} usuarios, cada uno genera ${Math.ceil(total / o.usuarios)}: ` +
        `el tope de pendientes es ${QR_POR_USUARIO_MAXIMO}. Sube --usuarios.`,
    );
  }
  return o;
}

const dormir = (segundos) => new Promise((resolver) => setTimeout(resolver, segundos * 1000));

/**
 * Llamada a la API. Ante un 429 espera lo que pide el servidor (Retry-After o `reintentar_en_segundos`) y
 * reintenta: los límites de ADR 0030 (anuncio por IP, generación por minuto) son esperables al preparar.
 * Un error inesperado lanza con el status y el `code` del servidor, nunca con el cuerpo de la petición.
 */
async function llamar(base, metodo, ruta, { cuerpo, token, dispositivo, esperado = [200, 201, 202, 204] } = {}) {
  for (let intento = 0; ; intento++) {
    const cabeceras = {};
    if (cuerpo !== undefined) cabeceras['content-type'] = 'application/json';
    if (token) cabeceras.authorization = `Bearer ${token}`;
    // La placa se autentica con su propia credencial (invariante 5), nunca con un token de usuario.
    if (dispositivo) cabeceras.authorization = `Dispositivo ${dispositivo.id}.${dispositivo.clave}`;
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await res.text();
    let datos = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch (_error) {
      datos = null;
    }
    if (res.status === 429 && intento < 6) {
      const porCabecera = Number(res.headers.get('retry-after'));
      const porCuerpo = Number(datos?.reintentar_en_segundos);
      const espera = Math.min([porCabecera, porCuerpo].find((v) => Number.isFinite(v) && v > 0) ?? 5, ESPERA_MAXIMA_S);
      process.stderr.write(`  límite de la API en ${metodo} ${ruta}: espero ${espera} s\n`);
      await dormir(espera);
      continue;
    }
    if (!esperado.includes(res.status)) {
      throw new Error(`${metodo} ${ruta} respondió ${res.status}${datos?.code ? ` (${datos.code})` : ''}.`);
    }
    return { status: res.status, datos };
  }
}

const aleatorio = () => randomBytes(6).toString('hex').toUpperCase();
/** MAC administrada localmente (bit 02) con 5 bytes al azar: no choca entre corridas. */
const macAleatoria = () => {
  const b = randomBytes(5);
  return ['02', ...[...b].map((x) => x.toString(16).padStart(2, '0'))].join(':').toUpperCase();
};
/** Clave de placa: 32 bytes en base64url, dentro de la regex del anuncio ([A-Za-z0-9_-]{32,128}). */
const claveDePlaca = () => randomBytes(32).toString('base64url');

/** Código de cuenta: 3 letras A–Z (ADR 0018), que son el prefijo del PIN. Se sortea y se reintenta si ya existe. */
const codigoAleatorio = () => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return [...randomBytes(3)].map((b) => letras[b % letras.length]).join('');
};

/** Alta de la cuenta de prueba. Con CARGA_CODIGO se usa ese código; si no, se sortea y se reintenta (422/409). */
async function crearCuentaDePrueba(base, tokenRaiz, { codigoFijo, plan, hoy }) {
  const intentos = codigoFijo ? 1 : 8;
  for (let n = 0; n < intentos; n++) {
    const codigo = codigoFijo ?? codigoAleatorio();
    try {
      return await llamar(base, 'POST', '/plataforma/cuentas', {
        token: tokenRaiz,
        esperado: [201],
        cuerpo: {
          razon_social: `Carga ${codigo}`,
          codigo,
          ciudad: 'La Paz',
          contacto_nombre: 'Carga',
          contacto_apellido: 'Prueba',
          contacto_telefono: '70000000',
          contacto_correo: 'carga@example.com',
          plan_id: plan.id,
          inicio: hoy,
          administrador_nombre: `Admin ${aleatorio()}`,
          pago: { monto: 1000, fecha_pago: hoy, medio: 'efectivo', referencia: 'carga' },
        },
      });
    } catch (error) {
      // Solo se reintenta si el código ya existe; cualquier otro error sale tal cual.
      if (codigoFijo || !/codigo/i.test(error.message)) throw error;
    }
  }
  throw new Error('No se encontró un código de cuenta libre tras varios intentos. Usa CARGA_CODIGO.');
}

async function main() {
  const opciones = opcionesDe(process.argv.slice(2));
  exigirEntornoDePrueba(process.env);
  const { base } = configuracionDeCarga(process.env);
  const claveRoot = process.env.CARGA_ROOT_CLAVE;
  if (!claveRoot) throw new Error('Falta CARGA_ROOT_CLAVE: la contraseña del super admin del entorno de prueba.');
  const usuarioRoot = process.env.CARGA_ROOT_USUARIO || 'root';

  process.stdout.write(`Preparando el entorno de prueba en ${base}\n`);

  // 1. Super admin: crea la cuenta, vincula placas y lee el catálogo de planes.
  const raiz = await llamar(base, 'POST', '/plataforma/sesiones', {
    cuerpo: { usuario: usuarioRoot, contrasena: claveRoot },
  });
  const tokenRaiz = raiz.datos.acceso;

  const planes = (await llamar(base, 'GET', '/plataforma/planes', { token: tokenRaiz })).datos.datos;
  const plan = process.env.CARGA_PLAN_ID
    ? planes.find((p) => p.id === process.env.CARGA_PLAN_ID)
    : planes.find((p) => p.cupo_usuarios === null || p.cupo_usuarios >= opciones.usuarios + 1);
  if (!plan) throw new Error('No hay un plan con cupo para los usuarios de prueba. Revisa CARGA_PLAN_ID.');

  // 2. Cuenta nueva con su Administrador y un primer pago: nace activa (si no, la suscripción no valida QR).
  const hoy = new Date().toISOString().slice(0, 10);
  const cuenta = await crearCuentaDePrueba(base, tokenRaiz, {
    codigoFijo: process.env.CARGA_CODIGO,
    plan,
    hoy,
  });
  const codigo = cuenta.datos.cuenta.codigo;
  const cuentaId = cuenta.datos.cuenta.id;

  // 3. Sesión del Administrador de la cuenta (su PIN salió una sola vez, en la respuesta de alta).
  const admin = await llamar(base, 'POST', '/sesiones', { cuerpo: { pin: cuenta.datos.administrador.pin } });
  const tokenAdmin = admin.datos.acceso;

  // 4. Sitio y puertas.
  const sitio = await llamar(base, 'POST', '/sitios', {
    token: tokenAdmin,
    esperado: [201],
    cuerpo: { nombre: 'Sitio de carga', zona_horaria: 'America/La_Paz' },
  });
  const sitioId = sitio.datos.id;
  const puertas = [];
  for (let k = 0; k < opciones.puertas; k++) {
    const puerta = await llamar(base, 'POST', `/sitios/${sitioId}/puertas`, {
      token: tokenAdmin,
      esperado: [201],
      cuerpo: { nombre: `Puerta de carga ${k + 1}`, segundos_apertura: 5 },
    });
    puertas.push({ id: puerta.datos.id, nombre: `Puerta de carga ${k + 1}` });
  }
  process.stdout.write(`  cuenta ${codigo}, sitio y ${puertas.length} puertas\n`);

  // 5. Placas: anuncio, vinculación por el super admin y confirmación (como en la mesa, ADR 0026).
  const dispositivos = [];
  for (let k = 0; k < puertas.length; k++) {
    const mac = macAleatoria();
    const clave = claveDePlaca();
    await llamar(base, 'POST', '/dispositivos/anunciar', {
      cuerpo: { mac, clave, firmware: '1.0.0-carga' },
    });
    const placas = await llamar(base, 'GET', `/plataforma/placas?busqueda=${encodeURIComponent(mac)}`, {
      token: tokenRaiz,
    });
    const placa = placas.datos.datos.find((p) => p.mac === mac);
    if (!placa) throw new Error(`La placa ${k + 1} no aparece tras anunciarse.`);
    await llamar(base, 'POST', `/plataforma/placas/${placa.id}/vincular`, {
      token: tokenRaiz,
      esperado: [202],
      cuerpo: { cuenta_id: cuentaId, puerta_id: puertas[k].id, nombre: `Placa de carga ${k + 1}` },
    });
    const confirmada = await llamar(base, 'POST', '/dispositivos/confirmar', { cuerpo: { mac, clave } });
    dispositivos.push({
      id: confirmada.datos.dispositivo_id,
      clave,
      mac,
      puerta_id: puertas[k].id,
    });
  }
  process.stdout.write(`  ${dispositivos.length} placas vinculadas\n`);

  // 6. Titulares de prueba: cada uno con su unidad y acceso a todas las puertas.
  const roles = (await llamar(base, 'GET', '/roles', { token: tokenAdmin })).datos.datos;
  const rolTitular = roles.find((r) => r.nombre === 'Titular');
  if (!rolTitular) throw new Error('La cuenta no tiene el rol Titular.');
  const usuarios = [];
  for (let u = 0; u < opciones.usuarios; u++) {
    const creado = await llamar(base, 'POST', '/usuarios', {
      token: tokenAdmin,
      esperado: [201],
      cuerpo: {
        etiqueta: `Titular de carga ${u + 1}`,
        rol_ids: [rolTitular.id],
        unidad: { sitio_id: sitioId, nombre: `Unidad de carga ${u + 1}` },
      },
    });
    await llamar(base, 'PUT', `/usuarios/${creado.datos.id}/puertas-asignadas`, {
      token: tokenAdmin,
      cuerpo: { todas: true, puerta_ids: [] },
    });
    usuarios.push({ id: creado.datos.id, etiqueta: `Titular de carga ${u + 1}`, pin: creado.datos.pin });
  }
  process.stdout.write(`  ${usuarios.length} Titulares con acceso a todas las puertas\n`);

  // 7. Sesión de cada Titular para generar los QR.
  const tokens = [];
  for (const usuario of usuarios) {
    const entra = await llamar(base, 'POST', '/sesiones', { cuerpo: { pin: usuario.pin } });
    tokens.push(entra.datos.acceso);
  }

  // 8. QR pregenerados. Cada QR va a la puerta k % P y lo valida la placa de esa puerta (índice k % P).
  const totalQr = opciones.qr + opciones.qrConfirmacion + opciones.qrRepeticion;
  const qr = [];
  for (let k = 0; k < totalQr; k++) {
    const indice = k % usuarios.length;
    const puerta = k % puertas.length;
    const generado = await llamar(base, 'POST', '/qr-accesos', {
      token: tokens[indice],
      esperado: [201],
      cuerpo: { puerta_ids: [puertas[puerta].id], etiqueta: 'carga' },
    });
    const uso = k < opciones.qr ? 'validacion' : k < opciones.qr + opciones.qrConfirmacion ? 'confirmacion' : 'repeticion';
    qr.push({ id: generado.datos.id, texto: generado.datos.texto, puerta_id: puertas[puerta].id, dispositivo: puerta, uso });
  }

  // 9. Los QR de repetición se usan AHORA, una vez: la prueba de repetición (escenarios a y d) espera que el
  // servidor los rechace como `qr.usado`. Si la primera validación no abre, los datos no sirven: se corta.
  for (const item of qr.filter((q) => q.uso === 'repeticion')) {
    const dispositivo = dispositivos[item.dispositivo];
    const primera = await llamar(base, 'POST', '/dispositivos/validaciones', {
      cuerpo: { token: item.texto },
      dispositivo,
      esperado: [200],
    });
    if (primera.datos?.abrir !== true) {
      throw new Error('Un QR de repetición no abrió en su primer uso: no se puede usar para la prueba de repetición.');
    }
  }

  // 10. Escritura del JSON, con permisos restrictivos.
  const salida = {
    version: 1,
    generado_at: new Date().toISOString(),
    api: base,
    cuenta: { id: cuentaId, codigo },
    sitio: { id: sitioId },
    puertas,
    dispositivos,
    usuarios,
    qr,
  };
  mkdirSync(dirname(opciones.salida), { recursive: true, mode: 0o700 });
  writeFileSync(opciones.salida, JSON.stringify(salida, null, 2), { mode: 0o600 });
  process.stdout.write(
    `Listo: ${qr.length} QR (${opciones.qr} validación, ${opciones.qrConfirmacion} confirmación, ` +
      `${opciones.qrRepeticion} repetición) en ${opciones.salida}\n` +
      'El archivo contiene claves de placas, PIN y tokens de QR de prueba: no lo subas a git.\n',
  );
}

main().catch((error) => {
  process.stderr.write(`preparar-datos: ${error.message}\n`);
  process.exit(1);
});
