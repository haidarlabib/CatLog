# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# ProwlLog PWA — Personal Cat Tracker

**Dokumen:** Product Requirements Document  
**Versi:** 1.0  
**Status:** Draft untuk perancangan dan implementasi MVP di Antigravity  
**Platform:** Progressive Web App (PWA), mobile-first, responsive  
**Bahasa antarmuka awal:** English (mengikuti referensi aplikasi); struktur kode harus siap untuk lokalisasi Bahasa Indonesia  
**Model produk:** Personal, local-first, single-user  

---

## 1. Ringkasan Produk

ProwlLog PWA adalah aplikasi personal untuk mencatat kucing yang ditemui pengguna, menyimpan foto dan lokasi pertemuan, melihat titik pertemuan di peta, serta mengelola profil setiap kucing dalam katalog pribadi.

Pengalaman inti harus sederhana:

**Temui kucing → foto → simpan detail dan lokasi → lihat pin di peta → buka CATalog kapan saja.**

Aplikasi ini mengambil inspirasi dari alur utama ProwlLog iOS, tetapi sengaja dibuat lebih sederhana. Tidak ada World CATalog, feed publik, akun teman, social sharing, sistem premium, atau Sticker Studio pada MVP. Navigasi utama hanya terdiri dari tiga tab: **Map**, **CATalog**, dan **Settings**.

Versi awal harus benar-benar dapat digunakan untuk menambah, melihat, mengedit, dan menghapus data—bukan hanya prototipe visual. Data kucing dan foto disimpan secara lokal agar pengalaman inti tetap tersedia tanpa koneksi internet.

## 2. Visi dan Tujuan

### Visi

Membantu pengguna membangun atlas pribadi berisi kucing-kucing yang pernah ditemui, lengkap dengan foto, lokasi, dan memori tentang setiap pertemuan.

### Tujuan MVP

1. Pengguna dapat mencatat kucing baru dalam waktu singkat.
2. Setiap pertemuan yang memiliki koordinat tampil sebagai photo marker di peta.
3. Pengguna dapat membuka profil kucing dari Map maupun CATalog.
4. Pengguna dapat mencatat pertemuan berulang tanpa membuat profil kucing duplikat.
5. Foto dan data yang sudah tersimpan tetap bisa dibuka ketika offline.
6. Aplikasi dapat dipasang ke home screen sebagai PWA dan nyaman digunakan di layar ponsel.

### Bukan tujuan MVP

- Mencari atau melihat koleksi kucing milik pengguna lain.
- World CATalog atau publikasi data ke publik.
- Registrasi/login dan sinkronisasi multi-perangkat.
- Integrasi iCloud.
- Sticker generator/sticker pack.
- AI untuk mengenali ras atau mencocokkan kucing secara otomatis.
- Pelacakan GPS pengguna di background.
- Monetisasi, subscription, atau fitur Pro.

## 3. Target Pengguna dan Kebutuhan

### Target pengguna

Pecinta kucing yang sering menjumpai kucing di lingkungan sehari-hari—misalnya di jalan, kampus, kafe, taman, atau lingkungan rumah—dan ingin mendokumentasikannya sebagai koleksi pribadi.

### Kebutuhan utama

- Bisa mengambil foto tanpa melalui form yang terlalu panjang.
- Bisa menyimpan lokasi otomatis lewat GPS atau memilih titik secara manual.
- Bisa membedakan profil kucing dari riwayat pertemuannya.
- Bisa mengetahui kapan dan di mana terakhir bertemu seekor kucing.
- Bisa mencari kembali kucing yang pernah dicatat.
- Bisa memakai aplikasi dan melihat catatan yang tersimpan saat offline.
- Memiliki kendali atas data dan lokasi pribadi.

## 4. Prinsip Produk dan UX

1. **Map-first:** Map adalah halaman default saat aplikasi dibuka.
2. **Three-tab navigation:** hanya Map, CATalog, dan Settings pada navigasi utama.
3. **Photo-first:** foto kucing harus menjadi elemen visual terpenting.
4. **Quick capture:** simpan pertemuan dengan langkah sesedikit mungkin.
5. **One cat, many sightings:** satu profil kucing dapat memiliki banyak riwayat pertemuan.
6. **Local-first privacy:** data tetap berada di perangkat pada MVP; tidak dipublikasikan atau dikirim ke server aplikasi.
7. **Progressive disclosure:** field tambahan seperti penampilan, catatan, dan feeding tidak memenuhi layar sebelum diperlukan.
8. **Honest offline behavior:** data tersimpan dapat dibuka offline; tile peta eksternal mungkin tidak tersedia tanpa koneksi.
9. **No fake controls:** setiap tombol/aksi yang terlihat harus mempunyai perilaku yang berfungsi atau secara jelas ditandai belum tersedia.

## 5. Informasi Arsitektur dan Navigasi

### Navigasi utama

Bottom navigation mobile dengan tiga item:

