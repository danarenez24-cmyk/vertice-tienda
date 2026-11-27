document.addEventListener("DOMContentLoaded", () => {
    cargarCarrito();
});

function abrirCarrito() {
    document.getElementById("panel-carrito")?.classList.add("activo");
    document.getElementById("overlay-carrito")?.classList.add("activo");
}

function cerrarCarrito() {
    document.getElementById("panel-carrito")?.classList.remove("activo");
    document.getElementById("overlay-carrito")?.classList.remove("activo");
}

function cargarCarrito() {
    fetch('/api/carrito/')
        .then(res => res.json())
        .then(data => {
            renderizarCarrito(data.items || [], data.total || 0, data.count || 0);
        });
}

function renderizarCarrito(items, total, count) {
    const contenedor = document.getElementById("carrito-contenido");
    const badge = document.getElementById("cart-count-badge");
    const itemsCountHeader = document.getElementById("total-items-count");
    const subtotalEl = document.getElementById("carrito-subtotal");
    const totalEl = document.getElementById("carrito-total");
    const btnCheckout = document.getElementById("btn-checkout");

    if (badge) badge.innerText = count;
    if (itemsCountHeader) itemsCountHeader.innerText = count;
    if (subtotalEl) subtotalEl.innerText = `$${total.toFixed(2)} MXN`;
    if (totalEl) totalEl.innerText = `$${total.toFixed(2)} MXN`;

    if (!contenedor) return;

    if (items.length === 0) {
        contenedor.innerHTML = `<p class="carrito-vacio-msg">Tu carrito está vacío por el momento.</p>`;
        if (btnCheckout) btnCheckout.disabled = true;
        return;
    }

    if (btnCheckout) btnCheckout.disabled = false;
    contenedor.innerHTML = "";

    items.forEach(item => {
        const itemHTML = `
            <div class="carrito-item">
                <img src="${item.imagen}" alt="${item.nombre}">
                <div class="item-detalles">
                    <h4>${item.nombre}</h4>
                    <p class="meta">Talla: <b>${item.talla}</b> | Cant.: <b>${item.cantidad}</b></p>
                    <p class="precio">$${(item.precio * item.cantidad).toFixed(2)} MXN</p>
                </div>
                <button class="btn-eliminar-item" onclick="eliminarDelCarrito('${item.producto_id}', '${item.talla}')">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
        `;
        contenedor.innerHTML += itemHTML;
    });
}

function eliminarDelCarrito(productoId, talla) {
    const formData = new FormData();
    formData.append('producto_id', productoId);
    formData.append('talla', talla);

    fetch('/api/carrito/eliminar/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
        body: formData
    }).then(() => cargarCarrito());
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}