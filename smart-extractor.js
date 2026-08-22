let smartOcrWorker = null;

function setSmartStatus(message, type = "normal") {
  const el = document.querySelector("#smartStatus");
  if (!el) return;

  el.textContent = message;
  el.className =
    type === "ok"
      ? "smart-status ok"
      : type === "error"
        ? "smart-status error"
        : "smart-status";
}

function setSmartProgress(value) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));

  const bar = document.querySelector("#smartProgressBar");
  const label = document.querySelector("#smartProgressLabel");

  if (bar) bar.style.width = pct + "%";
  if (label) label.textContent = pct + "%";
}

async function getSmartWorker() {
  if (smartOcrWorker) return smartOcrWorker;

  if (!window.Tesseract) {
    throw new Error(
      "OCR engine belum termuat. Pastikan internet aktif lalu reload halaman."
    );
  }

  setSmartStatus("Preparing OCR engine...");
  setSmartProgress(1);

  smartOcrWorker = await Tesseract.createWorker("eng", 1, {
    logger: message => {
      if (message && typeof message.progress === "number") {
        setSmartProgress(message.progress * 100);
      }

      if (message && message.status) {
        setSmartStatus(
          String(message.status)
            .replaceAll("_", " ")
            .toUpperCase()
        );
      }
    }
  });

  await smartOcrWorker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: "6"
  });

  return smartOcrWorker;
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Activity image tidak dapat dibaca."));
    };

    image.src = objectUrl;
  });
}

function averageLuminance(image) {
  const canvas = document.createElement("canvas");
  const width = 64;
  const height = Math.max(64, Math.round((image.height / image.width) * width));

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height).data;

  let total = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    total += (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    count += 1;
  }

  return count ? total / count : 0;
}

function classifyLayout(image) {
  const luminance = averageLuminance(image);
  const ratio = image.height / image.width;

  if (luminance < 85) {
    return {
      name: ratio > 1.35 ? "BLACK_VERTICAL" : "BLACK_COMPACT",
      luminance
    };
  }

  return {
    name: "MAP_CARD",
    luminance
  };
}

function getRoi(layout, image) {
  if (layout.name === "MAP_CARD") {
    return {
      x: Math.round(image.width * 0.04),
      y: Math.round(image.height * 0.55),
      w: Math.round(image.width * 0.92),
      h: Math.round(image.height * 0.42)
    };
  }

  if (layout.name === "BLACK_VERTICAL") {
    return {
      x: Math.round(image.width * 0.08),
      y: Math.round(image.height * 0.08),
      w: Math.round(image.width * 0.84),
      h: Math.round(image.height * 0.58)
    };
  }

  return {
    x: Math.round(image.width * 0.05),
    y: Math.round(image.height * 0.12),
    w: Math.round(image.width * 0.90),
    h: Math.round(image.height * 0.65)
  };
}

function preprocessRoi(image, roi, layout) {
  const maxScale = 4;
  const targetWidth = 1600;

  const scale = Math.min(
    maxScale,
    Math.max(2, targetWidth / Math.max(roi.w, 1))
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(roi.w * scale));
  canvas.height = Math.max(1, Math.round(roi.h * scale));

  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    roi.x,
    roi.y,
    roi.w,
    roi.h,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const threshold =
    layout.name.startsWith("BLACK")
      ? 145
      : 175;

  for (let i = 0; i < data.length; i += 4) {
    const lum =
      (0.2126 * data[i]) +
      (0.7152 * data[i + 1]) +
      (0.0722 * data[i + 2]);

    // Normalize to black text on white background.
    const value = lum >= threshold ? 0 : 255;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDistance(text) {
  const cleaned = text
    .replace(/,/g, ".")
    .replace(/[Oo](?=\d)/g, "0");

  const candidates = [];

  const labelled =
    cleaned.match(
      /(?:distance|dist[a-z]*)[\s\S]{0,40}?(\d{1,3}(?:\.\d{1,2})?)\s*k[mn]/i
    );

  if (labelled) {
    candidates.push(Number(labelled[1]));
  }

  const genericMatches =
    [...cleaned.matchAll(/(\d{1,3}(?:\.\d{1,2})?)\s*k[mn]/gi)];

  for (const match of genericMatches) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && value < 1000) {
      candidates.push(value);
    }
  }

  return candidates.length ? candidates[0] : null;
}

function parsePace(text) {
  const cleaned = text.replace(/[Oo]/g, "0");

  const labelled =
    cleaned.match(
      /(?:pace|pac[e3])[\s\S]{0,35}?(\d{1,3})\s*[:;]\s*(\d{1,2})\s*(?:\/|\s)?\s*k[mn]/i
    );

  if (labelled) {
    return {
      min: Number(labelled[1]),
      sec: Number(labelled[2])
    };
  }

  const generic =
    cleaned.match(
      /(\d{1,3})\s*[:;]\s*(\d{1,2})\s*(?:\/|\s)?\s*k[mn]/i
    );

  if (!generic) return null;

  return {
    min: Number(generic[1]),
    sec: Number(generic[2])
  };
}

