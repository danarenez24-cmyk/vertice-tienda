// ==========================================================================
// LÓGICA DE FILTRADO E INTERACCIÓN - NIÑOS (SINCRONIZADA Y DINÁMICA)
// ==========================================================================

document.addEventListener('DOMContentLoaded', function () {
    ejecutarFiltradoNinos();
});

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .trim();
}

const MAPA_CATEGORIAS_NINOS = {
    'ninas': ['nina', 'ninas', 'girl', 'girls', 'vestido', 'falda', 'blusa', 'conjunto nina'],
    'ninos': ['nino', 'ninos', 'boy', 'boys', 'pantalon', 'playera', 'camisa', 'bermuda', 'conjunto nino'],
    'bebes': ['bebe', 'bebes', 'baby', 'mameluco', 'body', 'panalero'],
    'sudaderas': ['sudadera', 'sudaderas', 'hoodie', 'sueter', 'chamarra', 'chaleco'],
    'calzado': ['calzado', 'zapato', 'zapatos', 'tenis', 'bota', 'botas', 'sandalia', 'sandalias']
};

function filtrarPorCheckboxes(checkboxClick) {
    const chkTodos = document.querySelector('.filter-check[value="todos"]');
    const chkCategorias = document.querySelectorAll('.filter-check:not([value="todos"])');

    if (checkboxClick) {
        if (checkboxClick === chkTodos) {
            if (chkTodos.checked) {
                chkCategorias.forEach(chk => chk.checked = false);
            } else {
                const algunOtro = Array.from(chkCategorias).some(chk => chk.checked);
                if (!algunOtro) chkTodos.checked = true;
            }
        } else {
            if (checkboxClick.checked) {
                if (chkTodos) chkTodos.checked = false;
            } else {
                const algunSeleccionado = Array.from(chkCategorias).some(chk => chk.checked);
                if (!algunSeleccionado && chkTodos) chkTodos.checked = true;
            }
        }
    }

    sincronizarPillsConCheckboxes();
    ejecutarFiltradoNinos();
}

function filtrarPorPill(categoria, botonElemento) {
    const catNorm = normalizarTexto(categoria);
    const chkTodos = document.querySelector('.filter-check[value="todos"]');
    const chkCategorias = document.querySelectorAll('.filter-check:not([value="todos"])');

    if (catNorm === 'todos') {
        if (chkTodos) chkTodos.checked = true;
        chkCategorias.forEach(chk => chk.checked = false);
    } else {
        if (chkTodos) chkTodos.checked = false;
        chkCategorias.forEach(chk => {
            const valNorm = normalizarTexto(chk.value);
            chk.checked = (valNorm === catNorm);
        });
    }

    const pills = document.querySelectorAll('.pill-illustrated');
    pills.forEach(p => p.classList.remove('active'));
    if (botonElemento) botonElemento.classList.add('active');

    ejecutarFiltradoNinos();
}

function sincronizarPillsConCheckboxes() {
    const chkTodos = document.querySelector('.filter-check[value="todos"]');
    const chkCategorias = document.querySelectorAll('.filter-check:not([value="todos"])');
    const pills = document.querySelectorAll('.pill-illustrated');

    pills.forEach(p => p.classList.remove('active'));

    if (chkTodos && chkTodos.checked) {
        const pillTodos = document.querySelector('.pill-illustrated[data-categoria="todos"]');
        if (pillTodos) pillTodos.classList.add('active');
        return;
    }

    const seleccionados = Array.from(chkCategorias)
        .filter(c => c.checked)
        .map(c => normalizarTexto(c.value));

    if (seleccionados.length === 1) {
        const pillCoincidente = Array.from(pills).find(p => normalizarTexto(p.getAttribute('data-categoria')) === seleccionados[0]);
        if (pillCoincidente) pillCoincidente.classList.add('active');
    }
}

function ejecutarFiltradoNinos() {
    const chkTodos = document.querySelector('.filter-check[value="todos"]');
    const chkCategorias = document.querySelectorAll('.filter-check:not([value="todos"])');
    const cards = document.querySelectorAll('.ninos-card-item');
    const contador = document.getElementById('contadorNinos');

    if (!cards.length) return;

    const seleccionados = Array.from(chkCategorias)
        .filter(chk => chk.checked)
        .map(chk => normalizarTexto(chk.value));

    const esVerTodo = chkTodos ? chkTodos.checked : (seleccionados.length === 0);
    let visibles = 0;

    cards.forEach(card => {
        const catProducto = normalizarTexto(card.getAttribute('data-categoria') || '');
        const nombreProducto = normalizarTexto(card.getAttribute('data-nombre') || '');
        const textoCompleto = `${catProducto} ${nombreProducto}`;

        let coincide = false;

        if (esVerTodo) {
            coincide = true;
        } else {
            coincide = seleccionados.some(catKey => {
                const palabrasClave = MAPA_CATEGORIAS_NINOS[catKey] || [catKey];
                return palabrasClave.some(kw => textoCompleto.includes(kw));
            });
        }

        if (coincide) {
            card.style.display = 'flex';
            card.style.animation = 'fadeInCard 0.3s forwards';
            visibles++;
        } else {
            card.style.display = 'none';
        }
    });

    if (contador) contador.textContent = visibles;
}

window.filtrarPorCheckboxes = filtrarPorCheckboxes;
window.filtrarPorPill = filtrarPorPill;