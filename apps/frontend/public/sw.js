/**
 * Service Worker für Abu-Abbad PWA
 * 
 * Features:
 * - Offline-Fallback für kritische Routen
 * - Cache-Strategie: Network-First für API, Cache-First für Assets
 * - Background Sync für Nachrichten
 * - Push-Benachrichtigungen für Termine
 */

const CACHE_NAME = 'abu-abad-v1';
const RUNTIME_CACHE = 'abu-abad-runtime-v1';

// Kritische Offline-Ressourcen
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ══════════════════════════════════════════════════════════════
// INSTALLATION
// ══════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => self.skipWaiting()) // Aktiviere sofort
  );
});

// ══════════════════════════════════════════════════════════════
// AKTIVIERUNG
// ══════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Lösche alte Caches
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim()) // Übernehme Kontrolle
  );
});

// ══════════════════════════════════════════════════════════════
// FETCH (Cache-Strategie)
// ══════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignoriere Chrome Extension Requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // API-Requests: Network-First (mit Fallback)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // HTML-Seiten: Network-First (mit Offline-Fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }
  
  // Assets (JS, CSS, Images): Cache-First
  event.respondWith(cacheFirstStrategy(request));
});

// ══════════════════════════════════════════════════════════════
// CACHE STRATEGIEN
// ══════════════════════════════════════════════════════════════

/**
 * Network-First: Versuche Netzwerk, sonst Cache
 * Gut für: API-Requests, die aktuell sein müssen
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    // Speichere erfolgreiche Response im Cache
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, using cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Keine Cache-Response verfügbar
    return new Response(
      JSON.stringify({ error: 'Offline - Keine Verbindung zum Server' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Cache-First: Nutze Cache, sonst Netzwerk
 * Gut für: Statische Assets (JS, CSS, Images)
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Speichere im Cache für zukünftige Requests
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // Fallback für Images
    if (request.destination === 'image') {
      return caches.match('/icons/icon-192x192.png');
    }
    
    throw error;
  }
}

// ══════════════════════════════════════════════════════════════
// BACKGROUND SYNC (Nachrichten senden wenn offline)
// ══════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background Sync:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Hole ausstehende Nachrichten aus IndexedDB
  const db = await openMessagesDB();
  const pendingMessages = await db.getAll('pending');
  
  for (const message of pendingMessages) {
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      // Lösche nach erfolgreichem Senden
      await db.delete('pending', message.id);
    } catch (error) {
      console.error('[Service Worker] Failed to sync message:', error);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS (Termin-Erinnerungen)
// ══════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');
  
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Sie haben eine neue Nachricht',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    data: data
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Abu-Abbad', options)
  );
});

// ══════════════════════════════════════════════════════════════
// NOTIFICATION CLICK
// ══════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Fokussiere existierendes Fenster
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Öffne neues Fenster
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ══════════════════════════════════════════════════════════════
// HELPER: IndexedDB für ausstehende Nachrichten
// ══════════════════════════════════════════════════════════════
async function openMessagesDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('abu-abad-messages', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}
