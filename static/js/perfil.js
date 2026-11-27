// ==========================================================================
// LÓGICA INTERACTIVA DE PERFIL (NAVEGACIÓN DE PESTAÑAS Y TARJETAS)
// ==========================================================================

// 1. Control de Pestañas
function openTab(evt, tabId) {
    if (evt) evt.preventDefault();

    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

    // Desactivar todos los botones de la navegación lateral
    document.querySelectorAll('.nav-button').forEach(el => el.classList.remove('active'));

    // Activar la pestaña indicada
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Activar el botón cliqueado
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    }
}

function switchTab(tabName, element) {
    openTab(null, 'tab-' + tabName);
    if (element) {
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }
}

// Exponer funciones globalmente para invocarlas desde onclick
window.openTab = openTab;
window.switchTab = switchTab;

// 2. Inicialización de Formularios y Previsualización Dinámica
document.addEventListener('DOMContentLoaded', function () {
    const inputNumero = document.getElementById('numero_tarjeta');
    const inputTitular = document.getElementById('titular');
    const inputExp = document.getElementById('expiracion');
    const inputCVV = document.getElementById('cvv');
    const formTarjeta = document.getElementById('formTarjeta');

    // Elementos de error
    const errNumero = document.getElementById('error-numero');
    const errTitular = document.getElementById('error-titular');
    const errExp = document.getElementById('error-expiracion');
    const errCVV = document.getElementById('error-cvv');

    // Previews de la tarjeta
    const previewNumber = document.getElementById('previewNumber');
    const previewHolder = document.getElementById('previewHolder');
    const previewExp = document.getElementById('previewExp');
    const previewBrand = document.getElementById('previewBrand');

    // Algoritmo de Luhn para verificación real
    function esLuhnValido(numero) {
        let sum = 0;
        let esSegundo = false;
        for (let i = numero.length - 1; i >= 0; i--) {
            let d = parseInt(numero.charAt(i), 10);
            if (esSegundo) {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
            esSegundo = !esSegundo;
        }
        return (sum % 10) === 0;
    }

    // Auxiliares UI de error
    function setError(input, errElem, msg) {
        if (!input) return;
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        if (errElem) {
            errElem.textContent = msg;
            errElem.style.display = 'block';
        }
    }

    function setValid(input, errElem) {
        if (!input) return;
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        if (errElem) {
            errElem.textContent = '';
            errElem.style.display = 'none';
        }
    }

    // Validación de Número de Tarjeta
    function validarNumero() {
        if (!inputNumero) return true;
        const raw = inputNumero.value.replace(/\D/g, '');
        if (raw.length === 0) {
            setError(inputNumero, errNumero, 'El número de tarjeta es obligatorio.');
            return false;
        } else if (raw.length < 15 || raw.length > 16) {
            setError(inputNumero, errNumero, `Debe tener 15 o 16 dígitos (${raw.length}/16).`);
            return false;
        } else if (!esLuhnValido(raw)) {
            setError(inputNumero, errNumero, 'Número de tarjeta inválido.');
            return false;
        }
        setValid(inputNumero, errNumero);
        return true;
    }

    // Validación de Fecha de Expiración
    function validarExpiracion() {
        if (!inputExp) return true;
        const val = inputExp.value.trim();
        const regex = /^(0[1-9]|1[0-2])\/(\d{2})$/;

        if (!regex.test(val)) {
            setError(inputExp, errExp, 'Ingresa una fecha válida (MM/AA).');
            return false;
        }

        const [mesStr, anoStr] = val.split('/');
        const mes = parseInt(mesStr, 10);
        const ano = 2000 + parseInt(anoStr, 10);

        const ahora = new Date();
        const anoActual = ahora.getFullYear();
        const mesActual = ahora.getMonth() + 1;

        if (ano < anoActual || (ano === anoActual && mes < mesActual)) {
            setError(inputExp, errExp, 'La tarjeta está vencida.');
            return false;
        }

        setValid(inputExp, errExp);
        return true;
    }

    // Validación del Titular
    function validarTitular() {
        if (!inputTitular) return true;
        const val = inputTitular.value.trim();
        if (val.length < 3) {
            setError(inputTitular, errTitular, 'Ingresa el nombre completo del titular.');
            return false;
        }
        setValid(inputTitular, errTitular);
        return true;
    }

    // Validación del CVV
    function validarCVV() {
        if (!inputCVV) return true;
        const raw = inputCVV.value.replace(/\D/g, '');
        if (raw.length < 3 || raw.length > 4) {
            setError(inputCVV, errCVV, 'El CVV requiere 3 o 4 dígitos.');
            return false;
        }
        setValid(inputCVV, errCVV);
        return true;
    }

    // Eventos e interacciones con los campos
    if (inputNumero) {
        inputNumero.addEventListener('input', function (e) {
            let val = e.target.value.replace(/\D/g, '').substring(0, 16);
            let partes = val.match(/.{1,4}/g);
            let formatted = partes ? partes.join(' ') : '';
            
            e.target.value = formatted;
            if (previewNumber) previewNumber.textContent = formatted || '•••• •••• •••• ••••';

            if (previewBrand) {
                if (val.startsWith('4')) previewBrand.textContent = 'VISA';
                else if (/^5[1-5]/.test(val) || /^2[2-7]/.test(val)) previewBrand.textContent = 'MASTERCARD';
                else if (/^3[47]/.test(val)) previewBrand.textContent = 'AMEX';
                else previewBrand.textContent = 'VÉRTICE';
            }

            if (val.length === 16) validarNumero();
        });
        inputNumero.addEventListener('blur', validarNumero);
    }

    if (inputTitular) {
        inputTitular.addEventListener('input', function (e) {
            e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
            if (previewHolder) previewHolder.textContent = e.target.value.toUpperCase() || 'NOMBRE Y APELLIDO';
        });
        inputTitular.addEventListener('blur', validarTitular);
    }

    if (inputExp) {
        inputExp.addEventListener('input', function (e) {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length >= 2) {
                let mes = parseInt(val.substring(0, 2), 10);
                if (mes > 12) val = '12' + val.substring(2);
                if (mes === 0) val = '01' + val.substring(2);
                val = val.substring(0, 2) + '/' + val.substring(2, 4);
            }
            e.target.value = val;
            if (previewExp) previewExp.textContent = val || 'MM/AA';

            if (val.length === 5) validarExpiracion();
        });
        inputExp.addEventListener('blur', validarExpiracion);
    }

    if (inputCVV) {
        inputCVV.addEventListener('input', function (e) {
            e.target.value = e.target.value.replace(/\D/g, '');
            if (e.target.value.length >= 3) validarCVV();
        });
        inputCVV.addEventListener('blur', validarCVV);
    }

    if (formTarjeta) {
        formTarjeta.addEventListener('submit', function (e) {
            const vNum = validarNumero();
            const vTit = validarTitular();
            const vExp = validarExpiracion();
            const vCvv = validarCVV();

            if (!vNum || !vTit || !vExp || !vCvv) {
                e.preventDefault();
            }
        });
    }
});
// ==========================================================================
// CONTROL DEL MODAL DE TICKET DIGITAL CON QR
// ==========================================================================

