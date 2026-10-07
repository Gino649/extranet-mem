import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DaexStore } from '../../../../state/daex.store';

/** Consultora del padrón oficial del MINEM. */
interface ConsultoraRegistrada {
  readonly id: string;
  readonly razonSocial: string;
  readonly nroRegistro: string;
}

/**
 * Profesional candidato del popup de asignación múltiple.
 *
 * `seleccionado` es mutable a propósito: la casilla del popup se enlaza con
 * `[(ngModel)]` sobre el propio objeto, que no es más que el estado en vuelo
 * de la selección y se descarta al cerrar el popup.
 */
interface ProfesionalCatalogo {
  readonly id: string;
  readonly nombres: string;
  readonly profesion: string;
  seleccionado: boolean;
}

/** Profesional ya asignado al staff de la consultora vinculada. */
interface ProfesionalStaff {
  readonly id: string;
  readonly nombres: string;
  readonly profesion: string;
}

/** Padrón oficial de consultoras ambientales autorizadas por el MINEM. */
const PADRON_CONSULTORAS: readonly ConsultoraRegistrada[] = [
  { id: 'CON-1', razonSocial: 'Tecnoambiente S.A.C.', nroRegistro: 'REG-2018-00472' },
  { id: 'CON-2', razonSocial: 'GeoAmbiente Consulting E.I.R.L.', nroRegistro: 'REG-2019-00815' },
  { id: 'CON-3', razonSocial: 'Sanco Ingeniería Ambiental S.A.C.', nroRegistro: 'REG-2020-01103' },
  { id: 'CON-4', razonSocial: 'MineraSys S.A.', nroRegistro: 'REG-2016-00291' },
  { id: 'CON-5', razonSocial: 'Línea Base S.A.C.', nroRegistro: 'REG-2021-01538' },
];

/** Catálogo de especialistas disponibles para el staff de la consultora. */
const ARMADURA_PROFESIONALES: readonly ProfesionalCatalogo[] = [
  {
    id: 'PRO-01',
    nombres: 'Rosa Elena Quispe Huamán',
    profesion: 'Ingeniera de Minas',
    seleccionado: false,
  },
  {
    id: 'PRO-02',
    nombres: 'Jorge Luis Campos Cárdenas',
    profesion: 'Geólogo Colegiado',
    seleccionado: false,
  },
  {
    id: 'PRO-03',
    nombres: 'María Fernanda Torres Álvarez',
    profesion: 'Ingeniera Ambiental',
    seleccionado: false,
  },
  {
    id: 'PRO-04',
    nombres: 'Carlos Andrés Paredes Ortiz',
    profesion: 'Ingeniero Civil',
    seleccionado: false,
  },
  {
    id: 'PRO-05',
    nombres: 'Luzmila Vargas Flores',
    profesion: 'Hidróloga',
    seleccionado: false,
  },
  {
    id: 'PRO-06',
    nombres: 'Raúl Antonio Sotomayor Díaz',
    profesion: 'Metalurgista',
    seleccionado: false,
  },
  {
    id: 'PRO-07',
    nombres: 'Patricia Del Rosario Rojas',
    profesion: 'Bióloga Colegiada',
    seleccionado: false,
  },
  {
    id: 'PRO-08',
    nombres: 'Héctor Manuel Salinas Romero',
    profesion: 'Topógrafo Certificado',
    seleccionado: false,
  },
  {
    id: 'PRO-09',
    nombres: 'Vanessa Alegría Mendoza',
    profesion: 'Socióloga',
    seleccionado: false,
  },
  {
    id: 'PRO-10',
    nombres: 'Fernando José Castillo Paredes',
    profesion: 'Químico Farmacéutico',
    seleccionado: false,
  },
  {
    id: 'PRO-11',
    nombres: 'Eliana Beatriz Núñez Silva',
    profesion: 'Arqueóloga',
    seleccionado: false,
  },
  {
    id: 'PRO-12',
    nombres: 'Óscar Renzo Gutiérrez Rey',
    profesion: 'Abogado Ambientalista',
    seleccionado: false,
  },
];

/**
 * Microcomponente de la sección 6.1 · Selección de Consultora y Profesionales.
 *
 * El bloque A vincula la consultora ambiental autorizada por el MINEM a partir
 * de un padrón cerrado; el bloque B declara el staff de profesionales que
 * suscriben el expediente. Ninguna grilla se edita en línea: la consultora se
 * elige en un popup y los profesionales se asignan de a varios desde el popup
 * del padrón, de modo que las tablas externas quedan en modo consulta.
 */
