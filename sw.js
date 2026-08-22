importScripts("./db.js");

const CACHE_NAME = "oep-activity-inbox-poc-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./share.html",
  "./app.js",
  "./db.js",
  "./ocr.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


// ======================================================
// INSTALL
// ======================================================

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});


// ======================================================
// ACTIVATE
// Hapus cache versi lama
// ======================================================

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name =>
              name.startsWith("oep-activity-inbox-poc-") &&
              name !== CACHE_NAME
            )
            .map(name => caches.delete(name))
        );
      }),

      self.clients.claim()
    ])
  );
});


// ======================================================
// FETCH
// ======================================================

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);


  // ----------------------------------------------------
  // ANDROID WEB SHARE TARGET
  // ----------------------------------------------------

  if (
    request.method === "POST" &&
    url.pathname.endsWith("/share-target")
  ) {
    event.respondWith(
      handleShareTarget(request)
    );

    return;
  }


  // ----------------------------------------------------
  // HTML NAVIGATION
  // Network-first supaya update development cepat terbaca
  // ----------------------------------------------------

  if (
    request.method === "GET" &&
    request.mode === "navigate"
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {

          const responseClone =
            response.clone();

          caches
            .open(CACHE_NAME)
            .then(cache => {
              cache.put(
                request,
                responseClone
              );
            });

          return response;
        })
        .catch(() => {
          return caches
            .open(CACHE_NAME)
            .then(cache =>
              cache.match(request)
            );
        })
    );

    return;
  }


  // ----------------------------------------------------
  // STATIC ASSETS
  // Hanya baca cache versi aktif
  // ----------------------------------------------------

  if (
    request.method === "GET" &&
    url.origin === self.location.origin
  ) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then(async cache => {

          const cached =
            await cache.match(request);

          if (cached) {
            return cached;
          }

          const response =
            await fetch(request);

          if (
            response &&
            response.ok
          ) {
            cache.put(
              request,
              response.clone()
            );
          }

          return response;
        })
    );
  }
});


// ======================================================
// SHARE TARGET HANDLER
// ======================================================

async function handleShareTarget(
  request
) {

  try {

    const formData =
      await request.formData();

    const title =
      String(
        formData.get("title") || ""
      );

    const text =
      String(
        formData.get("text") || ""
      );

    const sharedUrl =
      String(
        formData.get("url") || ""
      );


    let file =
      formData.get(
        "activityImage"
      );


    // Strava / Android tertentu mungkin
    // menggunakan field file berbeda.
    if (
      !(file instanceof File) ||
      file.size === 0
    ) {

      for (
        const value
        of formData.values()
      ) {

        if (
          value instanceof File &&
          value.size > 0
        ) {
          file = value;
          break;
        }
      }
    }


    const hasFile =
      file instanceof File &&
      file.size > 0;


    await saveLatestSharedPayload({
      receivedAt:
        new Date().toISOString(),

      title: title,

      text: text,

      url: sharedUrl,

      hasFile: hasFile,

      fileName:
        hasFile
          ? file.name
          : "",

      mimeType:
        hasFile
          ? file.type
          : "",

      fileSize:
        hasFile
          ? file.size
          : 0,

      fileBlob:
        hasFile
          ? file
          : null
    });


    const redirectUrl =
      new URL(
        "./share.html?received=1",
        request.url
      ).href;


    return Response.redirect(
      redirectUrl,
      303
    );


  } catch (error) {

    const redirectUrl =
      new URL(
        "./share.html?error=" +
          encodeURIComponent(
            error.message ||
            "Unknown share error"
          ),
        request.url
      ).href;


    return Response.redirect(
      redirectUrl,
      303
    );
  }
}
