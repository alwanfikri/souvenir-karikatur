# Souvenir Karikatur

Web statis untuk souvenir digital acara: tamu mengambil selfie/wefie, hasilnya diproses menjadi karikatur lokal, lalu dioverlay dengan twibbon/frame yang diatur admin. Hasil akhir bisa disimpan atau dikirim dari tombol terpisah.

## Halaman

- `index.html` - halaman tamu untuk selfie/wefie dan menyimpan hasil.
- `admin.html` - panel admin untuk mengatur event, caption share, upload twibbon, engine karikatur, dan placeholder teks interaktif.
- `manager.html` - panel manager untuk mengatur password admin prototipe.

## Ukuran Twibbon

- Story 9:16: 1080 x 1920 px.
- Portrait 4:5: 1080 x 1350 px.
- Disarankan upload PNG transparan dengan area tengah kosong untuk foto/karikatur.

## Catatan

Saat ini semua berjalan sebagai prototipe statis di browser. Untuk sinkronisasi lintas device, isi `cloud-config.js` dengan Supabase project URL, anon key, dan event slug, lalu ikuti `SUPABASE_SETUP.md`.

Password admin masih disimpan di browser untuk prototipe. Untuk production, pindahkan auth, storage, dan AI processing ke backend.
