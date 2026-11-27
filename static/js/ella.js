// ==========================================================================
// LÓGICA DE INTERACCIÓN Y FILTRADO - PESTAÑA ELLA
// ==========================================================================

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .trim();
}

const MAPA_CATEGORIAS_ELLA = {
    'vestidos': ['vestido', 'vestidos', 'falda', 'faldas', 'enterizo', 'jumpsuit', 'gala'],
    'blusas': ['blusa', 'blusas', 'top', 'tops', 'camisa', 'camisas', 'playera', 'playeras', 'sueter', 'sudadera', 'crop'],
    'pantalones': ['pantalon', 'pantalones', 'jeans', 'short', 'shorts', 'leggins', 'pants', 'saco', 'blazer'],
    'accesorios': ['accesorio', 'accesorios', 'bolso', 'bolsa', 'cartera', 'cinturon', 'joyeria', 'collar', 'lentes', 'bufanda']
};

function filtrarPorPillElla(botonElemento) {
    const pills = document.querySelectorAll('.pill-ella');
    const cards = document.querySelectorAll('.ella-card-item');
    const contador = document.getElementById('contadorPrendas');

    if (!cards.length) return;

    pills.forEach(p => p.classList.remove('active'));
    if (botonElemento) {
        botonElemento.classList.add('active');
    }

    const categoriaRaw = botonElemento ? botonElemento.getAttribute('data-categoria') : 'todos';
    const catNormalizada = normalizarTexto(categoriaRaw);

    let visibles = 0;

    cards.forEach(card => {
        const catProducto = normalizarTexto(card.getAttribute('data-categoria') || '');
        const nombreProducto = normalizarTexto(card.getAttribute('data-nombre') || '');
        const textoCompleto = `${catProducto} ${nombreProducto}`;

        let coincide = false;

        if (catNormalizada === 'todos') {
            coincide = true;
        } else {
            const palabrasClave = MAPA_CATEGORIAS_ELLA[catNormalizada] || [catNormalizada];
            coincide = palabrasClave.some(kw => textoCompleto.includes(kw));
        }

        if (coincide) {
            card.style.display = 'flex';
            card.style.animation = 'fadeInCard 0.3s forwards';
            visibles++;
        } else {
            card.style.display = 'none';
        }
    });

    if (contador) {
        contador.textContent = visibles;
    }
}

window.filtrarPorPillElla = filtrarPorPillElla;

// ==========================================================================
// MINI-LOOKBOOK AUTOMÁTICO EN HERO ELLA
// ==========================================================================

let lookbookIndex = 0;
let lookbookTimer = null;

function cambiarSlideLookbook(nuevoIndice) {
    const slides = document.querySelectorAll('#ellaLookbookSlider .ella-lookbook-slide');
    const dots = document.querySelectorAll('#ellaLookbookSlider .ella-dot');
    if (!slides.length) return;

    lookbookIndex = (nuevoIndice + slides.length) % slides.length;

    slides.forEach((slide, idx) => {
        slide.classList.toggle('active', idx === lookbookIndex);
    });
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === lookbookIndex);
    });
}

function iniciarAutoLookbook() {
    const slider = document.getElementById('ellaLookbookSlider');
    const slides = document.querySelectorAll('#ellaLookbookSlider .ella-lookbook-slide');
    if (!slider || slides.length <= 1) return;

    clearInterval(lookbookTimer);
    lookbookTimer = setInterval(() => {
        cambiarSlideLookbook(lookbookIndex + 1);
    }, 4000);

    // Pausar rotación al pasar el mouse encima
    slider.onmouseenter = () => clearInterval(lookbookTimer);
    slider.onmouseleave = () => {
        clearInterval(lookbookTimer);
        lookbookTimer = setInterval(() => cambiarSlideLookbook(lookbookIndex + 1), 4000);
    };
}

function iniciarAutoLookbook() {
    const slider = document.getElementById('ellaLookbookSlider');
    const slides = document.querySelectorAll('#ellaLookbookSlider .ella-lookbook-slide');
    const dots = document.querySelectorAll('#ellaLookbookSlider .ella-dot');
    if (!slider || slides.length <= 1) return;

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            cambiarSlideLookbook(Number(dot.dataset.slide));
        });
    });

    clearInterval(lookbookTimer);
    lookbookTimer = setInterval(() => {
        cambiarSlideLookbook(lookbookIndex + 1);
    }, 4000);

    slider.onmouseenter = () => clearInterval(lookbookTimer);
    slider.onmouseleave = () => {
        clearInterval(lookbookTimer);
        lookbookTimer = setInterval(() => cambiarSlideLookbook(lookbookIndex + 1), 4000);
    };
}

window.cambiarSlideLookbook = cambiarSlideLookbook;
document.addEventListener('DOMContentLoaded', iniciarAutoLookbook);