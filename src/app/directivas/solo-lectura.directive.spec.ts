import { Component } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { routes } from '../app.routes';
import { ContenedorCapituloComponent } from '../features/formulario-iga/contenedor-capitulo/contenedor-capitulo.component';
import { DaexStore } from '../state/daex.store';
import { SoloLecturaDirective } from './solo-lectura.directive';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

@Component({
  selector: 'spec-anfitrion',
  imports: [SoloLecturaDirective, ContenedorCapituloComponent],
  template: `
    <button type="button" id="fuera-del-candado">Externo</button>
    <div id="guard" appSoloLectura>
      <app-contenedor-capitulo [capituloId]="'2'" />
    </div>
  `,
})
class AnfitrionComponent {}

function montar() {
  const fixture = TestBed.createComponent(AnfitrionComponent);
  fixture.detectChanges();
  return { fixture, store: TestBed.inject(DaexStore), raiz: fixture.nativeElement as HTMLElement };
}

describe('SoloLecturaDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnfitrionComponent],
      providers: [provideRouter(routes, withComponentInputBinding())],
    }).compileComponents();
    TestBed.inject(DaexStore).inyectarSesion('20501234567', 'token', 'Titular Minero 20501234567');
  });

  describe('Con el candado apagado', () => {
    it('no altera el árbol: sin clase guard ni cambios en los controles', () => {
      const { raiz } = montar();
      const guard = elemento<HTMLElement>(raiz, '#guard');

      expect(guard.classList.contains('modo-lectura')).toBe(false);

      const botones = Array.from(guard.querySelectorAll<HTMLButtonElement>('button'));
      expect(botones.length).toBeGreaterThan(0);
      for (const boton of botones) {
        expect(boton.hidden).toBe(false);
      }

      const controles = Array.from(
        guard.querySelectorAll<HTMLInputElement>('input, select, textarea'),
      );
      for (const control of controles) {
        expect(control.disabled).toBe(false);
      }
    });
  });

  describe('Con el candado encendido (consulta / impresión)', () => {
    it('oculta los botones de escritura, deshabilita los campos y cuelga la clase guard', () => {
      const { fixture, store, raiz } = montar();
      store.activarModoSoloConsulta(true);
      fixture.detectChanges();

      const guard = elemento<HTMLElement>(raiz, '#guard');
      expect(guard.classList.contains('modo-lectura')).toBe(true);

      const botones = Array.from(guard.querySelectorAll<HTMLButtonElement>('button'));
      expect(botones.length).toBeGreaterThan(0);
      for (const boton of botones) {
        expect(boton.hidden).toBe(true);
      }

      const controles = Array.from(
        guard.querySelectorAll<HTMLInputElement>('input, select, textarea'),
      );
      expect(controles.length).toBeGreaterThan(0);
      for (const control of controles) {
        expect(control.disabled).toBe(true);
      }
    });

    it('respeta los controles que viven fuera del contenedor guardado', () => {
      const { fixture, store, raiz } = montar();
      store.activarModoSoloConsulta(true);
      fixture.detectChanges();

      const externo = elemento<HTMLButtonElement>(raiz, '#fuera-del-candado');
      expect(externo.hidden).toBe(false);
      expect(externo.disabled).toBe(false);
    });

    it('sigue ocultando los controles que llegan después de encendido', async () => {
      const { fixture, store, raiz } = montar();
      store.activarModoSoloConsulta(true);
      fixture.detectChanges();

      const guard = elemento<HTMLElement>(raiz, '#guard');
      const tardio = document.createElement('button');
      tardio.textContent = 'Llega tarde';
      guard.appendChild(tardio);
      await new Promise((resolver) => setTimeout(resolver, 0));

      expect(tardio.hidden).toBe(true);
    });

    it('restaura botones y campos al apagar el candado', () => {
      const { fixture, store, raiz } = montar();
      store.activarModoSoloConsulta(true);
      fixture.detectChanges();

      const guard = elemento<HTMLElement>(raiz, '#guard');
      const botones = Array.from(guard.querySelectorAll<HTMLButtonElement>('button'));
      const controles = Array.from(
        guard.querySelectorAll<HTMLInputElement>('input, select, textarea'),
      );
      expect(botones.length).toBeGreaterThan(0);
      expect(controles.length).toBeGreaterThan(0);

      store.activarModoSoloConsulta(false);
      fixture.detectChanges();

      expect(guard.classList.contains('modo-lectura')).toBe(false);
      for (const boton of botones) {
        expect(boton.hidden).toBe(false);
      }
      for (const control of controles) {
        expect(control.disabled).toBe(false);
      }
    });
  });
});
