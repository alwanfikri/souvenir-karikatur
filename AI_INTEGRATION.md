# Integrasi AI karikatur berbayar

Mode sekarang memakai engine gratis lokal di browser (`aiProvider: "local"`). Untuk pindah ke AI berbayar, isi `Endpoint API karikatur` di `admin.html`, lalu pilih `API nanti`.

Ukuran output dan twibbon:
- Canvas final: 1080 x 1350 px.
- Rasio: 4:5.
- Frame/twibbon disarankan PNG transparan 1080 x 1350 px.
- Area tengah frame sebaiknya transparan karena akan dipakai untuk foto/karikatur selfie atau wefie.
- Kalau frame dibuat lebih besar seperti 1122 x 1402 px, rasionya masih dekat 4:5 dan bisa dipakai. Web akan menyesuaikan dengan mode `Cover` atau `Contain`.
- Teks nama mempelai, tanggal, dan nama tamu dioverlay oleh web setelah twibbon, memakai token `{mempelai}`, `{tanggal}`, dan `{tamu}` dari panel admin.

Endpoint harus menerima:

```json
{
  "image": "data:image/jpeg;base64,...",
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
- Web akan mencoba endpoint API lebih dulu saat `aiProvider` bernilai `api`.
- Jika API gagal, web otomatis fallback ke karikatur lokal agar tamu tetap mendapat hasil.
- Twibbon tetap dioverlay di browser setelah hasil karikatur diterima, jadi API tidak perlu tahu nama mempelai atau file frame.
