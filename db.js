const OEP_DB_NAME = "oep-activity-share-poc";
const OEP_DB_VERSION = 1;
const OEP_STORE_NAME = "sharedPayload";

function openOepDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OEP_DB_NAME, OEP_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OEP_STORE_NAME)) {
        db.createObjectStore(OEP_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLatestSharedPayload(payload) {
  const db = await openOepDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OEP_STORE_NAME, "readwrite");
    tx.objectStore(OEP_STORE_NAME).put({ id: "latest", ...payload });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      const err = tx.error;
      db.close();
      reject(err);
    };
  });
}

async function getLatestSharedPayload() {
  const db = await openOepDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OEP_STORE_NAME, "readonly");
    const request = tx.objectStore(OEP_STORE_NAME).get("latest");

    request.onsuccess = () => {
      const result = request.result || null;
      db.close();
      resolve(result);
    };

    request.onerror = () => {
      const err = request.error;
      db.close();
      reject(err);
    };
  });
}

async function clearLatestSharedPayload() {
  const db = await openOepDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OEP_STORE_NAME, "readwrite");
    tx.objectStore(OEP_STORE_NAME).delete("latest");

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      const err = tx.error;
      db.close();
      reject(err);
    };
  });
}
