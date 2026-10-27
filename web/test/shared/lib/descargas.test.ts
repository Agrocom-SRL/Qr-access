import { descargarArchivo } from '@/shared/lib/descargas';

describe('descargarArchivo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('crea una URL temporal, la pulsa como enlace con el nombre y la revoca', () => {
    const crear = vi.fn<(contenido: Blob) => string>(() => 'blob:temporal');
    const revocar = vi.fn<(url: string) => void>();
    // jsdom no trae createObjectURL: se reemplaza el global solo durante el test.
    vi.stubGlobal('URL', { createObjectURL: crear, revokeObjectURL: revocar });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const contenido = new Blob(['a,b']);
    descargarArchivo('usuarios-agr-p1.csv', contenido);

    expect(crear).toHaveBeenCalledWith(contenido);
    expect(clic).toHaveBeenCalledOnce();
    expect(revocar).toHaveBeenCalledWith('blob:temporal');
    // El enlace temporal se quita de la página al terminar.
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