- **Map** — ikon peta.
- **CATalog** — ikon paw print.
- **Settings** — ikon gear.

Pada desktop, navigasi dapat berubah menjadi rail/sidebar sederhana bila lebih sesuai, tetapi urutan dan tiga destinasi harus tetap sama.

### Rute/halaman

- `/` — Map
- `/catalog` — CATalog
- `/settings` — Settings
- `/cats/new` — Add Cat
- `/cats/:catId` — Cat Detail
- `/cats/:catId/edit` — Edit Cat
- `/cats/:catId/sightings/new` — Add Sighting untuk kucing yang sudah ada
- `/sightings/:sightingId` — Sighting Detail (boleh berupa bottom sheet/modal pada mobile)

Halaman Add Cat, Cat Detail, Edit Cat, dan Add Sighting bukan tab utama. Di mobile, gunakan halaman penuh atau sheet yang jelas, dengan tombol kembali yang konsisten.

## 6. Core User Flows

### Flow A — Pengguna baru mencatat kucing pertama

1. Pengguna membuka aplikasi dan melihat Map.
2. Jika belum ada data, tampilkan empty state yang menjelaskan bahwa peta akan menampilkan kucing setelah pengguna menambahkannya.
3. Pengguna menekan tombol floating **+ / camera**.
4. Pengguna memilih **New cat**.
5. Pengguna mengambil foto menggunakan kamera perangkat atau memilih gambar dari galeri.
6. Aplikasi meminta akses lokasi hanya saat dibutuhkan. Jika diizinkan, isi koordinat dari posisi saat itu.
7. Pengguna dapat memindahkan pin ke titik yang benar atau melewati lokasi bila tidak tersedia.
8. Pengguna mengisi nama kucing (wajib), ras (opsional; default “Not sure yet”), warna/pola (opsional), catatan (opsional), dan apakah kucing diberi makan.
9. Jika memilih Yes pada feeding, pengguna memilih kategori makanan.
10. Pengguna menekan **Save cat**.
11. Data profil, sighting pertama, foto, dan feeding log (jika ada) tersimpan sebagai satu operasi logis.
12. Tampilkan konfirmasi sukses dan pilihan **View cat details** atau **Back to map**.
13. Map dan CATalog diperbarui tanpa reload penuh.

### Flow B — Pengguna bertemu kucing yang sudah dikenal

1. Pengguna menekan tombol + / camera.
2. Pengguna memilih **Existing cat**.
3. Pengguna mencari lalu memilih profil kucing yang sudah ada.
4. Pengguna mengambil/memilih foto pertemuan terbaru.
5. Aplikasi mengisi lokasi saat ini bila izin tersedia; pengguna bisa menyesuaikannya.
6. Pengguna menambahkan catatan khusus pertemuan dan status feeding bila relevan.
7. Pengguna menyimpan sighting.
8. Profil kucing tetap satu; sighting baru ditambahkan ke riwayat, dan pin baru tampil di Map.

### Flow C — Membuka detail dari Map

1. Pengguna mengetuk photo marker.
2. Tampilkan preview card berisi foto, nama kucing, tanggal/waktu pertemuan, dan nama lokasi jika tersedia.
3. Pengguna memilih **View details** untuk membuka profil kucing.
4. Jika satu kucing punya banyak sightings, masing-masing sighting tetap dapat dipilih pada peta.

### Flow D — Mengelola CATalog

1. Pengguna membuka CATalog.
2. Pengguna melihat grid foto kucing dan jumlah total kucing.
3. Pengguna dapat mencari dengan nama, ras, warna/pola, atau nama lokasi.
4. Pengguna mengetuk kartu untuk melihat profil.
5. Pengguna dapat mengedit informasi, menambah sighting, atau menghapus profil.

### Flow E — Mengelola data dan pengaturan

1. Pengguna membuka Settings.
2. Pengguna mengubah pengaturan tampilan peta atau preferensi aplikasi.
3. Pengguna dapat mengekspor data lokal sebagai backup.
4. Saat mengimpor backup, aplikasi menampilkan ringkasan dan meminta konfirmasi sebelum menggabungkan atau mengganti data.
5. Pengguna dapat membaca keterangan bahwa menghapus browser/site data dapat menghapus data yang tersimpan lokal.

## 7. Persyaratan Fungsional

### FR-01 — Map (prioritas P0)

- Map menjadi halaman default.
- Map menampilkan marker berbentuk foto untuk setiap sighting yang memiliki koordinat.
- Marker harus menggunakan thumbnail dari foto sighting; jika tidak ada foto, gunakan placeholder paw print.
- Mengetuk marker membuka preview card yang terhubung ke sighting dan profil kucing yang benar.
- Tampilkan kontrol **My location** bila browser mendukung Geolocation API dan pengguna memberi izin.
- Tampilkan jumlah profil kucing, bukan jumlah sightings, pada indikator jumlah kucing.
- Sediakan tombol floating untuk memulai proses tambah kucing/pertemuan.
- Jika beberapa marker berdekatan, implementasikan clustering bila didukung pustaka peta yang dipilih atau tampilkan marker yang tetap dapat dipilih dengan baik.
- Lokasi yang belum tersedia tidak boleh menyebabkan proses simpan gagal. Sighting tanpa koordinat tetap masuk CATalog dan diberi penanda “Location not set”.
- Jika peta gagal dimuat atau offline, tampilkan pesan yang informatif dan tetap sediakan akses ke CATalog serta catatan lokasi tekstual.

