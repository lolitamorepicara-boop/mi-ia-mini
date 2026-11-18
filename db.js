const DB_NAME = 'mi-ia-mini';
const DB_VERSION = 1;
let databasePromise;

function openDatabase() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Este navegador no admite IndexedDB.'));
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('photos')) {
        const store = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la base local.'));
    request.onblocked = () => reject(new Error('Cierra otras pestañas de MI IA MINI y vuelve a intentarlo.'));
  });
  return databasePromise;
}
function run(storeName, mode, action) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error de almacenamiento local.'));
    transaction.onabort = () => reject(transaction.error || new Error('La operación local se canceló.'));
  }));
}
export function addPhoto(photo) { return run('photos', 'readwrite', (store) => store.add(photo)); }
export function deletePhoto(id) { return run('photos', 'readwrite', (store) => store.delete(id)); }
export function getPhotos() { return run('photos', 'readonly', (store) => store.getAll()).then((items) => items.sort((a, b) => b.createdAt - a.createdAt)); }
export function saveMessage(message) { return run('messages', 'readwrite', (store) => store.add(message)); }
export function getRecentMessages(limit = 100) { return run('messages', 'readonly', (store) => store.getAll()).then((items) => items.sort((a, b) => a.createdAt - b.createdAt).slice(-limit)); }
export function getAll(storeName) { return run(storeName, 'readonly', (store) => store.getAll()); }
export function getPreference(key, fallback = null) {
  return run('preferences', 'readonly', (store) => store.get(key)).then((record) => record ? record.value : fallback);
}
export function setPreference(key, value) { return run('preferences', 'readwrite', (store) => store.put({ key, value })); }
export async function clearAll(storeName = null) {
  const db = await openDatabase();
  const stores = storeName ? [storeName] : ['messages', 'photos', 'preferences'];
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, 'readwrite');
    stores.forEach((name) => transaction.objectStore(name).clear());
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('No se pudieron borrar los datos.'));
    transaction.onabort = () => reject(transaction.error || new Error('La operación se canceló.'));
  });
}
