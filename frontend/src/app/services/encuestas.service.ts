// Herramientas para manejar las encuestas y respuestas
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';
import { SecurityService, SecurityCheck } from './security.service';

// Como se guarda la informacion de cada usuario
export interface Usuario {
  id: number;        // Numero para identificar al usuario
  nombre: string;    // Nombre completo
  email: string;     // Correo para entrar al sistema
  rol: 'encuestado' | 'directivo' | 'administrador';  // Tipo de usuario
  fechaRegistro: Date;  // Cuando se registro
  activo: boolean;      // Si puede usar el sistema
}

// Como se guarda cada pregunta de una encuesta
export interface Pregunta {
  id: number;       // Numero para identificar la pregunta
  texto: string;    // La pregunta que se hace al usuario
  tipo: 'multiple' | 'abierta' | 'escala';  // Tipo de pregunta
  opciones?: string[];                      // Opciones para elegir (solo si es multiple)
  requerida: boolean;                       // Si es obligatoria
}

// Como se guarda una encuesta completa
export interface Encuesta {
  id: number;           // Numero para identificar la encuesta
  titulo: string;       // Nombre de la encuesta
  descripcion: string;  // De que se trata la encuesta
  fechaCreacion: Date;  // Cuando se creo
  fechaLimite: Date;    // Hasta cuando se puede responder
  estado: 'activa' | 'finalizada' | 'borrador';  // Estado actual
  preguntas: Pregunta[];  // Todas las preguntas
  creadorId: number;      // Quien la creo
}

// Estructura de datos para una respuesta individual a una pregunta
export interface Respuesta {
  id: number;
  encuestaId: number;
  usuarioId: number;
  preguntaId: number;
  valor: any;                    // La respuesta que dio el usuario
  fechaRespuesta: Date;
  ipAddress?: string;            // Direccion IP para seguridad
}

// Estructura de datos para todas las respuestas de un usuario a una encuesta
export interface RespuestaCompleta {
  id: number;
  encuestaId: number;
  usuarioId: number;
  respuestas: { [preguntaId: number]: any };  // Todas las respuestas juntas
  fechaCompletado: Date;
  ipAddress?: string;
  tiempoRespuesta?: number; // en segundos
}

// Esto le dice a Angular que esta clase es un servicio que se puede usar en toda la app
@Injectable({
  providedIn: 'root'  // Hacer que este servicio este disponible en toda la aplicacion
})
export class EncuestasService {
  // Contenedores de datos que pueden cambiar y avisar a las paginas cuando cambian
  private encuestasSubject = new BehaviorSubject<Encuesta[]>([]);          // Lista de encuestas
  private respuestasSubject = new BehaviorSubject<RespuestaCompleta[]>([]); // Lista de respuestas
  private usuariosSubject = new BehaviorSubject<Usuario[]>([]);             // Lista de usuarios
  private sesionesUsuario = new Map<number, string>(); // Guardar sesiones activas

  // Versiones publicas que las paginas pueden leer (pero no modificar directamente)
  public encuestas$ = this.encuestasSubject.asObservable();   // Para que los componentes vean las encuestas
  public respuestas$ = this.respuestasSubject.asObservable(); // Para que los componentes vean las respuestas
  public usuarios$ = this.usuariosSubject.asObservable();     // Para que los componentes vean los usuarios

  constructor(private securityService: SecurityService) {
    this.inicializarDatos();
  }

