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
  setSmartProgress(2);

  smartOcrWorker = await Tesseract.createWorker("eng", 1, {
    logger: message => {
      // We control overall progress ourselves because extraction is multi-pass.
      if (message && message.status) {
        console.log("Tesseract:", message.status, message.progress);
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
  const height = Math.max(
    64,
    Math.round((image.height / image.width) * width)
  );

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
    count++;
  }

  return count ? total / count : 0;
}

function classifyLayout(image) {
  const luminance = averageLuminance(image);
  const ratio = image.height / image.width;

  if (luminance < 85) {
    return {
      name: ratio > 1.35 ? "BLACK_ADAPTIVE" : "BLACK_COMPACT",
      luminance
    };
  }

  return {
    name: "MAP_CARD",
    luminance
  };
}

function makeRoi(image, x, y, w, h, name) {
  return {
    name,
    x: Math.max(0, Math.round(image.width * x)),
    y: Math.max(0, Math.round(image.height * y)),
    w: Math.max(1, Math.round(image.width * w)),
    h: Math.max(1, Math.round(image.height * h))
  };
}

function getCandidateRois(layout, image) {
  if (layout.name === "MAP_CARD") {
    return [
      // Existing map-card arrangement: stats are concentrated lower down.
      makeRoi(image, 0.02, 0.52, 0.96, 0.46, "MAP_LOWER_STATS"),

      // Safety pass for alternate map share cards.
      makeRoi(image, 0.00, 0.38, 1.00, 0.60, "MAP_WIDE_LOWER")
    ];
  }

  // Dark Strava cards are not one fixed layout:
  // 1. large vertical stats near the top,
  // 2. route in the middle with tiny horizontal stats near the bottom,
  // 3. compact horizontal stats around the lower-middle.
  return [
    makeRoi(image, 0.04, 0.04, 0.92, 0.62, "BLACK_TOP_STACK"),
    makeRoi(image, 0.02, 0.48, 0.96, 0.50, "BLACK_BOTTOM_BAND"),
    makeRoi(image, 0.01, 0.30, 0.98, 0.68, "BLACK_WIDE_LOWER")
  ];
}

function preprocessRoi(image, roi, layout) {
  const targetWidth =
    roi.name.includes("BOTTOM") || roi.name.includes("WIDE")
      ? 2200
      : 1800;

  const maxScale = 6;

  const scale = Math.min(
    maxScale,
    Math.max(2.5, targetWidth / Math.max(roi.w, 1))
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

  // Dark cards tend to have white labels/numbers.
  // Map cards contain white text over a more complex map, so use a higher threshold.
  const threshold =
    layout.name.startsWith("BLACK")
      ? 135
      : 188;

  for (let i = 0; i < data.length; i += 4) {
    const lum =
      (0.2126 * data[i]) +
      (0.7152 * data[i + 1]) +
      (0.0722 * data[i + 2]);

    // Convert to black glyphs on a white background.
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

function numericCleanup(text) {
  return String(text || "")
    .replace(/,/g, ".")
    .replace(/[Oo](?=\d|\s*(?:km|m|s))/gi, "0")
    .replace(/\b[lI](?=\d)/g, "1");
}

function collectDistanceCandidates(text) {
  const cleaned = numericCleanup(text);
  const candidates = [];

  const patterns = [
    /(?:distance|dist[a-z]*)[\s\S]{0,50}?(\d{1,3}(?:\.\d{1,2})?)\s*k[mn]/gi,
    /(\d{1,3}(?:\.\d{1,2})?)\s*k[mn]/gi
  ];

  patterns.forEach((pattern, patternIndex) => {
    for (const match of cleaned.matchAll(pattern)) {
      const value = Number(match[1]);

      if (
        Number.isFinite(value) &&
        value > 0 &&
        value < 1000
      ) {
        candidates.push({
          value,
          confidence: patternIndex === 0 ? 3 : 2,
          raw: match[0]
        });
      }
    }
  });

  return dedupeNumericCandidates(candidates, 0.001);
}

function collectPaceCandidates(text) {
  const cleaned = numericCleanup(text);
  const candidates = [];

  const labelled =
    /(?:pace|pac[e3])[\s\S]{0,70}?(\d{1,2})\s*[:;]\s*(\d{1,2})(?:\s*\/?\s*k[mn])?/gi;

  for (const match of cleaned.matchAll(labelled)) {
    const min = Number(match[1]);
    const sec = Number(match[2]);

    if (min >= 0 && min <= 60 && sec >= 0 && sec < 60) {
      candidates.push({
        value: (min * 60) + sec,
        confidence: 3,
        raw: match[0]
      });
    }
  }

  const withUnit =
    /(\d{1,2})\s*[:;]\s*(\d{1,2})\s*\/?\s*k[mn]/gi;

  for (const match of cleaned.matchAll(withUnit)) {
    const min = Number(match[1]);
    const sec = Number(match[2]);

    if (min >= 0 && min <= 60 && sec >= 0 && sec < 60) {
      candidates.push({
        value: (min * 60) + sec,
        confidence: 3,
        raw: match[0]
      });
    }
  }

  return dedupeNumericCandidates(candidates, 1);
}

function collectDurationCandidates(text) {
  const cleaned = numericCleanup(text);
  const candidates = [];

  const hourPattern =
    /(\d{1,2})\s*h\s*(\d{1,2})\s*m(?:in)?\s*(\d{1,2})?\s*s?/gi;

  for (const match of cleaned.matchAll(hourPattern)) {
    const h = Number(match[1]);
    const m = Number(match[2]);
    const s = Number(match[3] || 0);

    if (m < 60 && s < 60) {
      candidates.push({
        value: (h * 3600) + (m * 60) + s,
        confidence: 3,
        raw: match[0]
      });
    }
  }

  const minutePattern =
    /(\d{1,3})\s*m(?:in)?\s*(\d{1,2})\s*s/gi;

  for (const match of cleaned.matchAll(minutePattern)) {
    const m = Number(match[1]);
    const s = Number(match[2]);

    if (s < 60) {
      candidates.push({
        value: (m * 60) + s,
        confidence: 3,
        raw: match[0]
      });
    }
  }

  const labelledClock =
    /(?:time|duration)[\s\S]{0,45}?(\d{1,2})\s*[:;]\s*(\d{2})(?:\s*[:;]\s*(\d{2}))?/gi;

  for (const match of cleaned.matchAll(labelledClock)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const c = match[3] !== undefined ? Number(match[3]) : null;

    let seconds;

    if (c !== null) {
      seconds = (a * 3600) + (b * 60) + c;
    } else {
      seconds = (a * 60) + b;
    }

    candidates.push({
      value: seconds,
      confidence: 2,
      raw: match[0]
    });
  }

  return dedupeNumericCandidates(candidates, 1);
}

function dedupeNumericCandidates(candidates, tolerance) {
  const sorted = [...candidates]
    .sort((a, b) => b.confidence - a.confidence);

  const result = [];

  for (const candidate of sorted) {
    const duplicate = result.some(existing =>
      Math.abs(existing.value - candidate.value) <= tolerance
    );

    if (!duplicate) {
      result.push(candidate);
    }
  }

  return result;
}

function parseSportType(sourceText) {
  const text = String(sourceText || "").toLowerCase();

  if (/\b(run|running)\b/.test(text)) return "RUN";
  if (/\b(ride|cycling|bike)\b/.test(text)) return "RIDE";
  if (/\b(swim|swimming)\b/.test(text)) return "SWIM";
  if (/\b(walk|walking)\b/.test(text)) return "WALK";

  return "UNKNOWN";
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

function evaluateCombination(distanceKm, durationSec, paceSec) {
  const missing =
    [distanceKm, durationSec, paceSec]
      .filter(value => value === null || value === undefined)
      .length;

  if (missing > 0) {
    return {
      score: -100 - (missing * 10),
      differenceSec: null,
      expectedPaceSec: null
    };
  }

  if (distanceKm <= 0 || durationSec <= 0 || paceSec <= 0) {
    return {
      score: -999,
      differenceSec: null,
      expectedPaceSec: null
    };
  }

  if (distanceKm < 0.2) {
    // Very short activities are too sensitive to rounding.
    return {
      score: 20,
      differenceSec: null,
      expectedPaceSec: durationSec / distanceKm
    };
  }

  const expected = durationSec / distanceKm;
  const diff = Math.abs(expected - paceSec);

  let score;

  if (diff <= 15) {
    score = 120 - diff;
  } else if (diff <= 45) {
    score = 75 - diff;
  } else {
    score = Math.max(-80, 20 - diff);
  }

  return {
    score,
    differenceSec: diff,
    expectedPaceSec: expected
  };
}

function chooseBestMetrics(allCandidates) {
  const distances = allCandidates.distances.slice(0, 8);
  const durations = allCandidates.durations.slice(0, 8);
  const paces = allCandidates.paces.slice(0, 8);

  let best = null;

  for (const distance of distances) {
    for (const duration of durations) {
      for (const pace of paces) {
        const check =
          evaluateCombination(
            distance.value,
            duration.value,
            pace.value
          );

        const confidenceBonus =
          distance.confidence +
          duration.confidence +
          pace.confidence;

        const totalScore =
          check.score +
          confidenceBonus;

        if (!best || totalScore > best.totalScore) {
          best = {
            distanceKm: distance.value,
            durationSec: duration.value,
            paceSec: pace.value,
            totalScore,
            differenceSec: check.differenceSec,
            expectedPaceSec: check.expectedPaceSec,
            selectedRaw: {
              distance: distance.raw,
              duration: duration.raw,
              pace: pace.raw
            }
          };
        }
      }
    }
  }

  // Fallback to individually strongest values if a complete triplet was not found.
  if (!best) {
    return {
      distanceKm: distances.length ? distances[0].value : null,
      durationSec: durations.length ? durations[0].value : null,
      paceSec: paces.length ? paces[0].value : null,
      totalScore: -100,
      differenceSec: null,
      expectedPaceSec: null,
      selectedRaw: {}
    };
  }

  return best;
}

function buildValidation(metrics) {
  const {
    distanceKm,
    durationSec,
    paceSec,
    differenceSec,
    expectedPaceSec
  } = metrics;

  if (!distanceKm || !durationSec || !paceSec) {
    return {
      status: "NEEDS_REVIEW",
      message: "One or more required metrics were not detected.",
      expectedPaceSec
    };
  }

  if (distanceKm < 0.2) {
    return {
      status: "SKIPPED_SHORT_ACTIVITY",
      message: "Consistency check skipped for very short activity.",
      expectedPaceSec
    };
  }

  if (differenceSec <= 15) {
    return {
      status: "MATCHED",
      message: "Distance, duration and pace are mathematically consistent.",
      expectedPaceSec
    };
  }

  if (differenceSec <= 45) {
    return {
      status: "CHECK",
      message: "Metrics are close but athlete confirmation is recommended.",
      expectedPaceSec
    };
  }

  // Important: do not silently "fix" OCR values.
  // We only provide a derived suggestion so the athlete/admin can confirm it.
  return {
    status: "MISMATCH",
    message:
      "OCR metrics conflict. Do not auto-submit. " +
      "Use the calculated pace/distance relationship as a review hint.",
    expectedPaceSec
  };
}

async function recognizeCanvas(worker, canvas, psm) {
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: String(psm)
  });

  const result = await worker.recognize(canvas);

  return normalizeOcrText(
    result &&
    result.data &&
    result.data.text
      ? result.data.text
      : ""
  );
}

function addCandidateText(bucket, text, roiName, passName) {
  const distanceList = collectDistanceCandidates(text);
  const durationList = collectDurationCandidates(text);
  const paceList = collectPaceCandidates(text);

  distanceList.forEach(item =>
    bucket.distances.push({
      ...item,
      source: roiName + "/" + passName
    })
  );

  durationList.forEach(item =>
    bucket.durations.push({
      ...item,
      source: roiName + "/" + passName
    })
  );

  paceList.forEach(item =>
    bucket.paces.push({
      ...item,
      source: roiName + "/" + passName
    })
  );
}

function extractionCompleteness(bucket) {
  let count = 0;

  if (bucket.distances.length) count++;
  if (bucket.durations.length) count++;
  if (bucket.paces.length) count++;

  return count;
}

async function runSmartExtraction(imageBlob, sourceText) {
  if (!imageBlob) {
    throw new Error("Tidak ada activity image untuk diekstrak.");
  }

  const image = await loadImageFromBlob(imageBlob);
  const layout = classifyLayout(image);
  const rois = getCandidateRois(layout, image);
  const worker = await getSmartWorker();

  const allCandidates = {
    distances: [],
    durations: [],
    paces: []
  };

  const debugPasses = [];
  const totalPasses =
    layout.name === "MAP_CARD"
      ? rois.length
      : rois.length * 2;

  let passCounter = 0;

  for (const roi of rois) {
    const canvas = preprocessRoi(image, roi, layout);

    // PSM 6 = assume one uniform block.
    setSmartStatus("Scanning " + roi.name + "...");
    const textPsm6 = await recognizeCanvas(worker, canvas, 6);

    passCounter++;
    setSmartProgress((passCounter / totalPasses) * 100);

    addCandidateText(
      allCandidates,
      textPsm6,
      roi.name,
      "PSM6"
    );

    debugPasses.push({
      roiName: roi.name,
      passName: "PSM6",
      text: textPsm6,
      canvas
    });

    // If the map card already yielded everything, avoid extra work.
    if (
      layout.name === "MAP_CARD" &&
      extractionCompleteness(allCandidates) === 3
    ) {
      break;
    }

    // Dark cards often have tiny, sparse horizontal text.
    // PSM 11 handles sparse text better, so give every black ROI a second pass.
    if (layout.name.startsWith("BLACK")) {
      setSmartStatus("Sparse-text scan " + roi.name + "...");

      const textPsm11 = await recognizeCanvas(worker, canvas, 11);

      passCounter++;
      setSmartProgress((passCounter / totalPasses) * 100);

      addCandidateText(
        allCandidates,
        textPsm11,
        roi.name,
        "PSM11"
      );

      debugPasses.push({
        roiName: roi.name,
        passName: "PSM11",
        text: textPsm11,
        canvas
      });
    }

    // Stop early when we already have a mathematically good triplet.
    if (extractionCompleteness(allCandidates) === 3) {
      const provisional = chooseBestMetrics(allCandidates);

      if (
        provisional &&
        provisional.differenceSec !== null &&
        provisional.differenceSec <= 15
      ) {
        break;
      }
    }
  }

  const metrics = chooseBestMetrics(allCandidates);
  const validation = buildValidation(metrics);

  setSmartProgress(100);

  if (validation.status === "MATCHED") {
    setSmartStatus("SMART EXTRACTION COMPLETE ✅", "ok");
  } else {
    setSmartStatus(
      "EXTRACTION COMPLETE — REVIEW NEEDED",
      validation.status === "MISMATCH" ? "error" : "normal"
    );
  }

  return {
    layout,
    sportType: parseSportType(sourceText),
    distanceKm: metrics.distanceKm,
    durationSec: metrics.durationSec,
    paceSec: metrics.paceSec,
    validation,
    selectedRaw: metrics.selectedRaw,
    debugPasses,
    candidates: allCandidates
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
