// ==========================================================================
// LÓGICA DE INTERACCIÓN Y FILTRADO - PESTAÑA ÉL
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

const MAPA_CATEGORIAS_EL = {
    'playeras': ['playera', 'playeras', 't-shirt', 'tshirt', 'camisa', 'camisas', 'top', 'polo'],
    'sudaderas': ['sudadera', 'sudaderas', 'hoodie', 'hoodies', 'sueter', 'sueteres', 'chaleco'],
    'chamarras': ['chamarra', 'chamarras', 'cazadora', 'chaqueta', 'chaquetas', 'saco', 'blazer', 'abrigo', 'abrigos']
};

function filtrarPorPillEl(botonElemento) {
    const pills = document.querySelectorAll('.pill-btn');
    const cards = document.querySelectorAll('.el-card-item');
    const contador = document.getElementById('contadorEl');

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
            const palabrasClave = MAPA_CATEGORIAS_EL[catNormalizada] || [catNormalizada];
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

window.filtrarPorPillEl = filtrarPorPillEl;