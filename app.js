import { addPhoto, clearAll, deletePhoto, getAll, getPreference, getPhotos, getRecentMessages, saveMessage, setPreference } from './db.js';
import { analyzeImage, requestGeneration } from './ai-adapters.js';

const $ = (selector) => document.querySelector(selector);
const chatMessages = $('#chat-messages');
const chatForm = $('#chat-form');
const messageInput = $('#message-input');
const photoInput = $('#photo-input');
const preview = $('#attachment-preview');
const toast = $('#toast');
let attachedFile = null;
let toastTimer;
let deferredInstallPrompt = null;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}
function formatTime(value = Date.now()) {
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(value);
}
function showWelcome() {
  chatMessages.innerHTML = '<div class="welcome-card"><div class="welcome-symbol">✦</div><h2>Un espacio solo para ti</h2><p>Puedo ayudarte a organizar ideas, guardar fotos y ofrecer un análisis básico sin conexión. Para respuestas de IA, conecta tu propio servidor privado en configuración.</p></div>';
}
function appendMessage(message) {
  const article = document.createElement('article');
  article.className = `message ${message.role === 'user' ? 'user' : 'assistant'}`;
  if (message.imageData) {
    const image = document.createElement('img');
    image.className = 'message-image';
    image.src = message.imageData;
    image.alt = message.imageName || 'Imagen adjunta';
    article.append(image);
  }
  const text = document.createElement('div');
  text.innerHTML = escapeText(message.text || '').replaceAll('\n', '<br>');
  article.append(text);
  const time = document.createElement('small');
  time.textContent = formatTime(message.createdAt);
  article.append(time);
  chatMessages.append(article);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
async function loadChat() {
  chatMessages.replaceChildren();
  const enabled = await getPreference('saveChat', true);
  const messages = enabled ? await getRecentMessages() : [];
  if (!messages.length) showWelcome();
  else messages.forEach(appendMessage);
}
async function storeAndShow(message) {
  if (await getPreference('saveChat', true)) await saveMessage(message);
  const welcome = chatMessages.querySelector('.welcome-card');
  welcome?.remove();
  appendMessage(message);
}
function localReply(text, hasImage) {
  if (hasImage) return 'He recibido la imagen. Puedo revisar sus propiedades localmente desde la biblioteca. Para una descripción visual con IA, conecta un modelo ligero compatible o un servidor privado; esta versión no ejecuta modelos pesados ni envía la foto.';
  if (/hola|buenas|hey/i.test(text)) return '¡Hola! Estoy aquí para ayudarte. Puedo guardar tus ideas en este dispositivo y funcionar sin conexión. ¿Qué te gustaría hacer?';
  return 'Tu mensaje quedó en este dispositivo. MI IA MINI funciona sin Internet; para obtener una respuesta generada por IA configura un endpoint privado en ⚙ Ajustes. No se contacta ningún servicio mientras no lo configures y lo solicites.';
}
async function imageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text && !attachedFile) return;
  const file = attachedFile;
  let imageData = '';
  if (file) {
    try { imageData = await imageAsDataUrl(file); }
    catch (error) { notify(error.message); return; }
  }
  const userMessage = { role: 'user', text, imageData, imageName: file?.name || '', createdAt: Date.now() };
  await storeAndShow(userMessage);
  messageInput.value = '';
  messageInput.style.height = 'auto';
  setAttachment(null);
  const response = { role: 'assistant', text: localReply(text, Boolean(file)), createdAt: Date.now() };
  await storeAndShow(response);
});
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 160)}px`;
});
function setAttachment(file) {
  attachedFile = file;
  preview.replaceChildren();
  preview.classList.toggle('hidden', !file);
  if (!file) return;
  const image = document.createElement('img');
  image.src = URL.createObjectURL(file);
  image.alt = file.name;
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Quitar imagen');
  close.addEventListener('click', () => { URL.revokeObjectURL(image.src); setAttachment(null); });
  preview.append(image, close);
}
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (file && !file.type.startsWith('image/')) { notify('Elige un archivo de imagen.'); photoInput.value = ''; return; }
  setAttachment(file || null);
});
$('#new-chat-button').addEventListener('click', async () => {
  if (await getPreference('saveChat', true) && !confirm('¿Borrar la conversación guardada en este dispositivo?')) return;
  await clearAll('messages');
  showWelcome();
  notify('Conversación nueva.');
});

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', async () => {
  const view = button.dataset.view;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.view').forEach((section) => { section.hidden = section.id !== `${view}-view`; section.classList.toggle('active', !section.hidden); });
  if (view === 'library') await renderLibrary();
}));

async function renderLibrary() {
  const grid = $('#photo-grid');
  grid.replaceChildren();
  const photos = await getPhotos();
  $('#photo-count').textContent = String(photos.length);
  $('#library-empty').classList.toggle('hidden', photos.length > 0);
  for (const photo of photos) {
    const card = document.createElement('article'); card.className = 'photo-card';
    const image = document.createElement('img'); image.src = URL.createObjectURL(photo.blob); image.alt = photo.name;
    image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
    const meta = document.createElement('div'); meta.className = 'photo-meta';
    const name = document.createElement('strong'); name.textContent = photo.name;
    const size = document.createElement('small'); size.textContent = `${(photo.blob.size / 1024).toFixed(0)} KB · ${formatTime(photo.createdAt)}`;
    const actions = document.createElement('div'); actions.className = 'photo-actions';
    const inspect = document.createElement('button'); inspect.type = 'button'; inspect.textContent = 'Analizar';
    inspect.addEventListener('click', async () => {
      try { const result = await analyzeImage(photo.blob); notify(result.summary); }
      catch { notify('No se pudo analizar esta imagen.'); }
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Eliminar';
    remove.addEventListener('click', async () => { if (!confirm(`¿Eliminar «${photo.name}» de la biblioteca?`)) return; await deletePhoto(photo.id); await renderLibrary(); notify('Foto eliminada del dispositivo.'); });
    actions.append(inspect, remove); meta.append(name, size, actions); card.append(image, meta); grid.append(card);
  }
}
async function saveSelectedPhotos(files) {
  const allowed = await getPreference('savePhotos', true);
  if (!allowed) { notify('Activa “Guardar fotos en biblioteca” en ajustes para guardarlas.'); return; }
  let saved = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try { await addPhoto({ name: file.name, type: file.type, blob: file, createdAt: Date.now() }); saved++; }
    catch { notify('No se pudo guardar. Puede que el almacenamiento esté lleno.'); break; }
  }
  await renderLibrary();
  if (saved) notify(`${saved} foto${saved === 1 ? '' : 's'} guardada${saved === 1 ? '' : 's'} localmente.`);
}
$('#library-input').addEventListener('change', async (event) => { await saveSelectedPhotos([...event.target.files]); event.target.value = ''; });

$('#settings-button').addEventListener('click', async () => {
  $('#save-chat-setting').checked = await getPreference('saveChat', true);
  $('#save-photos-setting').checked = await getPreference('savePhotos', true);
  $('#endpoint-input').value = await getPreference('privateEndpoint', '');
  $('#settings-dialog').showModal();
});
$('#save-settings-button').addEventListener('click', async () => {
  const endpoint = $('#endpoint-input').value.trim();
  if (endpoint) {
    try { const url = new URL(endpoint); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); }
    catch { $('#settings-feedback').textContent = 'Escribe una URL HTTP(S) válida o deja el campo vacío.'; return; }
    if (location.protocol === 'https:' && endpoint.startsWith('http:')) { $('#settings-feedback').textContent = 'Desde HTTPS solo se permiten endpoints HTTPS.'; return; }
  }
  await setPreference('saveChat', $('#save-chat-setting').checked);
  await setPreference('savePhotos', $('#save-photos-setting').checked);
  await setPreference('privateEndpoint', endpoint);
  $('#settings-feedback').textContent = 'Ajustes guardados en este dispositivo.';
  await loadChat();
});
$('#clear-data-button').addEventListener('click', async () => {
  if (!confirm('¿Borrar todos los mensajes, fotos y preferencias locales de MI IA MINI?')) return;
  await clearAll();
  $('#settings-feedback').textContent = 'Datos locales borrados.';
  await loadChat(); await renderLibrary();
});

async function updateConnection() {
  const status = $('#connection-status');
  const online = navigator.onLine;
  status.classList.toggle('offline', !online);
  status.innerHTML = `<span class="status-dot"></span>${online ? 'En línea' : 'Sin conexión'}`;
}
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; $('#install-button').classList.remove('hidden'); });
$('#install-button').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('#install-button').classList.add('hidden');
});

// Acciones explícitas de generación/edición disponibles para integraciones futuras.
// La UI no invoca este método automáticamente ni envía imágenes al abrirlas.
export async function generatePrivately(action, prompt, imageBlob = null) {
  const endpoint = await getPreference('privateEndpoint', '');
  if (!endpoint) throw new Error('Configura primero tu endpoint privado en Ajustes.');
  if (!confirm('Esta acción enviará el texto y, si se adjuntó, la imagen al endpoint privado que configuraste. ¿Continuar?')) return null;
  let image;
  if (imageBlob) image = { dataUrl: await imageAsDataUrl(imageBlob), type: imageBlob.type };
  return requestGeneration(endpoint, { action, prompt, image });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => notify('No se pudo activar el modo sin conexión.'));
}
await updateConnection();
await loadChat();
await renderLibrary();
