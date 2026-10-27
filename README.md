# Badminton Tournament Dashboard — starter kit

Prototype untuk turnamen badminton round robin, target satu permainan 42 poin, bertukar sisi ketika salah satu tim pertama kali mencapai 21 poin. Frontend `index.html` berfungsi sebagai demo lokal dan memiliki contoh panel operator. Backend `Code.gs` disiapkan untuk Google Apps Script + Google Sheets.

## Isi paket
- `index.html` — dashboard responsif, klasemen, jadwal, filter status, daftar lawan, panel input skor demo.
- `Code.gs` — backend Google Apps Script untuk data publik dan aksi operator.
- `README.md` — petunjuk setup.

## A. Coba demo lokal
Buka `index.html` di browser. Data demo disimpan hanya dalam memori halaman; refresh halaman mengembalikan data contoh. Mode demo bukan database bersama dan tidak terhubung ke Google Sheets.

## B. Siapkan Google Sheets
1. Buat spreadsheet baru di akun Google panitia.
2. Buka **Extensions → Apps Script**.
3. Ganti isi `Code.gs` dengan file `Code.gs` dari paket ini.
4. Simpan, lalu pilih fungsi `setupTournament` dan jalankan. Berikan izin yang diminta. Fungsi ini membuat tab `Teams`, `Matches`, dan `Settings` serta mengisi 7 tim contoh.
5. Di **Project Settings → Script Properties**, tambahkan `ADMIN_KEY` dengan nilai acak yang panjang. Jangan membagikan nilai ini ke peserta.
6. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone** agar dashboard bisa membaca jadwal publik. Ini mengekspos data turnamen yang dikembalikan oleh endpoint GET, bukan akses langsung ke spreadsheet.
7. Salin URL Web App yang berakhir `/exec`. Uji dengan membuka URL tersebut; respons semestinya JSON berisi `ok: true`, tim, dan pertandingan.

## C. Hubungkan frontend
Frontend demo ini belum otomatis terhubung ke backend. Untuk produksi, tambahkan konfigurasi URL Apps Script dan ubah fungsi render agar membaca `GET <WEB_APP_URL>?action=publicData`; aksi operator perlu mengirim POST JSON dengan `adminKey` dan action (`saveScore`, `setStatus`, `clearResult`, `addTeam`). Lihat contoh payload di bawah. Untuk menghindari duplikasi atau perubahan tak sengaja, gunakan validasi backend sebagai sumber kebenaran.

### Payload POST
```json
{"adminKey":"ISI_KUNCI_OPERATOR","action":"saveScore","matchId":"M001","scoreA":42,"scoreB":35}
```
Aksi lain:
```json
{"adminKey":"...","action":"setStatus","matchId":"M001","status":"Berlangsung"}
{"adminKey":"...","action":"clearResult","matchId":"M001"}
{"adminKey":"...","action":"addTeam","teamName":"Tim H"}
```

## D. Hosting gratis di Netlify
1. Buat repositori GitHub berisi `index.html` dan deploy repositori tersebut ke Netlify, atau unggah folder frontend ke Netlify Drop untuk prototipe.
2. Domain `*.netlify.app` dapat dibagikan ke peserta.
3. Aktifkan refresh data berkala di frontend produksi (misalnya setiap 15–30 detik) atau tombol refresh. Pastikan endpoint mengembalikan hanya data yang boleh dilihat publik.

## Aturan dan catatan penting
- Jumlah pertandingan untuk `n` tim adalah `n*(n-1)/2`; 7 tim = 21 pertandingan.
- `generateMissingMatches_()` hanya menambah pasangan yang belum tercatat; tidak membuat duplikat saat tim baru ditambahkan.
- Penambahan tim setelah turnamen berjalan membuat pertandingan tambahan dengan semua tim aktif. Panitia harus mengumumkan jadwal tambahan; untuk format ronde resmi, jadwal sebaiknya diatur ulang sebelum pertandingan terkait dimainkan.
- Klasemen: menang, lalu selisih poin, lalu poin diperoleh. Pertemuan langsung belum dijadikan pemecah seri otomatis; sepakati regulasi sebelum turnamen.
- Skor final harus tepat satu tim mencapai 42 dan tim lawan di bawah 42. Jika aturan lokal mengizinkan kondisi berbeda, ubah validasi pada backend.
- Keamanan: `ADMIN_KEY` disimpan di Script Properties, tidak di file HTML publik. Namun, memasukkan kunci pada browser operator berarti kunci dapat terlihat di browser tersebut. Gunakan perangkat panitia yang tepercaya dan rotasi kunci jika bocor. Untuk keamanan lebih baik, buat autentikasi operator terpisah.
- Google Apps Script ContentService dan CORS perlu diuji dari domain Netlify. Jika browser memblokir POST lintas origin atau preflight, gunakan formulir `text/plain`/`no-cors` dengan penanganan respons yang sesuai, atau implementasikan endpoint perantara yang aman. Jangan menganggap frontend produksi sudah terhubung sebelum pengujian.
