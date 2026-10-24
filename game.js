/**
 * WEDDING ADVENTURE GAME ENGINE - ARIEF & WARDANI
 * Responsive Canvas RPG Engine — Mobile Optimized
 */

(function() {
    'use strict';

    // ===================================================
    // MOBILE DETECTION & PERFORMANCE SETTINGS
    // ===================================================
    const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
                      (navigator.maxTouchPoints > 1);

    // Virtual Game World Coordinates (logical space — always fixed)
    const WORLD_W = 1536;
    const WORLD_H = 1024;

    // Viewport & Dynamic Camera (Portrait / Responsive Follow)
    let VIEW_W = WORLD_W;
    let VIEW_H = WORLD_H;
    let RENDER_SCALE = IS_MOBILE ? 0.5 : 1.0;

    const camera = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0
    };

    // Target FPS — cap at 30 on mobile to reduce CPU/GPU load
    const TARGET_FPS = IS_MOBILE ? 30 : 60;
    const FRAME_MS   = 1000 / TARGET_FPS;

    // Canvas & Context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { alpha: false }); // opaque = faster compositing

    // Stone Courtyard Walkable Bounds (in world / logical coordinates)
    const BOUNDS = {
        minX: 110,
        maxX: 1426,
        minY: 450,
        maxY: 920
    };

    // ===================================================
    // OBSTACLE COLLISION ZONES (impassable areas)
    // Based on actual pixel analysis of background.png
    // Each entry: { x, y, w, h } — axis-aligned rectangle blocking player center
    // ===================================================
    const OBSTACLE_ZONES = [
        // LEFT SIDE HEDGE (outer left border at all Y)
        { x: 0,    y: 450, w: 105,  h: 500 },

        // RIGHT SIDE HEDGE (outer right border at all Y)
        { x: 1431, y: 450, w: 105,  h: 500 },

        // BOTTOM-LEFT FENCE + FLOWER POT CLUSTER
        // Fence starts around x=260, y=730 and flower pot is at x=320..510, y=820..1024
        { x: 0,    y: 730, w: 360,  h: 300 },   // left hedge wall below y=730
        { x: 260,  y: 750, w: 190,  h: 270 },   // fence + draped cloth left
        { x: 340,  y: 820, w: 170,  h: 210 },   // flower pot bottom-left

        // BOTTOM-RIGHT FENCE + FLOWER POT CLUSTER
        { x: 1176, y: 750, w: 190,  h: 270 },   // fence + draped cloth right
        { x: 1000, y: 820, w: 170,  h: 210 },   // flower pot bottom-right
        { x: 1180, y: 730, w: 360,  h: 300 },   // right hedge wall below y=730
    ];

    // Helper: check if a world point is inside any obstacle rectangle
    // Uses a small radius around the player feet (center-bottom)
    function isInObstacle(px, py) {
        const r = 18; // player collision half-width
        for (const obs of OBSTACLE_ZONES) {
            if (px + r > obs.x && px - r < obs.x + obs.w &&
                py > obs.y && py < obs.y + obs.h) {
                return true;
            }
        }
        return false;
    }

    // Asset Cache
    const images = {};
    const assetManifest = {
        // Use JPEG background — 92% smaller, loads 10x faster on mobile
        bg: 'assets/background.jpg',

        // Male Player
        m_walk_1: 'assets/male_walk_1.png',
        m_walk_2: 'assets/male_walk_2.png',
        m_walk_3: 'assets/male_walk_3.png',
        m_walk_4: 'assets/male_walk_4.png',
        m_idle: 'assets/male_idle.png',

        // Female Player
        f_walk_1: 'assets/female_walk_1.png',
        f_walk_2: 'assets/female_walk_2.png',
        f_walk_3: 'assets/female_walk_3.png',
        f_walk_4: 'assets/female_walk_4.png',
        f_idle: 'assets/female_idle.png',

        // NPCs
        npc_groom: 'assets/npc_groom.png',
        npc_bride: 'assets/npc_bride.png',
        npc_father_groom: 'assets/npc_father_groom.png',
        npc_memorial: 'assets/npc_mother_groom_memorial.png',
        npc_father_bride: 'assets/npc_father_bride.png',
        npc_mother_bride: 'assets/npc_mother_bride.png',
        npc_ducky: 'assets/npc_ducky.png',

        // Props
        prop_gift: 'assets/prop_gift_box.png',
        prop_sign: 'assets/prop_signboard.png'
    };

    let assetsLoaded = 0;
    const totalAssets = Object.keys(assetManifest).length;

    // Offscreen background cache — drawn once, blit every frame (big perf win)
    let bgCache = null;

    function preloadAssets(onComplete) {
        for (const [key, src] of Object.entries(assetManifest)) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                assetsLoaded++;
                if (key === 'bg') {
                    // Pre-render background into offscreen canvas in full world resolution
                    bgCache = document.createElement('canvas');
                    bgCache.width  = WORLD_W;
                    bgCache.height = WORLD_H;
                    const bctx = bgCache.getContext('2d', { alpha: false });
                    bctx.drawImage(img, 0, 0, WORLD_W, WORLD_H);
                }
                if (assetsLoaded === totalAssets) onComplete();
            };
            img.onerror = () => {
                // Count failed assets too so game still starts
                assetsLoaded++;
                if (assetsLoaded === totalAssets) onComplete();
            };
            images[key] = img;
        }
    }

    // Ambient Particles — fewer on mobile for performance
    const MAX_PARTICLES = IS_MOBILE ? 12 : 30;
    const particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
        particles.push({
            x: Math.random() * WORLD_W,
            y: Math.random() * WORLD_H,
            size: Math.random() * 4 + 2,
            speedY: Math.random() * 0.8 + 0.3,
            speedX: Math.sin(Math.random() * Math.PI) * 0.6 + 0.2,
            color: Math.random() > 0.4 ? 'rgba(255, 230, 180, 0.65)' : 'rgba(255, 205, 210, 0.75)',
            sway: Math.random() * Math.PI * 2
        });
    }

    // Tap-to-walk ripples (desktop only)
    let tapRipples = [];

    // Player State
    const player = {
        gender: 'male', // 'male' or 'female'
        name: 'Tamu Undangan',
        x: 768,
        y: 750,
        facing: 1, // 1: right, -1: left
        isMoving: false,
        speed: 4.8,
        frameTimer: 0,
        frameIndex: 0,
        targetX: null,
        targetY: null,
        stepSoundTimer: 0
    };

    // NPCs and Interactive Objects in the Wedding Venue
    const entities = [
        {
            id: 'papan_info',
            name: 'Papan Informasi',
            role: 'Detail Akad Nikah',
            type: 'prop',
            x: 180,
            y: 440,
            width: 140,
            height: 140,
            avatar: 'assets/prop_signboard.png',
            badge: 'ℹ️ INFO ACARA',
            proximityRadius: 150,
            drawSelf: false, // already rendered on background
            onInteract: openPapanInfo
        },
        {
            id: 'ayah_arief',
            name: 'Bpk. Ahmad Kawit',
            role: 'Ayah Mempelai Pria',
            type: 'npc',
            sprite: 'npc_father_groom',
            x: 260,
            y: 650,
            width: 60,
            height: 165,
            badge: '💬 SAPA',
            proximityRadius: 130,
            drawSelf: true,
            dialogue: {
                title: 'Bpk. Ahmad Kawit',
                role: 'Ayah dari Arief Putra Utama (Putra Pertama)',
                avatar: 'assets/npc_father_groom.png',
                text: 'Assalamu’alaikum Warahmatullahi Wabarakatuh.\n\nSelamat datang di hari yang penuh berkah dan rasa syukur ini. Saya, Ahmad Kawit, ayahanda dari ananda Arief Putra Utama, mengucapkan terima kasih yang setulus-tulusnya atas kehadiran Bapak, Ibu, dan para sahabat sekalian.\n\nMohon doa restu agar putra pertama kami bersama ananda Wardani senantiasa dibimbing Allah SWT dalam membangun bahtera rumah tangga yang sakinah, mawaddah, warahmah. Aamiin.',
                actions: [
                    { label: 'Aamiin Ya Rabbal Alamin 🤲', type: 'close' },
                    { label: 'Kirim Doa Restu 💌', type: 'open_guestbook' }
                ]
            }
        },
        {
            id: 'meja_kenangan',
            name: 'Meja Kenangan & Doa',
            role: 'Mengenang (Alm) Ibu Agustinawati',
            type: 'npc',
            sprite: 'npc_memorial',
            x: 430,
            y: 560,
            width: 110,
            height: 165,
            badge: '🕊️ KENANGAN & DOA',
            proximityRadius: 140,
            drawSelf: true,
            dialogue: {
                title: '(Alm) Ibu Agustinawati',
                role: 'Ibunda Tercinta dari Arief Putra Utama',
                avatar: 'assets/npc_mother_groom_memorial.png',
                text: '🌸 "Tiada kata yang cukup untuk menggambarkan rasa terima kasih atas setiap peluh, kasih sayang, dan doa yang senantiasa Ibu curahkan. Meski ragamu tak lagi bersama kami di hari bahagia ini, doa dan cintamu selalu hidup di setiap detak jantung dan langkah kami."\n\nKepada para tamu yang terhormat, mari sejenak menundukkan kepala menghadiahkan bacaan Surah Al-Fatihah dan doa terbaik untuk almarhumah Ibu Agustinawati, semoga dilapangkan kuburnya dan ditempatkan di surga firdaus terbaik-Nya.',
                actions: [
                    { label: 'Kirim Doa Al-Fatihah 🤲🕊️', type: 'pray_mother' },
                    { label: 'Tutup', type: 'close' }
                ]
            }
        },
        {
            id: 'npc_ducky',
            name: 'Ducky (Game Dev)',
            role: 'Developer Undangan Game',
            type: 'npc',
            sprite: 'npc_ducky',
            x: 750,
            y: 875,
            width: 70,
            height: 145,
            badge: '🦆 DEVELOPER',
            proximityRadius: 130,
            drawSelf: true,
            dialogue: {
                title: 'Ducky (Ducky Games)',
                role: 'Secret Developer Mascot 🦆🎮',
                avatar: 'assets/avatar_ducky.png',
                text: 'Psst! Halo, Tamu Undangan yang luar biasa! 👋🦆 Tahukah kamu rahasia di balik website ini? Seluruh undangan pernikahan interaktif berbasis game RPG yang sedang kamu mainkan ini dibuat dan diprogram langsung oleh sang mempelai pria sendiri, yaitu Arief Putra Utama! Dari pixel karakter, animasi berjalan, musik romantis, hingga setiap detail pelaminan ini dirancang khusus oleh Saya sendiri sebagai persembahan cinta terindah untuk Pujaan Hati saya Wardani, sekaligus memberikan pengalaman seru & unik bagi kalian semua yang membukanya di HP! Hehe! Selamat berpetualang dan jangan lupa sapa kedua mempelai serta kirimkan doa restu terbaikmu ya! 🎉💛',
                actions: [
                    { label: 'Keren Banget Mas Arief! 👏🔥', type: 'clap_dev', primary: true },
                    { label: 'Sapa Pengantin 🤵👰', type: 'go_to_couple' },
                    { label: 'Tutup', type: 'close' }
                ]
            }
        },
        {
            id: 'mempelai',
            name: 'Arief & Wardani',
            role: 'Kedua Mempelai',
            type: 'npc',
            x: 759,
            y: 470,
            width: 150,
            height: 170,
            badge: '❤️ MEMPELAI',
            proximityRadius: 145,
            drawSelf: false, // couple is standing at the center arch
            dialogue: {
                title: 'Arief Putra Utama & Wardani',
                role: 'Kedua Mempelai Akad Nikah',
                avatar: 'assets/avatar_male.png',
                text: 'Bismillahirrahmannirrahiim. Assalamu’alaikum Warahmatullahi Wabarakatuh.\n\nDengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk menyaksikan dan memberikan doa restu pada prosesi Akad Nikah kami:\n\n🤵 Mempelai Pria:\n**Arief Putra Utama**\nPutra Pertama dari Bpk. Ahmad Kawit & (Alm) Ibu Agustinawati\n\n👰 Mempelai Wanita:\n**Wardani**\nPutri Pertama dari Bpk. Gunadi & Ibu Biah\n\nAcara ini adalah prosesi Akad Nikah, Kehadiran dan untaian Doa restu dari Bapak/Ibu/Saudara/I merupakan anugerah terindah dan penyempurna kebahagiaan kami.',
                actions: [
                    { label: 'Kirim Doa Restu / Ucapan 💌', type: 'open_guestbook' },
                    { label: 'Lihat Lokasi di Google Maps 📍', type: 'open_maps' },
                    { label: 'Tutup', type: 'close' }
                ]
            }
        },
        {
            id: 'kotak_hadiah',
            name: 'Kotak Hadiah',
            role: 'Tanda Kasih Pernikahan',
            type: 'prop',
            x: 1045,
            y: 430,
            width: 80,
            height: 80,
            avatar: 'assets/prop_gift_box.png',
            badge: '🎁 TANDA KASIH',
            proximityRadius: 130,
            drawSelf: false, // on background steps
            dialogue: {
                title: 'Tanda Kasih (Wedding Gift)',
                role: 'Amplop Digital & Alamat Pengiriman',
                avatar: 'assets/prop_gift_box.png',
                text: 'Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Namun jika Bapak/Ibu/Saudara/i berkenan memberikan tanda kasih secara digital, dapat disalurkan melalui rekening berikut:\n\n💳 **Bank BCA**: 771-204-8568\na.n Arief Putra Utama\n\n💳 **Bank BCA**: 862-070-3321\na.n Wardani\n\n🏡 **Alamat Pengiriman Kado**:\nJl. Raya Sambikerep No.55, Sambikerep, Kec. Sambikerep, Surabaya, Jawa Timur 60217 (Kediaman Mempelai Wanita)',
                actions: [
                    { label: 'Salin Rekening Arief (BCA) 📋', type: 'copy_bca_arief' },
                    { label: 'Salin Rekening Wardani (BCA) 📋', type: 'copy_bca_wardani' },
                    { label: 'Salin Alamat Rumah 🏡', type: 'copy_address' },
                    { label: 'Tutup', type: 'close' }
                ]
            }
        },
        {
            id: 'ayah_wardani',
            name: 'Bpk. Gunadi',
            role: 'Ayah Mempelai Wanita',
            type: 'npc',
            sprite: 'npc_father_bride',
            x: 1330,
            y: 620,
            width: 60,
            height: 165,
            badge: '💬 SAPA',
            proximityRadius: 130,
            drawSelf: true,
            dialogue: {
                title: 'Bpk. Gunadi',
                role: 'Ayah dari Wardani (Putri Pertama)',
                avatar: 'assets/npc_father_bride.png',
                text: 'Assalamu’alaikum Warahmatullahi Wabarakatuh.\n\nSelamat datang di kediaman kami di Sambikerep, Surabaya. Kami sekeluarga dengan penuh syukur dan bahagia menyambut kehadiran Anda sekalian untuk menyaksikan akad nikah putri pertama kami tercinta, Wardani, yang dipersunting oleh ananda Arief Putra Utama.\n\nTerima kasih yang mendalam atas segala perhatian, doa, dan tali silaturahmi yang senantiasa terjalin erat.',
                actions: [
                    { label: 'Sama-sama Bpk. Gunadi 🙏', type: 'close' },
                    { label: 'Tulis Pesan Doa 💌', type: 'open_guestbook' }
                ]
            }
        },
        {
            id: 'ibu_wardani',
            name: 'Ibu Biah',
            role: 'Ibu Mempelai Wanita',
            type: 'npc',
            sprite: 'npc_mother_bride',
            x: 1410,
            y: 720,
            width: 55,
            height: 160,
            badge: '💬 SAPA',
            proximityRadius: 130,
            drawSelf: true,
            dialogue: {
                title: 'Ibu Biah',
                role: 'Ibunda dari Wardani (Putri Pertama)',
                avatar: 'assets/npc_mother_bride.png',
                text: 'Alhamdulillah, selamat datang! Senang sekali hati kami Bapak/Ibu/Saudara/i dapat meluangkan waktu berharga untuk menghadiri momen sakral akad nikah ananda Wardani dan Arief.\n\nSemoga doa restu yang Anda panjatkan diijabah oleh Allah SWT dan dibalas dengan berlipat kebaikan. Silakan menikmati suasana kediaman kami!',
                actions: [
                    { label: 'Terima kasih Ibu Biah 🌸', type: 'close' },
                    { label: 'Lihat Info Peta 📍', type: 'open_maps' }
                ]
            }
        }
    ];

    let activeEntity = null;
    let inputStates = {
        up: false,
        down: false,
        left: false,
        right: false
    };

    // ===================================================
    // CANVAS & CAMERA VIEWPORT SETUP (PORTRAIT / RESPONSIVE)
    // ===================================================
    function resizeCanvas() {
        const container = document.getElementById('game-container') || document.body;
        const screenW = container.clientWidth || window.innerWidth;
        const screenH = container.clientHeight || window.innerHeight;
        const aspect = screenW / screenH;

        if (aspect < 1.0) {
            // PORTRAIT MODE (HP):
            // Height matches world height (1024) so full vertical stage is visible
            VIEW_H = WORLD_H;
            VIEW_W = Math.max(480, Math.min(WORLD_W, Math.round(VIEW_H * aspect)));
        } else {
            // LANDSCAPE / DESKTOP MODE:
            // Standard full landscape view
            VIEW_W = WORLD_W;
            VIEW_H = WORLD_H;
        }

        // Internal render resolution:
        // Sharp high-DPI rendering on mobile (1.0 - 1.2 scale) to eliminate blur & pixelation completely!
        const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
        RENDER_SCALE = IS_MOBILE ? Math.max(1.0, Math.min(1.2, dpr * 0.75)) : 1.0;
        const renderW = Math.round(VIEW_W * RENDER_SCALE);
        const renderH = Math.round(VIEW_H * RENDER_SCALE);

        if (canvas.width !== renderW || canvas.height !== renderH) {
            canvas.width = renderW;
            canvas.height = renderH;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }
    }
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 150);
    });

    // ===================================================
    // GAME INPUT HANDLERS (D-PAD, JOYSTICK, KEYBOARD)
    // ===================================================
    function setupControls() {
        // ---- D-PAD Buttons ----
        const buttons = {
            'dpad-up': 'up',
            'dpad-down': 'down',
            'dpad-left': 'left',
            'dpad-right': 'right'
        };

        for (const [id, dir] of Object.entries(buttons)) {
            const btn = document.getElementById(id);
            if (!btn) continue;

            const handleStart = (e) => {
                e.preventDefault();
                e.stopPropagation();
                inputStates[dir] = true;
                btn.classList.add('active');
                player.targetX = null;
                player.targetY = null;
            };

            const handleEnd = (e) => {
                e.preventDefault();
                inputStates[dir] = false;
                btn.classList.remove('active');
            };

            btn.addEventListener('touchstart', handleStart, { passive: false });
            btn.addEventListener('touchend',   handleEnd,   { passive: false });
            btn.addEventListener('touchcancel',handleEnd,   { passive: false });
            btn.addEventListener('mousedown',  handleStart);
            btn.addEventListener('mouseup',    handleEnd);
            btn.addEventListener('mouseleave', handleEnd);
        }

        // ---- SAPA (Action) Button ----
        const sapaBtn = document.getElementById('btn-sapa');
        if (sapaBtn) {
            const handleSapa = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerInteraction();
            };
            sapaBtn.addEventListener('touchstart', handleSapa, { passive: false });
            sapaBtn.addEventListener('click', handleSapa);
        }

        // ---- CANVAS touch/click ----
        // On MOBILE: completely disabled — only D-Pad & Sapa button work
        // On DESKTOP: tap-to-walk enabled
        if (!IS_MOBILE) {
            canvas.addEventListener('pointerdown', (e) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = VIEW_W / rect.width;
                const scaleY = VIEW_H / rect.height;

                // Map screen click into world space using camera position
                const clickX = camera.x + (e.clientX - rect.left) * scaleX;
                const clickY = camera.y + (e.clientY - rect.top)  * scaleY;

                // Walk toward nearby entity
                for (const ent of entities) {
                    const dist = Math.hypot(clickX - ent.x, clickY - ent.y);
                    if (dist < ent.proximityRadius * 0.9) {
                        player.targetX = ent.x;
                        player.targetY = Math.min(BOUNDS.maxY, ent.y + 40);
                        tapRipples.push({ x: ent.x, y: ent.y, radius: 10, alpha: 1 });
                        return;
                    }
                }

                // Walk to clicked position
                const targetX = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, clickX));
                const targetY = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, clickY));
                if (isInObstacle(targetX, targetY)) return;

                player.targetX = targetX;
                player.targetY = targetY;
                tapRipples.push({ x: targetX, y: targetY, radius: 8, alpha: 1 });
                if (window.soundEngine) window.soundEngine.playStep();
            });
        } else {
            // Prevent ANY accidental touch scrolling or tap on canvas
            canvas.addEventListener('touchstart',  (e) => e.preventDefault(), { passive: false });
            canvas.addEventListener('touchmove',   (e) => e.preventDefault(), { passive: false });
            canvas.addEventListener('touchend',    (e) => e.preventDefault(), { passive: false });
            canvas.style.touchAction = 'none';
            canvas.style.pointerEvents = 'none'; // canvas is display-only on mobile
        }

        // ---- Keyboard Controls (desktop) ----
        window.addEventListener('keydown', (e) => {
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            switch(e.key.toLowerCase()) {
                case 'arrowup':    case 'w': inputStates.up    = true;  player.targetX = null; break;
                case 'arrowdown':  case 's': inputStates.down  = true;  player.targetX = null; break;
                case 'arrowleft':  case 'a': inputStates.left  = true;  player.targetX = null; break;
                case 'arrowright': case 'd': inputStates.right = true;  player.targetX = null; break;
                case ' ': case 'enter': case 'e': triggerInteraction(); break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'arrowup':    case 'w': inputStates.up    = false; break;
                case 'arrowdown':  case 's': inputStates.down  = false; break;
                case 'arrowleft':  case 'a': inputStates.left  = false; break;
                case 'arrowright':
                case 'd':
                    inputStates.right = false;
                    break;
            }
        });
    }

    // ===================================================
    // INTERACTION ENGINE
    // ===================================================
    function triggerInteraction() {
        if (activeEntity) {
            if (window.soundEngine) window.soundEngine.playChime();
            if (activeEntity.onInteract) {
                activeEntity.onInteract();
            } else if (activeEntity.dialogue) {
                showDialogue(activeEntity.dialogue);
            }
        } else {
            showToast('Dekati seseorang atau papan info untuk menyapa! 👣');
        }
    }

    function checkProximity() {
        let nearest = null;
        let minDist = Infinity;

        for (const ent of entities) {
            const dist = Math.hypot(player.x - ent.x, player.y - ent.y);
            if (dist < ent.proximityRadius && dist < minDist) {
                minDist = dist;
                nearest = ent;
            }
        }

        const sapaBtn = document.getElementById('btn-sapa');
        const hintTag = document.getElementById('interaction-hint');

        if (nearest !== activeEntity) {
            activeEntity = nearest;
            if (activeEntity) {
                if (sapaBtn) sapaBtn.classList.add('can-interact');
                if (hintTag) {
                    hintTag.textContent = `${activeEntity.name}`;
                    hintTag.classList.add('visible');
                }
            } else {
                if (sapaBtn) sapaBtn.classList.remove('can-interact');
                if (hintTag) hintTag.classList.remove('visible');
            }
        }
    }

    // ===================================================
    // UPDATE LOGIC (60 FPS)
    // ===================================================
    function update(dt) {
        let moveX = 0;
        let moveY = 0;

        // D-Pad / Keyboard Direction
        if (inputStates.left) moveX -= 1;
        if (inputStates.right) moveX += 1;
        if (inputStates.up) moveY -= 1;
        if (inputStates.down) moveY += 1;

        // Pointer / Tap to walk navigation
        if (player.targetX !== null && player.targetY !== null && moveX === 0 && moveY === 0) {
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            const dist = Math.hypot(dx, dy);

            if (dist < player.speed) {
                player.x = player.targetX;
                player.y = player.targetY;
                player.targetX = null;
                player.targetY = null;
                player.isMoving = false;
            } else {
                moveX = dx / dist;
                moveY = dy / dist;
            }
        }

        // Apply Movement
        if (moveX !== 0 || moveY !== 0) {
            player.isMoving = true;

            // Facing direction
            if (moveX > 0) player.facing = 1;
            if (moveX < 0) player.facing = -1;

            // Diagonal normalization
            const len = Math.hypot(moveX, moveY);
            const speed = player.speed;

            // Try full movement, then slide along axes if blocked by obstacles
            const newX = player.x + (moveX / len) * speed;
            const newY = player.y + (moveY / len) * speed;

            // Clamp to outer bounds first
            const clampedX = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, newX));
            const clampedY = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, newY));

            // Check obstacle collisions — try full move, then X-only, then Y-only
            if (!isInObstacle(clampedX, clampedY)) {
                player.x = clampedX;
                player.y = clampedY;
            } else if (!isInObstacle(clampedX, player.y)) {
                player.x = clampedX;
            } else if (!isInObstacle(player.x, clampedY)) {
                player.y = clampedY;
            }
            // else fully blocked — stay put

            // Walk animation cycle
            player.frameTimer += dt;
            if (player.frameTimer > 130) {
                player.frameIndex = (player.frameIndex + 1) % 4;
                player.frameTimer = 0;
            }

            // Footstep sound
            player.stepSoundTimer += dt;
            if (player.stepSoundTimer > 280) {
                player.stepSoundTimer = 0;
                if (window.soundEngine) window.soundEngine.playStep();
            }
        } else {
            player.isMoving = false;
            player.frameIndex = 0;
            player.frameTimer = 0;
        }

        // Update ambient particles
        particles.forEach(p => {
            p.y += p.speedY;
            p.sway += 0.03;
            p.x += Math.sin(p.sway) * 0.5;
            if (p.y > WORLD_H + 10) {
                p.y = -10;
                p.x = Math.random() * WORLD_W;
            }
        });

        // Update tap ripples
        tapRipples.forEach(r => {
            r.radius += 1.4;
            r.alpha -= 0.03;
        });
        tapRipples = tapRipples.filter(r => r.alpha > 0);

        // Smooth Camera Follow: Center camera on player X, clamp to world bounds
        camera.targetX = player.x - VIEW_W / 2;
        camera.targetY = player.y - VIEW_H / 2;

        // Clamp camera target within world boundaries
        camera.targetX = Math.max(0, Math.min(WORLD_W - VIEW_W, camera.targetX));
        camera.targetY = Math.max(0, Math.min(WORLD_H - VIEW_H, camera.targetY));

        // Smooth lerp for buttery camera panning
        const lerpFactor = 0.12;
        camera.x += (camera.targetX - camera.x) * lerpFactor;
        camera.y += (camera.targetY - camera.y) * lerpFactor;

        checkProximity();
    }

    // ===================================================
    // DRAW / RENDER LOOP
    // ===================================================
    function draw() {
        // Set transform based on RENDER_SCALE and camera offset
        // Screen pixel = (worldPos - camera) * RENDER_SCALE
        ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, -camera.x * RENDER_SCALE, -camera.y * RENDER_SCALE);

        // 1. Draw Background — use pre-rendered offscreen cache
        if (bgCache) {
            ctx.drawImage(bgCache, 0, 0, WORLD_W, WORLD_H);
        } else if (images.bg && images.bg.complete) {
            ctx.drawImage(images.bg, 0, 0, WORLD_W, WORLD_H);
        } else {
            ctx.fillStyle = '#c8b89a';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        }

        // 2. Tap-to-Walk Ripples (desktop only — IS_MOBILE has no tap)
        if (!IS_MOBILE) {
            tapRipples.forEach(r => {
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.5, 0, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(218, 178, 107, ${r.alpha})`;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.restore();
            });
        }

        // 3. Depth Sorting: Render entities & player according to Y position
        const renderList = [];

        // Add visible entities
        entities.forEach(ent => {
            if (ent.drawSelf) {
                renderList.push({
                    type: 'entity',
                    y: ent.y,
                    obj: ent
                });
            }
        });

        // Add player
        renderList.push({
            type: 'player',
            y: player.y,
            obj: player
        });

        // Sort ascending by Y (far objects drawn first, closer objects overlap)
        renderList.sort((a, b) => a.y - b.y);

        renderList.forEach(item => {
            if (item.type === 'entity') {
                drawEntity(item.obj);
            } else {
                drawPlayer(item.obj);
            }
        });

        // 4. Draw Floating Exclamation Badges over all entities
        entities.forEach(ent => {
            drawEntityBadge(ent);
        });

        // 5. Draw Ambient Golden Sun Motes & Rose Petals
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
    }

    // ===================================================
    // SPRITE DRAWING HELPERS
    // ===================================================
    function drawPlayer(p) {
        ctx.save();

        // Perspective scaling: slightly larger as walking towards bottom
        const depthScale = 0.88 + ((p.y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY)) * 0.22;
        const targetH = 168 * depthScale;

        // Shadow under player
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 4, 30 * depthScale, 11 * depthScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 20, 10, 0.22)';
        ctx.fill();

        // Select sprite
        let spriteKey;
        const prefix = p.gender === 'female' ? 'f_' : 'm_';
        if (p.isMoving) {
            spriteKey = `${prefix}walk_${p.frameIndex + 1}`;
        } else {
            spriteKey = `${prefix}idle`;
        }

        const img = images[spriteKey];
        if (img && img.complete) {
            const aspect = img.width / img.height;
            const targetW = targetH * aspect;

            ctx.translate(p.x, p.y);
            if (p.facing === -1) {
                ctx.scale(-1, 1);
            }

            ctx.drawImage(img, -targetW / 2, -targetH + 10, targetW, targetH);
        }

        ctx.restore();

        // Player Indicator & Name Tag
        drawPlayerIndicator(p, targetH);
    }

    function drawPlayerIndicator(p, height) {
        ctx.save();
        const indicatorY = p.y - height - 12;

        // Floating bounce effect
        const bounce = Math.sin(Date.now() / 200) * 4;

        // Inverted Triangle Cursor (Blue for Male, Gold for Female)
        ctx.beginPath();
        const cursorX = p.x;
        const cursorY = indicatorY + bounce;
        ctx.moveTo(cursorX - 8, cursorY - 14);
        ctx.lineTo(cursorX + 8, cursorY - 14);
        ctx.lineTo(cursorX, cursorY - 3);
        ctx.closePath();
        ctx.fillStyle = p.gender === 'female' ? '#c89d56' : '#5b7c96';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Guest Name Pill
        ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
        const textWidth = ctx.measureText(p.name).width;
        const padX = 8;
        const pillW = textWidth + padX * 2;
        const pillH = 22;
        const pillX = p.x - pillW / 2;
        const pillY = cursorY - 38;

        ctx.fillStyle = 'rgba(28, 40, 50, 0.82)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 11);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.name, p.x, pillY + pillH / 2);

        ctx.restore();
    }

    function drawEntity(ent) {
        if (!ent.sprite) return;
        const img = images[ent.sprite];
        if (!img || !img.complete) return;

        ctx.save();
        const depthScale = 0.88 + ((ent.y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY)) * 0.22;
        const targetH = ent.height * depthScale;
        const aspect = img.width / img.height;
        const targetW = targetH * aspect;

        // Shadow under entity
        ctx.beginPath();
        ctx.ellipse(ent.x, ent.y + 4, targetW * 0.35, 10 * depthScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 20, 10, 0.25)';
        ctx.fill();

        ctx.drawImage(img, ent.x - targetW / 2, ent.y - targetH + 8, targetW, targetH);
        ctx.restore();
    }

    function drawEntityBadge(ent) {
        const dist = Math.hypot(player.x - ent.x, player.y - ent.y);
        // Only show badge when player approaches within 260px for a clean, cinematic view
        if (dist > 260) return;

        ctx.save();
        const alpha = Math.min(1.0, (260 - dist) / 50.0);
        ctx.globalAlpha = alpha;

        const bounce = Math.sin(Date.now() / 250 + ent.x) * 4;
        const badgeY = ent.y - ent.height - 18 + bounce;

        const isNearby = activeEntity && activeEntity.id === ent.id;

        // Animated Exclamation Bubble `(!)`
        ctx.beginPath();
        const bubbleRadius = isNearby ? 16 : 14;
        ctx.arc(ent.x, badgeY, bubbleRadius, 0, Math.PI * 2);
        ctx.fillStyle = isNearby ? '#ffd166' : 'rgba(255, 255, 255, 0.94)';
        ctx.fill();
        ctx.strokeStyle = isNearby ? '#9e7534' : 'rgba(74, 107, 130, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = isNearby ? '#5a3d0b' : '#355166';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', ent.x, badgeY + 1);

        ctx.restore();
    }

    // ===================================================
    // MAIN LOOP — Native Refresh Rate (Ultra-smooth 60 FPS)
    // ===================================================
    let lastTime = performance.now();

    function loop(currentTime) {
        requestAnimationFrame(loop);

        const elapsed = currentTime - lastTime;
        lastTime = currentTime;

        // Cap dt to prevent huge jump if user switches tab
        const dt = Math.min(elapsed, 64);

        update(dt);
        draw();
    }

    // ===================================================
    // DIALOGUE MODAL CONTROLLER
    // ===================================================
    function showDialogue(data) {
        const modal = document.getElementById('dialogue-modal');
        if (!modal) return;

        const avatarImg = document.getElementById('dialogue-avatar-img');
        const speakerName = document.getElementById('dialogue-speaker-name');
        const speakerRole = document.getElementById('dialogue-speaker-role');
        const textElem = document.getElementById('dialogue-text');
        const actionsContainer = document.getElementById('dialogue-actions');

        if (avatarImg) avatarImg.src = data.avatar || 'assets/avatar_male.png';
        if (speakerName) speakerName.textContent = data.title;
        if (speakerRole) speakerRole.textContent = data.role;
        if (textElem) textElem.textContent = data.text;

        // Action Buttons
        if (actionsContainer) {
            actionsContainer.innerHTML = '';
            (data.actions || []).forEach(act => {
                const btn = document.createElement('button');
                btn.className = `action-btn-custom ${act.primary ? 'primary' : 'gold'}`;
                btn.textContent = act.label;
                btn.onclick = () => {
                    handleDialogueAction(act.type);
                };
                actionsContainer.appendChild(btn);
            });
        }

        modal.classList.add('active');
    }

    function hideDialogue() {
        const modal = document.getElementById('dialogue-modal');
        if (modal) modal.classList.remove('active');
    }

    function handleDialogueAction(type) {
        switch(type) {
            case 'close':
                hideDialogue();
                break;
            case 'open_maps':
                window.open('https://maps.app.goo.gl/oVcFJ6hYmWVhiSSXA', '_blank');
                break;
            case 'open_guestbook':
                hideDialogue();
                openGuestbookModal();
                break;
            case 'copy_bca_arief':
            case 'copy_bca':
                navigator.clipboard.writeText('7712048568');
                showToast('No. Rekening BCA Arief (771-204-8568) berhasil disalin! 💳');
                if (window.soundEngine) window.soundEngine.playHeart();
                break;
            case 'copy_bca_wardani':
            case 'copy_mandiri':
                navigator.clipboard.writeText('8620703321');
                showToast('No. Rekening BCA Wardani (862-070-3321) berhasil disalin! 💳');
                if (window.soundEngine) window.soundEngine.playHeart();
                break;
            case 'copy_address':
                navigator.clipboard.writeText('Jl. Raya Sambikerep No.55, Sambikerep, Kec. Sambikerep, Surabaya, Jawa Timur 60217');
                showToast('Alamat kediaman berhasil disalin! 🏡');
                if (window.soundEngine) window.soundEngine.playHeart();
                break;
            case 'pray_mother':
                triggerMemorialSparkle();
                showToast('Doa & Al-Fatihah telah terkirim dengan takzim 🤲🕊️');
                if (window.soundEngine) window.soundEngine.playHeart();
                break;
            case 'clap_dev':
                triggerDuckySparkle();
                showToast('Terima kasih apresiasinya! Mas Arief sangat senang 🦆💛🔥');
                if (window.soundEngine) window.soundEngine.playHeart();
                break;
            case 'go_to_couple':
                hideDialogue();
                player.targetX = 759;
                player.targetY = 485;
                showToast('Menuju ke depan pelaminan Arief & Wardani ➔');
                break;
        }
    }

    function triggerMemorialSparkle() {
        // Spawn 20 glowing heart/flower particles at memorial table
        for (let i = 0; i < 20; i++) {
            particles.push({
                x: 430 + (Math.random() - 0.5) * 60,
                y: 560 + (Math.random() - 0.5) * 40,
                size: Math.random() * 5 + 3,
                speedY: -(Math.random() * 2 + 1),
                speedX: (Math.random() - 0.5) * 1.5,
                color: '#ffe082',
                sway: Math.random() * Math.PI
            });
        }
    }

    function triggerDuckySparkle() {
        // Spawn 25 yellow & golden sparkle stars around Ducky
        for (let i = 0; i < 25; i++) {
            particles.push({
                x: 750 + (Math.random() - 0.5) * 80,
                y: 860 + (Math.random() - 0.5) * 50,
                size: Math.random() * 5 + 3,
                speedY: -(Math.random() * 2.5 + 1.2),
                speedX: (Math.random() - 0.5) * 2,
                color: Math.random() > 0.5 ? '#ffd166' : '#66d9e8',
                sway: Math.random() * Math.PI
            });
        }
    }

    // ===================================================
    // PAPAN INFORMASI MODAL
    // ===================================================
    function openPapanInfo() {
        showDialogue({
            title: 'Akad Nikah Arief & Wardani',
            role: 'Informasi Resmi & Jadwal Acara',
            avatar: 'assets/prop_signboard.png',
            text: `🗓️ **HARI & TANGGAL**:\nKamis, 26 November 2026\n\n⏰ **WAKTU AKAD NIKAH**:\nPukul 09:00 Pagi (Akad sampai selesai)\n\n📌 **CATATAN ACARA**:\nAcara ini akad saja sampai selesai.\n\n📍 **LOKASI ACARA**:\nKediaman Mempelai Wanita\nJl. Raya Sambikerep No.55, Sambikerep, Kec. Sambikerep, Surabaya, Jawa Timur 60217`,
            actions: [
                { label: 'Buka di Google Maps 📍', type: 'open_maps', primary: true },
                { label: 'Salin Alamat 🏡', type: 'copy_address' },
                { label: 'Tulis Ucapan Doa 💌', type: 'open_guestbook' },
                { label: 'Tutup', type: 'close' }
            ]
        });
    }

    // ===================================================
    // GUESTBOOK / RSVP MODAL CONTROLLER
    // ===================================================
    function openGuestbookModal() {
        const modal = document.getElementById('guestbook-modal');
        if (modal) {
            modal.classList.add('active');
            renderWishesList();
            fetchWishesFromSheet(); // Tarik ucapan terbaru dari Google Sheets online
        }
    }

    function closeGuestbookModal() {
        const modal = document.getElementById('guestbook-modal');
        if (modal) modal.classList.remove('active');
    }

    // ===================================================
    // GUESTBOOK & RSVP WITH ONLINE GOOGLE SHEETS / CLOUD & ADMIN PIN
    // ===================================================
    // URL Google Apps Script Web App Aktif (Realtime Online Google Sheets)
    const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyhdMs0xYc1TUW9bKIyoTMuZ-EOwiTPG6RVG-HMAuOaEt3L1Xe2ARc3Y3alRS52sMFRxQ/exec';

    let isAdminLoggedIn = localStorage.getItem('arief_wardani_admin') === 'true';
    let isFetchingWishes = false;

    const defaultWishes = [
        { id: '1', name: 'Keluarga Besar Bpk. Ahmad', status: 'Hadir', text: 'Barakallahu laka wa baraka alaika wa jamaa bainakuma fii khoir. Selamat menempuh hidup baru Arief & Wardani!' },
        { id: '2', name: 'Dimas & Keluarga', status: 'Hadir', text: 'Selamat Arief dan Wardani! Semoga sakinah mawaddah warahmah selamanya.' },
        { id: '3', name: 'Siti Rahma', status: 'Hadir', text: 'Doa terbaik untuk kedua mempelai. Semoga dilimpahi rezeki dan kebahagiaan tak berujung.' }
    ];

    function getStoredWishes() {
        const stored = localStorage.getItem('arief_wardani_wishes');
        if (stored) {
            try { 
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map((w, idx) => ({ ...w, id: w.id || String(Date.now() - idx) }));
                }
            } catch(e) {}
        }
        return defaultWishes;
    }

    // Ambil data ucapan terbaru langsung dari Google Sheets
    function fetchWishesFromSheet() {
        if (!GOOGLE_SHEETS_URL || isFetchingWishes) return;
        isFetchingWishes = true;

        fetch(GOOGLE_SHEETS_URL)
            .then(res => res.json())
            .then(res => {
                if (res && res.status === 'success' && Array.isArray(res.data)) {
                    if (res.data.length > 0) {
                        localStorage.setItem('arief_wardani_wishes', JSON.stringify(res.data));
                        renderWishesList();
                    }
                }
            })
            .catch(err => {
                console.log('Gagal menyinkronkan Google Sheets (offline fallback):', err);
            })
            .finally(() => {
                isFetchingWishes = false;
            });
    }

    function deleteWish(id) {
        if (!isAdminLoggedIn) {
            alert('Akses ditolak: Hanya Admin yang dapat menghapus pesan ucapan.');
            return;
        }
        if (!confirm('Apakah Anda yakin ingin menghapus ucapan ini?')) return;

        let wishes = getStoredWishes();
        wishes = wishes.filter(w => String(w.id) !== String(id));
        localStorage.setItem('arief_wardani_wishes', JSON.stringify(wishes));

        // Hapus dari Google Sheets secara langsung
        if (GOOGLE_SHEETS_URL) {
            fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: String(id) })
            }).catch(console.error);
        }

        renderWishesList();
        showToast('Ucapan berhasil dihapus oleh Admin! 🗑️');
    }

    window.deleteWish = deleteWish;

    function renderWishesList() {
        const container = document.getElementById('wishes-container');
        if (!container) return;
        const wishes = getStoredWishes();
        const adminBtn = document.getElementById('btn-admin-login');
        if (adminBtn) {
            adminBtn.textContent = isAdminLoggedIn ? '🔓 Admin Aktif' : '🔒';
            adminBtn.classList.toggle('logged-in', isAdminLoggedIn);
        }

        if (wishes.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #888; font-size: 12px; padding: 12px;">Belum ada ucapan. Jadilah yang pertama mengirimkan doa restu! ✨</div>';
            return;
        }

        container.innerHTML = wishes.map(w => `
            <div class="wish-card" id="wish-${w.id}">
                <div class="wish-card-top">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="wish-name">${escapeHtml(w.name)}</span>
                        <span class="wish-badge">${escapeHtml(w.status || 'Hadir')}</span>
                    </div>
                    ${isAdminLoggedIn ? `<button type="button" class="btn-delete-wish" onclick="deleteWish('${w.id}')" title="Hapus Ucapan Ini">🗑️ Hapus</button>` : ''}
                </div>
                <div class="wish-text">${escapeHtml(w.text)}</div>
            </div>
        `).join('');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ===================================================
    // TOAST NOTIFICATION
    // ===================================================
    let toastTimeout = null;
    function showToast(msg) {
        const toast = document.getElementById('toast-msg');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    // ===================================================
    // INIT & CHARACTER SELECTION
    // ===================================================
    function init() {
        resizeCanvas();
        setupControls();

        // Check query param for custom name e.g. ?to=Budi+Santoso
        const params = new URLSearchParams(window.location.search);
        const guestNameParam = params.get('to');
        if (guestNameParam) {
            player.name = decodeURIComponent(guestNameParam);
            const label = document.getElementById('lobby-guest-name');
            if (label) label.textContent = player.name;
        }

        // Preload assets & start animation loop
        preloadAssets(() => {
            console.log('All wedding game assets loaded successfully!');
            requestAnimationFrame(loop);
        });

        // Close dialogue button
        const btnCloseDlg = document.getElementById('btn-close-dialogue');
        if (btnCloseDlg) btnCloseDlg.onclick = hideDialogue;

        // Close guestbook modal
        const btnCloseGb = document.getElementById('btn-close-guestbook');
        if (btnCloseGb) btnCloseGb.onclick = closeGuestbookModal;

        // Admin Lock Button Handler (Toggle Admin Mode with PIN)
        const btnAdmin = document.getElementById('btn-admin-login');
        if (btnAdmin) {
            btnAdmin.onclick = () => {
                if (isAdminLoggedIn) {
                    if (confirm('Keluar dari Mode Admin?')) {
                        isAdminLoggedIn = false;
                        localStorage.removeItem('arief_wardani_admin');
                        renderWishesList();
                        showToast('Mode Admin telah dinonaktifkan.');
                    }
                } else {
                    const pin = prompt('Masukkan PIN Admin untuk mengelola/menghapus ucapan:');
                    // Default PIN Admin: 2611 (Tanggal Akad Nikah 26 November)
                    if (pin === '2611' || pin === 'admin' || pin === 'arief') {
                        isAdminLoggedIn = true;
                        localStorage.setItem('arief_wardani_admin', 'true');
                        renderWishesList();
                        showToast('Mode Admin Aktif! Tombol Hapus ucapan kini muncul. 🔓');
                    } else if (pin !== null) {
                        alert('PIN Admin salah!');
                    }
                }
            };
        }

        // Guestbook Submit
        const formGb = document.getElementById('guestbook-form');
        if (formGb) {
            formGb.onsubmit = (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('gb-name');
                const statusInput = document.querySelector('input[name="gb-status"]:checked');
                const msgInput = document.getElementById('gb-msg');

                const newWish = {
                    id: String(Date.now()),
                    name: nameInput.value.trim() || player.name,
                    status: statusInput ? statusInput.value : 'Hadir',
                    text: msgInput.value.trim() || 'Selamat dan doa restu untuk Arief & Wardani!',
                    timestamp: new Date().toISOString()
                };

                const wishes = getStoredWishes();
                wishes.unshift(newWish);
                localStorage.setItem('arief_wardani_wishes', JSON.stringify(wishes));

                // Send to Google Sheets if configured
                if (GOOGLE_SHEETS_URL) {
                    fetch(GOOGLE_SHEETS_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newWish)
                    }).catch(console.error);
                }

                renderWishesList();
                msgInput.value = '';
                showToast('Doa restu Anda berhasil dicatat & dikirim! Terima kasih 💌');
                if (window.soundEngine) window.soundEngine.playHeart();
            };
        }

        // Music toggle button
        const btnMusic = document.getElementById('btn-music-toggle');
        if (btnMusic) {
            btnMusic.onclick = () => {
                if (window.soundEngine) {
                    const isPlaying = window.soundEngine.toggleMute();
                    btnMusic.innerHTML = isPlaying ? `
                        <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    ` : `
                        <svg viewBox="0 0 24 24"><path d="M4.27 3L3 4.27l9 9v.28c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.73L19.73 21 21 19.73 4.27 3zM14 7h4V3h-6v5.18l2 2z"/></svg>
                    `;
                    showToast(isPlaying ? 'Musik dinyalakan 🎵' : 'Musik dimatikan 🔇');
                }
            };
        }

        // Quick Info Menu button
        const btnMenu = document.getElementById('btn-info-menu');
        if (btnMenu) {
            btnMenu.onclick = () => {
                openPapanInfo();
            };
        }

        // Character Selection Setup
        setupCharacterSelection();
    }

    function setupCharacterSelection() {
        const maleCard = document.getElementById('card-male');
        const femaleCard = document.getElementById('card-female');
        const startBtn = document.getElementById('btn-start-game');
        const lobbyScreen = document.getElementById('lobby-screen');

        if (maleCard) {
            maleCard.onclick = () => {
                player.gender = 'male';
                maleCard.classList.add('selected');
                femaleCard.classList.remove('selected');
                if (window.soundEngine) window.soundEngine.playStep();
            };
        }

        if (femaleCard) {
            femaleCard.onclick = () => {
                player.gender = 'female';
                femaleCard.classList.add('selected');
                maleCard.classList.remove('selected');
                if (window.soundEngine) window.soundEngine.playStep();
            };
        }

        if (startBtn) {
            startBtn.onclick = () => {
                // Ensure viewport & camera are freshly calibrated
                resizeCanvas();
                camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x - VIEW_W / 2));
                camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, player.y - VIEW_H / 2));
                camera.targetX = camera.x;
                camera.targetY = camera.y;

                // Play chime & Start Romantic BGM
                if (window.soundEngine) {
                    window.soundEngine.startBgm();
                    window.soundEngine.playChime();
                }

                // Hide lobby screen with animation
                lobbyScreen.classList.add('hidden');
                showToast(`Selamat datang, ${player.name}! Silakan berkeliling.`);
            };
        }

        // Edit guest name button in lobby
        const editBtn = document.getElementById('btn-edit-guest');
        if (editBtn) {
            editBtn.onclick = () => {
                const newName = prompt('Masukkan nama Anda:', player.name);
                if (newName && newName.trim()) {
                    player.name = newName.trim();
                    const label = document.getElementById('lobby-guest-name');
                    if (label) label.textContent = player.name;
                }
            };
        }
    }

    // Expose helpers globally
    window.gameEngine = {
        player,
        openGuestbook: openGuestbookModal,
        openPapanInfo
    };

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