### FR-02 — Add Cat (prioritas P0)

Field form:

- Photo (disarankan; dapat diganti placeholder jika pengguna memutuskan menyimpan tanpa foto, tetapi alur normal harus mendorong penambahan foto).
- Cat name (wajib).
- Location (GPS otomatis bila tersedia; dapat disunting dengan memilih titik peta; boleh kosong).
- Breed (opsional): Not sure yet, Domestic, Persian, Angora, Maine Coon, Siamese, Bengal, Other.
- Appearance (opsional): badge ring dekoratif, coat colour, pattern.
- Notes (opsional): karakter atau kebiasaan kucing.
- Did you feed this cat? No/Yes.
- Jika Yes, food type: Wet food, Dry food, Treat, Other; note tambahan opsional.
- Tanggal/waktu sighting menggunakan waktu lokal perangkat dan dapat diedit bila dibutuhkan.

Validasi:

- Nama kucing wajib dan tidak boleh hanya berisi spasi.
- Tampilkan validasi dekat field terkait, bukan hanya alert browser.
- Jika lokasi tidak bisa didapatkan, jangan memaksa pengguna mengulang izin; sediakan pilihan manual atau lanjut tanpa lokasi.
- Foto berukuran besar harus dikecilkan/dioptimalkan sebelum disimpan untuk menghemat storage, tanpa mengubah gambar sumber di file pengguna.
- Disable tombol Save selama penyimpanan berlangsung untuk mencegah record ganda.

### FR-03 — Add Sighting (prioritas P0)

- Pengguna dapat menambahkan sighting dari tombol global maupun Cat Detail.
- Sighting baru harus terhubung ke `catId` yang sudah ada.
- Sighting mempunyai foto sendiri yang tidak otomatis mengganti cover foto utama kecuali pengguna memilihnya sebagai cover.
- Sighting menyimpan koordinat dan label lokasi per pertemuan.
- Notes pertemuan harus terpisah dari notes profil kucing.
- Feeding log harus dapat dihubungkan ke kucing dan, jika sesuai, ke sighting yang sama.

### FR-04 — CATalog (prioritas P0)

- Tampilkan jumlah total kucing.
- Grid responsif: 2 kolom di ponsel, bertambah pada tablet/desktop bila ruang cukup.
- Kartu menampilkan foto cover, nama, ras/warna ringkas, lokasi terakhir, tanggal terakhir dilihat, dan ringkasan jumlah sightings/feeding logs bila ruang cukup.
- Sediakan pencarian yang berjalan lokal tanpa request server.
- Sediakan sorting: Recently seen (default), Name A–Z, Date added.
- Sediakan filter sederhana berdasarkan breed dan coat colour; jangan membuat kontrol filter berlebihan pada MVP.
- Tampilkan empty state dengan tombol **Add your first cat** jika koleksi kosong.
- Tampilkan empty state pencarian apabila tidak ada hasil dan sediakan cara menghapus query.

### FR-05 — Cat Detail (prioritas P0)

- Tampilkan cover photo, nama, breed, appearance, catatan profil, dan waktu dibuat.
- Tampilkan lokasi terakhir dengan mini map/preview dan aksi **View on map** bila koordinat tersedia.
- Tampilkan daftar sightings terbaru lebih dahulu; setiap item dapat berisi foto, tanggal, lokasi, dan notes pertemuan.
- Tampilkan feeding history terpisah dan urutkan dari yang terbaru.
- Sediakan aksi **Edit cat**, **Add sighting**, **Set as cover photo**, dan **Delete cat**.
- Aksi delete harus meminta konfirmasi dan menjelaskan bahwa sightings serta feeding logs terkait juga akan dihapus.
- Bila foto cover tidak ada, gunakan placeholder yang konsisten.

### FR-06 — Edit Cat (prioritas P0)

- Pengguna dapat mengubah nama, breed, appearance, catatan profil, dan cover photo.
- Edit profil tidak boleh mengubah foto, tanggal, atau lokasi sightings lama secara tidak sengaja.
- Perubahan disimpan secara lokal dan langsung tercermin pada Map/CATalog/Detail.

### FR-07 — Feeding Log (prioritas P1)

- Pengguna dapat mencatat Wet food, Dry food, Treat, atau Other.
- Feeding log menyimpan waktu, tipe makanan, catatan opsional, dan referensi kucing.
- Pengguna dapat melihat serta menghapus log yang salah.
- Feeding log tidak wajib untuk menyimpan catatan kucing.

