// Daftarkan ScrollTrigger (Plugin dari GSAP)
gsap.registerPlugin(ScrollTrigger);

// 1. Animasi Parallax Latar Belakang (Bangunan dan Awan bergerak lebih lambat saat di-scroll)
gsap.to("#sky", {
    yPercent: 50, // Menggerakkan awan ke bawah setengah dari kecepat scroll
    ease: "none",
    scrollTrigger: {
        trigger: ".parallax-container",
        start: "top top", 
        end: "bottom top",
        scrub: true // Animasi mengikuti posisi scroll (bukan jalan sendiri)
    } 
});

gsap.to("#buildings", {
    yPercent: 20, 
    ease: "none",
    scrollTrigger: {
        trigger: ".parallax-container",
        start: "top top",
        end: "bottom top",
        scrub: true
    }
});

// 2. Animasi Karakter (Misal: Pasangan naik motor masuk dari kiri ke kanan saat di-scroll ke bawah)
gsap.fromTo("#couple", 
    { x: "-100vw" }, // Mulai dari luar layar kiri
    { 
        x: "50vw", // Berhenti di tengah layar
        ease: "power1.out",
        scrollTrigger: {
            trigger: ".section-details", // Animasi mulai saat teks 'Akad' mulai terlihat
            start: "top bottom", 
            end: "center center",
            scrub: true // Gerakan mengikuti scroll
        }
    }
);