# Undangan Pernikahan Interaktif — Arief & Wardani

> 🎮 **Undangan Akad Nikah berbasis game RPG** yang dapat dimainkan langsung di browser HP maupun laptop!

🌐 **Demo Live**: *(pasang link GitHub Pages di sini setelah deploy)*

---

## 📋 Info Acara

| | |
|---|---|
| **Mempelai Pria** | Arief Putra Utama *(Putra Pertama dari Bpk. Ahmad Kawit & (Alm) Ibu Agustinawati)* |
| **Mempelai Wanita** | Wardani *(Putri Pertama dari Bpk. Gunadi & Ibu Biah)* |
| **Tanggal** | Kamis, 26 November 2026 |
| **Acara** | Akad Nikah (tanpa resepsi) |
| **Lokasi** | Jl. Raya Sambikerep No.55, Sambikerep, Surabaya, Jawa Timur 60217 |
| **Maps** | [Google Maps](https://maps.app.goo.gl/oVcFJ6hYmWVhiSSXA) |

---

## 🗂️ Struktur File

```
Nikah-Web/
├── index.html          ← Halaman utama
├── style.css           ← Tampilan & styling
├── game.js             ← Engine game canvas 2D
├── audio.js            ← BGM & sound effects
└── assets/
    ├── background.png              ← Latar pelaminan
    ├── bgm.mp3                     ← Musik latar (looping)
    ├── avatar_male.png             ← Avatar tamu pria (lobby)
    ├── avatar_female.png           ← Avatar tamu wanita (lobby)
    ├── avatar_ducky.png            ← Avatar Ducky developer
    ├── male_walk_1..4.png          ← Animasi jalan tamu pria
    ├── male_idle.png               ← Pose diam tamu pria
    ├── female_walk_1..4.png        ← Animasi jalan tamu wanita
    ├── female_idle.png             ← Pose diam tamu wanita
    ├── npc_groom.png               ← Pengantin pria
    ├── npc_bride.png               ← Pengantin wanita
    ├── npc_father_groom.png        ← Bpk. Ahmad Kawit
    ├── npc_mother_groom_memorial.png ← (Alm) Ibu Agustinawati
    ├── npc_father_bride.png        ← Bpk. Gunadi
    ├── npc_mother_bride.png        ← Ibu Biah
    ├── npc_ducky.png               ← Maskot Ducky developer
    ├── prop_gift_box.png           ← Kotak hadiah
    └── prop_signboard.png          ← Papan informasi
```

---

## 🚀 Deploy ke GitHub Pages

1. **Buat repository baru** di GitHub (misal: `undangan-arief-wardani`)
2. **Upload semua file** dari folder `Nikah-Web/` ini ke repository
3. Buka **Settings → Pages**
4. Pilih **Source: Deploy from a branch → main → / (root)**
5. Klik **Save** — website akan aktif di:  
   `https://<username>.github.io/<nama-repo>/`

### 🔗 Link dengan Nama Tamu

Tambahkan parameter `?to=` di URL untuk personalisasi nama tamu:

```
https://<username>.github.io/<repo>/?to=Budi+dan+Siti
```

---

## 🎮 Cara Main

| Kontrol | Fungsi |
|---|---|
| **D-Pad** (pojok kiri bawah) | Jalan karakter ke segala arah |
| **Tap/Klik lantai** | Jalan otomatis ke titik tersebut |
| **Tombol Sapa** (pojok kanan bawah) | Berinteraksi dengan NPC / objek terdekat |
| **Keyboard Arrow / WASD** | Jalan (di desktop/laptop) |
| **Keyboard E / Space / Enter** | Sapa / Interaksi (di desktop) |

---

## 📱 Dioptimalkan untuk HP

Website ini dirancang **mobile-first** dan diuji pada browser HP (Chrome/Safari).  
Disarankan membuka dalam **posisi Landscape** untuk pengalaman terbaik.

---

*Dibuat dengan ❤️ oleh Arief Putra Utama — Mempelai Pria*