### FR-08 — Settings (prioritas P1)

Kelompok pengaturan:

**Profile**
- Label profil lokal opsional (tidak memerlukan akun).

**Map preferences**
- Default map center/zoom atau tombol reset ke lokasi sekarang.
- Preferensi gaya marker jika mudah diimplementasikan.

**Data & privacy**
- Ekspor data.
- Impor/restore backup dengan konfirmasi.
- Penjelasan bahwa data MVP disimpan di browser/perangkat dan tidak otomatis tersinkron ke cloud.
- Tombol untuk menghapus seluruh data lokal dengan konfirmasi berlapis.

**App**
- Status online/offline.
- Informasi versi aplikasi.
- Petunjuk instalasi PWA bila aplikasi belum terpasang.

### FR-09 — Local-first storage (prioritas P0)

- Simpan data utama pada IndexedDB, bukan `localStorage` untuk foto atau data koleksi.
- Simpan Blob foto atau file image yang telah dioptimalkan di IndexedDB.
- Data harus tetap tersedia setelah tab/browser ditutup dan dibuka kembali pada browser/perangkat yang sama, selama data situs belum dihapus.
- Terapkan penanganan storage penuh/quota exceeded dengan pesan yang jelas.
- Jangan menyatakan data aman dari kehilangan perangkat; tampilkan anjuran backup.

### FR-10 — PWA dan offline (prioritas P0)

- Sediakan `manifest.webmanifest`, ikon aplikasi, theme colour, nama aplikasi, dan mode standalone.
- Gunakan service worker untuk precache app shell dan aset inti.
- Aplikasi harus bisa dibuka kembali offline setelah berhasil dimuat setidaknya sekali.
- CATalog, detail kucing, dan data tersimpan harus dapat diakses offline.
- Menambah/mengedit data dan menyimpan foto harus berfungsi offline selama storage tersedia.
- Peta online dapat tidak menampilkan tile saat offline. Jangan mencoba melakukan bulk-cache tile dari layanan publik tanpa izin. Tampilkan fallback offline yang jelas.
- Tampilkan indikator koneksi secara ringan, bukan modal yang terus mengganggu.

### FR-11 — Export & Import (prioritas P1)

- Sediakan ekspor backup dalam format portabel yang mencakup metadata cats, sightings, feeding logs, settings penting, serta foto.
- Format yang disarankan: satu file JSON untuk metadata ditambah foto terenkode/base64 atau satu archive ZIP yang berisi `backup.json` dan file foto. Pilih solusi yang paling andal untuk browser dan dokumentasikan formatnya.
- Impor harus memvalidasi struktur file, memberi ringkasan jumlah cat/sightings/feeding logs, lalu meminta konfirmasi.
- Hindari penggabungan tanpa aturan yang dapat menciptakan duplikat ID. Gunakan ID stabil dan tawarkan mode “replace all local data” untuk MVP bila merge terlalu kompleks.

## 8. Aturan Bisnis dan Data

1. Satu record `cat` mewakili seekor kucing yang dikenali pengguna.
2. Satu `cat` dapat memiliki nol atau banyak `sightings`.
3. Satu `sighting` merepresentasikan satu pertemuan pada waktu dan lokasi tertentu.
4. Setiap sighting dapat memiliki foto sendiri; foto cover profil dapat merujuk pada salah satu foto.
5. Satu `cat` dapat memiliki nol atau banyak `feeding_logs`.
6. Feeding log tidak wajib terkait dengan sighting tertentu, tetapi boleh terhubung.
7. Lokasi dan foto yang tidak tersedia tidak boleh menghalangi pengguna menyimpan informasi dasar.
8. Menghapus cat akan menghapus sightings dan feeding logs yang terkait (cascade delete), setelah konfirmasi.
9. Mengedit data profil tidak boleh menimpa riwayat sighting.
10. Map menghitung marker dari `sightings` yang memiliki koordinat, bukan dari daftar cats saja.
11. Counter CATalog menghitung profil unik dari `cats`; counter marker menghitung sightings dengan koordinat.
12. Gunakan ISO timestamps di penyimpanan dan format tampilan sesuai locale perangkat.
13. Simpan `latitude` dan `longitude` sebagai angka desimal, bukan teks berformat lokal.

## 9. Model Data yang Disarankan

Model berikut merupakan rancangan logis; penamaan tabel/store dapat disesuaikan dengan implementasi.

### `cats`

- `id`: string/UUID, primary key
- `name`: string, required
- `breed`: string/enum, optional; default `unknown`
- `coatColors`: string array, optional
- `patterns`: string array, optional
- `badgeRing`: string, optional
- `notes`: string, optional; notes profil
- `coverPhotoId`: string, nullable
- `createdAt`: ISO datetime
- `updatedAt`: ISO datetime

### `sightings`

