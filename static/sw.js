const CACHE_NAME = 'portal-abv-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/dashboard',
  '/static/style.css',
  '/static/script.js',
  '/static/assets/Logotipo_Horizontal_Branco.svg',
  'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@700&family=Roboto:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/aos@2.3.1/dist/aos.css',
  'https://unpkg.com/aos@2.3.1/dist/aos.js'
];

// Instalação: Cacheia os arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Fetch: Serve o cache se estiver offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});