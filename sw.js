importScripts("./db.js");

const CACHE_NAME = "oep-activity-inbox-poc-v2";

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

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method === "POST" &&
    url.pathname.endsWith("/share-target")
  ) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method === "GET") {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request);
      })
    );
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();

    const title = String(formData.get("title") || "");
    const text = String(formData.get("text") || "");
    const sharedUrl = String(formData.get("url") || "");

    let file = formData.get("activityImage");

    // Some apps may not populate the exact expected file field.
    // Inspect all form values as a POC fallback and pick the first File.
    if (!(file instanceof File) || file.size === 0) {
      for (const value of formData.values()) {
        if (value instanceof File && value.size > 0) {
          file = value;
          break;
        }
      }
    }

    const hasFile = file instanceof File && file.size > 0;

    await saveLatestSharedPayload({
      receivedAt: new Date().toISOString(),
      title,
      text,
      url: sharedUrl,
      hasFile,
      fileName: hasFile ? file.name : "",
      mimeType: hasFile ? file.type : "",
      fileSize: hasFile ? file.size : 0,
      fileBlob: hasFile ? file : null
    });

    const redirectUrl = new URL(
      "./share.html?received=1",
      request.url
    ).href;

    return Response.redirect(redirectUrl, 303);

  } catch (error) {
    const redirectUrl = new URL(
      "./share.html?error=" +
        encodeURIComponent(error.message || "Unknown share error"),
      request.url
    ).href;

    return Response.redirect(redirectUrl, 303);
  }
}