- `id`: string/UUID, primary key
- `catId`: string, foreign key to `cats.id`
- `photoId`: string, nullable
- `latitude`: number, nullable
- `longitude`: number, nullable
- `locationName`: string, nullable
- `notes`: string, optional; notes khusus pertemuan
- `spottedAt`: ISO datetime
- `createdAt`: ISO datetime
- `updatedAt`: ISO datetime

### `photos`

- `id`: string/UUID, primary key
- `catId`: string, foreign key
- `sightingId`: string, nullable
- `blob`: Blob/File, stored in IndexedDB
- `mimeType`: string
- `width`: number, nullable
- `height`: number, nullable
- `createdAt`: ISO datetime

### `feeding_logs`

- `id`: string/UUID, primary key
- `catId`: string, foreign key
- `sightingId`: string, nullable
- `foodType`: `wet_food | dry_food | treat | other`
- `notes`: string, optional
- `fedAt`: ISO datetime
- `createdAt`: ISO datetime

### `settings`

- `key`: string, primary key
- `value`: JSON-compatible value
- `updatedAt`: ISO datetime

### Relasi

- `cats 1 — N sightings`
- `cats 1 — N feeding_logs`
- `cats 1 — N photos`
- `sightings 0..1 — 0..N photos` (sesuaikan implementasi; MVP cukup satu foto utama per sighting)
- `sightings 0..1 — N feeding_logs`

## 10. Arahan Desain UI

### Karakter visual

- Minimalis, hangat, bersih, ramah, dan berorientasi foto.
- Jangan menyalin semua kompleksitas UI aplikasi asli.
- Tidak ada halaman sosial atau elemen leaderboard.
- Hindari dashboard statistik yang tidak dibutuhkan.
- Gunakan ruang kosong yang cukup dan hierarchy tipografi yang jelas.

### Palet warna awal

- Deep teal / primary: `#226F80`
- Warm cream / background: `#FBF8F2`
- Soft teal / secondary surface: `#E8F0EF`
- Charcoal / primary text: `#292521`
- Muted text: `#716D68`
- Border: `#E5DED5`
- White surface: `#FFFFFF`

Gunakan token CSS, jangan menyebar nilai warna hard-coded di semua komponen.

### Bentuk dan komponen

- Card dengan radius sekitar 16–22 px.
- Tombol utama teal dengan teks putih.
- Field form tinggi dan nyaman disentuh.
- Bottom navigation berbentuk pill/rounded container yang tetap terlihat di halaman utama mobile.
- Floating action button untuk kamera/tambah cat pada Map dan CATalog.
- Gunakan ikon konsisten dari satu icon library (misalnya Lucide).
- Foto harus menggunakan `object-fit: cover`; hindari crop wajah kucing jika memungkinkan.
- Hindari efek blur/transparansi berlebihan yang mengurangi kontras.
- Animasi halus dan singkat; hormati `prefers-reduced-motion`.

### Map screen

- Peta memenuhi area utama layar.
- Header minimal: nama aplikasi dan jumlah kucing.
- Photo marker harus terlihat tetapi tidak menutupi peta; gunakan border putih dan shadow ringan.
- Marker terpilih membuka preview card ringkas.
- Tombol kamera/+ mudah dijangkau ibu jari, tanpa menutupi navigasi bawah.
- Pastikan map canvas tetap responsif ketika bottom nav dan preview card tampil.

### CATalog screen

- Judul `CATalog`.
- Counter jumlah cats.
- Search field yang mudah ditemukan.
- Grid dua kolom pada ponsel; kartu foto menjadi fokus.
- Informasi kartu dibatasi pada nama, detail pendek, dan lokasi/tanggal terakhir.
- Overflow menu hanya berisi aksi yang benar-benar tersedia.

### Add Cat / Add Sighting screen

- Form berupa section/card yang pendek dan mudah discroll.
- Urutan: Photo → Location → Cat name/profile fields → Feeding (opsional) → Notes → Save.
- Field opsional seperti Appearance dapat dilipat.
- Tombol Save terlihat jelas di bagian bawah tanpa menutupi input.
- Saat keyboard terbuka, tombol dan field aktif tidak boleh terhalang.

### Settings screen

- Pengaturan dikelompokkan, tidak menggunakan banyak dashboard tiles.
- Setiap baris memiliki ikon, judul, deskripsi singkat, dan affordance yang jelas.
- Aksi destruktif diletakkan terpisah dan diberi warna peringatan.

### Responsive behavior

- Prioritas desain: lebar ponsel 360–430 px.
- Tetap usable di tablet dan desktop.
- Hindari horizontal overflow.
- Hormati safe area pada perangkat mobile.
- Navigasi tidak boleh menutupi tombol utama, konten, atau form.

## 11. Rekomendasi Teknologi

Gunakan stack yang sederhana, matang, dan mudah dikembangkan:

- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS dengan design tokens/CSS variables
- **Routing:** React Router
- **PWA:** Vite PWA plugin atau konfigurasi Workbox yang sesuai
- **Local database:** IndexedDB via Dexie
- **Map:** Leaflet dengan provider tile yang sesuai dan attribution yang terlihat, atau MapLibre bila benar-benar diperlukan
- **Icons:** Lucide
- **Form validation:** React Hook Form + Zod (opsional; pilih jika membantu menjaga konsistensi)
- **Testing:** Vitest + React Testing Library untuk logic kritis

### Batasan peta

- Jangan menganggap peta offline akan tersedia secara default.
- Gunakan tile provider sesuai terms dan batas penggunaan; tampilkan atribusi yang diwajibkan.
- Jangan bulk-download/cache tile layanan publik yang melarangnya.
- Simpan koordinat dan label lokasi secara lokal.
- Jika reverse geocoding digunakan, gunakan provider yang sesuai dengan kebijakan penggunaannya dan buat aplikasi tetap dapat menyimpan koordinat jika layanan gagal.

### Arsitektur lokal

- Pisahkan UI, domain logic, dan persistence layer.
- Hindari akses IndexedDB langsung tersebar di komponen UI.
- Gunakan repository/services untuk cats, sightings, photos, feeding logs, settings.
- Perubahan CRUD harus memicu pembaruan UI melalui state/query yang konsisten.
- Gunakan ID stabil dan operasi data yang menjaga integritas relasi.

## 12. Persyaratan Nonfungsional

### Kinerja

- App shell harus terasa ringan dan tampil cepat di ponsel kelas menengah.
- Thumbnail grid dan marker tidak boleh memuat gambar resolusi penuh tanpa kebutuhan.
- Optimalkan/compress foto sebelum menyimpan salinan aplikasi.
- Map sebaiknya hanya merender marker yang dibutuhkan; pertimbangkan clustering untuk jumlah besar.

### Reliabilitas

- Reload tidak boleh menghilangkan data tersimpan.
- Save harus mencegah submit ganda.
- Kegagalan permission GPS atau reverse geocoding tidak boleh merusak flow simpan.
- Kegagalan peta tidak boleh membuat CATalog tidak bisa dibuka.
- Penanganan error harus menyebut tindakan berikutnya yang bisa dilakukan pengguna.

### Privasi dan keamanan

- MVP tidak mengirim lokasi, foto, atau catatan ke server aplikasi.
- Lokasi hanya diminta setelah tindakan pengguna yang membutuhkan lokasi.
- Jangan meminta background location.
- Jelaskan bahwa data lokal terikat pada browser/perangkat dan dapat hilang jika site data dihapus.
- Backup/export harus berupa tindakan yang jelas dimulai pengguna.

### Aksesibilitas

- Semua tombol memiliki accessible name.
- Form input memiliki label; jangan mengandalkan placeholder saja.
- Modal/sheet dapat digunakan dengan keyboard dan mempunyai fokus yang terkelola.
- Tampilkan status/error selain hanya dengan warna.
- Jaga kontras teks dan ukuran target sentuh yang nyaman.

## 13. Empty, Loading, dan Error States

Implementasikan state berikut secara sengaja:

- Belum ada cats: ilustrasi/ikon paw sederhana, copy singkat, CTA `Add your first cat`.
- CATalog kosong: ajakan menambahkan kucing.
- Search no result: pesan dan tombol clear search.
- Map tanpa sightings: empty overlay ringan yang tidak menggantikan layar Map sepenuhnya.
- Permission lokasi ditolak: jelaskan alternatif memilih titik manual atau menyimpan tanpa koordinat.
- Offline: beri indikator kecil; data lokal tetap tersedia.
- Map tile gagal: tampilkan fallback, jangan blank tanpa penjelasan.
- Foto gagal diproses: pesan error dan aksi untuk memilih foto lain.
- Storage penuh: jelaskan bahwa storage perangkat penuh dan sarankan ekspor/hapus data yang tidak perlu.
- Backup invalid: jangan mengubah data; berikan pesan validasi.
- Delete confirmation: jelaskan efek penghapusan profil dan data terkait.

## 14. Prioritas Pengembangan

### P0 — MVP wajib

1. App shell, routing, dan bottom navigation tiga tab.
2. Design system dasar dan responsive layout.
3. IndexedDB persistence.
4. Add Cat dengan upload/camera foto.
5. GPS permission dan pilihan lokasi manual/fallback.
6. Interactive Map dengan photo markers dari sightings.
7. CATalog grid, search, dan empty states.
8. Cat Detail dan Edit Cat.
9. Add Sighting untuk kucing lama.
10. Persistensi foto/data setelah reload.
11. PWA installability dan app shell offline.
12. CRUD error handling dan konfirmasi delete.

### P1 — setelah flow utama stabil

1. Feeding history.
2. Filter/sort CATalog lebih lengkap.
3. Export dan import backup.
4. Settings untuk map, privasi, dan data.
5. Mini map pada Cat Detail.
6. Optimasi foto dan thumbnail.

