// ==========================================================================
// 1. MENÚS LATERALES Y OVERLAY (UNIFICADO)
// ==========================================================================

function abrirMenu() {
    const menu = document.getElementById("menu");
    const inicioEl = document.getElementById("inicio");
    const overlay = document.getElementById("overlay");

    if (inicioEl) inicioEl.classList.remove("mostrar", "activo");
    if (menu) {
        const abrir = !menu.classList.contains("mostrar") && !menu.classList.contains("activo");
        menu.classList.toggle("mostrar", abrir);
        menu.classList.toggle("activo", abrir);
        if (overlay) {
            overlay.classList.toggle("mostrar", abrir);
            overlay.classList.toggle("activo", abrir);
        }
    }
}

function inicio() {
    const menu = document.getElementById("menu");
    const inicioEl = document.getElementById("inicio");
    const overlay = document.getElementById("overlay");

    if (menu) menu.classList.remove("mostrar", "activo");
    if (inicioEl) {
        const abrir = !inicioEl.classList.contains("mostrar") && !inicioEl.classList.contains("activo");
        inicioEl.classList.toggle("mostrar", abrir);
        inicioEl.classList.toggle("activo", abrir);
        if (overlay) {
            overlay.classList.toggle("mostrar", abrir);
            overlay.classList.toggle("activo", abrir);
        }
    }
}

function cerrarMenus() {
    const menu = document.getElementById("menu");
    const inicioEl = document.getElementById("inicio");
    const overlay = document.getElementById("overlay");

    if (menu) menu.classList.remove("mostrar", "activo");
    if (inicioEl) inicioEl.classList.remove("mostrar", "activo");
    if (overlay) overlay.classList.remove("mostrar", "activo");
}

window.abrirMenu = abrirMenu;
window.inicio = inicio;
window.cerrarMenus = cerrarMenus;


// ==========================================================================
// 2. UTILIDADES CSRF Y NOTIFICACIONES FLOTANTES (TOAST)
// ==========================================================================

function getCSRFToken(formElement = null) {
    if (formElement) {
        const inputToken = formElement.querySelector('[name="csrfmiddlewaretoken"]');
        if (inputToken && inputToken.value) return inputToken.value;
    }
    const anyToken = document.querySelector('[name="csrfmiddlewaretoken"]');
    if (anyToken && anyToken.value) return anyToken.value;

    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim();
        if (c.startsWith('csrftoken=')) {
            return decodeURIComponent(c.substring('csrftoken='.length));
        }
    }
    return '';
}