function abrirTicketQR(btn) {
    if (!btn) return;
    const modal = document.getElementById('modalTicketQR');
    if (!modal) return;

    document.getElementById('tkFolio').textContent = '#' + (btn.dataset.folio || 'VRT-000000');
    document.getElementById('tkFecha').textContent = btn.dataset.fecha || '';
    document.getElementById('tkEstado').textContent = (btn.dataset.estado || 'Procesando').toUpperCase();
    document.getElementById('tkProducto').textContent = btn.dataset.producto || '';
    document.getElementById('tkTalla').textContent = btn.dataset.talla || 'M';
    document.getElementById('tkCantidad').textContent = btn.dataset.cantidad || '1';
    document.getElementById('tkTotal').textContent = '$' + (btn.dataset.total || '0') + ' MXN';
    document.getElementById('tkQrImg').src = btn.dataset.qrUrl || '';

    modal.classList.add('active');
}

function cerrarTicketQR(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('modalTicketQR');
    if (modal) modal.classList.remove('active');
}

window.abrirTicketQR = abrirTicketQR;
window.cerrarTicketQR = cerrarTicketQR;

// Apertura automática de pestaña o ticket QR tras finalizar compra
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const ticketId = params.get('ticket');

    if (tabParam === 'pedidos') {
        const btnPedidos = document.querySelector(".nav-button[onclick*='tab-pedidos']");
        if (btnPedidos) btnPedidos.click();
    }

    if (ticketId) {
        const btnTicket = document.querySelector(`.btn-ticket-qr[data-pedido-id="${ticketId}"]`);
        if (btnTicket) {
            setTimeout(() => abrirTicketQR(btnTicket), 150);
        }
    }
});
// ==========================================================================
// GESTIÓN DE FAVORITOS EN EL PERFIL
// ==========================================================================