### P2 — pengembangan lanjutan jika dibutuhkan

1. Sinkronisasi cloud dan login.
2. Backup antarperangkat.
3. Statistik pribadi.
4. Sticker Studio.
5. Identifikasi kucing berbantuan AI (harus opt-in dan dievaluasi terpisah).

Jangan mulai mengembangkan fitur P2 sebelum seluruh acceptance criteria P0 lulus.

## 15. Acceptance Criteria MVP

MVP dinyatakan siap ditinjau apabila:

1. Aplikasi terbuka langsung ke Map.
2. Pengguna dapat membuat profil kucing baru dan menyimpan foto.
3. Setelah save, profil tampil di CATalog tanpa reload manual.
4. Sighting yang memiliki koordinat muncul sebagai photo marker di Map.
5. Tap marker menampilkan preview yang benar dan dapat membuka Cat Detail.
6. Pengguna dapat menambahkan sighting kedua ke kucing yang sudah ada tanpa membuat cat baru.
7. Setiap sighting tetap menyimpan tanggal, foto, dan lokasi masing-masing.
8. Pengguna dapat mengedit nama/breed/appearance/notes tanpa merusak riwayat sighting.
9. Pengguna dapat menghapus cat setelah konfirmasi; seluruh relasi terkait ikut ditangani dengan benar.
10. Pencarian CATalog menemukan kucing berdasarkan nama setidaknya.
11. Data dan foto tetap ada setelah halaman di-refresh dan browser dibuka kembali.
12. Aplikasi tetap dapat membuka CATalog dan detail yang tersimpan ketika offline setelah app shell pernah dimuat.
13. Jika GPS ditolak, pengguna masih dapat memilih lokasi manual atau menyimpan tanpa lokasi.
14. Navigasi utama hanya menampilkan Map, CATalog, dan Settings.
15. Tidak terdapat tombol utama yang tidak berfungsi atau hanya dekoratif.
16. Tampilan dapat digunakan pada viewport mobile 360 px tanpa horizontal overflow.
17. Build production berjalan tanpa error fatal dan tidak ada error console kritis pada flow utama.

## 16. Strategi Pengujian

### Skenario manual minimal

- Buat cat dengan GPS diizinkan.
- Buat cat ketika GPS ditolak.
- Buat cat tanpa lokasi.
- Upload foto dari galeri.
- Ambil foto memakai perangkat mobile yang mendukung kamera browser.
- Tambah sighting kedua untuk kucing yang sama.
- Pastikan dua sightings menghasilkan dua marker (jika keduanya punya koordinat).
- Edit profil dan pastikan sightings lama tidak berubah.
- Hapus cat dan verifikasi relasi ikut terhapus.
- Refresh browser dan pastikan data tetap ada.
- Buka aplikasi offline dan periksa CATalog/detail.
- Simulasikan foto terlalu besar, IndexedDB error/quota, dan file backup tidak valid.
- Uji tombol navigasi dan seluruh CTA.

### Pengujian otomatis yang disarankan

- Unit tests untuk repository CRUD dan relasi cascade.
- Unit tests untuk validasi form.
- Integration test add cat → catalog → detail.
- Integration test add sighting ke cat yang sudah ada.
- Test geolocation denied/error fallback.

## 17. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Penyimpanan browser dihapus | Sediakan export/backup; beri peringatan jelas di Settings. |
| Foto terlalu besar memenuhi storage | Optimasi gambar, thumbnail, dan pesan storage penuh. |
| GPS tidak tersedia/ditolak | Manual pin selection dan opsi simpan tanpa koordinat. |
| Map tidak berfungsi offline | Tetap tampilkan data lokal dan fallback map yang informatif. |
| Catatan duplikat | Pisahkan `cats` dari `sightings`; tawarkan alur Existing cat. |
| UI terlihat bagus tetapi kontrol tidak berfungsi | Acceptance criteria mencakup setiap flow; larang placeholder interactions. |
| Pustaka/peta melanggar aturan provider | Pilih provider dengan terms sesuai, atribusi, dan batas tile yang jelas. |

## 18. Definition of Done

Setiap fitur dianggap selesai bila:

- Desain sesuai sistem visual dan responsif.
- Aksi utama berfungsi dari awal sampai akhir.
- Data tersimpan di IndexedDB dan bertahan setelah reload.
- Loading, empty, success, dan error states tersedia sesuai kebutuhan.
- Tidak ada data dummy yang tercampur ke koleksi nyata setelah penggunaan dimulai.
- Form memiliki validasi dan aksesibilitas dasar.
- Flow terkait telah diuji secara manual.
- Tidak ada error console kritis.
- Tidak ada fitur sosial atau halaman tambahan di luar scope yang dibuat tanpa persetujuan.

## 19. Instruksi Implementasi untuk Antigravity

