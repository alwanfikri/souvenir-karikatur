# Migration Plan: Cheapest AI

## Tujuan

Menurunkan biaya pembuatan karikatur souvenir pernikahan tanpa mengubah alur aplikasi:

1. Tamu input nama.
2. Tamu upload selfie/wefie.
3. Engine mengubah foto menjadi karikatur.
4. Twibbon ditambahkan.
5. Placeholder nama dirender.
6. Hasil disimpan atau dibagikan.

## Mode Engine

Panel admin menyediakan:

```txt
Cartoon Lokal (Gratis)
FLUX Kontext
Gemini API
```

Default:

```txt
Cartoon Lokal (Gratis)
```

## Strategi Biaya

### Cartoon Lokal

Filter kartun berjalan di browser tanpa API.

```txt
Biaya: Rp 0
```

### FLUX Kontext

Provider awal:

```txt
FluxAPI.ai
```

Referensi API:

```txt
https://docs.fluxapi.ai/flux-kontext-api/generate-or-edit-image
https://docs.fluxapi.ai/flux-kontext-api/get-image-details
```

Secret Supabase:

```txt
FLUXAPI_API_KEY
```

### Gemini API

Tetap tersedia sebagai pilihan kualitas alternatif.

Secret Supabase:

```txt
GEMINI_API_KEY
```

Model default:

```txt
gemini-2.5-flash-image
```

## Arsitektur

Frontend hanya mengirim:

```json
{
  "image": "data:image/jpeg;base64,...",
  "engine": "flux | gemini",
  "outputFormat": "story | portrait",
  "style": "soft | comic | sketch",
  "prompt": "..."
}
```

Endpoint:

```txt
https://bjjibgbwgvphysavutiw.supabase.co/functions/v1/generate-caricature
```

Edge Function bertindak sebagai adapter:

```txt
supabase/functions/generate-caricature/index.ts
```

API key tidak disimpan di frontend.

## Flow FLUX Kontext

FluxAPI.ai membutuhkan `inputImage` berupa URL publik:

1. Edge Function menerima selfie sebagai data URL.
2. Edge Function upload selfie sementara ke bucket `souvenir-ai-inputs`.
3. Edge Function memanggil FluxAPI.ai.
4. Edge Function melakukan polling task sampai selesai.
5. Edge Function download output sebagai data URL.
6. Edge Function menghapus selfie sementara.
7. Frontend menerima hasil dan menambahkan twibbon/teks.

Setup bucket terdapat di:

```txt
SUPABASE_SETUP.md
```

## Status Implementasi

- [x] Dropdown engine admin.
- [x] Default Cartoon Lokal gratis.
- [x] Migrasi config lama `api` menjadi `gemini`.
- [x] Adapter Supabase Edge Function untuk FLUX Kontext.
- [x] Adapter Gemini tetap tersedia.
- [x] Fallback lokal jika API gagal.
- [x] Status provider dan error ditampilkan pada halaman tamu.
- [x] Rasio FLUX mengikuti setting Story 9:16 atau Portrait 4:5.
- [x] Dokumentasi bucket temporary input FLUX.
- [ ] Jalankan SQL pembuatan bucket di Supabase.
- [ ] Tambahkan secret `FLUXAPI_API_KEY`.
- [ ] Redeploy Edge Function dari Supabase Dashboard.
- [ ] Tes satu selfie dan satu wefie.

