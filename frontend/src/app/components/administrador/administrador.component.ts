import { Component, OnInit } from '@angular/core';  // Herramientas para crear paginas
import { CommonModule } from '@angular/common';  // Funciones basicas que se usan siempre
import { FormsModule } from '@angular/forms';  // Para poder usar formularios con inputs
import { EncuestasService, Encuesta as ServicioEncuesta, Usuario as ServicioUsuario, RespuestaCompleta } from '../../services/encuestas.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Estructura de datos para un usuario del sistema
interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'encuestado' | 'directivo' | 'administrador';
  fechaRegistro: Date;
  activo: boolean;
}

// Estructura de datos para una encuesta
interface Encuesta {
  id: number;
  titulo: string;
  descripcion: string;
  fechaCreacion: Date;
  fechaLimite: Date;
  estado: 'activa' | 'finalizada' | 'borrador';
  respuestas: number;
}

@Component({
  selector: 'app-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './administrador.component.html',
  styleUrls: ['./administrador.component.css']
})
export class AdministradorComponent implements OnInit {
  // Controla que seccion se muestra en pantalla
  vistaActual: 'dashboard' | 'usuarios' | 'encuestas' | 'reportes' = 'dashboard';
  
  // Numeros importantes para mostrar en el panel principal
  estadisticas = {
    totalUsuarios: 0,        // Cuantos usuarios hay registrados
    usuariosActivos: 0,      // Cuantos usuarios han usado el sistema hoy
    totalEncuestas: 0,       // Cuantas encuestas hay en total
    encuestasActivas: 0,     // Cuantas encuestas se pueden responder ahora
    respuestasHoy: 0,        // Cuantas respuestas se han recibido hoy
    respuestasTotal: 0       // Cuantas respuestas hay en total desde siempre
  };

  // Variables para manejar la lista de usuarios
  usuarios: Usuario[] = [];                // Lista completa de usuarios
  usuarioSeleccionado: Usuario | null = null;  // Usuario que estamos editando
  filtroUsuarios = '';                     // Texto para buscar usuarios
  
  // Variables para manejar la lista de encuestas
  encuestas: Encuesta[] = [];              // Lista completa de encuestas (sin preguntas)
  encuestaSeleccionada: Encuesta | null = null;  // Encuesta que estamos editando
  filtroEncuestas = '';                    // Texto para buscar encuestas

  // Variables para el formulario de crear usuario nuevo
  nuevoUsuario: Partial<Usuario> = {};     // Datos del usuario que se esta creando
  mostrarFormUsuario = false;              // Si se muestra o no el formulario

  // Inyectar el servicio de encuestas para sincronizar datos
  constructor(private encuestasService: EncuestasService) {}

  ngOnInit(): void {
    // Cuando se abre la pagina, cargar todos los datos
    this.cargarDatos();

    // Suscribirse a los observables del servicio para mantener sincronizados los datos
    this.encuestasService.obtenerEncuestas().subscribe(es => {
      // El servicio trae encuestas con preguntas; mapear a la forma usada por este componente
      this.encuestas = es.map(e => ({
        id: e.id,
        titulo: e.titulo,
        descripcion: e.descripcion,
        fechaCreacion: e.fechaCreacion,
        fechaLimite: e.fechaLimite,
        estado: e.estado,
        respuestas: 0 // se actualizará al suscribir respuestas
      }));
      this.actualizarEstadisticas();
    });

    this.encuestasService.obtenerRespuestas().subscribe(resps => {
      // Contar respuestas por encuesta y actualizar el campo `respuestas` local
      const counts: { [id: number]: number } = {};
      resps.forEach(r => { counts[r.encuestaId] = (counts[r.encuestaId] || 0) + 1; });
      this.encuestas = this.encuestas.map(e => ({ ...e, respuestas: counts[e.id] || 0 }));
      this.actualizarEstadisticas();
    });

    this.encuestasService.obtenerUsuarios().subscribe(us => {
      // Mapear usuarios del servicio al tipo local
      this.usuarios = us.map(u => ({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        fechaRegistro: u.fechaRegistro,
        activo: u.activo
      }));
      this.actualizarEstadisticas();
    });
  }

  cargarDatos(): void {
    // Traer toda la informacion necesaria para el panel
    this.cargarUsuarios();          // Lista de usuarios
    this.cargarEncuestas();         // Lista de encuestas
    this.actualizarEstadisticas();  // Numeros del dashboard
  }

  cargarUsuarios(): void {
    // Ahora los usuarios se cargan desde el servicio `EncuestasService`.
    // Esta función se mantiene por compatibilidad, pero no popula datos hardcodeados.
  }

  cargarEncuestas(): void {
    // Las encuestas se sincronizan desde `EncuestasService` (ver suscripciones en ngOnInit)
  }