  private inicializarDatos(): void {
    // Datos iniciales de usuarios
    const usuariosIniciales: Usuario[] = [
      {
        id: 1,
        nombre: 'Juan Pérez',
        email: 'juan.perez@universidad.edu',
        rol: 'encuestado',
        fechaRegistro: new Date('2024-01-15'),
        activo: true
      },
      {
        id: 3,
        nombre: 'Carlos López',
        email: 'carlos.lopez@universidad.edu',
        rol: 'directivo',
        fechaRegistro: new Date('2024-01-20'),
        activo: true
      },
      {
        id: 4,
        nombre: 'Ana Martínez',
        email: 'ana.martinez@universidad.edu',
        rol: 'administrador',
        fechaRegistro: new Date('2024-01-01'),
        activo: true
      }
    ];

    // Datos iniciales de encuestas
    const fechaComun = new Date('2025-12-31');
    const encuestasIniciales: Encuesta[] = [
      {
        id: 1,
        titulo: 'Satisfacción del Servicio',
        descripcion: 'Encuesta para evaluar la calidad del servicio prestado',
        fechaCreacion: new Date('2025-10-01'),
        fechaLimite: fechaComun,
        estado: 'activa',
        creadorId: 4,
        preguntas: [
          {
            id: 1,
            texto: '¿Cómo califica el servicio recibido?',
            tipo: 'escala',
            requerida: true
          },
          {
            id: 2,
            texto: '¿Qué aspectos mejoraría?',
            tipo: 'abierta',
            requerida: false
          },
          {
            id: 3,
            texto: '¿Recomendaría nuestros servicios?',
            tipo: 'multiple',
            opciones: ['Definitivamente sí', 'Probablemente sí', 'Probablemente no', 'Definitivamente no'],
            requerida: true
          }
        ]
      },
      {
        id: 2,
        titulo: 'Evaluación de Capacitación',
        descripcion: 'Encuesta post-capacitación para evaluar efectividad',
        fechaCreacion: new Date('2025-09-15'),
        fechaLimite: fechaComun,
        estado: 'activa',
        creadorId: 2,
        preguntas: [
          {
            id: 4,
            texto: '¿El contenido fue claro y comprensible?',
            tipo: 'multiple',
            opciones: ['Sí, muy claro', 'Parcialmente claro', 'No muy claro', 'Confuso'],
            requerida: true
          },
          {
            id: 5,
            texto: 'Califique la calidad del instructor (1-5)',
            tipo: 'escala',
            requerida: true
          }
        ]
      },
      {
        id: 3,
        titulo: 'Encuesta de Clima Laboral',
        descripcion: 'Medir la percepción del ambiente de trabajo',
        fechaCreacion: new Date('2025-10-10'),
        fechaLimite: fechaComun,
        estado: 'activa',
        creadorId: 4,
        preguntas: [
          { id: 6, texto: '¿Se siente valorado en su trabajo?', tipo: 'multiple', opciones: ['Sí','A veces','No'], requerida: true },
          { id: 7, texto: '¿Qué mejorarías del ambiente laboral?', tipo: 'abierta', requerida: false }
        ]
      },
      {
        id: 4,
        titulo: 'Uso de Herramientas Digitales',
        descripcion: 'Analizar la adopción de herramientas tecnológicas',
        fechaCreacion: new Date('2025-10-12'),
        fechaLimite: fechaComun,
        estado: 'activa',
        creadorId: 3,
        preguntas: [
          { id: 8, texto: '¿Usa las herramientas proporcionadas regularmente?', tipo: 'multiple', opciones: ['Sí','No'], requerida: true },
          { id: 9, texto: '¿Qué herramienta considera más útil?', tipo: 'abierta', requerida: false }
        ]
      },
      {
        id: 5,
        titulo: 'Satisfacción con Atención al Cliente',
        descripcion: 'Opiniones sobre el soporte y atención al cliente',
        fechaCreacion: new Date('2025-10-20'),
        fechaLimite: fechaComun,
        estado: 'activa',
        creadorId: 4,
        preguntas: [
          { id: 10, texto: '¿La atención fue oportuna?', tipo: 'multiple', opciones: ['Sí','No'], requerida: true },
          { id: 11, texto: 'Comentarios adicionales', tipo: 'abierta', requerida: false }
        ]
      },
      {
        id: 6,
        titulo: 'Preferencias de Comunicación',
        descripcion: 'Conocer canales preferidos para comunicaciones internas',
        fechaCreacion: new Date('2025-10-25'),
        fechaLimite: fechaComun,
        estado: 'activa',
        creadorId: 2,
        preguntas: [
          { id: 12, texto: '¿Qué canal prefiere para noticias internas?', tipo: 'multiple', opciones: ['Email','Intranet','WhatsApp','Otro'], requerida: true }
        ]
      }
    ];

    // Datos iniciales de respuestas
    const respuestasIniciales: RespuestaCompleta[] = [
      {
        id: 1,
        encuestaId: 1,
        usuarioId: 1,
        respuestas: {
          1: 4,
          2: 'Mejorar los tiempos de atención',
          3: 'Definitivamente sí'
        },
        fechaCompletado: new Date('2024-10-02'),
        ipAddress: '192.168.1.100',
        tiempoRespuesta: 180
      },
      {
        id: 2,
        encuestaId: 1,
        usuarioId: 2,
        respuestas: {
          1: 5,
          2: 'Todo perfecto',
          3: 'Definitivamente sí'
        },
        fechaCompletado: new Date('2024-10-02'),
        ipAddress: '192.168.1.101',
        tiempoRespuesta: 120
      },
      {
        id: 3,
        encuestaId: 2,
        usuarioId: 1,
        respuestas: {
          4: 'Sí, muy claro',
          5: 5
        },
        fechaCompletado: new Date('2024-10-10'),
        ipAddress: '192.168.1.100',
        tiempoRespuesta: 90
      }
    ];

    this.usuariosSubject.next(usuariosIniciales);
    this.encuestasSubject.next(encuestasIniciales);
    this.respuestasSubject.next(respuestasIniciales);
  }

