// Herramientas basicas de Angular
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

// Componentes
import { NavbarComponent } from './components/navbar/navbar.component';
import { SecurityService } from './services/security.service';

// Componente principal de toda la aplicacion
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  // Nombre de la aplicacion
  title = 'encuestas-app';
  showNavbar = false;

  constructor(
    private router: Router,
    private securityService: SecurityService
  ) { }

  ngOnInit() {
    // Escuchar cambios de ruta para mostrar/ocultar navbar
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Mostrar navbar solo en paginas autenticadas que no sean home ni login
      this.showNavbar = this.shouldShowNavbar(event.url);
    });

    // Restaurar sesion (si existe) y verificar ruta inicial
    // Esto asegura que la app cargue el estado del usuario antes de decidir que mostrar.
    try {
      // restoreSession es seguro con SSR (ver SecurityService)
      (this.securityService as any).restoreSession?.();
    } catch (e) {
      // Si ocurre algo en SSR, ignoramos y seguimos
      console.warn('restoreSession failed:', e);
    }

    // Si la URL inicial esta vacia o '/', navegar a /home para mostrar la pantalla de inicio
    const currentUrl = this.router.url || '/';
    if (currentUrl === '/' || currentUrl === '') {
      // Usar navigateByUrl para evitar apilar rutas
      this.router.navigateByUrl('/home');
    }

    // Determinar si se muestra el navbar en la ruta actual
    this.showNavbar = this.shouldShowNavbar(this.router.url);
  }

  private shouldShowNavbar(url: string): boolean {
    // No mostrar navbar en login
    if (url.includes('/login')) {
      return false;
    }

    // En home, mostrar navbar solo si esta autenticado
    if (url === '/home' || url === '/' || url === '') {
      return this.securityService.isAuthenticated();
    }

    // En otras paginas protegidas, mostrar si esta autenticado
    return this.securityService.isAuthenticated() &&
      (url.includes('/encuestas') || url.includes('/administrador') || url.includes('/directivo'));
  }
}

