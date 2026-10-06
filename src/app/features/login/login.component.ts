import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DaexStore } from '../../state/daex.store';

/** Longitud exacta del RUC institucional peruano. */
const LONGITUD_RUC = 11;

/** Mínimo de caracteres exigido por la guía DAEX para la contraseña. */
const LONGITUD_MINIMA_PASSWORD = 6;

/** Latencia simulada del handshake con el backend transaccional. */
const LATENCIA_SIMULADA_MS = 450;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  private readonly store = inject(DaexStore);
  private readonly router = inject(Router);

  /** RUC tipiado en caliente, ya saneado a dígitos puros. */
  protected readonly ruc = signal('');

  /** Contraseña en caliente. Nunca se expone fuera del campo de entrada. */
  protected readonly password = signal('');

  /** Marca el blur del RUC para habilitar la asistencia dinámica. */
  protected readonly rucTocado = signal(false);

  /** Alterna el tipo del input de contraseña entre `password` y `text`. */
  protected readonly verPassword = signal(false);

  /** Bloquea los campos y muestra el spinner durante el despacho. */
  protected readonly cargando = signal(false);

  /** La guía exige 11 dígitos exactos; se evalúa tras el blur. */
  protected readonly rucInvalido = computed(
    () => this.rucTocado() && this.ruc().length !== LONGITUD_RUC,
  );

  /** El CTA solo se habilita con RUC de 11 dígitos y contraseña de 6+ caracteres. */
  protected readonly formularioValido = computed(
    () => this.ruc().length === LONGITUD_RUC && this.password().length >= LONGITUD_MINIMA_PASSWORD,
  );

  /** Deshabilitación nativa: validez + ausencia de despacho en curso. */
  protected readonly botonDeshabilitado = computed(
    () => !this.formularioValido() || this.cargando(),
  );

  /** Clases del CTA mutadas según validez y estado de carga. */
  protected readonly claseBoton = computed(() => {
    const base =
      'w-full rounded-xl py-4 text-xs font-black tracking-wider uppercase ' +
      'transition-all duration-300';

    if (this.cargando()) {
      return (
        `${base} bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 ` +
        `text-slate-950 cursor-progress shadow-[0_4px_20px_rgba(245,158,11,0.3)]`
      );
    }

    if (!this.formularioValido()) {
      return `${base} border border-slate-300/60 bg-slate-200 text-slate-400 cursor-not-allowed shadow-none`;
    }

    return (
      `${base} bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 ` +
      `text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.3)] ` +
      `hover:shadow-[0_6px_25px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 cursor-pointer`
    );
  });

  /** Prespilla el valor recibido y lo trunca al tope normativo de 11 dígitos. */
  protected alIntroducirRuc(event: Event): void {
    const input = event.target as HTMLInputElement;
    const saneado = input.value.replace(/[^0-9]/g, '').slice(0, LONGITUD_RUC);
    input.value = saneado;
    this.ruc.set(saneado);
  }

  protected alIntroducirPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  /** El blur habilita la asistencia dinámica de longitud del RUC. */
  protected alPerderFocoRuc(): void {
    this.rucTocado.set(true);
  }

  protected alternarVisibilidad(): void {
    this.verPassword.update((visible) => !visible);
  }

  /** Evita la recarga nativa y descarta envíos con el formulario inválido. */
  protected enviar(event: Event): void {
    event.preventDefault();
    if (this.botonDeshabilitado()) {
      return;
    }
    void this.despacharSesion();
  }

  /**
   * Inyecta la sesión en el store de forma asíncrona e opaca y salta
   * directo a la consola, anulando el backlog de consolas históricas.
   */
  private async despacharSesion(): Promise<void> {
    this.cargando.set(true);
    const ruc = this.ruc();
    await new Promise((resolve) => setTimeout(resolve, LATENCIA_SIMULADA_MS));
    this.store.inyectarSesion(ruc, this.emitirToken(ruc), `Titular Minero ${ruc}`);
    this.cargando.set(false);
    await this.router.navigate(['/workspace']);
  }

  /** Token opaco simulado; el exchange real ocurre del lado del servidor. */
  private emitirToken(ruc: string): string {
    const cabecera = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const carga = btoa(JSON.stringify({ sub: ruc, scope: 'dgaam:expediente' }));
    return `${cabecera}.${carga}.firma-simulada`;
  }
}
