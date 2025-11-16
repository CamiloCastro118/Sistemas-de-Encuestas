import { Component, OnInit } from '@angular/core';  // Herramientas para crear paginas
import { CommonModule } from '@angular/common';  // Funciones basicas que se usan siempre
import { Router, NavigationEnd } from '@angular/router';  // Para cambiar de pagina y saber cuando cambia
import { filter } from 'rxjs/operators';  // Para filtrar eventos
import { SecurityService } from '../../services/security.service';  // Servicio de seguridad

// Estructura de datos para cada opcion del menu
interface MenuItem {
  label: string;    // Texto que se muestra
  route: string;    // A donde va cuando hacen clic
  icon: string;     // Icono que se muestra
  roles: string[];  // Que tipos de usuario pueden verlo
}

// Esto le dice a Angular que esta clase es una pagina
@Component({
  selector: 'app-navbar',  // Nombre que usamos para mostrar esta pagina
  standalone: true,        // Funciona de manera independiente
  imports: [CommonModule], // Herramientas que necesita para funcionar
  templateUrl: './navbar.component.html',  // Archivo donde esta el HTML
  styleUrls: ['./navbar.component.css']    // Archivo donde estan los estilos
})
export class NavbarComponent implements OnInit {
  // Variables que controlan como se ve el menu
  isMenuOpen = false;        // Si el menu esta abierto en celular
  currentRoute = '';         // En que pagina estamos ahora

  // Informacion del usuario que esta usando el sistema
  currentUser: any = null;
  avatarValid = true;

  // Lista de todas las opciones del menu
  menuItems: MenuItem[] = [
    {
      label: 'Inicio',
      route: '/home',
      icon: '',
      roles: ['encuestado', 'directivo', 'administrador']  // Todos pueden ver inicio
    },
    {
      label: 'Encuestas',
      route: '/encuestas',
      icon: '',
      roles: ['encuestado', 'directivo', 'administrador']  // Todos pueden ver encuestas
    },
    {
      label: 'Panel Directivo',
      route: '/directivo',
      icon: '',
      roles: ['directivo', 'administrador']  // Solo directivos y administradores
    },
    {
      label: 'Administración',
      route: '/administrador',
      icon: '',
      roles: ['administrador']  // Solo administradores
    }
  ];

  // Aqui le decimos a Angular que servicios necesitamos usar
  constructor(
    private router: Router,                    // Router para saber en que pagina estamos
    private securityService: SecurityService  // Servicio de seguridad
  ) { }

  ngOnInit(): void {
    // Restaurar sesion y obtener informacion del usuario actual
    this.securityService.restoreSession();
    this.updateUserInfo();

    // Cuando se carga el componente, hacer estas cosas:

    // Estar pendiente de cuando el usuario cambia de pagina
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.url;  // Actualizar en que pagina estamos
      this.updateUserInfo();  // Actualizar info del usuario
    });

    // Saber en que pagina estamos al inicio
    this.currentRoute = this.router.url;
  }

  // Actualizar informacion del usuario
  private updateUserInfo(): void {
    if (this.securityService.isAuthenticated()) {
      this.currentUser = this.securityService.getCurrentUser();
      if (!this.currentUser) {
        // Si no hay info completa, crear objeto basico
        this.currentUser = {
          id: Date.now(),
          usuario: localStorage.getItem('userName') || 'Usuario',
          nombre: localStorage.getItem('userName') || 'Usuario',
          role: this.securityService.getUserRole(),
          avatar: 'https://via.placeholder.com/40x40/007bff/white?text=' +
            (localStorage.getItem('userName')?.charAt(0).toUpperCase() || 'U')
        };
      } else {
        // Si existe el usuario pero falta avatar, creamos un placeholder
        if (!this.currentUser.avatar) {
          // Asegurar que existan las propiedades `usuario` y `nombre`
          if (!this.currentUser.usuario && this.currentUser.nombre) {
            this.currentUser.usuario = this.currentUser.nombre;
          }
          if (!this.currentUser.nombre && this.currentUser.usuario) {
            this.currentUser.nombre = this.currentUser.usuario;
          }

          this.currentUser.avatar = 'https://via.placeholder.com/40x40/007bff/white?text=' +
            ((this.currentUser.nombre || this.currentUser.usuario)?.charAt(0).toUpperCase() || 'U');
        }
      }

      // Determinar si el avatar es válido
      this.avatarValid = this.isAvatarValid(this.currentUser?.avatar);
    } else {
      this.currentUser = null;
      this.avatarValid = false;
    }
  }

  // Validar URL de avatar (filtrar 'undefined', 'null' y cadenas vacías)
  private isAvatarValid(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed === '') return false;
    if (/undefined|null/i.test(trimmed)) return false;
    return true;
  }

  get visibleMenuItems(): MenuItem[] {
    if (!this.currentUser) return [];

    const userRole = this.securityService.getUserRole();
    return this.menuItems.filter(item => {
      // Mapear roles del sistema a roles del menu
      if (userRole === 'admin' || userRole === 'administrador') {
        return item.roles.includes('administrador');
      } else if (userRole === 'directivo') {
        return item.roles.includes('directivo') || item.roles.includes('encuestado');
      } else {
        return item.roles.includes('encuestado');
      }
    });
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  navigate(route: string): void {
    this.router.navigate([route]);
    this.closeMenu();
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route ||
      (route !== '/home' && this.currentRoute.startsWith(route));
  }

  logout(): void {
    // Usar SecurityService para cerrar sesion
    console.log('Cerrando sesión...');
    this.securityService.logout();
    this.currentUser = null;
    this.router.navigate(['/login']);
  }

  getRoleDisplayName(): string {
    const role = this.securityService.getUserRole();
    const roleNames: { [key: string]: string } = {
      'user': 'Usuario',
      'directivo': 'Directivo',
      'admin': 'Administrador',
      'administrador': 'Administrador'
    };
    return roleNames[role] || 'Usuario';
  }

  getRoleIcon(): string {
    // No mostrar icono de rol — devolver cadena vacía para mantener compatibilidad
    return '';
  }

  getUserName(): string {
    // Preferir la propiedad `nombre`, si no existe caer a `usuario`.
    return this.currentUser?.nombre || this.currentUser?.usuario || 'Usuario';
  }

  // Inicial del nombre de usuario para usar en placeholders
  getUserInitial(): string {
    const name = this.getUserName();
    return (name && name.length > 0) ? name.charAt(0).toUpperCase() : 'U';
  }

  onAvatarError(): void {
    this.avatarValid = false;
  }

  // Verificar si el usuario esta autenticado
  isAuthenticated(): boolean {
    return this.securityService.isAuthenticated();
  }
}
