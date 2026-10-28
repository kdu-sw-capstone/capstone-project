// Own only the properties we change; preserve unrelated and later page changes.
export class Changes {
  #entries = new Map();
  hide(element) {
    let entry = this.#entries.get(element);
    if (!entry) {
      entry = { display: element.style.getPropertyValue('display'),
        priority: element.style.getPropertyPriority('display'), inert: element.inert };
      this.#entries.set(element, entry);
    } else {
      if (element.style.getPropertyValue('display') !== 'none' ||
          element.style.getPropertyPriority('display') !== 'important') {
        entry.display = element.style.getPropertyValue('display');
        entry.priority = element.style.getPropertyPriority('display');
      }
      // We write true. A later false is a page change, not our owned value.
      // Preserve it before the observer re-applies the restriction.
      if (element.inert !== true) entry.inert = element.inert;
    }
    element.style.setProperty('display', 'none', 'important');
    element.inert = true;
    return element.ownerDocument.defaultView.getComputedStyle(element).display === 'none' && element.inert;
  }
  get size() { return this.#entries.size; }
  snapshot() { return [...this.#entries].map(([element, original])=>({element,...original})); }
  restore() {
    let confirmed = true;
    for (const [element, entry] of this.#entries) {
      try {
        const ownedDisplay=element.style.getPropertyValue('display')==='none' && element.style.getPropertyPriority('display')==='important';
        const expectedDisplay=ownedDisplay?entry.display:element.style.getPropertyValue('display');
        const expectedPriority=ownedDisplay?entry.priority:element.style.getPropertyPriority('display');
        const expectedInert=element.inert===true?entry.inert:element.inert;
        if (element.style.getPropertyValue('display') === 'none' &&
            element.style.getPropertyPriority('display') === 'important') {
          if (entry.display) element.style.setProperty('display', entry.display, entry.priority);
          else element.style.removeProperty('display');
        }
        if (element.inert === true) element.inert = entry.inert;
        if(element.style.getPropertyValue('display')!==expectedDisplay || element.style.getPropertyPriority('display')!==expectedPriority || element.inert!==expectedInert){confirmed=false;continue;}
        this.#entries.delete(element);
      } catch { confirmed = false; }
    }
    return confirmed;
  }
}
