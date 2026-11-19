# Arquitectura y decisiones

## Estructura

Interfaz HTML/CSS/JavaScript sin compilación ni paquetes externos. Node 24 sirve el sitio y una API del mismo origen. SQLite en disco persistente guarda adultos, sesiones, enlaces de acceso, propuestas, noticias, resultados y estadísticas. Consultas parametrizadas; claves foráneas y WAL activados. Diseñado para una instancia; no montar réplicas con discos SQLite independientes.

Esta elección simplifica la revisión y ejecución local. El proyecto no necesita los servicios originales ni acceso a Google Cloud. Requiere un servidor Node real al publicarse; una web estática por sí sola no proporciona registro ni moderación.

## Identidad

- Enlaces aleatorios de 256 bits, almacenados como hash y con 15 minutos de vigencia. Se consumen mediante POST y confirmación, no por abrir un enlace GET.
- Cookies HttpOnly y SameSite=Lax, Secure en producción. Sesión adulta de hasta 30 días. Tokens y sesiones caducados se eliminan.
- CSRF mediante cookie y cabecera coincidentes, además de comprobación de Origin.
- Limitación de frecuencia de solicitudes, enlaces de correo y propuestas. La dirección de red se usa temporalmente en memoria para limitar abuso, no como identidad o estadística.
- El administrador se asigna mediante una operación local del servidor sobre una cuenta verificada. La interfaz no decide los permisos.

## Menores

Un visitante que se declara menor no crea usuario. Una cookie aleatoria y un registro temporal en memoria permiten una sesión de 30 minutos. Se incrementa un contador agregado por día, país y grupo, sin guardar IP ni identificador en la base de datos. Volver tras expirar puede sumar otra sesión: no se informa como personas únicas. Reiniciar el servidor invalida esas sesiones temporales. No hay progreso personal de menores guardado en el servidor.

Los videos y mapas externos se cargan bajo acción del visitante. Esto reduce solicitudes automáticas a terceros, pero no equivale a anonimato ante proveedores externos o el alojamiento.

## Moderación

Estados: pending, approved y rejected. Una propuesta nueva siempre es pending, incluso si quien la propone es administrador. Solo la API administrativa cambia el estado; aprobar exige confirmación y nota. La API pública devuelve exclusivamente approved, filtrado por país, sin dueño ni nota interna. Rechazar o volver a pendiente retira el punto de la API pública. La decisión queda en un registro de auditoría.

## Contenido y juegos

Las lecciones se extraen de las fuentes autorizadas y se revisaron los nombres de objetos visualmente. No se mezclan categorías de países. Cada ronda contiene seis categorías con un objeto por categoría, opciones distintas y una única respuesta puntuable por objeto. La interacción por selección funciona con teclado y táctil; arrastrar es opcional. Cancelar el arrastre no oculta ni consume el objeto.

Las preguntas de derechos comparan conjuntos completos para las opciones múltiples. Se eliminó el uso incorrecto de índices de respuestas del proyecto anterior. El estado se reinicia al cambiar de país; no hay clasificación competitiva ni incentivos basados en puntuaciones.

## Privacidad y conservación

Datos adultos: correo, país, rango de edad, género y ocupación opcionales, consentimiento, progreso y propuestas. No se pide nombre, fecha de nacimiento ni ubicación actual. Se ofrece descarga y eliminación de cuenta. Las propuestas públicas aprobadas se desvinculan del usuario al eliminarlo; las pendientes se borran. Se conserva auditoría hasta un año, con identificador técnico del actor, sin email copiado.

Sesiones y tokens caducados se eliminan. Cuentas no verificadas: 24 horas. Estadísticas agregadas y auditoría: un año. Las copias de seguridad, logs de alojamiento y correo requieren una política operativa al desplegar; no están controlados por el código por sí solos.

## Caché y actualización

El service worker guarda solo recursos públicos educativos. Nunca intercepta /api/ ni proveedores externos. Precarga imágenes y audios referenciados por content.json. Usa red primero y copia local como alternativa. Cambia el identificador de caché en sw.js para una nueva versión y prueba la actualización sin romper sesiones. La funcionalidad sin conexión no sustituye las verificaciones del servidor.

## Riesgos pendientes de producción

Confirmar proveedor de correo, dominio, contacto del responsable, copias y retención; probar restauración. Revisar requisitos de privacidad aplicables a la operación institucional y los contenidos educativos. Probar cargas y límites de correo. Configurar el proxy para evitar logs de datos sensibles y validar uso bajo red compartida. Considerar una base de datos gestionada y sesiones compartidas si se necesita escalar a múltiples instancias.
