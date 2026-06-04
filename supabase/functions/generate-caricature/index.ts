/*
  Supabase Edge Function – generate‑caricature
  Supports three AI providers:
    • gemini  (Google Gemini flash image model)
    • flux    (FluxAPI Kontekst)
    • fal     (Fal.ai Flux Pro)
  The front‑end passes:
    - engine: "gemini" | "flux" | "fal"
    - image: data‑url (png/jpg/webp)
    - prompt: custom prompt for flux/fal, otherwise built from style + extraPrompt
    - outputFormat: "portrait" | "story" … (used for aspect‑ratio)
*/

// -------------------------------------------------------------------
// CORS headers – allow the front‑end to call this function
// -------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// -------------------------------------------------------------------
// Environment variables (Supabase Secrets)
// -------------------------------------------------------------------
const geminiModel = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
const fluxApiKey = Deno.env.get("FLUXAPI_API_KEY") || "";
const falApiKey = Deno.env.get("FALAI_API_KEY") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const inputBucket = Deno.env.get("FLUX_INPUT_BUCKET") || "souvenir-ai-inputs";

// -------------------------------------------------------------------
// Types & small helpers
// -------------------------------------------------------------------
type ParsedImage = {
  mimeType: string;
  extension: string;
  data: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseDataUrl(dataUrl: string): ParsedImage {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error(
      "Format gambar harus berupa data URL image/png, image/jpeg, atau image/webp.",
    );
  }
  const mimeType = match[1].replace("image/jpg", "image/jpeg");
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  return { mimeType, extension: extensions[mimeType] || "jpg", data: match[2] };
}

function decodeBase64(data: string) {
  const binary = atob(data);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// -------------------------------------------------------------------
// Prompt helpers (used for Gemini & Flux)
// -------------------------------------------------------------------
function styleInstruction(style: string) {
  if (style === "sketch") {
    return "Use a clean pencil-sketch caricature style with refined line work and soft shading.";
  }
  if (style === "comic") {
    return "Use a cheerful colorful comic caricature style with expressive faces and polished event-photo quality.";
  }
  return "Use a warm semi-realistic caricature style with friendly exaggerated features and elegant wedding-souvenir polish.";
}

function buildPrompt(style: string, extraPrompt: string) {
  return [
    "Transform the uploaded photo into a wedding souvenir caricature.",
    styleInstruction(style),
    "Strictly preserve the exact head count, identities, poses, composition, and framing of the original image. Absolutely do not add any additional people, extra figures, or background characters.",
    "Keep the image family‑friendly, bright, clean, and ready to be overlaid with a transparent wedding twibbon/frame.",
    "Do not add text, logos, borders, or extra frame decorations.",
    extraPrompt,
  ]
    .filter(Boolean)
    .join(" ");
}

// -------------------------------------------------------------------
// Supabase storage helpers (temporary upload)
// -------------------------------------------------------------------
function storageHeaders(contentType?: string) {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

async function uploadTemporaryImage(image: ParsedImage) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Environment Supabase Storage belum tersedia.");
  }

  const objectPath = `${crypto.randomUUID()}.${image.extension}`;
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${inputBucket}/${objectPath}`,
    {
      method: "POST",
      headers: { ...storageHeaders(image.mimeType), "x-upsert": "false" },
      body: decodeBase64(image.data),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Upload input FLUX gagal (${response.status}). Pastikan bucket ${inputBucket} sudah dibuat public.`,
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${inputBucket}/${objectPath}`;
  console.log(`Temporary image uploaded. Public URL: ${publicUrl}`);

  return { objectPath, publicUrl };
}

async function removeTemporaryImage(objectPath: string) {
  if (!objectPath) return;
  await fetch(
    `${supabaseUrl}/storage/v1/object/${inputBucket}/${objectPath}`,
    { method: "DELETE", headers: storageHeaders() },
  ).catch(() => undefined);
}

// -------------------------------------------------------------------
// Download helper (convert remote image to data‑url)
// -------------------------------------------------------------------
async function downloadAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download hasil gagal (${response.status}).`);
  const mimeType = response.headers.get("content-type") || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

// -------------------------------------------------------------------
// Provider: Gemini
// -------------------------------------------------------------------
async function requestGemini(image: ParsedImage, prompt: string) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY belum diset di Supabase Secrets.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }, { inline_data: { mime_type: image.mimeType, data: image.data } }],
        }],
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: Record<string, unknown>) => p.inlineData || p.inline_data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;

  if (!inlineData?.data) {
    throw new Error("Gemini tidak mengembalikan gambar.");
  }

  const mime = inlineData.mimeType || inlineData.mime_type || "image/png";
  return { image: `data:${mime};base64,${inlineData.data}`, provider: "gemini", model: geminiModel };
}

