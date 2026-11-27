/* ==========================================================================
   VÉRTICE — LÓGICA DE GRÁFICAS (CHART.JS) Y GESTIÓN DEL ADMIN DASHBOARD
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
    inicializarGraficasAdmin();
    inicializarFiltrosAnalitica();
    inicializarDropzonesAdmin();
    inicializarModalEditarAdmin();
    inicializarVerificadorQRAdmin();
});

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

function inicializarGraficasAdmin() {
    const dataNode = document.getElementById('vertice-analytics-data');
    if (!dataNode || typeof Chart === 'undefined') return;

    let data = {};
    try {
        data = JSON.parse(dataNode.textContent);
    } catch (err) {
        console.error('Error parseando datos de analítica:', err);
        return;
    }

    Chart.defaults.font.family = "'Montserrat', sans-serif";
    Chart.defaults.color = '#4b5563';

    const formatoMXN = (valor) => '$' + Number(valor || 0).toLocaleString('es-MX', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    // 1. Gráfica Combinada (Área + Barras): Evolución de Ingresos vs Pedidos por Día
    const ctxEvolucion = document.getElementById('chartVentasEvolucion');
    if (ctxEvolucion) {
        const gCtx = ctxEvolucion.getContext('2d');
        const gradiente = gCtx.createLinearGradient(0, 0, 0, 280);
        gradiente.addColorStop(0, 'rgba(17, 17, 17, 0.24)');
        gradiente.addColorStop(1, 'rgba(17, 17, 17, 0.01)');

        new Chart(ctxEvolucion, {
            data: {
                labels: data.dias_labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Ingresos (MXN)',
                        data: data.serie_ingresos,
                        borderColor: '#111111',
                        backgroundColor: gradiente,
                        borderWidth: 2.5,
                        pointBackgroundColor: '#111111',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4.5,
                        fill: true,
                        tension: 0.36,
                        yAxisID: 'yIngresos'
                    },
                    {
                        type: 'bar',
                        label: 'Pedidos del día',
                        data: data.serie_pedidos_dia,
                        backgroundColor: 'rgba(156, 163, 175, 0.45)',
                        borderRadius: 6,
                        barPercentage: 0.45,
                        yAxisID: 'yPedidos'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', align: 'end' },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                if (ctx.dataset.yAxisID === 'yIngresos') {
                                    return ` Ingresos: ${formatoMXN(ctx.parsed.y)} MXN`;
                                }
                                return ` Pedidos: ${ctx.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    yIngresos: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' },
                        ticks: { callback: (val) => formatoMXN(val) }
                    },
                    yPedidos: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                        ticks: { stepSize: 1 }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Gráfica de Dona: Ingresos por Categoría (MXN)
    const ctxCatIng = document.getElementById('chartIngresosCategoria');
    if (ctxCatIng) {
        new Chart(ctxCatIng, {
            type: 'doughnut',
            data: {
                labels: data.cat_ing_labels,
                datasets: [{
                    data: data.cat_ing_values,
                    backgroundColor: ['#111111', '#374151', '#6b7280', '#9ca3af', '#d1d5db'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '64%',
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${formatoMXN(ctx.parsed)} MXN`
                        }
                    }
                }
            }
        });
    }

    // 3. Gráfica Horizontal: Top 5 Prendas Más Vendidas
    const ctxTop = document.getElementById('chartTopPrendas');
    if (ctxTop) {
        new Chart(ctxTop, {
            type: 'bar',
            data: {
                labels: data.top_labels,
                datasets: [{
                    label: 'Unidades vendidas',
                    data: data.top_unidades,
                    backgroundColor: ['#111111', '#262626', '#404040', '#525252', '#737373'],
                    borderRadius: 8,
                    barPercentage: 0.62
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (ctx) {
                                const ing = data.top_ingresos[ctx.dataIndex] || 0;
                                return `Facturación: ${formatoMXN(ing)} MXN`;
                            }
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f3f4f6' } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    // 4. Gráfica Radar: Curva de Demanda por Talla
    const ctxTallas = document.getElementById('chartDemandaTallas');
    if (ctxTallas) {
        new Chart(ctxTallas, {
            type: 'radar',
            data: {
                labels: data.tallas_labels,
                datasets: [{
                    label: 'Prendas vendidas',
                    data: data.tallas_values,
                    backgroundColor: 'rgba(17, 17, 17, 0.15)',
                    borderColor: '#111111',
                    borderWidth: 2,
                    pointBackgroundColor: '#111111',
                    pointRadius: 3.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, backdropColor: 'transparent' }
                    }
                }
            }
        });
    }

    // 5. Gráfica de Barras: Stock Disponible por Colección
    const ctxStock = document.getElementById('chartStockCategoria');
    if (ctxStock) {
        new Chart(ctxStock, {
            type: 'bar',
            data: {
                labels: data.inv_cat_labels,
                datasets: [{
                    label: 'Unidades en almacén',
                    data: data.inv_cat_values,
                    backgroundColor: '#1f2937',
                    borderRadius: 7,
                    barPercentage: 0.55
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 6. Gráfica de Barras con Semáforo: Estado de Pedidos
    const ctxEstados = document.getElementById('chartEstadoPedidos');
    if (ctxEstados) {
        new Chart(ctxEstados, {
            type: 'bar',
            data: {
                labels: data.est_labels,
                datasets: [{
                    label: 'Pedidos',
                    data: data.est_values,
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
                    borderRadius: 7,
                    barPercentage: 0.55
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f3f4f6' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 7. Gráfica Polar Area: Canales de Registro de Clientes
    const ctxCanales = document.getElementById('chartCanalesRegistro');
    if (ctxCanales) {
        new Chart(ctxCanales, {
            type: 'polarArea',
            data: {
                labels: data.reg_labels,
                datasets: [{
                    data: data.reg_values,
                    backgroundColor: [
                        'rgba(17, 17, 17, 0.85)',
                        'rgba(75, 85, 99, 0.75)',
                        'rgba(156, 163, 175, 0.75)'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    r: { ticks: { stepSize: 1, backdropColor: 'transparent' } }
                }
            }
        });
    }
}

function inicializarFiltrosAnalitica() {
    const botones = document.querySelectorAll('.analytics-tab-btn');
    const tarjetas = document.querySelectorAll('.analytics-bento-grid .chart-card');
    if (!botones.length) return;

    botones.forEach((btn) => {
        btn.addEventListener('click', () => {
            botones.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            const filtro = btn.dataset.filter;
            tarjetas.forEach((card) => {
                if (filtro === 'all' || card.dataset.group === filtro) {
                    card.classList.remove('is-hidden');
                } else {
                    card.classList.add('is-hidden');
                }
            });
        });
    });
}

function inicializarDropzonesAdmin() {
    const configurar = (dropzoneId, inputId, thumbId, titleId, subId) => {
        const dropzone = document.getElementById(dropzoneId);
        const input = document.getElementById(inputId);
        const thumb = document.getElementById(thumbId);
        const title = document.getElementById(titleId);
        const sub = document.getElementById(subId);
        if (!dropzone || !input) return;

        ['dragenter', 'dragover'].forEach((evt) => {
            dropzone.addEventListener(evt, () => dropzone.classList.add('is-dragover'));
        });
        ['dragleave', 'drop'].forEach((evt) => {
            dropzone.addEventListener(evt, () => dropzone.classList.remove('is-dragover'));
        });

        input.addEventListener('change', function () {
            const archivo = this.files && this.files[0];
            if (!archivo) return;

            dropzone.classList.add('has-file');
            title.textContent = archivo.name;
            sub.textContent = `${(archivo.size / 1024).toFixed(1)} KB • Lista para guardar`;

            const reader = new FileReader();
            reader.onload = (e) => { thumb.src = e.target.result; };
            reader.readAsDataURL(archivo);
        });
    };

    configurar('dropzoneCrear', 'crearImagenArchivo', 'previewCrearThumb', 'dropzoneCrearTitle', 'dropzoneCrearSub');
    configurar('dropzoneEditar', 'editImagenArchivo', 'previewEditarThumb', 'dropzoneEditarTitle', 'dropzoneEditarSub');
}

function inicializarModalEditarAdmin() {
    const modal = document.getElementById('modalEditarProducto');
    const form = document.getElementById('formEditarProducto');
    const btnCerrar = document.getElementById('btnCerrarModalEditar');
    if (!modal || !form) return;

    document.querySelectorAll('.js-btn-editar-producto').forEach((btn) => {
        btn.addEventListener('click', () => {
            form.action = btn.dataset.action;
            document.getElementById('editNombre').value = btn.dataset.nombre || '';
            document.getElementById('editCategoria').value = btn.dataset.categoria || 'el';
            document.getElementById('editPrecio').value = btn.dataset.precio || '';
            document.getElementById('editPrecioOriginal').value = btn.dataset.precioOriginal || '';
            document.getElementById('editTallas').value = btn.dataset.tallas || 'S, M, L, XL';
            document.getElementById('editImagenUrl').value = btn.dataset.imagen || '';
            document.getElementById('editDescripcion').value = btn.dataset.descripcion || '';

            const dropzoneEditar = document.getElementById('dropzoneEditar');
            const previewEditar = document.getElementById('previewEditarThumb');
            document.getElementById('editImagenArchivo').value = '';

            if (btn.dataset.imagen) {
                dropzoneEditar.classList.add('has-file');
                previewEditar.src = btn.dataset.imagen;
                document.getElementById('dropzoneEditarTitle').textContent = 'Fotografía actual cargada';
                document.getElementById('dropzoneEditarSub').textContent = 'Haz clic o arrastra otra imagen para reemplazarla';
            } else {
                dropzoneEditar.classList.remove('has-file');
                previewEditar.src = '';
            }

            const stockWrapper = document.getElementById('editStockWrapper');
            const stockInput = document.getElementById('editStock');
            if (btn.dataset.stockTalla === '1') {
                stockWrapper.style.display = 'none';
                stockInput.value = '';
            } else {
                stockWrapper.style.display = '';
                stockInput.value = btn.dataset.stock || '';
            }

            modal.classList.add('open');
        });
    });

    const cerrarModal = () => modal.classList.remove('open');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModal();
    });
}

function inicializarVerificadorQRAdmin() {
    const input = document.getElementById('inputCodigoQR');
    const btnVerificar = document.getElementById('btnVerificarTicketQR');
    const box = document.getElementById('resultadoVerificacionQR');
    const verifyUrl = document.body.dataset.verifyTicketUrl;
    if (!input || !btnVerificar || !box || !verifyUrl) return;

    const verificarTicket = async (marcarEntregado = false) => {
        const codigo = input.value.trim();
        if (!codigo) return;

        const formData = new FormData();
        formData.append('codigo', codigo);
        if (marcarEntregado) formData.append('accion', 'marcar_entregado');

        const resp = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: formData
        });
        const data = await resp.json();

        box.style.display = 'block';
        if (!data.ok) {
            box.innerHTML = `<p class="qr-error-msg">✕ ${data.error}</p>`;
            return;
        }

        const p = data.pedido;
        const esEntregado = p.estado === 'Entregado';
        box.innerHTML = `
            <div class="qr-verified-grid">
                <div>
                    <span class="status-badge ${esEntregado ? 'status-entregado' : 'status-procesando'}">TICKET AUTÉNTICO • ${p.estado.toUpperCase()}</span>
                    <h3 class="qr-ticket-title">${p.folio} — ${p.producto}</h3>
                    <p class="qr-ticket-meta">Cliente: <strong>${p.cliente}</strong> | Talla: <strong>${p.talla}</strong> (x${p.cantidad}) | Total: <strong>$${p.total} MXN</strong></p>
                </div>
                ${!esEntregado
                    ? `<button type="button" id="btnConfirmarEntregaQR" class="btn-admin-submit btn-no-margin">CONFIRMAR ENTREGA</button>`
                    : `<span class="qr-delivered-label">✓ Pedido ya entregado</span>`}
            </div>
        `;

        const btnConfirmar = document.getElementById('btnConfirmarEntregaQR');
        if (btnConfirmar) {
            btnConfirmar.addEventListener('click', () => verificarTicket(true));
        }
    };

    btnVerificar.addEventListener('click', () => verificarTicket(false));
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verificarTicket(false);
        }
    });
}