function parseDuration(text) {
  const cleaned = text
    .replace(/[Oo](?=\s*s|\d)/gi, "0")
    .replace(/\bl\b/gi, "1");

  let match =
    cleaned.match(
      /(?:time|duration)[\s\S]{0,35}?(\d{1,3})\s*m(?:in)?\s*(\d{1,2})?\s*s?/i
    );

  if (match) {
    return {
      hour: 0,
      min: Number(match[1]),
      sec: Number(match[2] || 0)
    };
  }

  match =
    cleaned.match(
      /(\d{1,3})\s*m(?:in)?\s*(\d{1,2})\s*s/i
    );

  if (match) {
    return {
      hour: 0,
      min: Number(match[1]),
      sec: Number(match[2])
    };
  }

  match =
    cleaned.match(
      /(\d{1,2})\s*h\s*(\d{1,2})\s*m(?:in)?\s*(\d{1,2})?\s*s?/i
    );

  if (match) {
    return {
      hour: Number(match[1]),
      min: Number(match[2]),
      sec: Number(match[3] || 0)
    };
  }

  return null;
}

function secondsFromDuration(value) {
  if (!value) return null;

  return (
    (Number(value.hour || 0) * 3600) +
    (Number(value.min || 0) * 60) +
    Number(value.sec || 0)
  );
}

function secondsFromPace(value) {
  if (!value) return null;

  return (
    (Number(value.min || 0) * 60) +
    Number(value.sec || 0)
  );
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "—";

  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return (
      String(h).padStart(2, "0") + ":" +
      String(m).padStart(2, "0") + ":" +
      String(s).padStart(2, "0")
    );
  }

  return (
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0")
  );
}

function formatPace(seconds) {
  if (seconds === null || seconds === undefined) return "—";

  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;

  return (
    String(m) + ":" +
    String(s).padStart(2, "0") +
    " /km"
  );
}

function parseSportType(sourceText) {
  const text = String(sourceText || "").toLowerCase();

  if (/\b(run|running)\b/.test(text)) return "RUN";
  if (/\b(ride|cycling|bike)\b/.test(text)) return "RIDE";
  if (/\b(swim|swimming)\b/.test(text)) return "SWIM";
  if (/\b(walk|walking)\b/.test(text)) return "WALK";

  return "UNKNOWN";
}

function validateActivity(distanceKm, durationSec, paceSec) {
  if (!distanceKm || !durationSec || !paceSec) {
    return {
      status: "NEEDS_REVIEW",
      message: "One or more required metrics were not detected.",
      differenceSec: null,
      expectedPaceSec: null
    };
  }

  // Very short activities are heavily affected by rounding.
  if (distanceKm < 0.2) {
    return {
      status: "SKIPPED_SHORT_ACTIVITY",
      message: "Consistency check skipped for very short distance.",
      differenceSec: null,
      expectedPaceSec: durationSec / distanceKm
    };
  }

  const expected = durationSec / distanceKm;
  const difference = Math.abs(expected - paceSec);

  if (difference <= 15) {
    return {
      status: "MATCHED",
      message: "Distance, duration and pace are mathematically consistent.",
      differenceSec: difference,
      expectedPaceSec: expected
    };
  }

  if (difference <= 45) {
    return {
      status: "CHECK",
      message: "Metrics are close but should be confirmed by the athlete.",
      differenceSec: difference,
      expectedPaceSec: expected
    };
  }

  return {
    status: "MISMATCH",
    message: "Metrics are not mathematically consistent.",
    differenceSec: difference,
    expectedPaceSec: expected
  };
}

async function runSmartExtraction(imageBlob, sourceText) {
  if (!imageBlob) {
    throw new Error("Tidak ada activity image untuk diekstrak.");
  }

  const image = await loadImageFromBlob(imageBlob);
  const layout = classifyLayout(image);
  const roi = getRoi(layout, image);
  const processedCanvas = preprocessRoi(image, roi, layout);

  setSmartStatus("OCR on stats region...");
  setSmartProgress(0);

  const worker = await getSmartWorker();

  const result = await worker.recognize(processedCanvas);

  const rawText = normalizeOcrText(
    result &&
    result.data &&
    result.data.text
      ? result.data.text
      : ""
  );

  const distanceKm = parseDistance(rawText);

  const paceObject = parsePace(rawText);
  const paceSec = secondsFromPace(paceObject);

  const durationObject = parseDuration(rawText);
  const durationSec = secondsFromDuration(durationObject);

  const sportType = parseSportType(sourceText);

  const validation =
    validateActivity(
      distanceKm,
      durationSec,
      paceSec
    );

  setSmartProgress(100);
  setSmartStatus("SMART EXTRACTION COMPLETE ✅", "ok");

  return {
    layout,
    rawText,
    processedCanvas,
    sportType,
    distanceKm,
    durationSec,
    paceSec,
    validation
  };
}

async function terminateSmartOcr() {
  if (!smartOcrWorker) return;

  try {
    await smartOcrWorker.terminate();
  } catch (error) {
    console.warn(error);
  }

  smartOcrWorker = null;
}
