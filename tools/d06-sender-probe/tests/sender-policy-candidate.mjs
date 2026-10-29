// Isolated rule proposal only. Not imported by the probe or product receiver.
export function acceptsWorker(sender, runtime) {
  if (!sender || typeof sender !== 'object' || !runtime?.id) return false;
  if (!['id','url','origin'].every(key => Object.hasOwn(sender,key)
    && typeof sender[key] === 'string')) return false;
  const workerURL = runtime.getURL('worker.js');
  return sender.id === runtime.id && sender.url === workerURL
    && sender.origin === new URL(workerURL).origin && !Object.hasOwn(sender, 'tab');
}

// Trusted binding is supplied by the harness, never inferred from the message.
export function matchesBinding(message, trusted) {
  if (!message || !trusted || trusted.active !== true) return false;
  return ['tabId', 'frameId', 'documentId', 'instance'].every(key =>
    Object.hasOwn(message, key) && Object.hasOwn(trusted, key)
    && message[key] === trusted[key])
    && Number.isInteger(trusted.tabId) && trusted.tabId >= 0
    && trusted.frameId === 0
    && typeof trusted.documentId === 'string' && trusted.documentId.length > 0
    && typeof trusted.instance === 'string' && trusted.instance.length > 0;
}