  // CRUD Encuestas
  obtenerEncuestas(): Observable<Encuesta[]> {
    return this.encuestas$;
  }

  obtenerEncuestaPorId(id: number): Observable<Encuesta | undefined> {
    return of(this.encuestasSubject.value.find(e => e.id === id));
  }

  crearEncuesta(encuesta: Omit<Encuesta, 'id'>): Observable<Encuesta> {
    const nuevaEncuesta: Encuesta = {
      ...encuesta,
      id: Math.max(...this.encuestasSubject.value.map(e => e.id)) + 1
    };
    
    const encuestasActuales = this.encuestasSubject.value;
    this.encuestasSubject.next([...encuestasActuales, nuevaEncuesta]);
    
    return of(nuevaEncuesta);
  }

  actualizarEncuesta(id: number, encuesta: Partial<Encuesta>): Observable<Encuesta | null> {
    const encuestasActuales = this.encuestasSubject.value;
    const index = encuestasActuales.findIndex(e => e.id === id);
    
    if (index === -1) {
      return of(null);
    }

    encuestasActuales[index] = { ...encuestasActuales[index], ...encuesta };
    this.encuestasSubject.next([...encuestasActuales]);
    
    return of(encuestasActuales[index]);
  }

  eliminarEncuesta(id: number): Observable<boolean> {
    const encuestasActuales = this.encuestasSubject.value;
    const nuevasEncuestas = encuestasActuales.filter(e => e.id !== id);
    
    if (nuevasEncuestas.length === encuestasActuales.length) {
      return of(false);
    }

    this.encuestasSubject.next(nuevasEncuestas);
    return of(true);
  }

  // Validacion de respuesta unica por usuario
  usuarioYaRespondio(encuestaId: number, usuarioId: number): Observable<boolean> {
    const respuestas = this.respuestasSubject.value;
    const yaRespondio = respuestas.some(r => r.encuestaId === encuestaId && r.usuarioId === usuarioId);
    return of(yaRespondio);
  }