function seleccionarTallaFav(btn, talla) {
    const card = btn.closest('.fav-card');
    if (!card) return;
    card.querySelectorAll('.fav-size-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const inputTalla = card.querySelector('input[name="talla"]');
    if (inputTalla) inputTalla.value = talla;
}

async function quitarFavoritoPerfil(btn) {
    const productoId = btn.dataset.productoId;
    const url = btn.dataset.url;
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const csrfToken = csrfInput ? csrfInput.value : '';

    if (!productoId || !url) return;

    const formData = new FormData();
    formData.append('producto_id', productoId);

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        });

        const data = await resp.json();
        if (data.ok) {
            const card = btn.closest('.fav-card');
            if (card) {
                card.classList.add('removing');
                setTimeout(() => {
                    card.remove();
                    const grid = document.getElementById('favoritosGrid');
                    const emptyBox = document.getElementById('emptyFavoritos');
                    const countBadge = document.getElementById('perfilFavCount');
                    const restantes = grid ? grid.querySelectorAll('.fav-card').length : 0;

                    if (countBadge) countBadge.textContent = restantes;
                    if (restantes === 0) {
                        if (grid) grid.remove();
                        if (emptyBox) emptyBox.classList.remove('hidden-empty');
                    }
                }, 220);
            }
        }
    } catch (err) {
        console.error('Error al quitar de favoritos:', err);
    }
}

window.seleccionarTallaFav = seleccionarTallaFav;
window.quitarFavoritoPerfil = quitarFavoritoPerfil;

document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'favoritos') {
        const btnFav = document.querySelector(".nav-button[onclick*='tab-favoritos']");
        if (btnFav) btnFav.click();
    }
});
// ==========================================================================
// SINCRONIZACIÓN AUTOMÁTICA DE ESTADOS DE PEDIDOS EN PERFIL
// ==========================================================================

async function sincronizarEstadosPedidos() {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    const url = container.dataset.estadosUrl;
    if (!url) return;

    try {
        const resp = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store'
        });
        if (!resp.ok) return;

        const data = await resp.json();
        if (!data.ok || !Array.isArray(data.pedidos)) return;

        data.pedidos.forEach(item => {
            const estadoTexto = item.estado || 'Procesando';
            const estadoClase = 'status-' + estadoTexto.toLowerCase();

            const badge = document.querySelector(`[data-status-pedido="${item.id_str}"]`);
            if (badge && badge.textContent.trim().toLowerCase() !== estadoTexto.toLowerCase()) {
                badge.textContent = estadoTexto;
                badge.classList.remove('status-procesando', 'status-enviado', 'status-entregado', 'status-cancelado');
                badge.classList.add(estadoClase);
            }

            const btnQr = document.querySelector(`.btn-ticket-qr[data-pedido-id="${item.id_str}"]`);
            if (btnQr) {
                btnQr.dataset.estado = estadoTexto;
            }
        });
    } catch (err) {
        console.error('Error sincronizando estados de pedidos:', err);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    sincronizarEstadosPedidos();
    setInterval(sincronizarEstadosPedidos, 5000);

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) sincronizarEstadosPedidos();
    });
    window.addEventListener('focus', sincronizarEstadosPedidos);
});