Gunakan dokumen PRD ini sebagai source of truth selama perancangan dan implementasi. Ikuti arahan berikut:

1. **Mulai dari inspeksi dan rencana proyek.** Tampilkan struktur file yang akan dibuat dan ringkas keputusan teknis sebelum mengubah banyak file.
2. **Implementasikan secara bertahap.** Mulai dengan foundation/design tokens dan tiga route utama, lalu data layer, Add Cat, Map, CATalog, Detail, dan akhirnya PWA/offline serta settings.
3. **Jangan hanya membuat static mockup.** Semua form, save, edit, delete, search, navigasi, pin selection, dan local persistence di scope MVP harus berfungsi.
4. **Gunakan IndexedDB untuk data persisten.** Jangan menyimpan foto di localStorage.
5. **Gunakan data contoh hanya untuk preview/development.** Sediakan cara agar demo data tidak otomatis tercampur dengan catatan pengguna setelah aplikasi mulai digunakan.
6. **Gunakan komponen reusable.** Minimal pisahkan `AppShell`, `BottomNavigation`, `MapView`, `CatMarker`, `CatCard`, `CatForm`, `CatDetail`, `SightingForm`, `EmptyState`, `ConfirmDialog`, dan `SettingsSection` bila sesuai.
7. **Jaga pemisahan domain.** Pisahkan repository/service cats, sightings, photos, feeding logs, dan settings dari komponen UI.
8. **Tangani permission dan error dengan baik.** Jangan menganggap GPS, kamera, storage, map tiles, atau network selalu tersedia.
9. **Jangan menambahkan layanan cloud secara diam-diam.** MVP local-first; jika membutuhkan API key atau service eksternal, jelaskan alasan dan konfigurasi yang dibutuhkan.
10. **Jangan meng-cache tile peta pihak ketiga secara massal.** Ikuti ketentuan provider dan tampilkan attribution.
11. **Jangan menambah tab atau fitur sosial.** Navigasi utama harus tetap Map, CATalog, Settings.
12. **Pastikan pengalaman mobile menjadi prioritas.** Periksa viewport 360–430 px, safe area, keyboard behavior, dan floating controls.
13. **Setelah setiap tahap, jalankan build dan test yang relevan**, perbaiki semua error sebelum lanjut.
14. **Di akhir, dokumentasikan** cara menjalankan proyek, cara membangun production build, bagaimana penyimpanan lokal bekerja, batasan offline map, dan cara backup data.

### Urutan milestone yang harus diikuti

- **Milestone 1:** Project setup, routing, design tokens, app shell, responsive bottom navigation.
- **Milestone 2:** IndexedDB schema/repositories dan CRUD unit tests.
- **Milestone 3:** Add Cat + photo handling + geolocation/manual location.
- **Milestone 4:** Map dengan marker nyata dari data IndexedDB.
- **Milestone 5:** CATalog, search, Cat Detail, Edit Cat, Add Sighting.
- **Milestone 6:** PWA installability, app-shell offline, loading/empty/error states.
- **Milestone 7:** Feeding logs dan Settings/backup jika P0 stabil.
- **Milestone 8:** QA berdasarkan acceptance criteria dan dokumentasi.

**Instruksi awal yang disarankan untuk Antigravity:**

> Baca PRD ini secara menyeluruh dan jadikan sumber kebenaran proyek. Jangan langsung membangun semua fitur sekaligus. Mulai dengan Milestone 1: setup React + TypeScript + Vite, styling, routing, design tokens, dan app shell mobile-first dengan tiga tab Map, CATalog, dan Settings. Buat tampilan berkualitas tinggi yang mengikuti arahan visual PRD, tetapi jangan membuat kontrol palsu. Setelah itu tampilkan file yang dibuat, jalankan build, dan jelaskan langkah berikutnya sebelum melanjutkan ke Milestone 2.

---

## 20. Keputusan yang Masih Terbuka

Keputusan berikut tidak harus menghambat pembuatan wireframe, tetapi perlu ditetapkan sebelum tahap implementasi yang terkait:

1. Apakah foto wajib saat menambahkan kucing, atau boleh menyimpan profil tanpa foto?
2. Apakah export backup harus mencakup seluruh foto sejak MVP, atau metadata saja dahulu?
3. Apakah aplikasi akan tetap sepenuhnya lokal dalam jangka panjang, atau kelak menyediakan akun dan sinkronisasi cloud?
4. Apakah interface tetap English seperti referensi, atau menggunakan Bahasa Indonesia?
5. Provider peta dan reverse-geocoding final, berdasarkan kebutuhan wilayah, atribusi, batas pemakaian, dan biaya.

**Default sementara untuk MVP:** foto sangat dianjurkan tetapi bisa dilewati; backup lengkap termasuk foto ditempatkan di P1; data bersifat lokal tanpa login; UI English dengan struktur yang siap dilokalkan; provider peta dipilih saat implementasi setelah terms dan kebutuhan dikonfirmasi.
