import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Replica el tecleo real del navegador sobre el input de RUC. */
function teclearRuc(input: HTMLInputElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

/** Replica el tecleo real del navegador sobre el input de contraseña. */
function teclearPassword(input: HTMLInputElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

describe('LoginComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  /** Crea el componente, resuelve el DOM y devuelve los elementos clave. */
  async function montar() {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compilado = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      ruc: elemento<HTMLInputElement>(compilado, '#ruc'),
      password: elemento<HTMLInputElement>(compilado, '#password'),
      boton: elemento<HTMLButtonElement>(compilado, 'button[type="submit"]'),
      alerta: (): HTMLElement | null => compilado.querySelector<HTMLElement>('[role="alert"]'),
    };
  }

  describe('Máscara del RUC', () => {
    it('descarta letras, espacios y símbolos en vivo', async () => {
      const { ruc } = await montar();
      teclearRuc(ruc, 'a2b0c5d0e1f2g3h4i5j6k7');

      expect(ruc.value).toBe('20501234567');
    });

    it('trunca a 11 dígitos aunque se exceda el tope', async () => {
      const { ruc } = await montar();
      teclearRuc(ruc, '12345678901234567890');

      expect(ruc.value).toBe('12345678901');
    });

    it('expone el máximo nativo y el teclado numérico', async () => {
      const { ruc } = await montar();

      expect(ruc.getAttribute('maxlength')).toBe('11');
      expect(ruc.getAttribute('inputmode')).toBe('numeric');
    });
  });

  describe('Asistencia dinámica del RUC', () => {
    it('no muestra la alerta antes del blur', async () => {
      const { alerta } = await montar();

      expect(alerta()).toBeNull();
    });

    it('muestra el texto normativo tras un blur incompleto', async () => {
      const { fixture, ruc, alerta } = await montar();
      teclearRuc(ruc, '205012');
      ruc.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(alerta()?.textContent).toContain(
        'El RUC institucional debe contener exactamente 11 dígitos numéricos.',
      );
    });

    it('retira la alerta y el borde rojo al completar los 11 dígitos', async () => {
      const { fixture, ruc, alerta } = await montar();
      teclearRuc(ruc, '205012');
      ruc.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(alerta()).toBeTruthy();
      expect(ruc.classList.contains('campo-error')).toBe(true);

      teclearRuc(ruc, '20501234567');
      fixture.detectChanges();
      expect(alerta()).toBeNull();
      expect(ruc.classList.contains('campo-error')).toBe(false);
    });
  });

  describe('Botón de despacho transaccional', () => {
    it('arranca deshabilitado de forma nativa', async () => {
      const { boton } = await montar();

      expect(boton.disabled).toBe(true);
    });

    it('se habilita con 11 dígitos y contraseña de 6 o más caracteres', async () => {
      const { fixture, ruc, password, boton } = await montar();
      teclearRuc(ruc, '20501234567');
      teclearPassword(password, 'señal12');
      fixture.detectChanges();

      expect(boton.disabled).toBe(false);
    });

    it('mantiene el bloqueo con contraseña de menos de 6 caracteres', async () => {
      const { fixture, ruc, password, boton } = await montar();
      teclearRuc(ruc, '20501234567');
      teclearPassword(password, 'abc');
      fixture.detectChanges();

      expect(boton.disabled).toBe(true);
    });

    it('no entra en estado de carga si se intenta enviar siendo inválido', async () => {
      const { fixture, ruc, boton } = await montar();
      teclearRuc(ruc, '205012');
      fixture.detectChanges();

      boton.click();
      fixture.detectChanges();

      // El botón nativo `disabled` impide el submit, así que no hay spinner.
      expect(boton.disabled).toBe(true);
      expect(boton.textContent).toContain('Ingresar a la Plataforma');
      expect(boton.textContent).not.toContain('Verificando credenciales');
    });
  });

  describe('Conmutador de visibilidad de la contraseña', () => {
    it('alterna el tipo del input y expone el estado accesible', async () => {
      const { fixture, password, boton } = await montar();
      const conmutador = elemento<HTMLButtonElement>(
        fixture.nativeElement as HTMLElement,
        'button[aria-pressed]',
      );

      expect(password.type).toBe('password');
      expect(conmutador.getAttribute('aria-pressed')).toBe('false');

      conmutador.click();
      fixture.detectChanges();
      expect(password.type).toBe('text');
      expect(conmutador.getAttribute('aria-pressed')).toBe('true');

      conmutador.click();
      fixture.detectChanges();
      expect(password.type).toBe('password');
      expect(boton.disabled).toBe(true);
    });
  });
});
