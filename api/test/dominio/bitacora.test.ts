import { describe, expect, it } from 'vitest';
import {
  clasificarCambio,
  detalleDelCambio,
  type CambioCrudo,
} from '../../src/modules/bitacora/domain/clasificar.js';

const cambio = (
  parcial: Partial<CambioCrudo> & Pick<CambioCrudo, 'tabla' | 'accion'>,
): CambioCrudo => ({
  registroId: '1',
  tenantId: '10',
  antes: null,
  despues: null,
  ...parcial,
});

describe('clasificarCambio', () => {
  it.each([
    [{ tabla: 'cuentas', accion: 'creado' }, 'cuenta.creada'],
    [{ tabla: 'pagos', accion: 'creado' }, 'pago.registrado'],
    [
      { tabla: 'suscripciones', accion: 'actualizado', despues: { plan_id: '2' } },
      'suscripcion.plan_cambiado',
    ],
    [
      { tabla: 'suscripciones', accion: 'actualizado', despues: { estado: 'suspendida' } },
      'suscripcion.suspendida',
    ],
    [
      { tabla: 'suscripciones', accion: 'actualizado', despues: { estado: 'vigente' } },
      'suscripcion.reactivada',
    ],
    [
      { tabla: 'suscripciones', accion: 'actualizado', despues: { hasta: '2027-01-01' } },
      'suscripcion.renovada',
    ],
    [
      { tabla: 'planes', accion: 'actualizado', tenantId: null, despues: { precio_anual: 1 } },
      'plan.precio_editado',
    ],
    [{ tabla: 'usuarios', accion: 'creado', tenantId: null }, 'equipo.agregado'],
    [
      { tabla: 'usuarios', accion: 'actualizado', tenantId: null, despues: { activo: 0 } },
      'equipo.desactivado',
    ],
    [
      { tabla: 'usuarios', accion: 'actualizado', despues: { pin_generado_at: 'x' } },
      'usuario.pin_regenerado',
    ],
    [
      { tabla: 'usuarios', accion: 'actualizado', despues: { pin_compartido_at: 'x' } },
      'usuario.pin_compartido',
    ],
    [{ tabla: 'usuarios', accion: 'creado' }, 'usuario.creado'],
    [{ tabla: 'puertas', accion: 'actualizado' }, 'puerta.editado'],
    [{ tabla: 'sitios', accion: 'eliminado' }, 'sitio.eliminado'],
  ] as const)('%j → %s', (entrada, esperado) => {
    expect(clasificarCambio(cambio({ ...entrada }))).toBe(esperado);
  });
});

describe('detalleDelCambio', () => {
  const planes = new Map([
    ['1', '100 usuarios'],
    ['2', '200 usuarios'],
  ]);

  it('un cambio de plan trae los nombres de los planes', () => {
    const crudo = cambio({
      tabla: 'suscripciones',
      accion: 'actualizado',
      antes: { plan_id: '1' },
      despues: { plan_id: '2' },
    });
    expect(detalleDelCambio('suscripcion.plan_cambiado', crudo, planes)).toEqual({
      antes: { plan: '100 usuarios' },
      despues: { plan: '200 usuarios' },
    });
  });

  it('el precio de un plan trae el nombre del plan y los dos precios', () => {
    const crudo = cambio({
      tabla: 'planes',
      accion: 'actualizado',
      registroId: '2',
      tenantId: null,
      antes: { precio_anual: '20400.00' },
      despues: { precio_anual: '21600.00' },
    });
    expect(detalleDelCambio('plan.precio_editado', crudo, planes)).toEqual({
      antes: { plan: '200 usuarios', precio_anual: '20400.00' },
      despues: { plan: '200 usuarios', precio_anual: '21600.00' },
    });
  });

  it('un pago muestra monto y referencia, sin más', () => {
    const crudo = cambio({
      tabla: 'pagos',
      accion: 'creado',
      despues: {
        monto: '12000.00',
        referencia: 'TRF-1',
        tipo: 'renovacion',
        plan_id: '1',
        periodo_desde: 'x',
      },
    });
    expect(detalleDelCambio('pago.registrado', crudo, planes)).toEqual({
      antes: null,
      despues: { monto: '12000.00', referencia: 'TRF-1', tipo: 'renovacion' },
    });
  });

  it('un objeto anidado nunca sale como valor: solo valores simples', () => {
    const crudo = cambio({
      tabla: 'puertas',
      accion: 'actualizado',
      antes: { nombre: { a: 1 } },
      despues: { nombre: 'x' },
    });
    expect(detalleDelCambio('puerta.editado', crudo, planes)).toEqual({
      antes: { nombre: null },
      despues: { nombre: 'x' },
    });
  });
});