function mostrarToastVertice(titulo, mensaje, linkUrl = '/checkout/', linkTexto = 'VER BOLSA', esError = false) {
    let container = document.getElementById('verticeToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'verticeToastContainer';
        container.className = 'vertice-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `vertice-toast ${esError ? 'error' : ''}`;
    toast.innerHTML = `
        <div class="vertice-toast-info">
            <span class="vertice-toast-title">${titulo}</span>
            <span class="vertice-toast-msg">${mensaje}</span>
        </div>
        ${linkUrl ? `<a href="${linkUrl}" class="vertice-toast-link">${linkTexto}</a>` : ''}
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 260);
    }, 3600);
}

window.mostrarToastVertice = mostrarToastVertice;


// ==========================================================================
// 3. CONTADOR EN VIVO DEL CARRITO (INYECCIÓN AUTOMÁTICA EN ENCABEZADO)
// ==========================================================================

function renderizarBadgeCarrito(cantidad) {
    const count = parseInt(cantidad, 10) || 0;
    document.querySelectorAll('.icono-carrito-wrapper').forEach(wrapper => {
        let badge = wrapper.querySelector('.cart-badge-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cart-badge-count empty';
            wrapper.appendChild(badge);
        }

        badge.textContent = count > 99 ? '99+' : count;
        if (count > 0) {
            badge.classList.remove('empty');
            badge.classList.add('bump');
            setTimeout(() => badge.classList.remove('bump'), 220);
        } else {
            badge.classList.add('empty');
        }
    });
}

async function actualizarContadorCarrito() {
    try {
        const resp = await fetch('/api/carrito/', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        renderizarBadgeCarrito(data.count || 0);
    } catch (err) {
        // Silencioso si no hay conexión
    }
}

window.actualizarContadorCarrito = actualizarContadorCarrito;


// ==========================================================================
// 4. SELECTOR DE TALLAS RÁPIDO EN TARJETAS + COMPRA RÁPIDA SIN RECARGAR (AJAX)
// ==========================================================================

function seleccionarTallaCard(btn, talla) {
    if (!btn) return;
    const selector = btn.closest('.card-size-selector');
    if (selector) {
        selector.querySelectorAll('.size-pill-btn').forEach(b => b.classList.remove('selected'));
    }
    btn.classList.add('selected');

    const card = btn.closest('article, .card-producto');
    if (card) {
        const inputTalla = card.querySelector('input[name="talla"]');
        if (inputTalla) inputTalla.value = talla;
    }
}

window.seleccionarTallaCard = seleccionarTallaCard;

function inicializarCompraRapidaAjax() {
    const selectoresForms = [
        '.el-form-quick-add',
        '.ella-form-quick-add',
        '.ninos-form-quick-add',
        '.fde-form-quick-light',
        'form[data-ajax-cart="true"]'
    ].join(', ');

    document.querySelectorAll(selectoresForms).forEach(form => {
        if (form.dataset.ajaxBound === 'true') return;
        form.dataset.ajaxBound = 'true';

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;

            const textoOriginal = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<ion-icon name="sync-outline"></ion-icon> AGREGANDO...';
            }

            try {
                const formData = new FormData(form);
                const resp = await fetch(form.action, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRFToken': getCSRFToken(form)
                    },
                    body: formData
                });

                const data = await resp.json();

                if (!resp.ok || !data.ok) {
                    if (data.login_url) {
                        mostrarToastVertice(
                            'Inicia sesión',
                            data.error || 'Debes iniciar sesión para agregar prendas.',
                            data.login_url,
                            'ENTRAR',
                            true
                        );
                    } else {
                        mostrarToastVertice(
                            'Aviso de inventario',
                            data.error || 'No se pudo agregar la prenda.',
                            null,
                            '',
                            true
                        );
                    }
                } else {
                    renderizarBadgeCarrito(data.count);
                    mostrarToastVertice(
                        'Prenda agregada',
                        `${data.producto} (Talla ${data.talla}) se añadió a tu bolsa.`,
                        '/checkout/',
                        'PAGAR'
                    );
                }
            } catch (err) {
                form.submit();
                return;
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginal;
                }
            }
        });
    });
}


// ==========================================================================
// 5. FAVORITOS / LISTA DE DESEOS UNIFICADA (TODAS LAS PESTAÑAS)
// ==========================================================================

function pintarBotonFavorito(btn, activo) {
    if (!btn) return;
    btn.classList.toggle('activo', activo);
    btn.classList.toggle('active', activo);
    btn.style.setProperty('background-color', '#ffffff', 'important');
    btn.style.setProperty('color', activo ? '#e11d48' : '#111111', 'important');

    const icon = btn.querySelector('ion-icon');
    if (icon) {
        icon.setAttribute('name', activo ? 'heart' : 'heart-outline');
        if (activo) {
            icon.style.setProperty('color', '#e11d48', 'important');
            icon.style.setProperty('fill', '#e11d48', 'important');
        } else {
            icon.style.removeProperty('color');
            icon.style.removeProperty('fill');
        }
    }
}

async function toggleFavoritoGlobal(btn) {
    if (!btn) return;
    const card = btn.closest('article, .card-producto');
    const productoId = btn.dataset.productoId || card?.querySelector('input[name="producto_id"]')?.value;

    const nuevoEstado = !btn.classList.contains('activo');
    pintarBotonFavorito(btn, nuevoEstado);

    if (!productoId) return;

    try {
        const formData = new FormData();
        formData.append('producto_id', productoId);

        const resp = await fetch('/toggle-favorito/', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        });

        const data = await resp.json();
        if (resp.status === 401 && data.login_url) {
            pintarBotonFavorito(btn, false);
            mostrarToastVertice('Favoritos', 'Inicia sesión para guardar prendas.', data.login_url, 'ENTRAR', true);
            return;
        }

        if (data.ok) {
            const agregado = Boolean(data.agregado);
            pintarBotonFavorito(btn, agregado);
            mostrarToastVertice(
                agregado ? 'Guardado en favoritos' : 'Eliminado de favoritos',
                agregado ? 'La prenda se guardó en tu perfil.' : 'La prenda se quitó de tu lista.',
                '/perfil/?tab=favoritos',
                'VER LISTA'
            );
        }
    } catch (e) {
        // Mantiene estado visual si falla la red
    }
}

async function sincronizarFavoritosUsuario() {
    try {
        const resp = await fetch('/api/favoritos/', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const ids = new Set((data.favoritos || []).map(String));

        document.querySelectorAll('[data-producto-id]').forEach(btn => {
            const prodId = String(btn.dataset.productoId || '');
            if (prodId && ids.has(prodId)) {
                pintarBotonFavorito(btn, true);
            }
        });
    } catch (e) {}
}

// Interceptar cualquier clic en botones de favoritos en fase de captura
document.addEventListener('click', function (e) {
    const btnWishlist = e.target.closest(
        '.btn-wishlist-index, .btn-wishlist-el, .btn-wishlist-ella, .btn-wishlist-ninos, .btn-wishlist-fde-light, .btn-favorito-detalle, [class*="btn-wishlist"]'
    );
    if (!btnWishlist) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    toggleFavoritoGlobal(btnWishlist);
}, true);

window.toggleFavorito = toggleFavoritoGlobal;
window.toggleFavoritoEl = toggleFavoritoGlobal;
window.toggleFavoritoNinos = toggleFavoritoGlobal;
window.toggleFavoritoFde = toggleFavoritoGlobal;
window.toggleFavoritoDetalle = toggleFavoritoGlobal;

document.addEventListener('DOMContentLoaded', function () {
    actualizarContadorCarrito();
    inicializarCompraRapidaAjax();
    sincronizarFavoritosUsuario();
});
/* ==========================================================================
   BUSCADOR DESPLEGABLE EN MÓVIL
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.querySelector('.search-box-wrapper');
    if (!searchForm) return;

    const searchBtn = searchForm.querySelector('.btn-search-icon');
    const searchInput = searchForm.querySelector('input[type="text"]');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', (e) => {
            if (window.innerWidth <= 820) {
                if (!searchForm.classList.contains('search-open')) {
                    e.preventDefault();
                    searchForm.classList.add('search-open');
                    setTimeout(() => searchInput.focus(), 50);
                } else if (!searchInput.value.trim()) {
                    e.preventDefault();
                    searchForm.classList.remove('search-open');
                }
            }
        });

        // Cerrar barra desplegada si se toca fuera
        document.addEventListener('click', (e) => {
            if (
                window.innerWidth <= 820 &&
                searchForm.classList.contains('search-open') &&
                !searchForm.contains(e.target)
            ) {
                searchForm.classList.remove('search-open');
            }
        });
    }
});
