const CONFIG_KEY = "weddingSouvenirConfig";
const CLOUD_SETTINGS_KEY = "weddingSouvenirCloudSettings";
const ADMIN_PASSWORD_KEY = "weddingSouvenirAdminPassword";
const ADMIN_AUTH_KEY = "weddingSouvenirAdminAuthenticated";
const MANAGER_PASSWORD_KEY = "weddingSouvenirManagerPassword";
const PASSWORD_DISABLED = "__disabled__";
const OUTPUT_FORMATS = {
  portrait: {
    width: 1080,
    height: 1350,
    label: "Portrait 4:5",
    hint: "Buat PNG transparan ukuran 1080 x 1350 px, rasio 4:5. Cocok untuk poster/feed portrait.",
  },
  story: {
    width: 1080,
    height: 1920,
    label: "Story 9:16",
    hint: "Buat PNG transparan ukuran 1080 x 1920 px, rasio 9:16. Cocok untuk Instagram Story.",
  },
};
let CANVAS_WIDTH = OUTPUT_FORMATS.portrait.width;
let CANVAS_HEIGHT = OUTPUT_FORMATS.portrait.height;
const DEFAULT_MANAGER_PASSWORD = "admin123";

const defaultConfig = {
  bride: "Raka",
  groom: "Dina",
  date: "22.06.2026",
  title: "Selfie atau wefie tamu jadi karikatur",
  shareCaption: "Terima kasih {tamu} sudah hadir di acara {mempelai}.",
  outputFormat: "portrait",
  frameFit: "cover",
  aiProvider: "local",
  apiEndpoint: "https://bjjibgbwgvphysavutiw.supabase.co/functions/v1/generate-caricature",
  twibbon: "",
  defaultGuestName: "Nama Tamu",
  fluxPrompt: "Transform the uploaded photo into a caricature in wedding souvenir style. Strictly preserve the exact head count, identities, poses, composition, and framing of the original image. Absolutely do not add any additional people, extra figures, or background characters. If there is one person in the original photo, there must be exactly one person in the output. Keep the image bright, clean, family-friendly, and ready to be overlaid with a transparent wedding twibbon/frame. Do not add any text, logos, borders, or extra frame decorations.",
  text: {
    couple: {
      template: "{mempelai}",
      x: 540,
      y: 1185,
      size: 54,
      color: "#b86f73",
      font: "Georgia, serif",
      weight: "400",
    },
    guest: {
      template: "Untuk {tamu}",
      x: 540,
      y: 1240,
      size: 30,
      color: "#b86f73",
      font: "Arial, sans-serif",
      weight: "400",
    },
    date: {
      template: "{tanggal}",
      x: 540,
      y: 1295,
      size: 24,
      color: "#b86f73",
      font: "Arial, sans-serif",
      weight: "400",
    },
  },
};

const defaultCloudSettings = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  eventSlug: "default-event",
};

const page = document.body.dataset.page;

function loadConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY));
    return normalizeConfig({ ...defaultConfig, ...stored });
  } catch {
    return normalizeConfig({ ...defaultConfig });
  }
}

function normalizeConfig(config) {
  const legacyText = config.text || {};
  const text = {
    couple: {
      ...defaultConfig.text.couple,
      ...legacyText.couple,
      template: legacyText.couple?.template || legacyText.coupleTemplate || defaultConfig.text.couple.template,
      y: Number(legacyText.couple?.y || legacyText.coupleY || defaultConfig.text.couple.y),
      color: legacyText.couple?.color || legacyText.color || defaultConfig.text.couple.color,
      size: Number(legacyText.couple?.size || legacyText.size || defaultConfig.text.couple.size),
    },
    guest: {
      ...defaultConfig.text.guest,
      ...legacyText.guest,
      template: legacyText.guest?.template || legacyText.guestTemplate || defaultConfig.text.guest.template,
      y: Number(legacyText.guest?.y || legacyText.guestY || defaultConfig.text.guest.y),
      color: legacyText.guest?.color || legacyText.color || defaultConfig.text.guest.color,
      size: Number(legacyText.guest?.size || Math.round((legacyText.size || 54) * 0.56) || defaultConfig.text.guest.size),
    },
    date: {
      ...defaultConfig.text.date,
      ...legacyText.date,
      template: legacyText.date?.template || legacyText.dateTemplate || defaultConfig.text.date.template,
      y: Number(legacyText.date?.y || legacyText.dateY || defaultConfig.text.date.y),
      color: legacyText.date?.color || legacyText.color || defaultConfig.text.date.color,
      size: Number(legacyText.date?.size || Math.round((legacyText.size || 54) * 0.46) || defaultConfig.text.date.size),
    },
  };
  const outputFormat = OUTPUT_FORMATS[config.outputFormat] ? config.outputFormat : defaultConfig.outputFormat;
  const legacyProvider = config.aiProvider === "api" ? "gemini" : config.aiProvider;
  const aiProvider = ["local", "flux", "gemini"].includes(legacyProvider) ? legacyProvider : defaultConfig.aiProvider;
  let fluxPrompt = config.fluxPrompt !== undefined ? config.fluxPrompt : defaultConfig.fluxPrompt;
  const oldDefaultFluxPrompt = "Transform the uploaded selfie or group selfie into a wedding souvenir caricature. Preserve each person's identity, pose, head count, composition, and camera framing. Keep the image family-friendly, bright, clean, and ready to be overlaid with a transparent wedding twibbon/frame. Do not add text, logos, borders, or extra frame decorations.";
  if (fluxPrompt === oldDefaultFluxPrompt) {
    fluxPrompt = defaultConfig.fluxPrompt;
  }
  const defaultGuestName = config.defaultGuestName !== undefined ? config.defaultGuestName : defaultConfig.defaultGuestName;
  return { ...defaultConfig, ...config, aiProvider, outputFormat, text, fluxPrompt, defaultGuestName };
}

function getOutputSize(format = defaultConfig.outputFormat) {
  return OUTPUT_FORMATS[format] || OUTPUT_FORMATS[defaultConfig.outputFormat];
}

function applyOutputFormat(format, ...canvases) {
  const size = getOutputSize(format);
  CANVAS_WIDTH = size.width;
  CANVAS_HEIGHT = size.height;
  canvases.filter(Boolean).forEach((canvas) => {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.style.aspectRatio = `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`;
    if (canvas.parentElement) {
      canvas.parentElement.style.aspectRatio = `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`;
    }
  });
  document.querySelectorAll(".compare-view").forEach((element) => {
    element.style.aspectRatio = `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`;
  });
  return size;
}

