# Publicación y operación — después de aprobar la revisión

No se publica automáticamente al subir el repositorio. La aplicación completa necesita Node 24, almacenamiento persistente y HTTPS; GitHub Pages puede alojar archivos estáticos pero no este servidor. No se promete un servicio ilimitado gratuito. Elegir proveedor, límites y coste antes de contratar.

## Configuración

1. Usar una cuenta de alojamiento controlada por el responsable.
2. Configurar un volumen persistente para DATA_DIR fuera de public/.
3. Copiar .env.example a .env en el servidor, o usar variables secretas del proveedor.
4. Establecer NODE_ENV=production, HOST=0.0.0.0, PORT según el proveedor, PUBLIC_URL con el origen HTTPS final, CONTACT_EMAIL y MAIL_FROM.
5. Configurar RESEND_API_KEY para el adaptador de correo incluido y un remitente autorizado en ese proveedor. El adaptador puede reemplazarse por otro proveedor manteniendo la interfaz sendAccess. No guardar claves en Git.
6. Ejecutar node --env-file=.env server.mjs. El arranque de producción rechaza configuración incompleta.
7. Registrar/verificar la cuenta del responsable y ejecutar node --env-file=.env server.mjs --admin correo-del-responsable. No hay cuenta administrativa ni contraseña predeterminada.

El servidor no sirve TLS directamente: requiere proxy HTTPS del proveedor. La app valida Origin contra PUBLIC_URL; utilizar el mismo origen para web y API. Configurar el proxy sin registrar cuerpos de solicitudes ni enlaces de acceso. Si cambia el dominio, revisar cookies, enlaces de correo y caché.

## Copias y restauración

Guardar una copia coherente de SQLite mediante su API de backup o detener escrituras antes de copiar; no copiar solamente ecoh.sqlite mientras WAL está activo sin una estrategia consistente. Almacenar copias cifradas fuera del directorio público, limitar acceso y establecer caducidad. Probar restauración en un entorno aislado antes del lanzamiento. No subir ninguna copia al repositorio.

## Revisión de aceptación

- Validar el correo de contacto público y el aviso de privacidad.
- Probar envío, recepción y caducidad de enlaces con cuentas reales de prueba autorizadas.
- Confirmar funcionamiento en Android, iPhone, escritorio y teclado.
- Verificar lectura y juegos sin conexión después de descargar recursos; comprobar actualización de caché.
- Probar moderación como administrador y como usuario normal, sin exponer propuestas pendientes.
- Revisar ubicaciones y residuos aceptados antes de publicarlos.
- Confirmar materiales educativos y vínculos institucionales con el responsable; no equiparar colores de ECOH a normativa municipal universal.
- Verificar disponibilidad de la playlist, consentimiento de carga externa y reproducción en móviles.
- Probar restauración de copia y una actualización con retorno a versión anterior.
- Revisar capacidad, límites de correo, protección contra abuso y política de logs del proveedor.

## Elementor

Tras aprobar y publicar la app, editar la página institucional, añadir un botón «Abrir ECOH Ambiental» y usar la URL HTTPS final. El diseño actual abre la app a pantalla completa; la incrustación en iframe está deshabilitada deliberadamente por las cabeceras de seguridad porque el alcance final solicita redirección. No hay que copiar el servidor ni la base de datos a Elementor.
