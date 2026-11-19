# ECOH Ambiental

Aplicación web para aprender a separar residuos y cuidar el ambiente en Bolivia y Guatemala. Reconstruida a partir de los materiales autorizados del proyecto Android original.

**Estado: versión 0.1 para revisión. No está publicada como servicio al público.** Incluye interfaz, servidor, almacenamiento persistente, pruebas y recursos originales. El correo real y el alojamiento deben configurarse antes del lanzamiento.

## Incluye

- Entrada de menores sin cuenta ni perfil personal. Conteo agregado de sesiones por día y país, no menores únicos.
- Registro de adultos por correo verificado, sesiones recordadas, rango de edad y datos demográficos opcionales.
- Doce fichas educativas, 72 objetos ilustrados y tres retos adaptados a cada país.
- Seis preguntas de derechos y deberes, incluidas preguntas de selección múltiple.
- Playlist indicada por el responsable, cargada solo al elegir reproducir.
- Noticias con borrador/publicación, resumen propio y enlace a la fuente.
- Propuestas de lugares y contenedores, publicadas únicamente tras verificación del administrador.
- Estadísticas privadas de administración; exportación y eliminación de cuenta.
- Caché del núcleo educativo para volver a consultar materiales sin conexión tras una primera carga completa.

No se incluyen noticias ni ubicaciones inventadas. No se reutilizan claves ni bases de datos del servidor anterior.

## Probar en tu computadora

Requisito: **Node.js 24 LTS**. No hay paquetes externos que instalar.

```sh
node --version
node server.mjs
```

Abre `http://127.0.0.1:4173`. Para una primera revisión visual elige **«Soy menor de 18 años»**: es la entrada de visitante, sin formulario de registro. No se interpreta como verificación real de edad.

Los datos locales se guardan en `.runtime/`, excluido de Git. No uses datos reales al hacer pruebas de desarrollo.

### Probar una cuenta de adulto

1. Elige «Tengo 18 años o más» y «Crear una cuenta».
2. Usa un correo de prueba, por ejemplo `revisor@example.test`.
3. En modo local no se envía correo: abre el último JSON de `.runtime/outbox/` y copia su campo `link` al navegador.
4. Pulsa «Confirmar y entrar». El enlace vence en 15 minutos y funciona una sola vez.
5. Para convertir esa cuenta ya verificada en administrador, en otra terminal ejecuta:

```sh
node server.mjs --admin revisor@example.test
```

Recarga la página: aparecerá «Administración». Solo una persona con acceso al servidor puede asignar ese permiso; no existe un botón público para convertirse en administrador.

Los correos de desarrollo contienen enlaces privados de acceso. No los compartas ni subas `.runtime` al repositorio.

## Pruebas

```sh
node --test tests/*.test.mjs
node --check server.mjs
node --check public/app.js
```

Las pruebas crean sus datos sintéticos en carpetas temporales y los eliminan al terminar. Cubren aislamiento de menores, verificación de correo, CSRF, roles, moderación, noticias, progreso, eliminación y persistencia, además de las reglas de los juegos y la integridad de recursos.

## Organización

```text
public/                 Interfaz y recursos públicos
  app.js                Pantallas e interacciones
  game.js               Reglas de juego verificables
  styles.css            Diseño adaptable
  data/content.json     Fichas, preguntas, instituciones y playlist
  assets/original/      Imágenes y audios originales
  sw.js                 Caché educativa; nunca guarda /api/
server.mjs              API, acceso, permisos y SQLite
tests/                  Pruebas automatizadas
docs/                   Diseño, arquitectura, revisión y publicación
.env.example            Variables de configuración, sin claves
```

## Diseño y edición

La [guía de diseño](docs/guia-diseno.md) indica qué debe preparar la diseñadora, nombres de archivos y tamaños. Los textos educativos se editan en `public/data/content.json`; las noticias se gestionan desde el panel administrativo. Cambiar una imagen conservando su ruta evita modificar las pantallas.

Las categorías reflejan el material ECOH, no un código de colores universal. Hay decisiones editoriales y referencias históricas pendientes de revisión en el JSON y en la guía. Comprueba la aceptación local de residuos y los vínculos institucionales antes de publicar.

## Publicar después de la revisión

El repositorio guarda el código. **GitHub Pages no ejecuta este servidor ni SQLite**: la app completa necesita un alojamiento compatible con Node 24, disco persistente y HTTPS. Elementor solo tendrá un botón que lleve a la URL final.

Consulta [publicación y operación](docs/publicacion.md). No se ha contratado alojamiento ni establecido una URL pública de la app.

## Alcance y límites

- El envío real de correo requiere configuración de un proveedor; el modo local guarda un buzón de prueba.
- La edad es autodeclarada; no se verifica documentalmente.
- Las puntuaciones son educativas, informadas por el cliente y acotadas por el servidor. No se ofrecen premios ni clasificaciones competitivas con garantía antifraude.
- YouTube y OpenStreetMap requieren conexión. No se ha confirmado la reproducción de todos los videos de la lista.
- La moderación es humana; aprobar un formulario no verifica automáticamente un lugar.
- Las fotografías de propuestas y un mapa con todos los marcadores simultáneos quedan para una ampliación; esta versión registra coordenadas y muestra el mapa de cada lugar aprobado.
- Se ha probado la interfaz en navegador de escritorio y viewport móvil; faltan pruebas en dispositivos Android/iPhone reales, entrega de correo en producción y despliegue con HTTPS.
- La instalación como PWA debe verificarse por navegador antes del lanzamiento. La preferencia de país se guarda localmente; la caché puede ser eliminada por el navegador.

## Consulta del código y autoría

Repositorio público para consulta. Los visitantes no tienen permiso de escritura sobre el repositorio original. No se concede aquí una licencia abierta adicional sobre el código o materiales de terceros. Conserva las atribuciones del proyecto original y verifica los derechos de redistribución de cada recurso antes de usos ajenos al proyecto. El responsable confirmó autorización para esta adaptación.

No subas contraseñas, claves, datos personales, correos de acceso ni copias de la base de datos. El repositorio incluye únicamente código, configuración de ejemplo, pruebas y recursos autorizados.
