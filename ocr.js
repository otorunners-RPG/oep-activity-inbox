let oepOcrWorker = null;

function setOcrStatus(message, type = "normal") {
  const status = document.querySelector("#ocrStatus");
  if (!status) return;
  status.textContent = message;
  status.className = type === "error" ? "ocr-status error" : type === "ok" ? "ocr-status ok" : "ocr-status";
}

function setOcrProgress(percent) {
  const bar = document.querySelector("#ocrProgressBar");
  const label = document.querySelector("#ocrProgressLabel");
  const safe = Math.max(0, Math.min(100, Math.round(percent || 0)));
  if (bar) bar.style.width = safe + "%";
  if (label) label.textContent = safe + "%";
}

async function getOrCreateOcrWorker() {
  if (oepOcrWorker) return oepOcrWorker;
  if (!window.Tesseract) throw new Error("Tesseract.js belum termuat. Pastikan HP terhubung ke internet lalu reload halaman.");
  setOcrStatus("Preparing OCR engine...");
  setOcrProgress(1);
  oepOcrWorker = await Tesseract.createWorker("eng", 1, {
    logger: message => {
      if (message && typeof message.progress === "number") setOcrProgress(message.progress * 100);
      if (message && message.status) setOcrStatus(String(message.status).replaceAll("_", " ").toUpperCase());
    }
  });
  return oepOcrWorker;
}

async function extractTextFromBlob(imageBlob) {
  if (!imageBlob) throw new Error("Tidak ada image untuk di-OCR.");
  const worker = await getOrCreateOcrWorker();
  setOcrStatus("Recognizing activity image...");
  setOcrProgress(0);
  const result = await worker.recognize(imageBlob);
  const text = result?.data?.text ? result.data.text.trim() : "";
  setOcrProgress(100);
  if (!text) {
    setOcrStatus("OCR selesai, tetapi text tidak terdeteksi.", "error");
    return "";
  }
  setOcrStatus("OCR COMPLETE ✅", "ok");
  return text;
}

async function terminateOcrWorker() {
  if (!oepOcrWorker) return;
  try { await oepOcrWorker.terminate(); } catch (error) { console.warn(error); }
  oepOcrWorker = null;
}
