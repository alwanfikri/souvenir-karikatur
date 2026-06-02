const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const model = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
const apiKey = Deno.env.get("GEMINI_API_KEY");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error("Format gambar harus berupa data URL image/png, image/jpeg, atau image/webp.");
  }
  return {
    mimeType: match[1].replace("image/jpg", "image/jpeg"),
    data: match[2],
  };
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY belum diset di Supabase Secrets." }, 500);
  }

  try {
    const payload = await request.json();
    const { mimeType, data } = parseDataUrl(String(payload.image || ""));
    const style = String(payload.style || "soft");
    const prompt = String(payload.prompt || "");
    const finalPrompt = [
      "Transform the uploaded selfie or group selfie into a wedding souvenir caricature.",
      styleInstruction(style),
      "Preserve each person's identity, pose, head count, composition, and camera framing.",
      "Keep the image family-friendly, bright, clean, and ready to be overlaid with a transparent wedding twibbon/frame.",
      "Do not add text, logos, borders, or extra frame decorations.",
      prompt,
    ]
      .filter(Boolean)
      .join(" ");

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: finalPrompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const geminiPayload = await geminiResponse.json();
    if (!geminiResponse.ok) {
      return jsonResponse(
        {
          error: "Gemini gagal membuat karikatur.",
          detail: geminiPayload?.error?.message || `HTTP ${geminiResponse.status}`,
        },
        geminiResponse.status
      );
    }

    const parts = geminiPayload?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: Record<string, unknown>) => part.inlineData || part.inline_data);
    const inlineData = imagePart?.inlineData || imagePart?.inline_data;
    const imageData = inlineData?.data;
    const outputMimeType = inlineData?.mimeType || inlineData?.mime_type || "image/png";

    if (!imageData) {
      return jsonResponse({ error: "Gemini tidak mengembalikan gambar." }, 502);
    }

    return jsonResponse({
      image: `data:${outputMimeType};base64,${imageData}`,
      model,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Request tidak valid." }, 400);
  }
});
