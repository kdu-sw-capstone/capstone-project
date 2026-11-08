// A route candidate is not an access event. Core must verify explicit navigation,
// RUNNING, sender/tab/frame, owner and the common navigation_id before recording.
export function featureEntry(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (['youtube.com','www.youtube.com'].includes(url.hostname) && /^\/shorts(?:\/|$)/.test(url.pathname)) return 'YOUTUBE_SHORTS';
  if (['instagram.com','www.instagram.com'].includes(url.hostname) && /^\/reels?(?:\/|$)/.test(url.pathname)) return 'INSTAGRAM_REELS';
  return null;
}
