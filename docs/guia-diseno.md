# Guía de imágenes y contenidos para la diseñadora

ECOH Ambiental · primera versión web para revisión

La identidad y los recursos del proyecto Android se han conservado. Los archivos originales de Drive no se modificaron. La interfaz debe poder crecer sin que sea necesario volver a programar cada imagen.

## Dónde están las imágenes

- `public/assets/original/`: 128 recursos recuperados del proyecto, incluidos imágenes y audios.
- `public/data/content.json`: textos, categorías, preguntas, instituciones y las rutas de sus imágenes.
- `public/data/assets-manifest.json`: procedencia de cada archivo, tamaño, dimensiones de imágenes y huella SHA-256 para comprobar integridad.

Los archivos son originales. Se verificó que todos los archivos referenciados por el contenido existen y que las 124 imágenes pueden abrirse. Los cuatro MP3 se copiaron con el tamaño original; no se ha evaluado su calidad sonora.

## Qué puede cambiarse

| Elemento | Recursos actuales | Entrega sugerida para rediseño | Consideraciones |
|---|---|---|---|
| Marca e icono | `ic_launcher_ecoh.png`, `proyecto_ecoh.png` | Logo SVG y PNG transparente; icono cuadrado de 512×512 y 192×192 | Conservar nombre ECOH Ambiental. El SVG debe ser estático y sin scripts. Preparar versión legible sobre fondo claro y oscuro |
| Presentación del proyecto | `begin_project_ecoh.png` | Ilustración adaptable, aproximadamente 1600×1000 | No incrustar párrafos de texto: el texto web debe ser seleccionable y legible en móvil |
| Objetos de los juegos | `bo_*_obj1…6.png`, `gu_*_obj1…6.png` | 72 ilustraciones cuadradas de 512×512, PNG transparente | Seis objetos por categoría y seis categorías por país. Mantener la identidad del objeto; si se cambia, actualizar también nombre accesible y respuesta |
| Contenedores | `game_img_garbage_<color>.png` | 9 ilustraciones coherentes, lienzo de 512×640 o cuadrado con margen | No depender solo del color: acompañar cada contenedor con nombre de material y etiqueta visible |
| Derechos y deberes | `rights_derechos_prgunta11…63` | 18 ilustraciones, idealmente 800×600 | Cada grupo de tres corresponde a una pregunta. Conservar el sentido de las opciones y las respuestas correctas |
| Ilustraciones introductorias | `rights_caratula`, `rights_earth_whats`, `rights_earth_deberes`, `rights_learning`, `rights_fisnish` | Ilustraciones sin texto, dimensiones acordes a su uso | No es necesario usarlas todas en la nueva interfaz |
| Instituciones | `logo_*` y `proyecto_ecoh.png` | Logos oficiales preferentemente SVG, o PNG transparente de 600 px de ancho | Mantener proporciones, colores y áreas de respeto. Revisar vigencia con el responsable antes de publicar |
| Sonidos | `sonido_buena`, `sonido_mala`, `sonido_gano`, `sonido_perdio` | MP3 cortos, volumen coherente | La experiencia debe funcionar con sonido desactivado y ofrecer control de silencio |

Las dimensiones sugeridas son recomendaciones para nuevos archivos, no requisitos de los originales. Evitar ampliar una imagen pequeña hasta que se vea borrosa. Conservar editables de diseño fuera de la carpeta pública y exportar solo lo que utilice la aplicación.

## Clasificación usada en los juegos

| País | Color en el material original | Categoría educativa |
|---|---|---|
| Bolivia | Negro | Eléctricos y electrónicos |
| Bolivia | Amarillo | Plásticos |
| Bolivia | Verde | Orgánicos |
| Bolivia | Plateado | Vidrio |
| Bolivia | Rojo | Residuos sanitarios y peligrosos |
| Bolivia | Azul | Papel y cartón |
| Guatemala | Amarillo | Papel y cartón |
| Guatemala | Azul | Plásticos |
| Guatemala | Rojo | Eléctricos y peligrosos |
| Guatemala | Celeste | Vidrio |
| Guatemala | Naranja | Envases multicapa |
| Guatemala | Negro | Metales |

Esta tabla refleja la clasificación educativa del proyecto original. No acredita que todos los municipios de esos países apliquen esos colores. El usuario debe confirmar los materiales aceptados por cada punto de recolección.

Existen seis imágenes adicionales `bo_gray_obj*` que no utiliza el mapa vigente de los juegos. Se han conservado por procedencia, pero no deben añadirse automáticamente como una séptima categoría.

## Cómo sustituir un recurso

1. Preparar la nueva ilustración y revisar su correspondencia con el contenido.
2. Para una sustitución directa, conservar el nombre y la extensión del archivo. Si se usa otro nombre, actualizar su ruta en `public/data/content.json`.
3. Revisar el texto alternativo (`label`) si la identidad del objeto cambió. Un nombre como «imagen 1» no permite jugar mediante lector de pantalla.
4. Revisar el juego en móvil y escritorio, con ratón, tacto y teclado. Comprobar que no se recorta la parte que identifica el objeto.
5. Registrar la nueva autoría, licencia y procedencia. Si se reemplaza un original, actualizar su entrada del manifiesto para no atribuirle por error la huella del archivo anterior.

Los textos de botones, preguntas y explicaciones pertenecen al HTML y al catálogo de contenidos, no a las imágenes. Esto permite aumentar el tamaño de letra y mantiene la interfaz accesible.

## Revisión editorial pendiente

- La fuente Android contiene cifras ambientales sin referencias. Las descripciones de la primera versión evitan reproducirlas como hechos actuales y se centran en reconocer los materiales.
- Se retiró de las descripciones visibles la recomendación original de guardar pilas en una botella. El material nuevo remite a puntos de entrega autorizados sin instruir una manipulación potencialmente peligrosa.
- En Guatemala, el texto original agrupa latas y multicapa en naranja, mientras que las ilustraciones del juego asignan latas a negro. Se ha seguido el mapa visual del juego: negro/metales y naranja/multicapa. Esta decisión requiere revisión educativa antes de publicación.
- Los residuos orgánicos del juego incluyen carne y pescado. No se presentan como instrucciones para compostaje doméstico.
- Las preguntas de derechos 2 y 3 tienen varias respuestas correctas. La interfaz debe permitir seleccionar todas y comprobar el conjunto.
- Se corrigió una opción textual ambigua: «No, tienen la obligación» pasa a «No, no tienen esa obligación».
- Los textos institucionales proceden de la versión histórica. No se ha validado que sus cargos, vínculos o descripciones sigan vigentes.

El catálogo completo de estas observaciones está en `editorialNotes` de `content.json`. La fuente original sigue enlazada para comparar. La autorización declarada por el responsable permite preparar el proyecto, pero no sustituye el registro de atribuciones y permisos de nuevos materiales de terceros.

## Cobertura de los contenidos

- 12 fichas educativas: seis por país.
- 72 objetos de juego con nombres accesibles asignados tras inspección visual.
- Seis preguntas de derechos/deberes, con 18 opciones y sus imágenes.
- 12 instituciones o proyectos con texto, logo y enlace de la fuente original.
- Cuatro audios y nueve contenedores de colores.
- Playlist facilitada por el usuario, sin inventar títulos ni videos que no se han podido comprobar.
- No se incorporaron noticias ni ubicaciones ficticias para rellenar pantallas.
