# Integrasi AI karikatur berbayar

Mode default memakai Cartoon Lokal gratis di browser (`aiProvider: "local"`). Panel admin menyediakan:

- `Cartoon Lokal (Gratis)`
- `FLUX Kontext`
- `Gemini API`

Mode FLUX dan Gemini memakai satu endpoint Supabase Edge Function. API key tidak pernah dikirim ke frontend.

Ukuran output dan twibbon:
- Story 9:16: 1080 x 1920 px.
- Portrait 4:5: 1080 x 1350 px.
- Frame/twibbon disarankan PNG transparan sesuai format aktif.
- Area tengah frame sebaiknya transparan karena akan dipakai untuk foto/karikatur selfie atau wefie.
- Kalau frame dibuat lebih besar seperti 1122 x 1402 px, rasionya masih dekat 4:5 dan bisa dipakai. Web akan menyesuaikan dengan mode `Cover` atau `Contain`.
- Teks nama mempelai, tanggal, dan nama tamu dioverlay oleh web setelah twibbon, memakai token `{mempelai}`, `{tanggal}`, dan `{tamu}` dari panel admin.

Endpoint harus menerima:

```json
{
  "image": "data:image/jpeg;base64,...",
  "engine": "flux | gemini",
  "outputFormat": "story | portrait",
  "style": "soft | comic | sketch",
  "prompt": "Create a caricature that follows the uploaded selfie or group selfie composition. Preserve the number of people, poses, and overall framing."
}
```

Endpoint harus mengembalikan:

```json
{
  "image": "data:image/png;base64,..."
}
```

Catatan implementasi:
- Web akan mencoba endpoint API lebih dulu saat `aiProvider` bernilai `flux` atau `gemini`.
- Jika API gagal, web otomatis fallback ke karikatur lokal agar tamu tetap mendapat hasil.
- Twibbon tetap dioverlay di browser setelah hasil karikatur diterima, jadi API tidak perlu tahu nama mempelai atau file frame.

## Gemini / Nano Banana lewat Supabase

Project ini sudah menyiapkan template Supabase Edge Function:

```txt
supabase/functions/generate-caricature/index.ts
```

Secret yang dibutuhkan di Supabase:

```txt
GEMINI_API_KEY=isi_api_key_google_ai_studio
```

Opsional, kalau ingin mengganti model:

```txt
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

Setelah function `generate-caricature` dideploy, pakai endpoint ini di halaman admin:

```txt
https://bjjibgbwgvphysavutiw.supabase.co/functions/v1/generate-caricature
```

Karena halaman tamu bersifat publik, buka pengaturan function `generate-caricature` di Supabase lalu nonaktifkan `Verify JWT`. Secret `GEMINI_API_KEY` tetap aman karena hanya bisa dibaca dari server-side Edge Function.

`gemini-2.5-flash-image` adalah model Nano Banana resmi untuk pemrosesan gambar cepat. Gemini image API tidak menyediakan free tier, jadi project Google AI Studio yang dipakai harus memiliki billing aktif.

## FLUX Kontext lewat FluxAPI.ai

Tambahkan secret:

```txt
FLUXAPI_API_KEY=isi_api_key_fluxapi
```

FluxAPI.ai meminta URL publik sebagai `inputImage`. Edge Function otomatis mengunggah selfie sementara ke bucket public `souvenir-ai-inputs`, menunggu task selesai, lalu menghapus input tersebut.

Setup bucket terdapat di:

```txt
SUPABASE_SETUP.md
```
