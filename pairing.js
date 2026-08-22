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
