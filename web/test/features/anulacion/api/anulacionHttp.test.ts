import { anulacionDesdeDto, crearAnulacionHttp } from '@/features/anulacion/api/anulacionHttp';
import type { ClienteHttp, SolicitudHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta: unknown) {
  const solicitar = vi.fn<(solicitud: SolicitudHttp) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

describe('anulación masiva por HTTP (ADR 0033 §3)', () => {
  it('manda el alcance cuenta y el motivo, sin usuario_id, a la ruta de la cuenta', async () => {
    const { solicitar, cliente } = clienteFalso({
      id: '501',
      alcance: 'cuenta',
      usuario_id: null,
      usuarios_alcanzados: 3,
      qr_anulados: 4,
    });
    await crearAnulacionHttp(cliente).anularCuenta('7', 'Uso sospechoso');
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'POST',
      ruta: '/plataforma/cuentas/7/qr-accesos/anulacion-masiva',
      cuerpo: { alcance: 'cuenta', motivo: 'Uso sospechoso' },
    });
  });

  it('devuelve cuántos QR se anularon y de cuántos usuarios', () => {
    expect(
      anulacionDesdeDto({
        id: '501',
        alcance: 'cuenta',
        usuario_id: null,
        usuarios_alcanzados: 3,
        qr_anulados: 0,
      }),
    ).toEqual({ id: '501', usuariosAlcanzados: 3, qrAnulados: 0 });
  });
});
