const OEP_PAIRING_KEY = "oepParticipantCode";

function normalizeParticipantCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getPairedParticipantCode() {
  return normalizeParticipantCode(
    localStorage.getItem(OEP_PAIRING_KEY)
  );
}

function savePairedParticipantCode(value) {
  const participantCode =
    normalizeParticipantCode(value);

  if (!participantCode) {
    throw new Error(
      "Participant Code is required."
    );
  }

  localStorage.setItem(
    OEP_PAIRING_KEY,
    participantCode
  );

  return participantCode;
}

function clearPairedParticipantCode() {
  localStorage.removeItem(
    OEP_PAIRING_KEY
  );
}


const RPG_IPHONE_PAIRING_CONFIG = {
  ENDPOINT:
    "https://script.google.com/macros/s/AKfycbxHBw2BlpR6UdZrUAggLWmUN2SIaw8vIUNK9Rf_ckCm8vXOm0ksYlXgbOep5TLmMamqmA/exec"
};

async function createIphonePairingSetupCode(
  participantCode
) {
  const normalized =
    normalizeParticipantCode(
      participantCode
    );

  if (!normalized) {
    throw new Error(
      "Pair this device first."
    );
  }

  const url =
    RPG_IPHONE_PAIRING_CONFIG.ENDPOINT +
    "?action=createIphonePairingSetup" +
    "&participantCode=" +
    encodeURIComponent(normalized) +
    "&_=" +
    Date.now();

  const response =
    await fetch(
      url,
      {
        method: "GET",
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      "SETUP_REQUEST_FAILED"
    );
  }

  const data =
    await response.json();

  if (!data || data.success !== true) {
    const message =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "Unable to create iPhone Setup Code.";

    throw new Error(message);
  }

  return data;
}