@Component({
  selector: 'app-consultoras',
  imports: [FormsModule],
  templateUrl: './consultoras.component.html',
  styleUrls: ['./consultoras.component.css'],
})
export class ConsultorasComponent {
  protected readonly store = inject(DaexStore);

  /** Índice de la sección; el orquestador lo inyecta en `inputs`. */
  readonly numero = input<string>('6.1');

  /** Consultora ambienta elegida del padrón, o `null` si aún no hay. */
  protected readonly consultoraSeleccionada = signal<ConsultoraRegistrada | null>(null);

  /** Padrón oficial de consultoras autorizadas por el MINEM. */
  protected readonly padronConsultoras =
    signal<readonly ConsultoraRegistrada[]>(PADRON_CONSULTORAS);

  /** Profesionales del popup de asignación, con su marca de selección en vuelo. */
  private readonly armaduraProfesionales = signal<ProfesionalCatalogo[]>(
    ARMADURA_PROFESIONALES.map((profesional) => ({ ...profesional })),
  );

  /** Staff ya asignado a la consultora vinculada, para la grilla de consulta. */
  protected readonly profesionalesAsignados = signal<readonly ProfesionalStaff[]>([]);

  /** Texto del buscador del popup de profesionales. */
  protected readonly filtroBusquedaNombre = signal('');

  /** El popup del padrón está abierto. */
  protected readonly modalConsultorasAbierto = signal(false);

  /** El popup de asignación múltiple está abierto. */
  protected readonly modalProfAbierto = signal(false);

  /** Candidatos que coinciden con el buscador, en el mismo orden del catálogo. */
  protected readonly staffFiltradoPorNombre = computed(() => {
    const criterio = this.filtroBusquedaNombre().trim().toLowerCase();
    return this.armaduraProfesionales().filter(
      (profesional) =>
        criterio === '' ||
        profesional.nombres.toLowerCase().includes(criterio) ||
        profesional.profesion.toLowerCase().includes(criterio),
    );
  });

  /** Una consultora vinculada con al menos un profesional firmante. */
  protected readonly seccionTotalmenteValida = computed(
    () => this.consultoraSeleccionada() !== null && this.profesionalesAsignados().length > 0,
  );

  /* ------------------------------------------------------------------
     FLUJO DEL POPUP DEL PADRÓN DE CONSULTORAS
     ------------------------------------------------------------------ */

  protected abrirModalConsultorasPadrons(): void {
    this.modalConsultorasAbierto.set(true);
  }

  protected cerrarModalConsultorasPadrons(): void {
    this.modalConsultorasAbierto.set(false);
  }

  /** Vincula la consultora elegida y rearma el staff en blanco. */
  protected seleccionarConsultoraEmpresa(consultora: ConsultoraRegistrada): void {
    this.consultoraSeleccionada.set(consultora);
    this.profesionalesAsignados.set([]);
    this.cerrarModalConsultorasPadrons();
  }

  /* ------------------------------------------------------------------
     FLUJO DEL POPUP DE ASIGNACIÓN MÚLTIPLE DE PROFESIONALES
     ------------------------------------------------------------------ */

  protected abrirModalProfesionalesStaff(): void {
    this.modalProfAbierto.set(true);
  }

  protected cerrarModalProfesionalesStaff(): void {
    this.modalProfAbierto.set(false);
  }

  /** Quita un profesional del staff de la consultora vinculada. */
  protected removerProfesionalStaff(id: string): void {
    this.profesionalesAsignados.update((staff) =>
      staff.filter((profesional) => profesional.id !== id),
    );
  }

  /** Inyecta los profesionales marcados en el staff y cierra el popup. */
  protected confirmarInyeccionStaffBloque(): void {
    const elegidos = this.armaduraProfesionales().filter((profesional) => profesional.seleccionado);
    this.profesionalesAsignados.update((staff) => {
      const existentes = new Set(staff.map((profesional) => profesional.id));
      return [
        ...staff,
        ...elegidos
          .filter((profesional) => !existentes.has(profesional.id))
          .map(({ id, nombres, profesion }) => ({ id, nombres, profesion })),
      ];
    });
    for (const profesional of this.armaduraProfesionales()) {
      profesional.seleccionado = false;
    }
    this.cerrarModalProfesionalesStaff();
  }

  /* ------------------------------------------------------------------
     VALIDACIÓN DE LA SECCIÓN
     ------------------------------------------------------------------ */

  /** Publica el bloque en el expediente y pone la sección 6.1 en verde. */
  protected guardarYValidarConsultorasSeccion(): void {
    if (!this.seccionTotalmenteValida()) {
      return;
    }
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
  }
}
