// ==========================================================================
// LÓGICA INTERACTIVA - MIDNIGHT COUNTDOWN & MAGAZINE SPOTLIGHT (LIGHT MODE)
// ==========================================================================

document.addEventListener('DOMContentLoaded', function () {
    iniciarContadorRegresivo();
});

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

const MAPA_CATEGORIAS = {
    'gala': ['gala', 'vestido', 'vestidos', 'noche', 'largo'],
    'smokings': ['smoking', 'smokings', 'blazer', 'blusers', 'saco', 'traje'],
    'saten': ['saten', 'seda', 'silk', 'satin', 'raso'],
    'accesorios': ['accesorio', 'accesorios', 'bolso', 'joyeria', 'collar', 'cinturon', 'bufanda']
};

function filtrarFde(categoriaBuscada, botonElemento) {
    const pills = document.querySelectorAll('.fde-pill-light, .fde-pill');
    const cards = document.querySelectorAll('.fde-card-light, .fde-card');
    const contador = document.getElementById('contadorFde');

    if (!cards.length) return;

    pills.forEach(p => p.classList.remove('active'));
    if (botonElemento) {
        botonElemento.classList.add('active');
    }

    const catNormalizada = normalizarTexto(categoriaBuscada);
    const palabrasClave = MAPA_CATEGORIAS[catNormalizada] || [catNormalizada];

    let visibles = 0;

    cards.forEach(card => {
        const catProducto = normalizarTexto(card.getAttribute('data-categoria') || '');
        const nombreProducto = normalizarTexto(card.getAttribute('data-nombre') || '');
        const textoCompleto = `${catProducto} ${nombreProducto}`;

        let coincide = false;

        if (catNormalizada === 'todos') {
            coincide = true;
        } else {
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

function cambiarModoVista(modo) {
    const gridContainer = document.getElementById('gridFde');
    const btnGrid = document.getElementById('btnGridMode');
    const btnEditorial = document.getElementById('btnEditorialMode');

    if (!gridContainer) return;

    if (modo === 'grid') {
        gridContainer.classList.remove('editorial-mode');
        gridContainer.classList.add('grid-mode');
        if (btnGrid) btnGrid.classList.add('active');
        if (btnEditorial) btnEditorial.classList.remove('active');
    } else {
        gridContainer.classList.remove('grid-mode');
        gridContainer.classList.add('editorial-mode');
        if (btnEditorial) btnEditorial.classList.add('active');
        if (btnGrid) btnGrid.classList.remove('active');
    }
}

function iniciarContadorRegresivo() {
    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMins = document.getElementById('cd-mins');
    const elSecs = document.getElementById('cd-secs');

    if (!elDays || !elHours || !elMins || !elSecs) return;

    const nextYear = new Date().getFullYear() + 1;
    const targetDate = new Date(`January 1, ${nextYear} 00:00:00`).getTime();

    function actualizarReloj() {
        const now = new Date().getTime();
        const difference = targetDate - now;

        if (difference <= 0) {
            elDays.textContent = '00';
            elHours.textContent = '00';
            elMins.textContent = '00';
            elSecs.textContent = '00';
            return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        elDays.textContent = String(days).padStart(2, '0');
        elHours.textContent = String(hours).padStart(2, '0');
        elMins.textContent = String(minutes).padStart(2, '0');
        elSecs.textContent = String(seconds).padStart(2, '0');
    }

    actualizarReloj();
    setInterval(actualizarReloj, 1000);
}

window.filtrarFde = filtrarFde;
window.cambiarModoVista = cambiarModoVista;