  actualizarEstadisticas(): void {
    this.estadisticas.totalUsuarios = this.usuarios.length;
    this.estadisticas.usuariosActivos = this.usuarios.filter(u => u.activo).length;
    this.estadisticas.totalEncuestas = this.encuestas.length;
    this.estadisticas.encuestasActivas = this.encuestas.filter(e => e.estado === 'activa').length;
    this.estadisticas.respuestasTotal = this.encuestas.reduce((sum, e) => sum + e.respuestas, 0);
    this.estadisticas.respuestasHoy = Math.floor(Math.random() * 20) + 5; // Simulado
  }

  cambiarVista(vista: 'dashboard' | 'usuarios' | 'encuestas' | 'reportes'): void {
    this.vistaActual = vista;
  }

  // Gestion de usuarios
  get usuariosFiltrados(): Usuario[] {
    if (!this.filtroUsuarios) return this.usuarios;
    return this.usuarios.filter(u => 
      u.nombre.toLowerCase().includes(this.filtroUsuarios.toLowerCase()) ||
      u.email.toLowerCase().includes(this.filtroUsuarios.toLowerCase()) ||
      u.rol.toLowerCase().includes(this.filtroUsuarios.toLowerCase())
    );
  }

  seleccionarUsuario(usuario: Usuario): void {
    this.usuarioSeleccionado = usuario;
  }

  toggleUsuarioActivo(usuario: Usuario): void {
    usuario.activo = !usuario.activo;
    this.actualizarEstadisticas();
  }

  eliminarUsuario(usuario: Usuario): void {
    if (confirm(`¿Está seguro de eliminar al usuario ${usuario.nombre}?`)) {
      this.usuarios = this.usuarios.filter(u => u.id !== usuario.id);
      this.actualizarEstadisticas();
    }
  }

  abrirFormularioUsuario(): void {
    this.nuevoUsuario = {};
    this.mostrarFormUsuario = true;
  }

  guardarUsuario(): void {
    if (this.nuevoUsuario.nombre && this.nuevoUsuario.email && this.nuevoUsuario.rol) {
      const usuario: Usuario = {
        id: this.usuarios.length + 1,
        nombre: this.nuevoUsuario.nombre,
        email: this.nuevoUsuario.email,
        rol: this.nuevoUsuario.rol,
        fechaRegistro: new Date(),
        activo: true
      };
      this.usuarios.push(usuario);
      this.mostrarFormUsuario = false;
      this.actualizarEstadisticas();
    }
  }

  cancelarFormUsuario(): void {
    this.mostrarFormUsuario = false;
    this.nuevoUsuario = {};
  }

  // Gestion de encuestas
  get encuestasFiltradas(): Encuesta[] {
    if (!this.filtroEncuestas) return this.encuestas;
    return this.encuestas.filter(e => 
      e.titulo.toLowerCase().includes(this.filtroEncuestas.toLowerCase()) ||
      e.descripcion.toLowerCase().includes(this.filtroEncuestas.toLowerCase())
    );
  }

  cambiarEstadoEncuesta(encuesta: Encuesta, nuevoEstado: 'activa' | 'finalizada' | 'borrador'): void {
    encuesta.estado = nuevoEstado;
    this.actualizarEstadisticas();
  }

  eliminarEncuesta(encuesta: Encuesta): void {
    if (confirm(`¿Está seguro de eliminar la encuesta "${encuesta.titulo}"?`)) {
      this.encuestas = this.encuestas.filter(e => e.id !== encuesta.id);
      this.actualizarEstadisticas();
    }
  }

  exportarReportes(): void;
  exportarReportes(tipo: 'usuarios' | 'encuestas' | 'actividad' | 'all' = 'all', formato: 'csv' | 'json' | 'pdf' = 'csv'): void {
    const fecha = new Date();

    // Helper: descarga un Blob o texto como archivo
    const descarga = (data: BlobPart, filename: string, mime = 'text/csv') => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    };

    // Helper: convierte array de arrays a CSV
    const toCSV = (rows: Array<Array<any>>, headers?: string[]) => {
      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('\n') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      let out = '';
      if (headers && headers.length) out += headers.map(escapeCell).join(',') + '\n';
      out += rows.map(r => r.map(escapeCell).join(',')).join('\n');
      return out;
    };

    if (formato === 'json') {
      let payload: any = {};
      if (tipo === 'usuarios') payload = this.usuarios;
      else if (tipo === 'encuestas') payload = this.encuestas;
      else if (tipo === 'actividad') payload = this.estadisticas;
      else payload = { usuarios: this.usuarios, encuestas: this.encuestas, estadisticas: this.estadisticas };

      descarga(JSON.stringify(payload, null, 2), `datos-${tipo}-${fecha.toISOString().slice(0,10)}.json`, 'application/json');
      return;
    }

