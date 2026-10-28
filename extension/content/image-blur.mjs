const THRESHOLD = { LOW: .85, MEDIUM: .70, HIGH: .50 };
const RADIUS = { LOW: 8, MEDIUM: 16, HIGH: 24 };
const fingerprint = image => [image.currentSrc, image.src, image.srcset, image.sizes, image.naturalWidth, image.naturalHeight].join('|');

// classify(canvas) must be supplied by a packaged, version-pinned local model adapter.
// No model, pixel, image URL or classifier output is sent over the network here.
export class ImageBlur {
  constructor(document, classify, onResult = () => {}) {
    this.document = document; this.classify = classify; this.onResult = onResult;
    this.items = new Map(); this.queue = []; this.active = false; this.epoch = 0;
    this.onLoad = event => { if (event.target.tagName === 'IMG') this.discover(event.target, true); };
  }
  start(policy) {
    if (this.active) throw Error('BLUR_ALREADY_ACTIVE');
    if (!(policy.sensitivity in THRESHOLD) || !(policy.strength in RADIUS)) throw Error('INVALID_BLUR_PROFILE');
    this.policy = { ...policy }; this.active = true; this.epoch++;
    this.observer = new this.document.defaultView.MutationObserver(() => this.scan());
    this.observer.observe(this.document.documentElement, {subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','sizes']});
    this.document.addEventListener('load', this.onLoad, true);
    this.scan();
  }
  scan() {
    if (!this.active) return;
    for (const [image, state] of this.items) if (!image.isConnected) {
      this.restore(image, state); this.items.delete(image);
    }
    this.document.querySelectorAll('img').forEach(image => this.discover(image));
  }
  discover(image, loaded = false) {
    if (!this.active || !image.isConnected) return;
    const key = fingerprint(image), old = this.items.get(image);
    if (old && old.key === key && !loaded) return;
    if (old) this.restore(image, old);
    const state = { key, filter: image.style.getPropertyValue('filter'), priority: image.style.getPropertyPriority('filter'),
      status:'PENDING', revealed:false };
    state.click = event => {
      if (state.status === 'SAFE') return;
      event.preventDefault(); event.stopImmediatePropagation();
      state.revealed = !state.revealed;
      this.paint(image, state); this.report(state);
    };
    this.items.set(image,state);
    image.addEventListener('click',state.click,true);
    this.paint(image,state);
    const source = image.currentSrc || image.src;
    let raster = /^data:image\/(?:png|jpeg|webp|gif);/i.test(source);
    try { raster ||= /\.(?:png|jpe?g|webp|gif)$/i.test(new URL(source).pathname); } catch { /* unsupported URL */ }
    if (!raster) { state.status = 'UNSUPPORTED'; this.report(state); return; }
    if (this.queue.length >= 100) { state.status = 'UNANALYZED'; this.report(state); return; }
    this.queue.push({image,state});
    // Batch discovery so visible images can be selected before offscreen work.
    queueMicrotask(() => this.drain());
  }
  paint(image,state) {
    if (state.revealed || state.status === 'SAFE') {
      if (image.style.getPropertyValue('filter') === state.ownedFilter && image.style.getPropertyPriority('filter') === 'important') {
        if (state.filter) image.style.setProperty('filter',state.filter,state.priority);
        else image.style.removeProperty('filter');
      }
    } else {
      state.ownedFilter = (state.filter ? state.filter + ' ' : '') + `blur(${RADIUS[this.policy.strength]}px)`;
      image.style.setProperty('filter',state.ownedFilter,'important');
    }
  }
  report(state) { this.onResult({status:state.status,revealed:state.revealed}); }
  async drain() {
    if (this.busy || !this.active) return;
    this.busy = true;
    const epoch = this.epoch;
    try {
      while (this.active && epoch === this.epoch && this.queue.length) {
        this.queue.sort((a,b) => Number(this.visible(b.image))-Number(this.visible(a.image)));
        const {image,state} = this.queue.shift();
        if (this.items.get(image) !== state || !image.isConnected) continue;
        try {
          if (!this.classify) throw Error('MODEL_UNAVAILABLE');
          await image.decode();
          if (this.items.get(image) !== state || state.key !== fingerprint(image)) continue;
          const canvas = this.document.createElement('canvas');
          const scale = Math.min(1,512 / Math.max(image.naturalWidth,image.naturalHeight));
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d', {willReadFrequently:true});
          context.drawImage(image,0,0,canvas.width,canvas.height);
          context.getImageData(0,0,1,1); // Unreadable cross-origin pixels never become SAFE.
          const probabilities = await this.classify(canvas);
          if (!['Porn','Hentai'].every(name => Number.isFinite(probabilities?.[name]) && probabilities[name]>=0 && probabilities[name]<=1))
            throw Error('INVALID_CLASSIFICATION');
          state.status = Math.max(probabilities.Porn,probabilities.Hentai) >= THRESHOLD[this.policy.sensitivity] ? 'BLURRED' : 'SAFE';
        } catch { state.status = 'FAILED'; }
        if (this.active && epoch === this.epoch && this.items.get(image) === state && state.key === fingerprint(image)) {
          this.paint(image,state); this.report(state);
        }
      }
    } finally {
      this.busy = false;
      if (this.active && this.queue.length) queueMicrotask(() => this.drain());
    }
  }
  visible(image) {
    const rect = image.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < this.document.defaultView.innerHeight && rect.right > 0 && rect.left < this.document.defaultView.innerWidth;
  }
  restore(image,state) {
    image.removeEventListener('click',state.click,true);
    state.revealed = true; this.paint(image,state);
  }
  release() {
    this.active = false; this.epoch++; this.observer?.disconnect();
    this.document.removeEventListener('load',this.onLoad,true);
    this.queue = [];
    let confirmed = true;
    for (const [image,state] of this.items) {
      try { this.restore(image,state); this.items.delete(image); } catch { confirmed = false; }
    }
    return confirmed;
  }
}
