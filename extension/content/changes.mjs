// Own only the properties we change; preserve unrelated and later page changes.
export class Changes {
  #entries = new Map();
  hide(element) {
    let entry = this.#entries.get(element);
    if (!entry) {
      entry = { display: element.style.getPropertyValue('display'),
        priority: element.style.getPropertyPriority('display'), inert: element.inert };
      this.#entries.set(element, entry);
    } else if (element.style.getPropertyValue('display') !== 'none' ||
               element.style.getPropertyPriority('display') !== 'important') {
      entry.display = element.style.getPropertyValue('display');
      entry.priority = element.style.getPropertyPriority('display');
    }
    element.style.setProperty('display', 'none', 'important');
    element.inert = true;
    return element.ownerDocument.defaultView.getComputedStyle(element).display === 'none' && element.inert;
  }
  restore() {
    let confirmed = true;
    for (const [element, entry] of this.#entries) {
      try {
        if (element.style.getPropertyValue('display') === 'none' &&
            element.style.getPropertyPriority('display') === 'important') {
          if (entry.display) element.style.setProperty('display', entry.display, entry.priority);
          else element.style.removeProperty('display');
        }
        if (element.inert === true) element.inert = entry.inert;
        this.#entries.delete(element);
      } catch { confirmed = false; }
    }
    return confirmed;
  }
}
