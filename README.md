# Ranking XP · La Movida de SST+

Plataforma pública independiente: **https://ranking.movidasst.com/**

## Arquitectura y compatibilidad

Este repositorio `movidasst/ranking-` sirve únicamente la **web de visualización**. No contiene un panel de administración de estudios. No se ha cambiado ningún archivo de `movidasst/estudia`, `movidasst/participa`, `movidasst/inteligencia` ni del repositorio histórico `movidasst/ranking`.

Reutiliza la base central de Supabase (`lfdmbkzghnwvsapxypvt`) y **solo RPC existentes de lectura**:
- `ranking_publico` (ranking global, paginado).
- `ranking_sesion_publico` (ranking por estudio).
- `estudia_niveles_publicos` (niveles y umbrales).
- `estudia_sesiones_publicas` (selector de estudios).
- `estudia_mi_progreso` (consulta personal por credencial).

**No hay escrituras de XP ni cambios al cálculo del ranking.** Las asignaciones siguen ocurriendo en sus respectivas aplicaciones.

## Privacidad

La búsqueda pública muestra únicamente los campos devueltos por las funciones públicas. Mis XP requiere documento y código personal. La aplicación **no** almacena estas credenciales en `localStorage`, `sessionStorage`, URLs o cookies. La sesión privada se borra al cerrar la consulta o recargar la aplicación. El historial viene limitado por el RPC existente; la vista indica si el desglose por fuente no incluye todos los movimientos.

## Experiencia

- Mobile-first, cinco pestañas en barra inferior sólida: Inicio, Ranking, Mis XP, Niveles y Más.
- Podio, búsqueda, filtros, nivel, descarga de podio PNG y compartir enlace.
- Consulta personal privada: nivel, total de XP, progreso, fuentes y movimientos.
- Instalación web (PWA) Android/iOS. Service worker cachea solo la interfaz estática y **nunca** las respuestas de Supabase.
- Open Graph JPEG/PNG para enlace de WhatsApp/LinkedIn.

## Publicación

GitHub Pages debe usar `main` y carpeta `/ (root)` del repositorio `movidasst/ranking-`. El archivo `CNAME` existente contiene `ranking.movidasst.com`. Apuntar el DNS del dominio a GitHub Pages, si aún no se configuró.

## Pruebas

```sh
node --check app.js
node --check sw.js
node tests/smoke.js
```

*La Movida de SST+ · De la Reacción a la Prevención*

## Ranking acumulado por estudios (octubre 2026)
En la pestaña «Ranking» hay dos ámbitos: «Ranking general» (todos los XP) y «Por estudio», donde la opción predeterminada «Todos los estudios · XP acumulados» suma exclusivamente eventos asociados a estudios, respetando exclusiones de participantes del ranking. También permite seleccionar estudios específicos. Utiliza la nueva función **pública y solo lectura** `ranking_todos_estudios_publico`, sin cambiar las consultas existentes. La selección «Todos los estudios» incluye únicamente estudios visibles, sin XP de Participa ni de Pulso de la Comunidad. La consulta admite paginación.


## Explicación pública de XP e innovación
La pestaña «Más» contiene dos tarjetas informativas sobre los XP de las tres fuentes y la evolución de Inteligencia SST hacia capacidades agénticas. El texto distingue las funciones actuales de la siguiente etapa, mantiene la validación humana para asignar puntos y no modifica las reglas ni los datos.