  // Enviar respuesta con validaciones
  enviarRespuesta(respuestaCompleta: Omit<RespuestaCompleta, 'id'>): Observable<{ success: boolean; message: string }> {
    // Validar respuesta unica
    const yaRespondio = this.respuestasSubject.value.some(
      r => r.encuestaId === respuestaCompleta.encuestaId && r.usuarioId === respuestaCompleta.usuarioId
    );

    if (yaRespondio) {
      return of({ success: false, message: 'Ya has respondido esta encuesta' });
    }

    // Validar limites de tiempo (anti-spam basico)
    if (respuestaCompleta.tiempoRespuesta && respuestaCompleta.tiempoRespuesta < 30) {
      return of({ success: false, message: 'Respuesta enviada muy rápido. Por favor, tómate tiempo para leer las preguntas.' });
    }

    const nuevaRespuesta: RespuestaCompleta = {
      ...respuestaCompleta,
      id: Math.max(...this.respuestasSubject.value.map(r => r.id)) + 1
    };

    const respuestasActuales = this.respuestasSubject.value;
    this.respuestasSubject.next([...respuestasActuales, nuevaRespuesta]);

    return of({ success: true, message: 'Respuesta enviada exitosamente' });
  }

  // Obtener estadisticas por encuesta
  obtenerEstadisticasEncuesta(encuestaId: number): Observable<any> {
    const respuestas = this.respuestasSubject.value.filter(r => r.encuestaId === encuestaId);
    const encuesta = this.encuestasSubject.value.find(e => e.id === encuestaId);

    if (!encuesta) {
      return of(null);
    }

    const estadisticas = {
      encuestaId,
      titulo: encuesta.titulo,
      totalRespuestas: respuestas.length,
      fechaInicio: encuesta.fechaCreacion,
      fechaFin: encuesta.fechaLimite,
      estado: encuesta.estado,
      preguntasAnalisis: encuesta.preguntas.map(pregunta => {
        const respuestasPregunta = respuestas.map(r => r.respuestas[pregunta.id]).filter(Boolean);
        
        let analisis: any = {
          preguntaId: pregunta.id,
          texto: pregunta.texto,
          tipo: pregunta.tipo,
          totalRespuestas: respuestasPregunta.length
        };

        if (pregunta.tipo === 'escala') {
          const valores = respuestasPregunta.map(Number).filter(Boolean);
          analisis.promedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
          analisis.distribucion = this.calcularDistribucionEscala(valores);
        } else if (pregunta.tipo === 'multiple') {
          analisis.distribucion = this.calcularDistribucionMultiple(respuestasPregunta);
        } else if (pregunta.tipo === 'abierta') {
          analisis.respuestasTexto = respuestasPregunta.slice(0, 10); // Solo primeras 10 para el ejemplo
        }

        return analisis;
      }),
      tiempoPromedioRespuesta: respuestas.length > 0 
        ? respuestas.reduce((suma, r) => suma + (r.tiempoRespuesta || 0), 0) / respuestas.length 
        : 0
    };

    return of(estadisticas);
  }

  private calcularDistribucionEscala(valores: number[]): { [key: string]: number } {
    const distribucion: { [key: string]: number } = {};
    for (let i = 1; i <= 5; i++) {
      distribucion[i.toString()] = valores.filter(v => v === i).length;
    }
    return distribucion;
  }

  private calcularDistribucionMultiple(respuestas: any[]): { [key: string]: number } {
    const distribucion: { [key: string]: number } = {};
    respuestas.forEach(respuesta => {
      if (distribucion[respuesta]) {
        distribucion[respuesta]++;
      } else {
        distribucion[respuesta] = 1;
      }
    });
    return distribucion;
  }

  // Obtener todas las respuestas
  obtenerRespuestas(): Observable<RespuestaCompleta[]> {
    return this.respuestas$;
  }

  // Usuarios
  obtenerUsuarios(): Observable<Usuario[]> {
    return this.usuarios$;
  }

  crearUsuario(usuario: Omit<Usuario, 'id'>): Observable<Usuario> {
    const nuevoUsuario: Usuario = {
      ...usuario,
      id: Math.max(...this.usuariosSubject.value.map(u => u.id)) + 1
    };
    
    const usuariosActuales = this.usuariosSubject.value;
    this.usuariosSubject.next([...usuariosActuales, nuevoUsuario]);
    
    return of(nuevoUsuario);
  }

