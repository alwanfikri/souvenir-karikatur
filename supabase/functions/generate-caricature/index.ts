const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const geminiModel = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
const fluxApiKey = Deno.env.get("FLUXAPI_API_KEY") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const inputBucket = Deno.env.get("FLUX_INPUT_BUCKET") || "souvenir-ai-inputs";

type ParsedImage = {
  mimeType: string;
  extension: string;
  data: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function parseDataUrl(dataUrl: string): ParsedImage {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error("Format gambar harus berupa data URL image/png, image/jpeg, atau image/webp.");
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
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

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
    "Transform the uploaded selfie or group selfie into a wedding souvenir caricature.",
    styleInstruction(style),
    "Preserve each person's identity, pose, head count, composition, and camera framing.",
    "Keep the image family-friendly, bright, clean, and ready to be overlaid with a transparent wedding twibbon/frame.",
    "Do not add text, logos, borders, or extra frame decorations.",
    extraPrompt,
  ]
    .filter(Boolean)
    .join(" ");
}

async function requestGemini(image: ParsedImage, prompt: string) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY belum diset di Supabase Secrets.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: image.mimeType,
                  data: image.data,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: Record<string, unknown>) => part.inlineData || part.inline_data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) {
    throw new Error("Gemini tidak mengembalikan gambar.");
  }

  const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
  return {
    image: `data:${mimeType};base64,${inlineData.data}`,
    provider: "gemini",
    model: geminiModel,
  };
}

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
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${inputBucket}/${objectPath}`, {
    method: "POST",
    headers: {
      ...storageHeaders(image.mimeType),
      "x-upsert": "false",
    },
    body: decodeBase64(image.data),
  });

  if (!response.ok) {
    throw new Error(`Upload input FLUX gagal (${response.status}). Pastikan bucket ${inputBucket} sudah dibuat public.`);
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${inputBucket}/${objectPath}`;
  console.log(`Temporary image uploaded. Public URL: ${publicUrl}`);

  return {
    objectPath,
    publicUrl,
  };
}

async function removeTemporaryImage(objectPath: string) {
  if (!objectPath) return;
  await fetch(`${supabaseUrl}/storage/v1/object/${inputBucket}/${objectPath}`, {
    method: "DELETE",
    headers: storageHeaders(),
  }).catch(() => undefined);
}

async function pollFluxTask(taskId: string) {
  console.log(`Memulai polling untuk Task ID: ${taskId}`);
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetch(`https://api.fluxapi.ai/api/v1/flux/kontext/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${fluxApiKey}` },
    });
    const payload = await response.json();
    if (!response.ok || payload.code !== 200) {
      throw new Error(payload.msg || `FluxAPI status HTTP ${response.status}`);
    }

    const successFlag = payload.data?.successFlag;
    console.log(`Polling attempt ${attempt}: successFlag = ${successFlag}`);

    if (successFlag === 1) {
      const resultImageUrl = payload.data?.response?.resultImageUrl;
      if (!resultImageUrl) {
        throw new Error("FluxAPI sukses tetapi tidak mengembalikan URL hasil (resultImageUrl).");
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

async function downloadAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download hasil FLUX gagal (${response.status}).`);
  const mimeType = response.headers.get("content-type") || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function requestFlux(image: ParsedImage, prompt: string, outputFormat: string) {
  if (!fluxApiKey) {
    throw new Error("FLUXAPI_API_KEY belum diset di Supabase Secrets.");
  }

  let objectPath = "";
  try {
    const uploaded = await uploadTemporaryImage(image);
    objectPath = uploaded.objectPath;
    const response = await fetch("https://api.fluxapi.ai/api/v1/flux/kontext/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fluxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        inputImage: uploaded.publicUrl,
        aspectRatio: outputFormat === "story" ? "9:16" : "4:5",
        outputFormat: "png",
        safetyTolerance: 2,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.code !== 200 || !payload.data?.taskId) {
      throw new Error(payload.msg || `FluxAPI HTTP ${response.status}`);
    }

    const resultUrl = await pollFluxTask(payload.data.taskId);
    return {
      image: await downloadAsDataUrl(resultUrl),
      provider: "fluxapi",
      model: "flux-kontext",
    };
  } finally {
    await removeTemporaryImage(objectPath);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await request.json();
    const engine = String(payload.engine || "gemini");
    const image = parseDataUrl(String(payload.image || ""));
    const prompt = engine === "flux"
      ? String(payload.prompt || "")
      : buildPrompt(String(payload.style || "soft"), String(payload.prompt || ""));

    if (engine === "flux") {
      return jsonResponse(await requestFlux(image, prompt, String(payload.outputFormat || "portrait")));
    }
    if (engine === "gemini") {
      return jsonResponse(await requestGemini(image, prompt));
    }
    return jsonResponse({ error: `Engine ${engine} tidak didukung oleh Edge Function.` }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Request tidak valid." }, 400);
  }
});