    if (formato === 'csv') {
      if (tipo === 'usuarios') {
        const headers = ['id', 'nombre', 'email', 'rol', 'fechaRegistro', 'activo'];
        const rows = this.usuarios.map(u => [u.id, u.nombre, u.email, u.rol, u.fechaRegistro instanceof Date ? u.fechaRegistro.toISOString() : String(u.fechaRegistro), u.activo ? 'Activo' : 'Inactivo']);
        const csv = toCSV(rows, headers);
        descarga(csv, `usuarios-${fecha.toISOString().slice(0,10)}.csv`);
        return;
      }

      if (tipo === 'encuestas') {
        const headers = ['id', 'titulo', 'descripcion', 'fechaCreacion', 'fechaLimite', 'estado', 'respuestas'];
        const rows = this.encuestas.map(e => [e.id, e.titulo, e.descripcion, e.fechaCreacion instanceof Date ? e.fechaCreacion.toISOString() : String(e.fechaCreacion), e.fechaLimite instanceof Date ? e.fechaLimite.toISOString() : String(e.fechaLimite), e.estado, e.respuestas]);
        const csv = toCSV(rows, headers);
        descarga(csv, `encuestas-${fecha.toISOString().slice(0,10)}.csv`);
        return;
      }

      if (tipo === 'actividad') {
        const headers = ['clave', 'valor'];
        const rows = Object.entries(this.estadisticas).map(([k, v]) => [k, String(v)]);
        const csv = toCSV(rows, headers);
        descarga(csv, `estadisticas-${fecha.toISOString().slice(0,10)}.csv`);
        return;
      }

      // default: export all as CSV (usuarios then encuestas then estadisticas)
      const allRows: Array<Array<any>> = [];
      allRows.push(['--- Usuarios ---']);
      allRows.push(['id', 'nombre', 'email', 'rol', 'fechaRegistro', 'activo']);
      this.usuarios.forEach(u => allRows.push([u.id, u.nombre, u.email, u.rol, u.fechaRegistro instanceof Date ? u.fechaRegistro.toISOString() : String(u.fechaRegistro), u.activo ? 'Activo' : 'Inactivo']));
      allRows.push([]);
      allRows.push(['--- Encuestas ---']);
      allRows.push(['id', 'titulo', 'descripcion', 'fechaCreacion', 'fechaLimite', 'estado', 'respuestas']);
      this.encuestas.forEach(e => allRows.push([e.id, e.titulo, e.descripcion, e.fechaCreacion instanceof Date ? e.fechaCreacion.toISOString() : String(e.fechaCreacion), e.fechaLimite instanceof Date ? e.fechaLimite.toISOString() : String(e.fechaLimite), e.estado, e.respuestas]));
      allRows.push([]);
      allRows.push(['--- Estadisticas ---']);
      Object.entries(this.estadisticas).forEach(([k, v]) => allRows.push([k, String(v)]));

      const csv = toCSV(allRows as any[]);
      descarga(csv, `datos-todos-${fecha.toISOString().slice(0,10)}.csv`);
      return;
    }

    if (formato === 'pdf') {
      // Mantener la generación de PDF existente cuando se solicite
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Reporte de Encuestas - Administración', 14, 20);
      doc.setFontSize(11);
      doc.text(`Fecha: ${fecha.toLocaleString()}`, 14, 28);

      const stats = [
        ['Total Usuarios', String(this.estadisticas.totalUsuarios)],
        ['Usuarios Activos', String(this.estadisticas.usuariosActivos)],
        ['Total Encuestas', String(this.estadisticas.totalEncuestas)],
        ['Encuestas Activas', String(this.estadisticas.encuestasActivas)],
        ['Respuestas Hoy', String(this.estadisticas.respuestasHoy)],
        ['Respuestas Total', String(this.estadisticas.respuestasTotal)]
      ];

      (autoTable as any)(doc, {
        startY: 36,
        head: [['Clave', 'Valor']],
        body: stats,
        theme: 'grid',
        styles: { fontSize: 10 }
      });

      let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 60;

      if (tipo === 'usuarios' || tipo === 'all') {
        if (this.usuarios && this.usuarios.length) {
          const usuariosBody = this.usuarios.map(u => [u.nombre, u.email, u.rol, u.activo ? 'Activo' : 'Inactivo']);
          (autoTable as any)(doc, {
            startY: finalY,
            head: [['Nombre', 'Email', 'Rol', 'Estado']],
            body: usuariosBody,
            styles: { fontSize: 9 }
          });
          finalY = (doc as any).lastAutoTable.finalY + 8;
        }
      }

      if (tipo === 'encuestas' || tipo === 'all') {
        if (this.encuestas && this.encuestas.length) {
          const encBody = this.encuestas.map(e => [e.titulo, e.estado, String(e.respuestas)]);
          (autoTable as any)(doc, {
            startY: finalY,
            head: [['Título', 'Estado', 'Respuestas']],
            body: encBody,
            styles: { fontSize: 9 }
          });
          finalY = (doc as any).lastAutoTable.finalY + 8;
        }
      }

      const filename = `reporte-encuestas-${fecha.toISOString().slice(0,10)}.pdf`;
      doc.save(filename);
      return;
    }
  }
}