const OEP_SUBMISSION_CONFIG = {
  VERSION: "11.2D",

  // Current Apps Script Web App endpoint.
  ENDPOINT:
    "https://script.google.com/macros/s/AKfycbxHBw2BlpR6UdZrUAggLWmUN2SIaw8vIUNK9Rf_ckCm8vXOm0ksYlXgbOep5TLmMamqmA/exec",

  SOURCE: "STRAVA_ANDROID_SHARE"
};


function extractStravaActivityUrl(sharedText) {
  const text = String(sharedText || "");

  const match =
    text.match(
      /https:\/\/(?:www\.)?strava\.com\/activities\/\d+[^\s]*/i
    );

  return match ? match[0] : "";
}


async function submitConfirmedActivity(
  extractionResult,
  sharedText
) {

  if (
    !extractionResult ||
    !extractionResult.validation ||
    extractionResult.validation.status !== "MATCHED"
  ) {
    throw new Error(
      "Only MATCHED activity can be submitted."
    );
  }


  const participantCode =
    getPairedParticipantCode();

  if (!participantCode) {
    throw new Error(
      "DEVICE_NOT_PAIRED"
    );
  }


  const body =
    new URLSearchParams();


  body.set(
    "participantCode",
    participantCode
  );

  body.set(
    "source",
    OEP_SUBMISSION_CONFIG.SOURCE
  );

  body.set(
    "payloadType",
    "STRUCTURED_ACTIVITY"
  );

  body.set(
    "sportType",
    extractionResult.sportType || ""
  );

  body.set(
    "distanceKm",
    String(
      extractionResult.distanceKm ?? ""
    )
  );

  body.set(
    "durationSec",
    String(
      extractionResult.durationSec ?? ""
    )
  );

  body.set(
    "paceSecPerKm",
    String(
      extractionResult.paceSec ?? ""
    )
  );

  body.set(
    "validationStatus",
    extractionResult.validation.status
  );

  body.set(
    "sourceUrl",
    extractStravaActivityUrl(sharedText)
  );

  body.set(
    "sourceText",
    String(sharedText || "")
  );

  body.set(
    "notes",
    "Checkpoint 11.2D Android POC"
  );


  /*
   * GitHub Pages -> Apps Script is cross-origin.
   *
   * We deliberately use:
   * - application/x-www-form-urlencoded
   * - mode: no-cors
   *
   * so the browser can send a simple POST without CORS preflight.
   *
   * The response is intentionally opaque in this POC.
   * Success is verified by checking ACTIVITY_INBOX in Google Sheet.
   */
  await fetch(
    OEP_SUBMISSION_CONFIG.ENDPOINT,
    {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: body.toString()
    }
  );


  return {
    sent: true,
    participantCode:
      participantCode,
    source:
      OEP_SUBMISSION_CONFIG.SOURCE
  };
}
