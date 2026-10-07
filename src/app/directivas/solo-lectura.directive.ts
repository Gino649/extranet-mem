import { DestroyRef, Directive, ElementRef, effect, inject } from '@angular/core';

import { DaexStore } from '../state/daex.store';

interface EstadoCapturado {
  readonly esBoton: boolean;
  readonly oculto: boolean;
  readonly esControl: boolean;
  readonly deshabilitado: boolean;
  readonly esEditor: boolean;
  readonly editable: string | null;
}

@Directive({
  selector: '[appSoloLectura]',
  standalone: true,
})
export class SoloLecturaDirective {
  private readonly store = inject(DaexStore);
  private readonly raiz: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly estadoPrevio = new Map<Element, EstadoCapturado>();
  private readonly observador = new MutationObserver(() => {
    if (this.store.modoSoloConsulta()) {
      this.barrerSubarbol(true);
    }
  });

  constructor() {
    this.observador.observe(this.raiz, { childList: true, subtree: true });
    inject(DestroyRef).onDestroy(() => this.observador.disconnect());
    effect(() => this.barrerSubarbol(this.store.modoSoloConsulta()));
  }

  private barrerSubarbol(activo: boolean): void {
    this.raiz.classList.toggle('modo-lectura', activo);

    if (!activo) {
      for (const [nodo, anterior] of this.estadoPrevio) {
        if (anterior.esBoton) {
          (nodo as HTMLButtonElement).hidden = anterior.oculto === true;
        }
        if (anterior.esControl) {
          (nodo as HTMLInputElement).disabled = anterior.deshabilitado;
        }
        if (anterior.esEditor) {
          if (anterior.editable === null) {
            nodo.removeAttribute('contenteditable');
          } else {
            nodo.setAttribute('contenteditable', anterior.editable);
          }
        }
      }
      this.estadoPrevio.clear();
      return;
    }

    for (const boton of this.raiz.querySelectorAll<HTMLButtonElement>('button')) {
      this.capturar(boton, {
        esBoton: true,
        oculto: boton.hidden === true,
        esControl: false,
        deshabilitado: false,
        esEditor: false,
        editable: null,
      });
      boton.hidden = true;
    }

    for (const control of this.raiz.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('input, select, textarea')) {
      this.capturar(control, {
        esBoton: false,
        oculto: false,
        esControl: true,
        deshabilitado: control.disabled,
        esEditor: false,
        editable: null,
      });
      control.disabled = true;
    }

    for (const editor of this.raiz.querySelectorAll<HTMLElement>('[contenteditable]')) {
      this.capturar(editor, {
        esBoton: false,
        oculto: false,
        esControl: false,
        deshabilitado: false,
        esEditor: true,
        editable: editor.getAttribute('contenteditable'),
      });
      editor.setAttribute('contenteditable', 'false');
    }
  }

  private capturar(nodo: Element, estado: EstadoCapturado): void {
    if (!this.estadoPrevio.has(nodo)) {
      this.estadoPrevio.set(nodo, estado);
    }
  }
}
