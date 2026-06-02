# Souvenir Karikatur - Project Memory

## Tujuan Project

Web souvenir pernikahan untuk tamu undangan:

1. Tamu mengisi nama.
2. Tamu mengambil selfie/wefie memakai kamera HP, galeri, atau kamera live.
3. Foto diproses menjadi karikatur.
4. Twibbon/frame pernikahan ditambahkan sebagai overlay.
5. Placeholder teks seperti nama mempelai, tanggal, dan nama tamu dirender di atas hasil.
6. Tamu dapat menyimpan PNG atau mengirim hasil lewat fitur share perangkat.

Project online:

```txt
https://alwanfikri.github.io/souvenir-karikatur/
```

Repository:

```txt
https://github.com/alwanfikri/souvenir-karikatur
```

## Folder Lokal

```txt
C:\Users\Rentek Jembatan\Documents\EDIT GAMBAR\souvenir-karikatur
```

## Halaman Web

### `index.html`

Halaman tamu:

- Input nama tamu sebelum memproses foto.
- Tombol kamera HP, galeri, dan kamera live.
- Kamera live dapat memilih kamera depan atau belakang.
- Slider zoom kamera.
- Preview foto dan hasil karikatur.
- Slider perbandingan sebelum/sesudah.
- Tombol `Simpan` dan `Kirim` dipisahkan.
- Link admin dilindungi password.
- Status engine karikatur menampilkan mode lokal, Gemini API aktif, atau alasan fallback.

### `admin.html`

Halaman admin:

- Dilindungi password admin.
- Pengaturan nama mempelai, tanggal, judul, dan caption kirim.
- Upload twibbon/frame.
- Pilihan output:
  - Story 9:16: 1080 x 1920 px.
  - Portrait 4:5: 1080 x 1350 px.
- Pilihan posisi frame `Cover` atau `Contain`.
- Editor placeholder teks:
  - Template teks.
  - Posisi X/Y.
  - Drag langsung pada preview.
  - Ukuran teks.
  - Font.
  - Warna.
  - Ketebalan.
- Penyimpanan konsep twibbon ke Supabase.
- Pilihan engine:
  - `Gratis lokal`
  - `Gemini API`
- Endpoint default:

```txt
https://bjjibgbwgvphysavutiw.supabase.co/functions/v1/generate-caricature
```

### `manager.html`

Halaman manager:

- Password manager default untuk prototipe:

```txt
admin123
```

- Mengatur password admin.
- Mengatur Supabase URL, publishable key, dan event slug.
- Override manager masih tersimpan di localStorage browser.

## Supabase

Project URL:

```txt
https://bjjibgbwgvphysavutiw.supabase.co
```

Event slug:

```txt
raka-dina
```

Konfigurasi publik browser terdapat di:

```txt
app-config.js
```

Jangan memasukkan secret key atau Gemini API key ke file frontend, GitHub, atau halaman admin.

### Database

SQL setup terdapat di:

```txt
SUPABASE_SETUP.md
```

Tabel utama:

- `events`: menyimpan config event JSON.
- `twibbon_concepts`: menyimpan konsep twibbon agar tersedia lintas device.

### Edge Function Gemini

Template function:

```txt
supabase/functions/generate-caricature/index.ts
```

Nama Edge Function:

```txt
generate-caricature
```

Secret Supabase yang diperlukan:

```txt
GEMINI_API_KEY
```

Secret opsional untuk mengganti model:

```txt
GEMINI_IMAGE_MODEL
```

Karena halaman tamu bersifat publik, setting `Verify JWT` pada function `generate-caricature` harus dinonaktifkan.

### Adapter Engine Murah

Admin sekarang memiliki tiga pilihan:

```txt
Cartoon Lokal (Gratis)
FLUX Kontext
Gemini API
```

Default adalah Cartoon Lokal gratis. Mode FLUX memakai FluxAPI.ai melalui Edge Function yang sama. Tambahkan secret:

```txt
FLUXAPI_API_KEY
```

FluxAPI.ai membutuhkan input berupa URL publik. Jalankan SQL bucket temporary pada `SUPABASE_SETUP.md`. Edge Function menghapus selfie temporary setelah task selesai.

Detail migrasi:

```txt
MIGRATION_PLAN_CHEAPEST_AI.md
```

## Kondisi Integrasi Gemini Terakhir

Koneksi frontend ke Supabase Edge Function sudah berhasil:

- Request OPTIONS ke function menghasilkan HTTP 200.
- Setelah `Verify JWT` dinonaktifkan, request mencapai Gemini.
- Frontend menampilkan pesan error Gemini dan memakai fallback lokal jika AI gagal.

Model gratis lama:

```txt
gemini-2.0-flash-preview-image-generation
```

tidak tersedia untuk project/API ini. Model tersebut jangan dipakai.

Model Nano Banana resmi yang disiapkan sebagai default function:

```txt
gemini-2.5-flash-image
```

Gemini image API tidak menyediakan free tier untuk model ini. Billing Google AI Studio / Google Cloud perlu diaktifkan untuk pemakaian API. Subscription Google AI Plus di aplikasi Gemini tidak otomatis mencakup biaya API.

Estimasi harga resmi `gemini-2.5-flash-image`:

```txt
sekitar USD 0.039 per output image
```

Untuk 200 hasil:

```txt
sekitar USD 7.80 ditambah input token
```

## Langkah Berikutnya

1. Di Supabase Secrets, ubah atau hapus override model lama:

```txt
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

2. Copy ulang isi terbaru:

```txt
supabase/functions/generate-caricature/index.ts
```

ke editor Edge Function Supabase.

3. Deploy update function.

4. Aktifkan billing untuk Gemini API jika ingin memakai Nano Banana resmi.

5. Buka admin, pilih `Gemini API`, lalu klik `Simpan Pengaturan`.

6. Tes ulang dari halaman tamu dengan satu foto.

## Catatan Git

Branch aktif:

```txt
main
```

Commit terbaru saat file memory dibuat:

```txt
51b418c Use official Nano Banana image model
```

Commit tersebut sudah tersedia di `origin/main`.

## Keamanan

- Jangan menaruh `GEMINI_API_KEY` di frontend.
- Jangan menggunakan Supabase secret/service-role key di browser.
- Publishable key Supabase boleh berada di frontend dengan RLS yang tepat.
- Policy Supabase prototipe saat ini masih longgar untuk kebutuhan uji coba. Sebelum production, batasi write access dan pertimbangkan autentikasi admin berbasis backend.
