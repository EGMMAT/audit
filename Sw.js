/* Service Worker for 內稽工具 (audit_tool.html)
   ============================================
   Deployment: this file MUST sit in the same folder as audit_tool.html. The browser only allows
   a service worker to control requests within its own folder and below (its "scope"), so if this
   file is uploaded to a different path than the HTML, registration will still succeed but caching
   will not actually intercept the HTML's own requests.

   What this does: on first successful online visit, caches audit_tool.html itself (there is
   nothing else to cache — JSZip and all styles/scripts are already inlined in the single HTML
   file, and the tool makes no other network requests). On every subsequent visit — online or
   offline — requests for the HTML are served from that cache first, so the tool keeps working
   with no network connection.

   What this does NOT do: it does not cache or sync any of the person's audit data. All project
   data (vessel info, findings, photos) lives in localStorage/sessionStorage inside the page itself,
   which is completely separate from this cache and is unaffected by anything below.

   Known iOS limitation (informational, not fixable here): Safari's Intelligent Tracking Prevention
   (ITP) may clear this cache (and the service worker registration itself) if the tool has not been
   opened in about a week. This does not delete any saved project data (localStorage is governed by
   a separate, more permissive policy) — it only means offline mode needs one more online visit to
   re-establish itself after a long gap.
*/

const CACHE_VERSION = 'audit-tool-v1';
const CACHE_NAME = `audit-tool-cache-${CACHE_VERSION}`;

// Cache relative to this file's own folder, so it works regardless of what sub-path the tool is
// deployed under (e.g. https://egmmat.github.io/audit/audit_tool.html).
const APP_SHELL = [
  './audit_tool.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name.startsWith('audit-tool-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin navigation/HTML — anything else (there shouldn't be
  // much else, since the tool has no other network calls) is left to the network as normal.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      // Cache-first: serve immediately from cache if we have it (works offline), but also kick off
      // a background fetch to refresh the cache for next time, so deployed updates are eventually
      // picked up without the person having to do anything beyond a normal reload.
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null); // offline: no network response, that's fine if we have a cached one

      return cached || networkFetch;
    })
  );
});
