const CACHE_NAME = 'spiltag-inventario-v4';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo-spiltag.png',
  './icon-192.png',
  './icon-512.png'
];


// ======================================================
// INSTALAÇÃO
// Salva os arquivos principais para funcionamento offline
// ======================================================

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});


// ======================================================
// ATIVAÇÃO
// Remove versões antigas do cache
// ======================================================

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => {
        return Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});


// ======================================================
// REQUISIÇÕES
// ======================================================

self.addEventListener('fetch', event => {

  const request = event.request;


  // ----------------------------------------------------
  // POST
  // Nunca intercepta o envio para o banco de dados
  // A fila offline é controlada pelo index.html
  // ----------------------------------------------------

  if (request.method === 'POST') {
    return;
  }


  const url = new URL(request.url);


  // ----------------------------------------------------
  // GOOGLE APPS SCRIPT
  // Consultas ao banco devem sempre tentar a internet.
  // Não armazenamos respostas do banco no cache.
  // ----------------------------------------------------

  if (
    url.hostname === 'script.google.com' ||
    url.hostname === 'script.googleusercontent.com'
  ) {
    event.respondWith(
      fetch(request)
    );

    return;
  }


  // ----------------------------------------------------
  // NAVEGAÇÃO / INDEX
  //
  // Primeiro tenta buscar a versão mais recente.
  // Se estiver sem internet, abre a versão salva.
  // ----------------------------------------------------

  if (request.mode === 'navigate') {

    event.respondWith(

      fetch(request)

        .then(response => {

          const copia = response.clone();

          caches
            .open(CACHE_NAME)
            .then(cache => {
              cache.put('./index.html', copia);
            });

          return response;
        })

        .catch(() => {
          return caches.match('./index.html');
        })

    );

    return;
  }


  // ----------------------------------------------------
  // ARQUIVOS DO APLICATIVO
  //
  // Procura primeiro no cache.
  // Em segundo plano tenta atualizar o arquivo.
  // ----------------------------------------------------

  event.respondWith(

    caches.match(request)

      .then(cachedResponse => {

        const networkRequest = fetch(request)

          .then(networkResponse => {

            if (
              networkResponse &&
              networkResponse.status === 200
            ) {

              const copia = networkResponse.clone();

              caches
                .open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, copia);
                });

            }

            return networkResponse;
          });


        // Se já existe no cache, abre imediatamente.
        if (cachedResponse) {

          // Atualiza silenciosamente em segundo plano.
          event.waitUntil(
            networkRequest.catch(() => {})
          );

          return cachedResponse;
        }


        // Se não existe no cache, tenta internet.
        return networkRequest;

      })

      .catch(() => {

        // Último fallback para navegação
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }

        return new Response(
          'Recurso indisponível offline.',
          {
            status: 503,
            statusText: 'Offline'
          }
        );

      })

  );

});