function scaleTextSettings(settings, fromFormat, toFormat) {
  const from = getOutputSize(fromFormat);
  const to = getOutputSize(toFormat);
  const scaled = structuredClone(settings);
  Object.keys(scaled).forEach((key) => {
    scaled[key].x = Math.round((Number(scaled[key].x) / from.width) * to.width);
    scaled[key].y = Math.round((Number(scaled[key].y) / from.height) * to.height);
  });
  return scaled;
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadCloudSettings() {
  const publicConfig = window.SOUVENIR_CLOUD_CONFIG || {};
  try {
    const storedConfig = JSON.parse(localStorage.getItem(CLOUD_SETTINGS_KEY)) || {};
    return compactCloudSettings({
      ...defaultCloudSettings,
      ...publicConfig,
      ...storedConfig,
    });
  } catch {
    return compactCloudSettings({ ...defaultCloudSettings, ...publicConfig });
  }
}

function compactCloudSettings(settings) {
  const publicConfig = window.SOUVENIR_CLOUD_CONFIG || {};
  return {
    supabaseUrl: settings.supabaseUrl || publicConfig.supabaseUrl || "",
    supabaseAnonKey: settings.supabaseAnonKey || publicConfig.supabaseAnonKey || "",
    eventSlug: settings.eventSlug || publicConfig.eventSlug || defaultCloudSettings.eventSlug,
  };
}

function saveCloudSettings(settings) {
  localStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify({ ...defaultCloudSettings, ...settings }));
}

function clearCloudSettings() {
  localStorage.removeItem(CLOUD_SETTINGS_KEY);
}

function isCloudConfigured() {
  const settings = loadCloudSettings();
  return Boolean(settings.supabaseUrl && settings.supabaseAnonKey && settings.eventSlug);
}

function getSupabaseHeaders(settings) {
  return {
    apikey: settings.supabaseAnonKey,
    Authorization: `Bearer ${settings.supabaseAnonKey}`,
    "Content-Type": "application/json",
  };
}

function getSupabaseBaseUrl(settings) {
  return settings.supabaseUrl.replace(/\/$/, "");
}

async function fetchCloudConfig() {
  const settings = loadCloudSettings();
  if (!isCloudConfigured()) return null;

  const params = new URLSearchParams({
    slug: `eq.${settings.eventSlug}`,
    select: "config",
    limit: "1",
  });
  const response = await fetch(`${getSupabaseBaseUrl(settings)}/rest/v1/events?${params}`, {
    headers: getSupabaseHeaders(settings),
  });
  if (!response.ok) throw new Error(`Gagal membaca Supabase: ${response.status}`);

  const rows = await response.json();
  if (!rows.length) return null;
  const config = normalizeConfig({ ...defaultConfig, ...rows[0].config });
  saveConfig(config);
  return config;
}

async function saveCloudConfig(config) {
  const settings = loadCloudSettings();
  if (!isCloudConfigured()) return false;

  const response = await fetch(`${getSupabaseBaseUrl(settings)}/rest/v1/events`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(settings),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      slug: settings.eventSlug,
      config,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Gagal menyimpan Supabase: ${response.status}`);
  return true;
}

async function fetchTwibbonConcepts() {
  const settings = loadCloudSettings();
  if (!isCloudConfigured()) return [];

  const params = new URLSearchParams({
    event_slug: `eq.${settings.eventSlug}`,
    select: "id,name,image_data,output_format,frame_fit,updated_at",
    order: "updated_at.desc",
  });
  const response = await fetch(`${getSupabaseBaseUrl(settings)}/rest/v1/twibbon_concepts?${params}`, {
    headers: getSupabaseHeaders(settings),
  });
  if (!response.ok) throw new Error(`Gagal membaca konsep twibbon: ${response.status}`);
  return response.json();
}

async function saveTwibbonConceptToCloud(concept) {
  const settings = loadCloudSettings();
  if (!isCloudConfigured()) return false;

  const response = await fetch(`${getSupabaseBaseUrl(settings)}/rest/v1/twibbon_concepts`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(settings),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      event_slug: settings.eventSlug,
      name: concept.name,
      image_data: concept.imageData,
      output_format: concept.outputFormat,
      frame_fit: concept.frameFit,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Gagal menyimpan konsep twibbon: ${response.status}`);
  return true;
}

function getStoredPassword(key, fallback = "") {
  return localStorage.getItem(key) || fallback;
}

function getAdminPassword() {
  const stored = localStorage.getItem(ADMIN_PASSWORD_KEY);
  if (stored === PASSWORD_DISABLED) return "";
  return stored || DEFAULT_MANAGER_PASSWORD;
}

function isAdminAuthenticated() {
  const adminPassword = getAdminPassword();
  return !adminPassword || sessionStorage.getItem(ADMIN_AUTH_KEY) === "true";
}

function setAdminAuthenticated() {
  sessionStorage.setItem(ADMIN_AUTH_KEY, "true");
}

function checkedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(ctx, source, mirror = false, zoom = 1, mode = "cover") {
  const sourceWidth = source.videoWidth || source.width;
  const sourceHeight = source.videoHeight || source.height;
  const fitRatio =
    mode === "contain"
      ? Math.min(CANVAS_WIDTH / sourceWidth, CANVAS_HEIGHT / sourceHeight)
      : Math.max(CANVAS_WIDTH / sourceWidth, CANVAS_HEIGHT / sourceHeight);
  const ratio = fitRatio * zoom;
  const width = sourceWidth * ratio;
  const height = sourceHeight * ratio;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = (CANVAS_HEIGHT - height) / 2;

  ctx.save();
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (mode === "contain") {
    ctx.fillStyle = "#f8f2ea";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  if (mirror) {
    ctx.translate(CANVAS_WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, x, y, width, height);
  } else {
    ctx.drawImage(source, x, y, width, height);
  }
  ctx.restore();
}

function drawContainOrCover(ctx, source, fit) {
  const ratio =
    fit === "contain"
      ? Math.min(CANVAS_WIDTH / source.width, CANVAS_HEIGHT / source.height)
      : Math.max(CANVAS_WIDTH / source.width, CANVAS_HEIGHT / source.height);
  const width = source.width * ratio;
  const height = source.height * ratio;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = (CANVAS_HEIGHT - height) / 2;
  ctx.drawImage(source, x, y, width, height);
}

function posterize(ctx, style) {
  const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imageData.data;
  const steps = style === "comic" ? 5 : style === "sketch" ? 3 : 7;
  const stepSize = 255 / steps;

  for (let index = 0; index < data.length; index += 4) {
    if (style === "sketch") {
      const avg = (data[index] + data[index + 1] + data[index + 2]) / 3;
      data[index] = 255 - avg * 0.2;
      data[index + 1] = 255 - avg * 0.2;
      data[index + 2] = 255 - avg * 0.2;
    } else {
      data[index] = Math.round(data[index] / stepSize) * stepSize;
      data[index + 1] = Math.round(data[index + 1] / stepSize) * stepSize;
      data[index + 2] = Math.round(data[index + 2] / stepSize) * stepSize;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyLocalCaricature(sourceCanvas, style) {
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = CANVAS_WIDTH;
  resultCanvas.height = CANVAS_HEIGHT;
  const resultCtx = resultCanvas.getContext("2d", { willReadFrequently: true });

  const blur = style === "comic" ? 1.8 : style === "sketch" ? 0.4 : 1.2;
  const saturation = style === "comic" ? 1.55 : style === "sketch" ? 0.15 : 1.35;
  const contrast = style === "comic" ? 1.18 : style === "sketch" ? 1.38 : 1.12;
  resultCtx.filter = `blur(${blur}px) saturate(${saturation}) contrast(${contrast})`;
  resultCtx.drawImage(sourceCanvas, 0, 0);
  resultCtx.filter = "none";

  posterize(resultCtx, style);
  drawEdgeInk(resultCtx, style);
  tintHighlights(resultCtx, style);

  return resultCanvas;
}

function drawEdgeInk(ctx, style) {
  const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imageData.data;
  const luminance = new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT);

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    luminance[pixel] = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }

  const threshold = style === "sketch" ? 38 : style === "comic" ? 48 : 58;
  const alpha = style === "sketch" ? 210 : style === "comic" ? 170 : 118;
  const edgeCanvas = document.createElement("canvas");
  edgeCanvas.width = CANVAS_WIDTH;
  edgeCanvas.height = CANVAS_HEIGHT;
  const edgeCtx = edgeCanvas.getContext("2d");
  const edgeData = edgeCtx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const edgePixels = edgeData.data;

  for (let y = 1; y < CANVAS_HEIGHT - 1; y += 1) {
    for (let x = 1; x < CANVAS_WIDTH - 1; x += 1) {
      const top = luminance[(y - 1) * CANVAS_WIDTH + x];
      const bottom = luminance[(y + 1) * CANVAS_WIDTH + x];
      const left = luminance[y * CANVAS_WIDTH + x - 1];
      const right = luminance[y * CANVAS_WIDTH + x + 1];
      const magnitude = Math.abs(top - bottom) + Math.abs(left - right);

      if (magnitude > threshold) {
        const output = (y * CANVAS_WIDTH + x) * 4;
        edgePixels[output] = 28;
        edgePixels[output + 1] = 24;
        edgePixels[output + 2] = 20;
        edgePixels[output + 3] = Math.min(alpha, magnitude * 2.2);
      }
    }
  }

  edgeCtx.putImageData(edgeData, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(edgeCanvas, 0, 0);
  ctx.restore();
}

function tintHighlights(ctx, style) {
  if (style === "sketch") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "rgba(255, 246, 228, 0.34)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = style === "comic" ? "rgba(255, 210, 135, 0.26)" : "rgba(255, 238, 205, 0.18)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();
}

async function generateCaricature(sourceCanvas, style, config) {
  generateCaricature.lastStatus = { provider: "local", message: "Cartoon Lokal aktif." };
  if (config.aiProvider !== "local" && config.apiEndpoint) {
    try {
      const result = await requestPaidAiCaricature(sourceCanvas, style, config);
      const label = config.aiProvider === "flux" ? "FLUX Kontext" : "Gemini API";
      generateCaricature.lastStatus = { provider: config.aiProvider, message: `${label} berhasil memproses karikatur.` };
      return result;
    } catch (error) {
      console.warn("API caricature failed, using local fallback.", error);
      const label = config.aiProvider === "flux" ? "FLUX Kontext" : "Gemini API";
      generateCaricature.lastStatus = {
        provider: "fallback",
        message: `${label} gagal (${error.message}). Dipakai fallback lokal.`,
      };
    }
  }

  return applyLocalCaricature(sourceCanvas, style);
}

function getAiRequestHeaders(config) {
  const headers = { "Content-Type": "application/json" };
  const settings = loadCloudSettings();
  if (config.apiEndpoint?.includes("/functions/v1/") && settings.supabaseAnonKey) {
    headers.apikey = settings.supabaseAnonKey;
    headers.Authorization = `Bearer ${settings.supabaseAnonKey}`;
  }
  return headers;
}

async function requestPaidAiCaricature(sourceCanvas, style, config) {
  const response = await fetch(config.apiEndpoint, {
    method: "POST",
    headers: getAiRequestHeaders(config),
    body: JSON.stringify({
      image: sourceCanvas.toDataURL("image/jpeg", 0.9),
      engine: config.aiProvider,
      outputFormat: config.outputFormat,
      style,
      prompt: config.aiProvider === "flux" ? (config.fluxPrompt || "") : "Create a caricature that follows the uploaded selfie or group selfie composition. Preserve the number of people, poses, and overall framing.",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
  }
  const image = await loadImage(payload.image);
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = CANVAS_WIDTH;
  resultCanvas.height = CANVAS_HEIGHT;
  drawCover(resultCanvas.getContext("2d"), image);
  return resultCanvas;
}

function fitText(ctx, text, x, y, maxWidth, size, family, weight = "400") {
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 18) {
    fontSize -= 2;
    ctx.font = `${weight} ${fontSize}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

function fillTemplate(template, config, guestName) {
  return template
    .replaceAll("{mempelai}", `${config.bride} & ${config.groom}`)
    .replaceAll("{tanggal}", config.date)
    .replaceAll("{tamu}", guestName || "Nama Tamu");
}

function drawTextPlaceholders(ctx, config, guestName, activeKey = "") {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 255, 255, 0.82)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  Object.entries(config.text).forEach(([key, item]) => {
    const text = fillTemplate(item.template, config, guestName);
    const size = Number(item.size) || 28;
    const x = Number(item.x) || CANVAS_WIDTH / 2;
    const y = Number(item.y) || CANVAS_HEIGHT - 100;
    const family = item.font || "Arial, sans-serif";
    const weight = item.weight || "400";

    ctx.fillStyle = item.color || "#b86f73";
    ctx.font = `${weight} ${size}px ${family}`;
    fitText(ctx, text, x, y, CANVAS_WIDTH - 160, size, family, weight);

    if (key === activeKey) {
      const width = Math.min(CANVAS_WIDTH - 160, ctx.measureText(text).width + 28);
      const height = size + 24;
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(36, 33, 29, 0.52)";
      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 3;
      ctx.strokeRect(x - width / 2, y - height / 2, width, height);
      ctx.restore();
    }
  });
  ctx.restore();
}

function drawFallbackTwibbon(ctx, config, guestName = "Tamu Undangan") {
  ctx.save();
  ctx.strokeStyle = "#7d967a";
  ctx.lineWidth = 30;
  ctx.strokeRect(32, 32, CANVAS_WIDTH - 64, CANVAS_HEIGHT - 64);
  ctx.strokeStyle = "#c79a48";
  ctx.lineWidth = 7;
  ctx.strokeRect(72, 72, CANVAS_WIDTH - 144, CANVAS_HEIGHT - 144);

  ctx.fillStyle = "rgba(255, 250, 242, 0.92)";
  ctx.fillRect(0, CANVAS_HEIGHT - 255, CANVAS_WIDTH, 255);
  drawDecor(ctx, 96, 112, 1);
  drawDecor(ctx, CANVAS_WIDTH - 96, 112, -1);
  drawDecor(ctx, 96, CANVAS_HEIGHT - 318, 1);
  drawDecor(ctx, CANVAS_WIDTH - 96, CANVAS_HEIGHT - 318, -1);
  ctx.restore();
}

function drawDecor(ctx, x, y, direction) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);

  for (let item = 0; item < 5; item += 1) {
    ctx.rotate((Math.PI / 9) * (item - 2));
    ctx.strokeStyle = "#7d967a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(28, -34, 72, -48);
    ctx.stroke();
    ctx.fillStyle = "#f4c2a1";
    ctx.beginPath();
    ctx.ellipse(76, -50, 18, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

async function drawTwibbon(ctx, config, guestName) {
  const twibbon = await loadImage(config.twibbon);
  if (twibbon) {
    drawContainOrCover(ctx, twibbon, config.frameFit);
    return;
  }
  drawFallbackTwibbon(ctx, config, guestName);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initAdmin() {
  const loginPanel = document.querySelector("#adminLogin");
  const workspace = document.querySelector(".admin-workspace");
  const passwordInput = document.querySelector("#adminPasswordInput");
  const loginButton = document.querySelector("#adminLoginButton");
  const loginStatus = document.querySelector("#adminLoginStatus");

  if (!isAdminAuthenticated()) {
    loginPanel.hidden = false;
    workspace.hidden = true;
    loginButton.addEventListener("click", () => {
      if (passwordInput.value === getAdminPassword()) {
        setAdminAuthenticated();
        loginPanel.hidden = true;
        workspace.hidden = false;
        initAdminForm();
        return;
      }
      loginStatus.textContent = "Password admin salah.";
    });
    passwordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loginButton.click();
    });
    return;
  }

  initAdminForm();
}

function initAdminForm() {
  const config = loadConfig();
  const bride = document.querySelector("#adminBride");
  const groom = document.querySelector("#adminGroom");
  const date = document.querySelector("#adminDate");
  const title = document.querySelector("#adminTitle");
  const defaultGuestName = document.querySelector("#adminDefaultGuestName");
  const shareCaption = document.querySelector("#shareCaption");
  const aiProvider = document.querySelector("#aiProvider");
  const fluxPrompt = document.querySelector("#fluxPrompt");
  const fluxPromptGroup = document.querySelector("#fluxPromptGroup");
  const apiEndpoint = document.querySelector("#apiEndpoint");
  const frameSizeHint = document.querySelector("#frameSizeHint");
  const placeholderTemplate = document.querySelector("#placeholderTemplate");
  const placeholderSize = document.querySelector("#placeholderSize");
  const placeholderColor = document.querySelector("#placeholderColor");
  const placeholderFont = document.querySelector("#placeholderFont");
  const placeholderWeight = document.querySelector("#placeholderWeight");
  const placeholderX = document.querySelector("#placeholderX");
  const placeholderY = document.querySelector("#placeholderY");
  const centerPlaceholder = document.querySelector("#centerPlaceholder");
  const upload = document.querySelector("#twibbonUpload");
  const conceptName = document.querySelector("#twibbonConceptName");
  const conceptList = document.querySelector("#twibbonConceptList");
  const saveConcept = document.querySelector("#saveTwibbonConcept");
  const applyConcept = document.querySelector("#applyTwibbonConcept");
  const refreshConcepts = document.querySelector("#refreshTwibbonConcepts");
  const conceptStatus = document.querySelector("#twibbonConceptStatus");
  const save = document.querySelector("#saveAdmin");
  const reset = document.querySelector("#resetAdmin");
  const canvas = document.querySelector("#adminPreviewCanvas");
  const ctx = canvas.getContext("2d");
  let activeFormat = config.outputFormat;
  applyOutputFormat(activeFormat, canvas);

  bride.value = config.bride;
  groom.value = config.groom;
  date.value = config.date;
  title.value = config.title;
  defaultGuestName.value = config.defaultGuestName || "Nama Tamu";
  shareCaption.value = config.shareCaption;
  apiEndpoint.value = config.apiEndpoint;
  let activePlaceholder = checkedValue("activePlaceholder") || "couple";
  let textSettings = structuredClone(config.text);
  let isDragging = false;
  let currentTwibbon = config.twibbon || "";
  let twibbonConcepts = [];

  function syncPlaceholderControls() {
    const item = textSettings[activePlaceholder];
    placeholderTemplate.value = item.template;
    placeholderSize.value = item.size;
    placeholderColor.value = item.color;
    placeholderFont.value = item.font;
    placeholderWeight.value = item.weight;
    placeholderX.value = item.x;
    placeholderY.value = item.y;
  }

  document.querySelector(`input[name="frameFit"][value="${config.frameFit}"]`).checked = true;
  aiProvider.value = config.aiProvider;
  fluxPrompt.value = config.fluxPrompt || "";
  function updateFluxPromptVisibility() {
    if (aiProvider.value === "flux") {
      fluxPromptGroup.style.display = "block";
    } else {
      fluxPromptGroup.style.display = "none";
    }
  }
  updateFluxPromptVisibility();
  document.querySelector(`input[name="outputFormat"][value="${activeFormat}"]`).checked = true;
  updateFormatUi();

  async function preview() {
    const nextConfig = {
      ...loadConfig(),
      bride: bride.value || defaultConfig.bride,
      groom: groom.value || defaultConfig.groom,
      date: date.value || defaultConfig.date,
      title: title.value || defaultConfig.title,
      shareCaption: shareCaption.value || defaultConfig.shareCaption,
      outputFormat: activeFormat,
      frameFit: checkedValue("frameFit"),
      aiProvider: aiProvider.value,
      apiEndpoint: apiEndpoint.value || defaultConfig.apiEndpoint,
      twibbon: currentTwibbon,
      fluxPrompt: fluxPrompt.value,
      defaultGuestName: defaultGuestName.value,
      text: readTextSettings(),
    };

    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#f0d7c6");
    gradient.addColorStop(0.5, "#d7e0ce");
    gradient.addColorStop(1, "#b8c3d6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, 420, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - 230, 620, 460, 350, 170);
    ctx.fill();

    const guestNameForPreview = defaultGuestName.value || "Nama Tamu";
    await drawTwibbon(ctx, nextConfig, guestNameForPreview);
    drawTextPlaceholders(ctx, nextConfig, guestNameForPreview, activePlaceholder);
  }

  function readTextSettings() {
    return structuredClone(textSettings);
  }

  function updateFormatUi() {
    const size = applyOutputFormat(activeFormat, canvas);
    frameSizeHint.textContent = getOutputSize(activeFormat).hint;
    placeholderX.max = size.width;
    placeholderY.max = size.height;
  }

  function writeActivePlaceholder() {
    textSettings[activePlaceholder] = {
      template: placeholderTemplate.value || defaultConfig.text[activePlaceholder].template,
      x: Number(placeholderX.value),
      y: Number(placeholderY.value),
      size: Number(placeholderSize.value),
      color: placeholderColor.value,
      font: placeholderFont.value,
      weight: placeholderWeight.value,
    };
  }

  async function persist() {
    const current = loadConfig();
    const nextConfig = {
      ...current,
      bride: bride.value || defaultConfig.bride,
      groom: groom.value || defaultConfig.groom,
      date: date.value || defaultConfig.date,
      title: title.value || defaultConfig.title,
      shareCaption: shareCaption.value || defaultConfig.shareCaption,
      outputFormat: activeFormat,
      frameFit: checkedValue("frameFit"),
      aiProvider: aiProvider.value,
      apiEndpoint: apiEndpoint.value || defaultConfig.apiEndpoint,
      twibbon: currentTwibbon,
      fluxPrompt: fluxPrompt.value,
      defaultGuestName: defaultGuestName.value,
      text: readTextSettings(),
    };
    saveConfig(nextConfig);
    try {
      if (await saveCloudConfig(nextConfig)) {
        save.textContent = "Tersimpan ke cloud";
      } else {
        save.textContent = "Cloud belum dikonfigurasi";
      }
    } catch (error) {
      console.warn(error);
      save.textContent = "Cloud gagal, tersimpan lokal";
    }
    await preview();
    window.setTimeout(() => {
      save.innerHTML = '<span class="button-icon">OK</span>Simpan Pengaturan';
    }, 1200);
  }

  upload.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    currentTwibbon = await fileToDataUrl(file);
    const nextConfig = { ...loadConfig(), twibbon: currentTwibbon };
    saveConfig(nextConfig);
    await preview();
  });

  async function refreshTwibbonConceptList() {
    conceptStatus.textContent = "Memuat konsep...";
    try {
      twibbonConcepts = await fetchTwibbonConcepts();
      conceptList.innerHTML = "";
      if (!twibbonConcepts.length) {
        conceptList.innerHTML = '<option value="">Belum ada konsep</option>';
        conceptStatus.textContent = isCloudConfigured()
          ? "Belum ada konsep twibbon tersimpan."
          : "Cloud belum dikonfigurasi.";
        return;
      }

      twibbonConcepts.forEach((concept) => {
        const option = document.createElement("option");
        option.value = concept.id;
        option.textContent = `${concept.name} (${concept.output_format})`;
        conceptList.append(option);
      });
      conceptStatus.textContent = `${twibbonConcepts.length} konsep tersedia.`;
    } catch (error) {
      console.warn(error);
      conceptStatus.textContent = "Gagal memuat konsep. Cek table twibbon_concepts dan policy Supabase.";
    }
  }

  saveConcept.addEventListener("click", async () => {
    if (!currentTwibbon) {
      conceptStatus.textContent = "Upload twibbon dulu sebelum menyimpan konsep.";
      return;
    }

    const name = conceptName.value.trim();
    if (!name) {
      conceptStatus.textContent = "Isi nama konsep dulu.";
      return;
    }

    conceptStatus.textContent = "Menyimpan konsep...";
    try {
      await saveTwibbonConceptToCloud({
        name,
        imageData: currentTwibbon,
        outputFormat: activeFormat,
        frameFit: checkedValue("frameFit"),
      });
      conceptStatus.textContent = "Konsep tersimpan ke cloud.";
      await refreshTwibbonConceptList();
    } catch (error) {
      console.warn(error);
      conceptStatus.textContent = "Gagal menyimpan konsep. Cek table/policy Supabase.";
    }
  });

  applyConcept.addEventListener("click", async () => {
    const selected = twibbonConcepts.find((concept) => concept.id === conceptList.value);
    if (!selected) {
      conceptStatus.textContent = "Pilih konsep dulu.";
      return;
    }

    currentTwibbon = selected.image_data;
    if (OUTPUT_FORMATS[selected.output_format] && selected.output_format !== activeFormat) {
      textSettings = scaleTextSettings(textSettings, activeFormat, selected.output_format);
      activeFormat = selected.output_format;
      document.querySelector(`input[name="outputFormat"][value="${activeFormat}"]`).checked = true;
      updateFormatUi();
    }
    if (selected.frame_fit) {
      document.querySelector(`input[name="frameFit"][value="${selected.frame_fit}"]`).checked = true;
    }
    conceptName.value = selected.name;
    saveConfig({ ...loadConfig(), twibbon: currentTwibbon, outputFormat: activeFormat, frameFit: checkedValue("frameFit") });
    syncPlaceholderControls();
    await preview();
    conceptStatus.textContent = "Konsep dipakai di preview. Klik Simpan Pengaturan untuk publish ke event.";
  });

  refreshConcepts.addEventListener("click", refreshTwibbonConceptList);

  [
    bride,
    groom,
    date,
    title,
    defaultGuestName,
    shareCaption,
    fluxPrompt,
    apiEndpoint,
  ].forEach((input) => input.addEventListener("input", preview));
  [
    placeholderTemplate,
    placeholderSize,
    placeholderColor,
    placeholderFont,
    placeholderWeight,
    placeholderX,
    placeholderY,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      writeActivePlaceholder();
      preview();
    });
  });
  document.querySelectorAll("input[name='activePlaceholder']").forEach((input) => {
    input.addEventListener("change", () => {
      activePlaceholder = checkedValue("activePlaceholder");
      syncPlaceholderControls();
      preview();
    });
  });
  document.querySelectorAll("input[name='outputFormat']").forEach((input) => {
    input.addEventListener("change", () => {
      const nextFormat = checkedValue("outputFormat");
      if (nextFormat === activeFormat) return;
      textSettings = scaleTextSettings(textSettings, activeFormat, nextFormat);
      activeFormat = nextFormat;
      updateFormatUi();
      syncPlaceholderControls();
      preview();
    });
  });
  document.querySelectorAll("input[name='frameFit']").forEach((input) => input.addEventListener("change", preview));
  aiProvider.addEventListener("change", () => {
    updateFluxPromptVisibility();
    preview();
  });
  centerPlaceholder.addEventListener("click", () => {
    textSettings[activePlaceholder].x = CANVAS_WIDTH / 2;
    syncPlaceholderControls();
    preview();
  });
  canvas.addEventListener("pointerdown", (event) => {
    isDragging = true;
    canvas.setPointerCapture(event.pointerId);
    moveActiveText(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (isDragging) moveActiveText(event);
  });
  canvas.addEventListener("pointerup", () => {
    isDragging = false;
  });

  function moveActiveText(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    textSettings[activePlaceholder].x = Math.round(Math.max(0, Math.min(CANVAS_WIDTH, x)));
    textSettings[activePlaceholder].y = Math.round(Math.max(0, Math.min(CANVAS_HEIGHT, y)));
    syncPlaceholderControls();
    preview();
  }
  save.addEventListener("click", persist);
  reset.addEventListener("click", async () => {
    saveConfig({ ...defaultConfig });
    window.location.reload();
  });

  syncPlaceholderControls();
  preview();
  const localBeforeCloud = localStorage.getItem(CONFIG_KEY);
  fetchCloudConfig()
    .then((cloudConfig) => {
      if (cloudConfig && localBeforeCloud !== localStorage.getItem(CONFIG_KEY)) {
        window.location.reload();
      }
    })
    .catch((error) => console.warn(error));
  refreshTwibbonConceptList();
}

function initManager() {
  const currentPassword = document.querySelector("#managerCurrentPassword");
  const newPassword = document.querySelector("#managerNewPassword");
  const confirmPassword = document.querySelector("#managerConfirmPassword");
  const saveButton = document.querySelector("#saveManagerPassword");
  const clearButton = document.querySelector("#clearManagerPassword");
  const status = document.querySelector("#managerStatus");
  const supabaseUrl = document.querySelector("#supabaseUrl");
  const supabaseAnonKey = document.querySelector("#supabaseAnonKey");
  const eventSlug = document.querySelector("#eventSlug");
  const saveCloud = document.querySelector("#saveCloudSettings");
  const clearCloud = document.querySelector("#clearCloudSettings");
  const cloudStatus = document.querySelector("#cloudStatus");
  const cloudSettings = loadCloudSettings();

  supabaseUrl.value = cloudSettings.supabaseUrl;
  supabaseAnonKey.value = cloudSettings.supabaseAnonKey;
  eventSlug.value = cloudSettings.eventSlug;

  function isManagerAllowed() {
    return currentPassword.value === getStoredPassword(MANAGER_PASSWORD_KEY, DEFAULT_MANAGER_PASSWORD);
  }

  saveButton.addEventListener("click", () => {
    if (!isManagerAllowed()) {
      status.textContent = "Password manager saat ini salah.";
      return;
    }

    if (newPassword.value.length < 6) {
      status.textContent = "Password admin minimal 6 karakter.";
      return;
    }

    if (newPassword.value !== confirmPassword.value) {
      status.textContent = "Konfirmasi password belum sama.";
      return;
    }

    localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword.value);
    localStorage.setItem(MANAGER_PASSWORD_KEY, newPassword.value);
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    status.textContent = "Password admin tersimpan. Buka halaman Admin lalu login dengan password baru.";
  });

  clearButton.addEventListener("click", () => {
    if (!isManagerAllowed()) {
      status.textContent = "Password manager saat ini salah.";
      return;
    }

    localStorage.setItem(ADMIN_PASSWORD_KEY, PASSWORD_DISABLED);
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    status.textContent = "Password admin dimatikan untuk browser ini.";
  });

  saveCloud.addEventListener("click", async () => {
    saveCloudSettings({
      supabaseUrl: supabaseUrl.value.trim(),
      supabaseAnonKey: supabaseAnonKey.value.trim(),
      eventSlug: eventSlug.value.trim() || defaultCloudSettings.eventSlug,
    });

    try {
      await fetchCloudConfig();
      cloudStatus.textContent = "Cloud sync tersimpan dan koneksi berhasil.";
    } catch (error) {
      console.warn(error);
      cloudStatus.textContent = "Cloud sync tersimpan, tapi koneksi belum berhasil. Cek tabel/policy Supabase.";
    }
  });

  clearCloud.addEventListener("click", () => {
    clearCloudSettings();
    const publicConfig = window.SOUVENIR_CLOUD_CONFIG || defaultCloudSettings;
    supabaseUrl.value = publicConfig.supabaseUrl || "";
    supabaseAnonKey.value = publicConfig.supabaseAnonKey || "";
    eventSlug.value = publicConfig.eventSlug || defaultCloudSettings.eventSlug;
    cloudStatus.textContent = "Override lokal dibersihkan. App kembali memakai cloud-config.js.";
  });
}

function initGuest() {
  const config = loadConfig();
  const camera = document.querySelector("#camera");
  const canvas = document.querySelector("#workCanvas");
  applyOutputFormat(config.outputFormat, canvas);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cameraEmpty = document.querySelector("#cameraEmpty");
  const startCamera = document.querySelector("#startCamera");
  const switchCamera = document.querySelector("#switchCamera");
  const cameraZoom = document.querySelector("#cameraZoom");
  const capturePhoto = document.querySelector("#capturePhoto");
  const uploadPhoto = document.querySelector("#uploadPhoto");
  const deviceCameraPhoto = document.querySelector("#deviceCameraPhoto");
  const renderGift = document.querySelector("#renderGift");
  const saveGift = document.querySelector("#saveGift");
  const shareGift = document.querySelector("#shareGift");
  const guestName = document.querySelector("#guestName");
  const beforeImage = document.querySelector("#beforeImage");
  const afterImage = document.querySelector("#afterImage");
  const engineNote = document.querySelector("#engineNote");
  const compareCard = document.querySelector("#compareCard");
  const compareAfter = document.querySelector("#compareAfter");
  const compareLine = document.querySelector("#compareLine");
  const compareSlider = document.querySelector("#compareSlider");
  const adminLink = document.querySelector("#guestAdminLink");
  const adminGate = document.querySelector("#guestAdminGate");
  const adminPassword = document.querySelector("#guestAdminPassword");
  const adminLogin = document.querySelector("#guestAdminLogin");
  const adminCancel = document.querySelector("#guestAdminCancel");
  const adminStatus = document.querySelector("#guestAdminStatus");

  let sourceImage = null;
  let lastBlob = null;
  let stream = null;
  let currentFacing = checkedValue("cameraFacing") || "user";
  let currentZoom = Number(cameraZoom.value) || 1;
  let zoomCapabilities = null;

  document.querySelector("#guestTitle").textContent = config.title;
  document.querySelector("#coupleName").textContent = `${config.bride} & ${config.groom}`;
  document.querySelector("#eventDate").textContent = config.date;

  const styleSelectorGroup = document.querySelector("#styleSelectorGroup");
  if (styleSelectorGroup) {
    if (config.aiProvider === "flux") {
      styleSelectorGroup.style.display = "none";
    } else {
      styleSelectorGroup.style.display = "block";
    }
  }

  function updateEngineNote(status = null) {
    const activeConfig = loadConfig();
    if (status?.message) {
      engineNote.textContent = status.message;
      return;
    }
    const label = activeConfig.aiProvider === "flux" ? "FLUX Kontext" : "Gemini API";
    engineNote.textContent =
      activeConfig.aiProvider !== "local"
        ? `${label} aktif. Foto akan diproses dengan AI saat membuat karikatur.`
        : "Cartoon Lokal aktif. Pilih FLUX Kontext atau Gemini API dari panel admin untuk memakai AI.";
  }

  updateEngineNote();

  function openAdminGate(event) {
    if (isAdminAuthenticated()) return;
    event.preventDefault();
    adminGate.hidden = false;
    adminStatus.textContent = "";
    adminPassword.value = "";
    adminPassword.focus();
  }

  function closeAdminGate() {
    adminGate.hidden = true;
    adminPassword.value = "";
    adminStatus.textContent = "";
  }

  function submitAdminGate() {
    if (adminPassword.value === getAdminPassword()) {
      setAdminAuthenticated();
      window.location.href = "admin.html";
      return;
    }
    adminStatus.textContent = "Password admin salah.";
  }

  async function openCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    currentZoom = 1;
    cameraZoom.value = "1";

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: currentFacing } },
      audio: false,
    });
    camera.srcObject = stream;
    await configureCameraZoom();
    camera.style.display = "block";
    canvas.style.display = "none";
    cameraEmpty.style.display = "none";
    capturePhoto.disabled = false;
    switchCamera.disabled = false;
  }

  async function configureCameraZoom() {
    const [track] = stream?.getVideoTracks() || [];
    zoomCapabilities = track?.getCapabilities?.().zoom ? track.getCapabilities().zoom : null;

    if (zoomCapabilities) {
      cameraZoom.min = zoomCapabilities.min || 1;
      cameraZoom.max = Math.min(zoomCapabilities.max || 2, 4);
      cameraZoom.step = zoomCapabilities.step || 0.1;
      currentZoom = Math.max(Number(cameraZoom.min), Math.min(1, Number(cameraZoom.max)));
      cameraZoom.value = currentZoom;
      await applyCameraZoom();
    } else {
      cameraZoom.min = 1;
      cameraZoom.max = 2;
      cameraZoom.step = 0.05;
      currentZoom = Number(cameraZoom.value) || 1;
    }
  }

  async function applyCameraZoom() {
    currentZoom = Number(cameraZoom.value) || 1;
    const [track] = stream?.getVideoTracks() || [];
    if (zoomCapabilities && track?.applyConstraints) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: currentZoom }] });
      } catch (error) {
        console.warn("Hardware zoom failed, using digital zoom.", error);
      }
    }
  }

  function drawPlaceholder() {
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#f0d7c6");
    gradient.addColorStop(0.48, "#d7e0ce");
    gradient.addColorStop(1, "#b8c3d6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, 430, 155, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - 230, 620, 460, 360, 180);
    ctx.fill();
  }

  async function renderSouvenir() {
    if (!guestName.value.trim()) {
      guestName.focus();
      cameraEmpty.style.display = "block";
      cameraEmpty.innerHTML =
        "<strong>Isi nama dulu</strong><span>Nama tamu akan dipakai di souvenir dan caption kirim.</span>";
      return;
    }

    applyOutputFormat(loadConfig().outputFormat, canvas);
    const originalCanvas = document.createElement("canvas");
    originalCanvas.width = CANVAS_WIDTH;
    originalCanvas.height = CANVAS_HEIGHT;
    const originalCtx = originalCanvas.getContext("2d");

    if (sourceImage) {
      drawCover(originalCtx, sourceImage, false, currentZoom, "contain");
    } else if (camera.srcObject) {
      drawCover(originalCtx, camera, currentFacing === "user", zoomCapabilities ? 1 : currentZoom, "contain");
    } else {
      drawPlaceholder();
      originalCtx.drawImage(canvas, 0, 0);
    }

    beforeImage.src = originalCanvas.toDataURL("image/jpeg", 0.9);
    renderGift.disabled = true;
    renderGift.textContent = "Memproses...";
    updateEngineNote(
      loadConfig().aiProvider !== "local"
        ? { message: `Sedang memproses foto dengan ${loadConfig().aiProvider === "flux" ? "FLUX Kontext" : "Gemini API"}...` }
        : { message: "Sedang memproses foto dengan Cartoon Lokal..." }
    );
    try {
      const caricatureCanvas = await generateCaricature(originalCanvas, checkedValue("style"), loadConfig());
      updateEngineNote(generateCaricature.lastStatus);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(caricatureCanvas, 0, 0);
      const latestConfig = loadConfig();
      await drawTwibbon(ctx, latestConfig, guestName.value || "Tamu Undangan");
      drawTextPlaceholders(ctx, latestConfig, guestName.value || "Tamu Undangan");

      afterImage.src = canvas.toDataURL("image/png");
      canvas.style.display = "block";
      camera.style.display = "none";
      cameraEmpty.style.display = "none";
      compareCard.hidden = false;
      setCompare(compareSlider.value);

      canvas.toBlob((blob) => {
        lastBlob = blob;
        saveGift.disabled = !blob;
        shareGift.disabled = !blob;
      }, "image/png");
    } finally {
      renderGift.disabled = false;
      renderGift.innerHTML = '<span class="button-icon">GO</span>Buat Karikatur';
    }
  }

  function setCompare(value) {
    compareAfter.style.clipPath = `inset(0 ${100 - Number(value)}% 0 0)`;
    compareLine.style.left = `${value}%`;
  }

  function captureFromVideo() {
    const image = new Image();
    drawCover(ctx, camera, currentFacing === "user", zoomCapabilities ? 1 : currentZoom, "contain");
    image.onload = () => {
      sourceImage = image;
      renderSouvenir();
    };
    image.src = canvas.toDataURL("image/jpeg", 0.92);
  }

  async function shareSouvenir() {
    if (!lastBlob) return;
    const latestConfig = loadConfig();
    const caption = fillTemplate(
      latestConfig.shareCaption || defaultConfig.shareCaption,
      latestConfig,
      guestName.value || "Tamu Undangan"
    );
    const file = new File([lastBlob], "souvenir-karikatur.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "Souvenir Karikatur",
        text: caption,
        files: [file],
      });
      return;
    }

    downloadSouvenir();
  }

  function downloadSouvenir() {
    if (!lastBlob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(lastBlob);
    link.download = "souvenir-karikatur.png";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  startCamera.addEventListener("click", () => {
    openCamera().catch(() => {
      cameraEmpty.style.display = "block";
      cameraEmpty.innerHTML =
        "<strong>Kamera tidak bisa dibuka</strong><span>Coba izinkan akses kamera atau unggah foto dari galeri.</span>";
    });
  });
  switchCamera.addEventListener("click", () => {
    currentFacing = currentFacing === "user" ? "environment" : "user";
    document.querySelector(`input[name="cameraFacing"][value="${currentFacing}"]`).checked = true;
    openCamera().catch(() => {
      currentFacing = currentFacing === "user" ? "environment" : "user";
      document.querySelector(`input[name="cameraFacing"][value="${currentFacing}"]`).checked = true;
      cameraEmpty.style.display = "block";
      cameraEmpty.innerHTML =
        "<strong>Kamera tidak bisa diganti</strong><span>Device/browser ini mungkin hanya menyediakan satu kamera.</span>";
    });
  });
  cameraZoom.addEventListener("input", () => {
    applyCameraZoom();
  });
  document.querySelectorAll("input[name='cameraFacing']").forEach((input) => {
    input.addEventListener("change", () => {
      currentFacing = checkedValue("cameraFacing") || "user";
      if (stream) {
        openCamera().catch(() => {
          cameraEmpty.style.display = "block";
          cameraEmpty.innerHTML =
            "<strong>Kamera tidak bisa dibuka</strong><span>Coba pilih kamera lain atau unggah foto dari galeri.</span>";
        });
      }
    });
  });

  capturePhoto.addEventListener("click", captureFromVideo);
  renderGift.addEventListener("click", renderSouvenir);
  saveGift.addEventListener("click", downloadSouvenir);
  shareGift.addEventListener("click", shareSouvenir);
  compareSlider.addEventListener("input", () => setCompare(compareSlider.value));
  adminLink.addEventListener("click", openAdminGate);
  adminLogin.addEventListener("click", submitAdminGate);
  adminCancel.addEventListener("click", closeAdminGate);
  adminPassword.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitAdminGate();
    if (event.key === "Escape") closeAdminGate();
  });

  uploadPhoto.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const image = new Image();
    image.onload = () => {
      sourceImage = image;
      renderSouvenir();
    };
    image.src = URL.createObjectURL(file);
  });

  deviceCameraPhoto.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const image = new Image();
    image.onload = () => {
      sourceImage = image;
      renderSouvenir();
    };
    image.src = URL.createObjectURL(file);
  });

  guestName.addEventListener("input", () => {
    if (!compareCard.hidden) renderSouvenir();
  });
  document.querySelectorAll("input[name='style']").forEach((input) => {
    input.addEventListener("change", () => {
      if (!compareCard.hidden) renderSouvenir();
    });
  });

  drawPlaceholder();
  canvas.style.display = "block";
  const localBeforeCloud = localStorage.getItem(CONFIG_KEY);
  fetchCloudConfig()
    .then((cloudConfig) => {
      if (cloudConfig && localBeforeCloud !== localStorage.getItem(CONFIG_KEY)) {
        window.location.reload();
      }
    })
    .catch((error) => console.warn(error));
}

if (page === "admin") initAdmin();
if (page === "guest") initGuest();
if (page === "manager") initManager();
