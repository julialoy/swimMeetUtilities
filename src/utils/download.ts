/** Triggers a browser download of the given PDF bytes under `fileName`. */
export function triggerDownload(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
