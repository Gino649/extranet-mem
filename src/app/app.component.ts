import { Component, OnDestroy, OnInit, afterNextRender, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private sub?: Subscription;

  constructor() {
    afterNextRender(() => {
      this.aplicar();
    });
  }

  ngOnInit(): void {
    this.aplicar();
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.aplicar());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.limpiar();
  }

  private aplicar(): void {
    const url = this.router.url || window.location.pathname;
    if (url.startsWith('/formulario-iga')) {
      document.documentElement.classList.add('formulario-activo');
      document.body.classList.add('formulario-activo');
      (document.documentElement as HTMLElement).style.overflow = 'hidden';
      (document.body as HTMLElement).style.overflow = 'hidden';
    } else {
      document.documentElement.classList.remove('formulario-activo');
      document.body.classList.remove('formulario-activo');
      (document.documentElement as HTMLElement).style.overflow = '';
      (document.body as HTMLElement).style.overflow = '';
    }
  }

  private limpiar(): void {
    document.documentElement.classList.remove('formulario-activo');
    document.body.classList.remove('formulario-activo');
  }
}
