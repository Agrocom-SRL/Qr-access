import { jwtVerify, SignJWT } from 'jose';

const EMISOR = 'agrocom-acceso';
const ALGORITMO = 'HS256';

export interface ReclamosDeAcceso {
  readonly usuarioId: string;
  /** `null` = sesión de plataforma (super admin): el JWT no lleva `tid`. */
  readonly cuentaId: string | null;
  readonly sesionId: string;
  readonly rolActivoId: string | null;
}

export interface EmisorDeJwt {
  firmar(reclamos: ReclamosDeAcceso): Promise<string>;
  /** `null` ante cualquier fallo: firma, algoritmo, emisor o vencimiento. */
  verificar(jwt: string): Promise<ReclamosDeAcceso | null>;
}

/** JWT de acceso corto firmado con HS256 (ADR 0004 §4). El rol activo viaja en `rid`. */
export function crearEmisorDeJwt(secreto: string, minutosDeVida: number): EmisorDeJwt {
  const clave = new TextEncoder().encode(secreto);
  return {
    firmar(reclamos) {
      const jwt = new SignJWT({
        ...(reclamos.cuentaId === null ? {} : { tid: reclamos.cuentaId }),
        sid: reclamos.sesionId,
        ...(reclamos.rolActivoId === null ? {} : { rid: reclamos.rolActivoId }),
      })
        .setProtectedHeader({ alg: ALGORITMO })
        .setSubject(reclamos.usuarioId)
        .setIssuer(EMISOR)
        .setIssuedAt()
        .setExpirationTime(`${minutosDeVida}m`);
      return jwt.sign(clave);
    },

    async verificar(jwt) {
      try {
        const { payload } = await jwtVerify(jwt, clave, {
          issuer: EMISOR,
          algorithms: [ALGORITMO],
        });
        const { sub, tid, sid, rid } = payload;
        if (typeof sub !== 'string' || typeof sid !== 'string') return null;
        if (tid !== undefined && typeof tid !== 'string') return null;
        if (rid !== undefined && typeof rid !== 'string') return null;
        return { usuarioId: sub, cuentaId: tid ?? null, sesionId: sid, rolActivoId: rid ?? null };
      } catch {
        return null;
      }
    },
  };
}
