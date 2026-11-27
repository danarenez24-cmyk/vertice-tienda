// ==========================================================================
// ESTILISTA IA VÉRTICE - ASISTENTE DE MODA EN TIEMPO REAL
// ==========================================================================

const stylistState = {
    historial: [],
    enviando: false
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('verticeStylistFab')) return;

    const widgetHTML = `
        <button type="button" id="verticeStylistFab" class="vertice-stylist-fab" onclick="toggleStylistDrawer()">
            <span class="fab-dot"></span>
            <span>ESTILISTA IA</span>
        </button>

        <div id="verticeStylistDrawer" class="vertice-stylist-drawer">
            <div class="stylist-header">
                <div class="stylist-header-info">
                    <h4>ESTILISTA PERSONAL VÉRTICE</h4>
                    <span>Conectado en vivo al catálogo</span>
                </div>
                <button type="button" class="stylist-close" onclick="toggleStylistDrawer()">×</button>
            </div>

            <div class="stylist-messages" id="stylistMessages">
                <div class="stylist-msg bot">
                    ¡Hola! Soy tu estilista de <b>VÉRTICE</b>. Dime qué ocasión tienes, el clima o tu presupuesto y te armo un outfit con prendas disponibles ahora mismo.
                </div>
            </div>

            <div class="stylist-chips">
                <button type="button" class="stylist-chip" onclick="enviarSugerenciaEstilista('Outfit casual para salir de noche con algo de frío')">Noche con frío</button>
                <button type="button" class="stylist-chip" onclick="enviarSugerenciaEstilista('Look urbano cómodo para uso diario')">Urbano diario</button>
                <button type="button" class="stylist-chip" onclick="enviarSugerenciaEstilista('Combos por menos de 1500 pesos')">Menos de $1,500</button>
            </div>

            <form class="stylist-input-bar" onsubmit="enviarMensajeEstilista(event)">
                <input type="text" id="stylistInput" placeholder="Ej. Tengo una cita casual el viernes..." autocomplete="off">
                <button type="submit" id="stylistSendBtn">ENVIAR</button>
            </form>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
});

function toggleStylistDrawer() {
    const drawer = document.getElementById('verticeStylistDrawer');
    if (!drawer) return;
    drawer.classList.toggle('abierto');
    if (drawer.classList.contains('abierto')) {
        document.getElementById('stylistInput')?.focus();
    }
}

function enviarSugerenciaEstilista(texto) {
    const input = document.getElementById('stylistInput');
    if (input) {
        input.value = texto;
        enviarMensajeEstilista(new Event('submit'));
    }
}

function obtenerCSRFCookie() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : (document.querySelector('[name=csrfmiddlewaretoken]')?.value || '');
}

function formatearTextoBasico(texto) {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
}

async function enviarMensajeEstilista(e) {
    if (e) e.preventDefault();
    if (stylistState.enviando) return;

    const input = document.getElementById('stylistInput');
    const msgs = document.getElementById('stylistMessages');
    const btn = document.getElementById('stylistSendBtn');
    const texto = (input?.value || '').trim();
    if (!texto) return;

    input.value = '';
    stylistState.enviando = true;
    if (btn) btn.disabled = true;

    // Mostrar mensaje del usuario
    msgs.insertAdjacentHTML('beforeend', `<div class="stylist-msg user">${formatearTextoBasico(texto)}</div>`);
    const typingId = 'typing-' + Date.now();
    msgs.insertAdjacentHTML('beforeend', `<div class="stylist-msg bot" id="${typingId}">Buscando prendas en el catálogo...</div>`);
    msgs.scrollTop = msgs.scrollHeight;

    try {
        const resp = await fetch('/api/estilista-ia/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': obtenerCSRFCookie(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                mensaje: texto,
                historial: stylistState.historial
            })
        });

        const data = await resp.json();
        document.getElementById(typingId)?.remove();

        if (!resp.ok || !data.ok) {
            msgs.insertAdjacentHTML('beforeend', `<div class="stylist-msg bot">${data.error || 'No pude conectar con el estilista.'}</div>`);
            return;
        }

        stylistState.historial.push({ role: 'user', text: texto });
        stylistState.historial.push({ role: 'model', text: data.respuesta });

        let cardsHTML = '';
        if (Array.isArray(data.productos) && data.productos.length > 0) {
            cardsHTML = '<div class="stylist-cards-wrap">';
            data.productos.forEach(p => {
                cardsHTML += `
                    <div class="stylist-prod-card">
                        <img src="${p.imagen}" alt="${p.nombre}" onerror="this.src='/static/media/logo1.png'">
                        <div class="stylist-prod-meta">
                            <h5>${p.nombre}</h5>
                            <p>$${Number(p.precio).toFixed(2)} MXN • Tallas: ${(p.tallas || []).join(', ')}</p>
                            <div class="stylist-prod-actions">
                                <a href="/producto/${p.id}/" class="stylist-btn-ver">VER Y PROBAR EN IA</a>
                            </div>
                        </div>
                    </div>
                `;
            });
            cardsHTML += '</div>';
        }

        msgs.insertAdjacentHTML('beforeend', `
            <div class="stylist-msg bot">
                ${formatearTextoBasico(data.respuesta)}
                ${cardsHTML}
            </div>
        `);
        msgs.scrollTop = msgs.scrollHeight;
    } catch (err) {
        document.getElementById(typingId)?.remove();
        msgs.insertAdjacentHTML('beforeend', `<div class="stylist-msg bot">Error de conexión. Intenta de nuevo.</div>`);
    } finally {
        stylistState.enviando = false;
        if (btn) btn.disabled = false;
    }
}// ==========================================================================
// PERSISTENCIA VISUAL DEL ÚLTIMO OUTFIT GENERADO CON IA EN LA SESIÓN
// ==========================================================================
function actualizarWidgetSesionVTO() {
    const genUrl = sessionStorage.getItem('vertice_vto_generated_url');
    const prodName = sessionStorage.getItem('vertice_vto_product_name') || 'Look IA';
    const prodUrl = sessionStorage.getItem('vertice_vto_product_url') || '#';

    const existente = document.getElementById('verticeVtoSessionCard');
    if (!genUrl) {
        if (existente) existente.remove();
        return;
    }

    if (existente) {
        existente.querySelector('img').src = genUrl;
        existente.querySelector('h5').textContent = prodName;
        existente.querySelector('a').href = prodUrl;
        return;
    }

    const cardHTML = `
        <div id="verticeVtoSessionCard" style="
            position: fixed;
            left: 24px;
            bottom: 24px;
            z-index: 9985;
            display: flex;
            align-items: center;
            gap: 10px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 8px 12px 8px 8px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.16);
            max-width: 280px;
        ">
            <img src="${genUrl}" alt="Tu outfit IA" style="
                width: 46px;
                height: 60px;
                object-fit: cover;
                border-radius: 8px;
                cursor: pointer;
            " onclick="window.open('${genUrl}', '_blank')">
            <div style="flex: 1; min-width: 0;">
                <span style="display:block; font-size:9px; font-weight:800; color:#16a34a; letter-spacing:0.06em;">TU LOOK IA ACTIVO</span>
                <h5 style="margin:2px 0 4px; font-size:12px; font-weight:700; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${prodName}</h5>
                <div style="display:flex; gap:8px; align-items:center;">
                    <a href="${prodUrl}" style="font-size:10px; font-weight:700; color:#111; text-decoration:underline;">Volver a prenda</a>
                    <button type="button" onclick="cerrarLookSesionVTO()" style="background:none; border:none; font-size:10px; color:#6b7280; cursor:pointer; padding:0;">Quitar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', cardHTML);
}

function cerrarLookSesionVTO() {
    sessionStorage.removeItem('vertice_vto_generated_url');
    sessionStorage.removeItem('vertice_vto_product_name');
    sessionStorage.removeItem('vertice_vto_product_url');
    document.getElementById('verticeVtoSessionCard')?.remove();
}

document.addEventListener('DOMContentLoaded', actualizarWidgetSesionVTO);
window.actualizarWidgetSesionVTO = actualizarWidgetSesionVTO;
window.cerrarLookSesionVTO = cerrarLookSesionVTO;
window.toggleStylistDrawer = toggleStylistDrawer;
window.enviarSugerenciaEstilista = enviarSugerenciaEstilista;
window.enviarMensajeEstilista = enviarMensajeEstilista;