  actualizarUsuario(id: number, usuario: Partial<Usuario>): Observable<Usuario | null> {
    const usuariosActuales = this.usuariosSubject.value;
    const index = usuariosActuales.findIndex(u => u.id === id);
    
    if (index === -1) {
      return of(null);
    }

    usuariosActuales[index] = { ...usuariosActuales[index], ...usuario };
    this.usuariosSubject.next([...usuariosActuales]);
    
    return of(usuariosActuales[index]);
  }

  eliminarUsuario(id: number): Observable<boolean> {
    const usuariosActuales = this.usuariosSubject.value;
    const nuevosUsuarios = usuariosActuales.filter(u => u.id !== id);
    
    if (nuevosUsuarios.length === usuariosActuales.length) {
      return of(false);
    }

    this.usuariosSubject.next(nuevosUsuarios);
    return of(true);
  }

  // Metodos de seguridad

  // Inicializar sesion segura para usuario
  inicializarSesionSegura(userId: number, ipAddress: string, userAgent: string): Observable<string> {
    const sessionId = this.securityService.inicializarSesion(userId, ipAddress, userAgent);
    this.sesionesUsuario.set(userId, sessionId);
    return of(sessionId);
  }

  // Validar acceso a encuesta con verificaciones de seguridad
  validarAccesoEncuestaSegura(userId: number, encuestaId: number): Observable<SecurityCheck> {
    const sessionId = this.sesionesUsuario.get(userId);
    
    if (!sessionId) {
      return throwError(() => new Error('Sesión no iniciada'));
    }

    return this.securityService.validarAccesoEncuesta(sessionId, encuestaId);
  }

  // Responder encuesta con validaciones de seguridad
  responderEncuestaSegura(
    userId: number, 
    encuestaId: number, 
    respuestaData: any, 
    tiempoInicio: Date
  ): Observable<RespuestaCompleta> {
    const sessionId = this.sesionesUsuario.get(userId);
    
    if (!sessionId) {
      return throwError(() => new Error('Sesión no válida'));
    }

    const tiempoRespuesta = Math.floor((Date.now() - tiempoInicio.getTime()) / 1000);

    return this.securityService.validarRespuesta(sessionId, encuestaId, respuestaData, tiempoRespuesta)
      .pipe(
        switchMap((validacion: SecurityCheck) => {
          if (!validacion.isValid) {
            return throwError(() => new Error(validacion.message));
          }

          // Si la validacion es exitosa, proceder con el guardado normal
          const respuestaCompleta: Omit<RespuestaCompleta, 'id'> = {
            encuestaId,
            usuarioId: userId,
            respuestas: respuestaData,
            fechaCompletado: new Date(),
            tiempoRespuesta
          };
          
          return this.enviarRespuesta(respuestaCompleta).pipe(
            map(result => {
              if (!result.success) {
                throw new Error(result.message);
              }
              // Retornar la respuesta creada
              const respuestasActuales = this.respuestasSubject.value;
              return respuestasActuales[respuestasActuales.length - 1];
            })
          );
        })
      );
  }

  // Obtener estadisticas de seguridad (solo para administradores)
  obtenerEstadisticasSeguridad(): Observable<any> {
    return this.securityService.obtenerEstadisticasSeguridad();
  }

  // Desbloquear IP (solo para administradores)
  desbloquearIP(ipAddress: string): void {
    this.securityService.desbloquearIP(ipAddress);
  }

  // Obtener IPs bloqueadas (solo para administradores)
  obtenerIPsBloqueadas(): Observable<string[]> {
    return of(this.securityService.obtenerIPsBloqueadas());
  }

  // Cerrar sesion de usuario
  cerrarSesion(userId: number): void {
    this.sesionesUsuario.delete(userId);
  }
}
