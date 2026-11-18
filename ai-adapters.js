/** Adaptadores deliberadamente pequeños: sin dependencias ni descarga de modelos. */
export async function analyzeImage(blob) {
  // Un modelo local ligero puede exponerse como globalThis.MiniVisionModel.analyze(blob).
  // Si no está instalado, solo se muestran metadatos: no se simula comprensión visual.
  if (globalThis.MiniVisionModel && typeof globalThis.MiniVisionModel.analyze === 'function') {
    return globalThis.MiniVisionModel.analyze(blob);
  }
  const dimensions = await getImageDimensions(blob);
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));
  return { summary: `Análisis local básico: ${dimensions.width} × ${dimensions.height} px · ${blob.type || 'imagen'} · ${sizeKb} KB. No hay un modelo visual local conectado, así que no se ha interpretado el contenido.` };
}
function getImageDimensions(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
    image.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    image.src = url;
  });
}
export async function requestGeneration(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`El servidor privado respondió con ${response.status}.`);
  const data = await response.json();
  if (typeof data.text !== 'string') throw new Error('Respuesta inválida: se esperaba un campo “text”.');
  return data.text;
}
