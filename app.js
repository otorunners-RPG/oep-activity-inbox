let deferredInstallPrompt = null;

async function registerServiceWorker() {
  const statusEl = document.querySelector("#swStatus");

  if (!("serviceWorker" in navigator)) {
    if (statusEl) statusEl.textContent = "NOT SUPPORTED";
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./"
    });

    await navigator.serviceWorker.ready;

    if (statusEl) statusEl.textContent = "ACTIVE";
    console.log("OEP service worker ready:", registration.scope);

  } catch (error) {
    if (statusEl) statusEl.textContent = "ERROR";
    console.error("Service Worker registration failed:", error);
  }
}

function updateDisplayMode() {
  const el = document.querySelector("#displayMode");
  if (!el) return;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  el.textContent = standalone ? "INSTALLED / STANDALONE" : "BROWSER";

  const installButton = document.querySelector("#installButton");
  if (installButton && standalone) {
    installButton.hidden = true;
  }
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;

  const button = document.querySelector("#installButton");
  if (button) button.hidden = false;
});

async function installPwa() {
  if (!deferredInstallPrompt) {
    alert(
      "Jika tombol install native belum tersedia, gunakan menu Chrome → Add to Home screen / Install app."
    );
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;

  const button = document.querySelector("#installButton");
  if (button) button.hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  updateDisplayMode();

  const installButton = document.querySelector("#installButton");
  if (installButton) {
    installButton.addEventListener("click", installPwa);
  }
});
