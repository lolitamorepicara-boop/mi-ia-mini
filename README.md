# MI IA MINI

PWA estática en español para Android, pensada para tabletas con recursos limitados. No depende de servicios externos: el chat y la biblioteca son locales; no se ejecutan modelos grandes. La generación/edición solo se conecta a un endpoint que la persona configura y solicita expresamente.

## Archivos

- `index.html`: estructura de chat, biblioteca y ajustes.
- `styles.css`: tema oscuro adaptable a móvil/tablet. Si no hay Internet, usa la tipografía de sistema como alternativa; el diseño no depende de la fuente remota.
- `app.js`: interacción, navegación, chat local, carga de fotos, ajustes e instalación.
- `db.js`: persistencia local en IndexedDB (mensajes, fotos y preferencias).
- `ai-adapters.js`: contrato de análisis visual local y cliente opcional de servidor privado. Sin modelo local conectado, solo reporta metadatos de imagen.
- `manifest.webmanifest` e `icons/icon.svg`: metadatos e icono de la PWA.
- `sw.js`: precache del shell para abrir la app sin conexión después de la primera visita.

## Ejecutar y probar

Los service workers requieren `localhost` o HTTPS; no abras `index.html` con `file://`.

1. Descarga/clona el repositorio y ejecuta desde su carpeta:
   - Python: `python -m http.server 8080`
   - o Node: `npx serve .`
2. En un navegador de escritorio abre `http://localhost:8080`. Para probar en la Redmi Pad 2, publica el sitio en HTTPS (por ejemplo, GitHub Pages) o sirve el proyecto desde una máquina de la misma red mediante HTTPS; `localhost` del PC no es el localhost de la tablet.
3. Prueba el chat: envía un mensaje, recarga y comprueba que persiste. “Nuevo chat” limpia la conversación.
4. Ve a “Mi biblioteca”, añade una foto y prueba “Analizar” y “Eliminar”. El análisis inicial informa tamaño/dimensiones y no pretende reconocer el contenido.
5. En ajustes desactiva el guardado de fotos, vuelve a añadir una imagen y comprueba que no se incorpora a la biblioteca. Desactiva “Guardar conversaciones” y comprueba que los nuevos mensajes no persisten.
6. Con conexión, abre una vez la app. Luego activa modo avión y recarga: el shell debe abrir y el chat/biblioteca local seguir disponibles.
7. En Chrome Android, abre el menú ⋮ → “Instalar aplicación”/“Añadir a pantalla de inicio”. El botón “Instalar” de la cabecera aparece cuando el navegador ofrece el evento de instalación. Se requiere HTTPS (o localhost).
8. Revisa almacenamiento y service worker en DevTools → Application. “Borrar todos mis datos” borra la base de IndexedDB de esta app.

## Conectar un modelo o servidor privado (opcional)

- **Modelo visual ligero local:** adapta `globalThis.MiniVisionModel.analyze(blob)` para devolver una promesa con `{ summary: '...' }`. Carga el adaptador local desde el mismo origen; no descargues ni ejecutes modelos pesados en la tablet. Mantén el modelo opcional y verifica el consumo de memoria antes de habilitarlo en dispositivos de 4 GB.
- **Servidor de generación/edición:** configura en Ajustes una URL privada HTTPS. `generatePrivately(action, prompt, imageBlob)` en `app.js` muestra una confirmación antes de enviar y llama a `ai-adapters.js`. El servidor debe aceptar JSON `{ action, prompt, image?: { dataUrl, type } }` y devolver JSON `{ text }`. Configura CORS en el servidor si su origen difiere. No hay llamadas de red al dejar vacía la URL.
- Para conectar acciones a botones de UI, invoca `generatePrivately('generate', prompt)` o `generatePrivately('edit', prompt, blob)` desde una acción explícita; maneja errores con un mensaje visible. No conectes el envío al selector de archivos ni al render de la biblioteca.

## Consideraciones

IndexedDB y el caché del navegador no son cifrado de extremo a extremo; protege el dispositivo y evita guardar fotos sensibles en dispositivos compartidos. El almacenamiento puede ser eliminado por el navegador si el dispositivo está bajo presión de espacio. No se solicitan permisos innecesarios. El endpoint configurado debe ser de confianza.