// -------------------------------------------------------------------
// Provider: FluxAPI (existing implementation)
// -------------------------------------------------------------------
async function requestFlux(image: ParsedImage, prompt: string, outputFormat: string) {
  if (!fluxApiKey) {
    throw new Error("FLUXAPI_API_KEY belum diset di Supabase Secrets.");
  }

  let objectPath = "";
  try {
    const uploaded = await uploadTemporaryImage(image);
    objectPath = uploaded.objectPath;

    const response = await fetch(
      "https://api.fluxapi.ai/api/v1/flux/kontext/generate",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${fluxApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          inputImage: uploaded.publicUrl,
          aspectRatio: outputFormat === "story" ? "9:16" : "4:5",
          outputFormat: "png",
          safetyTolerance: 2,
        }),
      },
    );

    const payload = await response.json();
    if (!response.ok || payload.code !== 200 || !payload.data?.taskId) {
      throw new Error(payload.msg || `FluxAPI HTTP ${response.status}`);
    }

    const resultUrl = await pollFluxTask(payload.data.taskId);
    return { image: await downloadAsDataUrl(resultUrl), provider: "fluxapi", model: "flux-kontext" };
  } finally {
    await removeTemporaryImage(objectPath);
  }
}

// -------------------------------------------------------------------
// Provider: Fal.ai Flux Pro
// -------------------------------------------------------------------
async function requestFal(image: ParsedImage, prompt: string, outputFormat: string) {
  if (!falApiKey) {
    throw new Error("FALAI_API_KEY belum diset di Supabase Secrets.");
  }

  let objectPath = "";
  try {
    const uploaded = await uploadTemporaryImage(image);
    objectPath = uploaded.objectPath;

    const response = await fetch(
      "https://api.fal.ai/v1/flux-pro/v1.1/generate",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${falApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image_url: uploaded.publicUrl,
          aspect_ratio: outputFormat === "story" ? "9:16" : "4:5",
          output_format: "png",
          safety_tolerance: 2,
        }),
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Fal.ai HTTP ${response.status}`);
    }

    const resultUrl = payload.result_image_url || payload.resultImageUrl;
    if (!resultUrl) {
      throw new Error("Fal.ai tidak mengembalikan URL hasil.");
    }

    return { image: await downloadAsDataUrl(resultUrl), provider: "fal", model: "flux-pro" };
  } finally {
    await removeTemporaryImage(objectPath);
  }
}

// -------------------------------------------------------------------
// Flux task polling (used by requestFlux)
// -------------------------------------------------------------------
async function pollFluxTask(taskId: string) {
  console.log(`Memulai polling untuk Task ID: ${taskId}`);
  for (let attempt = 1; attempt <= 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetch(
      `https://api.fluxapi.ai/api/v1/flux/kontext/record-info?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${fluxApiKey}` } },
    );
    const payload = await response.json();
    if (!response.ok || payload.code !== 200) {
      throw new Error(payload.msg || `FluxAPI status HTTP ${response.status}`);
    }
    const successFlag = payload.data?.successFlag;
    console.log(`Polling attempt ${attempt}: successFlag = ${successFlag}`);
    if (successFlag === 1) {
      const resultImageUrl = payload.data?.response?.resultImageUrl;
      if (!resultImageUrl) {
        throw new Error(
          "FluxAPI sukses tetapi tidak mengembalikan URL hasil (resultImageUrl).",
        );
      }
      console.log(`FluxAPI sukses. URL Hasil: ${resultImageUrl}`);
      return resultImageUrl;
    }
    if (successFlag === 2 || successFlag === 3) {
      const errorMsg = payload.data?.errorMessage || "FluxAPI gagal memproses gambar.";
      throw new Error(`${errorMsg} (successFlag: ${successFlag})`);
    }
  }
  throw new Error("FluxAPI belum selesai setelah 120 detik.");
}

// -------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------
Deno.serve(async (request) => {
  // Pre‑flight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await request.json();
    const engine = String(payload.engine || "gemini"); // gemini | flux | fal
    const image = parseDataUrl(String(payload.image || ""));

    // Prompt handling:
    //   - flux & fal use the prompt sent from the UI directly
    //   - other engines build a prompt from style + extraPrompt
    const prompt = (engine === "flux" || engine === "fal")
      ? String(payload.prompt || "")
      : buildPrompt(String(payload.style || "soft"), String(payload.prompt || ""));

    if (engine === "flux") {
      return jsonResponse(
        await requestFlux(image, prompt, String(payload.outputFormat || "portrait")),
      );
    }
    if (engine === "fal") {
      return jsonResponse(
        await requestFal(image, prompt, String(payload.outputFormat || "portrait")),
      );
    }
    if (engine === "gemini") {
      return jsonResponse(await requestGemini(image, prompt));
    }
    return jsonResponse({ error: `Engine ${engine} tidak didukung oleh Edge Function.` }, 400);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Request tidak valid." }, 400);
  }
});
