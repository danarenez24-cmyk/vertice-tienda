// ==========================================================================
// PROBADOR VIRTUAL VÉRTICE v9 (REMBG IA + MEDIAPIPE + IDM-VTON + SESIÓN)
// ==========================================================================

const vtoState = {
    userImg: null,
    rawGarmentImg: null,
    originalTrimmedCanvas: null,
    workingGarmentCanvas: null,
    stream: null,
    mode: 'move',
    corners: null,
    activeCorner: -1,
    isDraggingBody: false,
    isPainting: false,
    lastMouse: { x: 0, y: 0 },
    brightness: 95,
    flipX: false,
    initialized: false,
    aiReady: false,
    poseLandmarker: null,
    poseLoading: false
};

function obtenerProductoIdVTO() {
    const modal = document.getElementById('vtoModal');
    let productoId = modal?.dataset.productoId;
    if (!productoId) {
        const match = window.location.pathname.match(/\/producto\/([^/]+)/);
        if (match) productoId = match[1];
    }
    return productoId || '';
}

async function generarTryOnRealIA() {
    const canvas = document.getElementById('vtoCanvas');
    const modal = document.getElementById('vtoModal');
    const btn = document.getElementById('btnGenerarVtonIA');

    if (!canvas || !vtoState.userImg) {
        alert('Primero sube una foto o tómate una con la cámara.');
        return;
    }

    const productoId = obtenerProductoIdVTO();

    // Siempre enviar la foto base limpia del usuario (evita degradar calidad si prueba varias prendas)
    let baseDataUrl = sessionStorage.getItem('vertice_vto_user_base');
    if (!baseDataUrl) {
        const cleanUserCanvas = document.createElement('canvas');
        cleanUserCanvas.width = vtoState.userImg.naturalWidth || vtoState.userImg.width;
        cleanUserCanvas.height = vtoState.userImg.naturalHeight || vtoState.userImg.height;
        cleanUserCanvas.getContext('2d').drawImage(vtoState.userImg, 0, 0);
        baseDataUrl = cleanUserCanvas.toDataURL('image/jpeg', 0.92);
        try {
            sessionStorage.setItem('vertice_vto_user_base', baseDataUrl);
        } catch (e) {
            console.warn('No se pudo cachear foto base:', e);
        }
    }

    const blob = await (await fetch(baseDataUrl)).blob();
    const formData = new FormData();
    formData.append('user_image', blob, 'usuario.jpg');

    const csrfToken =
        document.cookie.match(/csrftoken=([^;]+)/)?.[1] ||
        document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
        '';
    const textoOriginal = btn ? btn.innerHTML : '';
    const badgeEl = modal?.querySelector('.vto-badge');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'VISTIENDO PRENDA CON IA (~20s)...';
    }
    if (badgeEl) {
        badgeEl.textContent = 'GENERANDO VTON...';
        badgeEl.style.background = '#2563eb';
    }

    try {
        const resp = await fetch(`/api/vton-generativo/${productoId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        });

        const data = await resp.json();

        if (!resp.ok || !data.ok || !data.result_url) {
            alert(data.error || 'No se pudo generar la imagen en este momento. Intenta de nuevo.');
            if (badgeEl) {
                badgeEl.textContent = 'REINTENTAR IA';
                badgeEl.style.background = '#dc2626';
            }
            return;
        }

        const finalUrl = `${data.result_url}?t=${Date.now()}`;

        // Cargar la foto generada por IDM-VTON directamente en el lienzo
        const imgGenerada = new Image();
        imgGenerada.crossOrigin = 'anonymous';
        imgGenerada.onload = function () {
            vtoState.userImg = imgGenerada;
            // Ocultar la capa 2D superpuesta porque la ropa ya está integrada en la foto
            vtoState.corners = null;
            renderizarEscenaVTO(true);

            // Guardar en sessionStorage para que dure toda la sesión (Inicio, Él, Ella, etc.)
            const nombreProducto = document.querySelector('.titulo-detalle, h1')?.textContent?.trim() || 'Prenda VÉRTICE';
            sessionStorage.setItem('vertice_vto_generated_url', finalUrl);
            sessionStorage.setItem('vertice_vto_product_id', productoId);
            sessionStorage.setItem('vertice_vto_product_name', nombreProducto);
            sessionStorage.setItem('vertice_vto_product_url', window.location.pathname);

            if (typeof actualizarWidgetSesionVTO === 'function') {
                actualizarWidgetSesionVTO();
            }

            if (badgeEl) {
                badgeEl.textContent = 'VTON IA COMPLETADO';
                badgeEl.style.background = '#16a34a';
            }
        };
        imgGenerada.src = finalUrl;

    } catch (err) {
        console.error('Error en VTON generativo:', err);
        alert('Error de conexión con el servidor al generar la prueba virtual.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }
}

// Carga MediaPipe Pose como módulo ES nativo (evita error de sintaxis con 'export')
async function inicializarDetectorCuerpo() {
    if (vtoState.poseLandmarker) return vtoState.poseLandmarker;
    if (vtoState.poseLoading) {
        let espera = 0;
        while (vtoState.poseLoading && espera < 25) {
            await new Promise(r => setTimeout(r, 200));
            espera++;
        }
        return vtoState.poseLandmarker;
    }

    try {
        vtoState.poseLoading = true;
        const mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
        const vision = await mp.FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
        try {
            vtoState.poseLandmarker = await mp.PoseLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
                runningMode: 'IMAGE',
                numPoses: 1
            });
        } catch (gpuErr) {
            vtoState.poseLandmarker = await mp.PoseLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
                runningMode: 'IMAGE',
                numPoses: 1
            });
        }
    } catch (err) {
        console.warn('No se pudo cargar MediaPipe externo, se usará análisis local de silueta:', err);
    } finally {
        vtoState.poseLoading = false;
    }
    return vtoState.poseLandmarker;
}

function restaurarSesionVTO() {
    const modal = document.getElementById('vtoModal');
    const badgeEl = modal?.querySelector('.vto-badge');
    const savedGeneratedUrl = sessionStorage.getItem('vertice_vto_generated_url');
    const savedGeneratedProdId = sessionStorage.getItem('vertice_vto_product_id');
    const savedBaseData = sessionStorage.getItem('vertice_vto_user_base');
    const currentProdId = obtenerProductoIdVTO();

    // 1. Si hay imagen ya generada con IA para este producto en la sesión, mostrarla al instante
    if (savedGeneratedUrl && (!savedGeneratedProdId || savedGeneratedProdId === currentProdId)) {
        const imgGen = new Image();
        imgGen.crossOrigin = 'anonymous';
        imgGen.onload = async function () {
            const canvas = document.getElementById('vtoCanvas');
            const placeholder = document.getElementById('vtoPlaceholder');
            if (canvas) {
                const maxH = 500;
                const ratio = imgGen.width / imgGen.height;
                canvas.height = Math.min(imgGen.height, maxH);
                canvas.width = Math.round(canvas.height * ratio);
                canvas.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';

            vtoState.userImg = imgGen;
            vtoState.corners = null;
            renderizarEscenaVTO(true);

            if (badgeEl) {
                badgeEl.textContent = 'VTON IA (SESIÓN ACTIVA)';
                badgeEl.style.background = '#16a34a';
            }
        };
        imgGen.src = savedGeneratedUrl;
        return;
    }

    // 2. Si el usuario subió su foto antes en otro producto, reutilizarla automáticamente
    if (savedBaseData && !vtoState.userImg) {
        const imgBase = new Image();
        imgBase.onload = function () {
            prepararLienzoConFoto(imgBase, false);
        };
        imgBase.src = savedBaseData;
    }
}

function abrirProbadorVirtual() {
    const modal = document.getElementById('vtoModal');
    if (!modal) return;

    modal.classList.add('abierto');
    document.body.style.overflow = 'hidden';

    if (!vtoState.initialized) {
        inicializarEventosCanvasVTO();
        cargarPrendaConIA();
        inicializarDetectorCuerpo();
        vtoState.initialized = true;
    }

    restaurarSesionVTO();
}

function cerrarProbadorVirtual() {
    const modal = document.getElementById('vtoModal');
    if (modal) modal.classList.remove('abierto');
    document.body.style.overflow = '';
    detenerCamaraVTO();
}

function cambiarModoVTO(nuevoModo, btn) {
    vtoState.mode = nuevoModo;
    document.querySelectorAll('.vto-mode-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const brushPanel = document.getElementById('vtoBrushPanel');
    const transformPanel = document.getElementById('vtoTransformPanel');
    const canvas = document.getElementById('vtoCanvas');

    if (nuevoModo === 'move') {
        if (brushPanel) brushPanel.style.display = 'none';
        if (transformPanel) transformPanel.style.display = 'flex';
        if (canvas) canvas.style.cursor = 'grab';
    } else {
        if (brushPanel) brushPanel.style.display = 'flex';
        if (transformPanel) transformPanel.style.display = 'none';
        if (canvas) canvas.style.cursor = 'crosshair';
    }

    renderizarEscenaVTO();
}

async function cargarPrendaConIA() {
    const modal = document.getElementById('vtoModal');
    const productoId = obtenerProductoIdVTO();

    const imgCatalogo = document.querySelector('.imagen-wrapper-detalle img');
    const fallbackSrc = imgCatalogo ? (imgCatalogo.currentSrc || imgCatalogo.src) : '';

    const badgeEl = modal?.querySelector('.vto-badge');
    if (badgeEl && !sessionStorage.getItem('vertice_vto_generated_url')) {
        badgeEl.textContent = 'RECORTANDO CON IA...';
    }

    let finalSrc = fallbackSrc;

    if (productoId) {
        try {
            const resp = await fetch(`/api/recortar-prenda/${productoId}/`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await resp.json();
            if (resp.ok && data.ok && data.cutout_url) {
                finalSrc = `${data.cutout_url}?t=${Date.now()}`;
                vtoState.aiReady = true;
            }
        } catch (err) {
            console.warn('Error llamando a rembg, usando respaldo local:', err);
        }
    }

    if (badgeEl && !sessionStorage.getItem('vertice_vto_generated_url')) {
        badgeEl.textContent = vtoState.aiReady ? 'IA ACTIVA' : 'MODO MANUAL';
        badgeEl.style.background = vtoState.aiReady ? '#16a34a' : '#111111';
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        vtoState.rawGarmentImg = img;
        prepararPrendaRecortada(img, !vtoState.aiReady);
    };
    img.src = finalSrc;
}

function prepararPrendaRecortada(img, usarRespaldoFloodFill = false) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const fullClean = document.createElement('canvas');
    fullClean.width = w;
    fullClean.height = h;
    fullClean.getContext('2d').drawImage(img, 0, 0, w, h);

    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d');
    offCtx.drawImage(img, 0, 0, w, h);

    let minX = 0, minY = 0, maxX = w - 1, maxY = h - 1;

    try {
        const imgData = offCtx.getImageData(0, 0, w, h);
        const data = imgData.data;

        if (usarRespaldoFloodFill && document.getElementById('vtoAutoCutout')?.checked !== false) {
            const tol = parseInt(document.getElementById('vtoTolerance')?.value || '22', 10);
            const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
            let bgR = 0, bgG = 0, bgB = 0;
            corners.forEach(idx => { bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2]; });
            bgR /= 4; bgG /= 4; bgB /= 4;

            const total = w * h;
            const visited = new Uint8Array(total);
            const stack = new Int32Array(total);
            let ptr = 0;

            const esFondo = (p) => {
                const i = p * 4;
                return Math.hypot(data[i] - bgR, data[i + 1] - bgG, data[i + 2] - bgB) <= tol;
            };

            for (let x = 0; x < w; x++) {
                if (!visited[x] && esFondo(x)) { visited[x] = 1; stack[ptr++] = x; }
                const b = (h - 1) * w + x;
                if (!visited[b] && esFondo(b)) { visited[b] = 1; stack[ptr++] = b; }
            }
            for (let y = 0; y < h; y++) {
                const l = y * w;
                if (!visited[l] && esFondo(l)) { visited[l] = 1; stack[ptr++] = l; }
                const r = y * w + (w - 1);
                if (!visited[r] && esFondo(r)) { visited[r] = 1; stack[ptr++] = r; }
            }

            while (ptr > 0) {
                const curr = stack[--ptr];
                data[curr * 4 + 3] = 0;
                const cx = curr % w;
                const cy = (curr - cx) / w;
                if (cx > 0 && !visited[curr - 1] && esFondo(curr - 1)) { visited[curr - 1] = 1; stack[ptr++] = curr - 1; }
                if (cx < w - 1 && !visited[curr + 1] && esFondo(curr + 1)) { visited[curr + 1] = 1; stack[ptr++] = curr + 1; }
                if (cy > 0 && !visited[curr - w] && esFondo(curr - w)) { visited[curr - w] = 1; stack[ptr++] = curr - w; }
                if (cy < h - 1 && !visited[curr + w] && esFondo(curr + w)) { visited[curr + w] = 1; stack[ptr++] = curr + w; }
            }
            offCtx.putImageData(imgData, 0, 0);
        }

        minX = w; minY = h; maxX = 0; maxY = 0;
        let tieneContenido = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (data[(y * w + x) * 4 + 3] > 25) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    tieneContenido = true;
                }
            }
        }
        if (!tieneContenido || maxX <= minX || maxY <= minY) {
            minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
        }
    } catch (e) {
        minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const working = document.createElement('canvas');
    working.width = cropW;
    working.height = cropH;
    working.getContext('2d').drawImage(offCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    const origTrimmed = document.createElement('canvas');
    origTrimmed.width = cropW;
    origTrimmed.height = cropH;
    origTrimmed.getContext('2d').drawImage(fullClean, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    vtoState.workingGarmentCanvas = working;
    vtoState.originalTrimmedCanvas = origTrimmed;

    const savedGenProd = sessionStorage.getItem('vertice_vto_product_id');
    const esMismoProdGenerado = sessionStorage.getItem('vertice_vto_generated_url') && savedGenProd === obtenerProductoIdVTO();

    if (vtoState.userImg && !esMismoProdGenerado) {
        ajustarPrendaAlCuerpoAutomatico();
    } else {
        renderizarEscenaVTO(Boolean(esMismoProdGenerado));
    }
}

function ajustarPorSiluetaLocal(userCanvas, gCanvas) {
    const W = userCanvas.width;
    const H = userCanvas.height;
    const ctx = userCanvas.getContext('2d');
    const data = ctx.getImageData(0, 0, W, H).data;

    const bgR = (data[0] + data[(W - 1) * 4]) / 2;
    const bgG = (data[1] + data[(W - 1) * 4 + 1]) / 2;
    const bgB = (data[2] + data[(W - 1) * 4 + 2]) / 2;

    let minY = H, maxY = 0;
    const rowBounds = [];

    for (let y = 0; y < H; y++) {
        let rowMin = W, rowMax = 0, count = 0;
        for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            const diff = Math.hypot(data[idx] - bgR, data[idx + 1] - bgG, data[idx + 2] - bgB);
            if (diff > 28) {
                if (x < rowMin) rowMin = x;
                if (x > rowMax) rowMax = x;
                count++;
            }
        }
        if (count > W * 0.06) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            rowBounds[y] = { min: rowMin, max: rowMax, width: rowMax - rowMin };
        }
    }

    const personH = maxY - minY;
    if (personH < H * 0.25) return null;

    const shoulderY = Math.round(minY + personH * 0.25);
    let sumMin = 0, sumMax = 0, muestras = 0;
    for (let y = shoulderY - 8; y <= shoulderY + 8; y++) {
        if (rowBounds[y]) {
            sumMin += rowBounds[y].min;
            sumMax += rowBounds[y].max;
            muestras++;
        }
    }
    if (!muestras) return null;

    const leftX = (sumMin / muestras) - 6;
    const rightX = (sumMax / muestras) + 6;
    const targetW = rightX - leftX;
    const gRatio = gCanvas.width / gCanvas.height;
    const targetH = Math.max(personH * 0.34, targetW / gRatio);
    const topY = minY + personH * 0.17;

    return [
        { x: leftX, y: topY },
        { x: rightX, y: topY },
        { x: rightX, y: topY + targetH },
        { x: leftX, y: topY + targetH }
    ];
}

async function ajustarPrendaAlCuerpoAutomatico() {
    const canvas = document.getElementById('vtoCanvas');
    const gCanvas = vtoState.workingGarmentCanvas;
    if (!canvas || !vtoState.userImg) return;

    if (!gCanvas) {
        inicializarEsquinasPrenda();
        return;
    }

    const badgeEl = document.querySelector('#vtoModal .vto-badge');
    if (badgeEl) badgeEl.textContent = 'DETECTANDO CUERPO...';

    const userCanvas = document.createElement('canvas');
    userCanvas.width = canvas.width;
    userCanvas.height = canvas.height;
    userCanvas.getContext('2d').drawImage(vtoState.userImg, 0, 0, canvas.width, canvas.height);

    const detector = await inicializarDetectorCuerpo();
    let ajustadoConIA = false;

    if (detector) {
        try {
            const result = detector.detect(userCanvas);
            const lm = result?.landmarks?.[0];

            if (lm && lm[11] && lm[12] && lm[23] && lm[24]) {
                const W = canvas.width;
                const H = canvas.height;

                let leftSh = { x: lm[12].x * W, y: lm[12].y * H };
                let rightSh = { x: lm[11].x * W, y: lm[11].y * H };
                let leftHip = { x: lm[24].x * W, y: lm[24].y * H };
                let rightHip = { x: lm[23].x * W, y: lm[23].y * H };

                if (leftSh.x > rightSh.x) [leftSh, rightSh] = [rightSh, leftSh];
                if (leftHip.x > rightHip.x) [leftHip, rightHip] = [rightHip, leftHip];

                const shDx = rightSh.x - leftSh.x;
                const shDy = rightSh.y - leftSh.y;
                const shoulderWidth = Math.hypot(shDx, shDy);

                const midSh = { x: (leftSh.x + rightSh.x) / 2, y: (leftSh.y + rightSh.y) / 2 };
                const midHip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
                const torsoDx = midHip.x - midSh.x;
                const torsoDy = midHip.y - midSh.y;
                const torsoHeight = Math.hypot(torsoDx, torsoDy);

                const titulo = (document.querySelector('.titulo-detalle')?.textContent || '').toLowerCase();
                const esPantalon = /(pantal|jeans|short|falda|bermuda|cargo|jogger)/.test(titulo);

                if (esPantalon) {
                    const hipWidth = Math.hypot(rightHip.x - leftHip.x, rightHip.y - leftHip.y);
                    const legLength = torsoHeight * 1.65;
                    const ux = torsoDx / (torsoHeight || 1);
                    const uy = torsoDy / (torsoHeight || 1);
                    const padX = hipWidth * 0.28;

                    vtoState.corners = [
                        { x: leftHip.x - padX, y: leftHip.y - torsoHeight * 0.08 },
                        { x: rightHip.x + padX, y: rightHip.y - torsoHeight * 0.08 },
                        { x: rightHip.x + padX + ux * legLength, y: rightHip.y + uy * legLength },
                        { x: leftHip.x - padX + ux * legLength, y: leftHip.y + uy * legLength }
                    ];
                } else {
                    const gRatio = gCanvas.width / gCanvas.height;
                    const targetWidth = shoulderWidth * 1.95;
                    const targetHeight = Math.max(torsoHeight * 1.25, targetWidth / gRatio);

                    const ux = shDx / (shoulderWidth || 1);
                    const uy = shDy / (shoulderWidth || 1);
                    const vx = -uy;
                    const vy = ux;

                    const neckLift = targetHeight * 0.14;
                    const topCenter = {
                        x: midSh.x - vx * neckLift,
                        y: midSh.y - vy * neckLift
                    };

                    const halfW = targetWidth / 2;
                    vtoState.corners = [
                        { x: topCenter.x - ux * halfW, y: topCenter.y - uy * halfW },
                        { x: topCenter.x + ux * halfW, y: topCenter.y + uy * halfW },
                        { x: topCenter.x + ux * halfW + vx * targetHeight, y: topCenter.y + uy * halfW + vy * targetHeight },
                        { x: topCenter.x - ux * halfW + vx * targetHeight, y: topCenter.y - uy * halfW + vy * targetHeight }
                    ];
                }
                ajustadoConIA = true;
            }
        } catch (err) {
            console.warn('Error en MediaPipe detect:', err);
        }
    }

    if (!ajustadoConIA) {
        const siluetaCorners = ajustarPorSiluetaLocal(userCanvas, gCanvas);
        if (siluetaCorners) {
            vtoState.corners = siluetaCorners;
            ajustadoConIA = true;
        } else {
            inicializarEsquinasPrenda();
        }
    }

    if (badgeEl) {
        if (ajustadoConIA) {
            badgeEl.textContent = vtoState.aiReady ? 'IA ACTIVA • AUTO-FIT' : 'AUTO-FIT ACTIVO';
            badgeEl.style.background = '#16a34a';
        } else {
            badgeEl.textContent = vtoState.aiReady ? 'IA ACTIVA' : 'MODO MANUAL';
        }
    }

    renderizarEscenaVTO();
}

function procesarPrendaVTO() {
    if (vtoState.rawGarmentImg) {
        prepararPrendaRecortada(vtoState.rawGarmentImg, !vtoState.aiReady);
    }
}

function inicializarEsquinasPrenda() {
    const canvas = document.getElementById('vtoCanvas');
    const gCanvas = vtoState.workingGarmentCanvas;
    if (!canvas || !gCanvas) return;

    const gRatio = gCanvas.width / gCanvas.height;
    const w = canvas.width * 0.42;
    const h = w / gRatio;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.41;

    vtoState.corners = [
        { x: cx - w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy + h / 2 },
        { x: cx - w / 2, y: cy + h / 2 }
    ];
}

function cargarFotoUsuario(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    detenerCamaraVTO();
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            prepararLienzoConFoto(img, true);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function iniciarCamaraVTO() {
    const wrap = document.getElementById('vtoWebcamWrap');
    const video = document.getElementById('vtoVideo');
    const placeholder = document.getElementById('vtoPlaceholder');
    const canvas = document.getElementById('vtoCanvas');

    try {
        detenerCamaraVTO();
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
            audio: false
        });
        vtoState.stream = stream;
        video.srcObject = stream;

        if (placeholder) placeholder.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (wrap) wrap.classList.add('activo');
    } catch (err) {
        alert('No se pudo acceder a la cámara. Puedes subir una foto desde tu dispositivo.');
    }
}

function detenerCamaraVTO() {
    if (vtoState.stream) {
        vtoState.stream.getTracks().forEach(t => t.stop());
        vtoState.stream = null;
    }
    const wrap = document.getElementById('vtoWebcamWrap');
    if (wrap) wrap.classList.remove('activo');
}

function capturarFotoCamara() {
    const video = document.getElementById('vtoVideo');
    if (!video || !video.videoWidth) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext('2d');

    ctx.translate(tempCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    detenerCamaraVTO();

    const img = new Image();
    img.onload = function () {
        prepararLienzoConFoto(img, true);
    };
    img.src = tempCanvas.toDataURL('image/png');
}

async function prepararLienzoConFoto(img, esNuevaFotoUsuario = true) {
    const canvas = document.getElementById('vtoCanvas');
    const placeholder = document.getElementById('vtoPlaceholder');
    if (!canvas) return;

    if (esNuevaFotoUsuario) {
        // Limpiar el outfit IA previo de la sesión si el usuario sube una nueva foto
        sessionStorage.removeItem('vertice_vto_generated_url');
        sessionStorage.removeItem('vertice_vto_product_id');
        sessionStorage.removeItem('vertice_vto_product_name');
        sessionStorage.removeItem('vertice_vto_product_url');
        if (typeof actualizarWidgetSesionVTO === 'function') {
            actualizarWidgetSesionVTO();
        }

        // Guardar foto base limpia en sessionStorage para reutilizarla en otros productos
        try {
            const baseC = document.createElement('canvas');
            const maxDim = 1024;
            let bw = img.naturalWidth || img.width;
            let bh = img.naturalHeight || img.height;
            if (bw > maxDim || bh > maxDim) {
                const r = Math.min(maxDim / bw, maxDim / bh);
                bw = Math.round(bw * r);
                bh = Math.round(bh * r);
            }
            baseC.width = bw;
            baseC.height = bh;
            baseC.getContext('2d').drawImage(img, 0, 0, bw, bh);
            sessionStorage.setItem('vertice_vto_user_base', baseC.toDataURL('image/jpeg', 0.9));
        } catch (err) {
            console.warn('No se pudo guardar foto base en sesión:', err);
        }
    }

    const maxH = 500;
    const ratio = img.width / img.height;
    canvas.height = Math.min(img.height, maxH);
    canvas.width = Math.round(canvas.height * ratio);

    vtoState.userImg = img;
    vtoState.flipX = false;

    if (placeholder) placeholder.style.display = 'none';
    canvas.style.display = 'block';

    await ajustarPrendaAlCuerpoAutomatico();
}

function voltearPrendaVTO() {
    vtoState.flipX = !vtoState.flipX;
    renderizarEscenaVTO();
}

function reiniciarAjustesVTO() {
    vtoState.flipX = false;
    vtoState.brightness = 95;
    const lightEl = document.getElementById('vtoLight');
    if (lightEl) lightEl.value = 95;
    const lightVal = document.getElementById('vtoLightVal');
    if (lightVal) lightVal.textContent = '95%';

    // Si estaba viendo una imagen ya generada con IA, volver a la foto base limpia
    const savedBase = sessionStorage.getItem('vertice_vto_user_base');
    if (!vtoState.corners && savedBase) {
        const imgBase = new Image();
        imgBase.onload = function () {
            prepararLienzoConFoto(imgBase, false);
        };
        imgBase.src = savedBase;
        return;
    }

    if (vtoState.rawGarmentImg) {
        prepararPrendaRecortada(vtoState.rawGarmentImg, !vtoState.aiReady);
    } else {
        ajustarPrendaAlCuerpoAutomatico();
    }
}

function actualizarTransformVTO() {
    const lightEl = document.getElementById('vtoLight');
    if (lightEl) {
        vtoState.brightness = parseInt(lightEl.value, 10);
        const lightVal = document.getElementById('vtoLightVal');
        if (lightVal) lightVal.textContent = `${lightEl.value}%`;
    }
    renderizarEscenaVTO();
}

function dibujarTrianguloSinGrietas(ctx, img, p0, p1, p2, t0, t1, t2) {
    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    const expandir = (pt) => {
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return { x: pt.x + (dx / len) * 0.75, y: pt.y + (dy / len) * 0.75 };
    };

    const ep0 = expandir(p0);
    const ep1 = expandir(p1);
    const ep2 = expandir(p2);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ep0.x, ep0.y);
    ctx.lineTo(ep1.x, ep1.y);
    ctx.lineTo(ep2.x, ep2.y);
    ctx.closePath();
    ctx.clip();

    const denom = t0.x * (t1.y - t2.y) - t1.x * (t0.y - t2.y) + t2.x * (t0.y - t1.y);
    if (Math.abs(denom) < 0.0001) {
        ctx.restore();
        return;
    }

    const m11 = (p0.x * (t1.y - t2.y) - p1.x * (t0.y - t2.y) + p2.x * (t0.y - t1.y)) / denom;
    const m12 = (p0.y * (t1.y - t2.y) - p1.y * (t0.y - t2.y) + p2.y * (t0.y - t1.y)) / denom;
    const m21 = -(p0.x * (t1.x - t2.x) - p1.x * (t0.x - t2.x) + p2.x * (t0.x - t1.x)) / denom;
    const m22 = -(p0.y * (t1.x - t2.x) - p1.y * (t0.x - t2.x) + p2.y * (t0.x - t1.x)) / denom;
    const dx = (p0.x * (t1.x * t2.y - t2.x * t1.y) - p1.x * (t0.x * t2.y - t2.x * t0.y) + p2.x * (t0.x * t1.y - t1.x * t0.y)) / denom;
    const dy = (p0.y * (t1.x * t2.y - t2.x * t1.y) - p1.y * (t0.x * t2.y - t2.x * t0.y) + p2.y * (t0.x * t1.y - t1.x * t0.y)) / denom;

    ctx.transform(m11, m12, m21, m22, dx, dy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
}

function dibujarPrendaEnPerspectiva(ctx, gCanvas, c) {
    const gw = gCanvas.width;
    const gh = gCanvas.height;
    const steps = 4;

    const interp = (u, v) => {
        const topX = c[0].x + (c[1].x - c[0].x) * u;
        const topY = c[0].y + (c[1].y - c[0].y) * u;
        const botX = c[3].x + (c[2].x - c[3].x) * u;
        const botY = c[3].y + (c[2].y - c[3].y) * u;
        return {
            x: topX + (botX - topX) * v,
            y: topY + (botY - topY) * v
        };
    };

    const texCoord = (u, v) => ({
        x: vtoState.flipX ? (1 - u) * gw : u * gw,
        y: v * gh
    });

    ctx.save();
    ctx.filter = `brightness(${vtoState.brightness}%) contrast(102%) drop-shadow(0px 6px 10px rgba(0,0,0,0.20))`;

    for (let iy = 0; iy < steps; iy++) {
        const v0 = iy / steps;
        const v1 = (iy + 1) / steps;
        for (let ix = 0; ix < steps; ix++) {
            const u0 = ix / steps;
            const u1 = (ix + 1) / steps;

            const p00 = interp(u0, v0);
            const p10 = interp(u1, v0);
            const p11 = interp(u1, v1);
            const p01 = interp(u0, v1);

            const t00 = texCoord(u0, v0);
            const t10 = texCoord(u1, v0);
            const t11 = texCoord(u1, v1);
            const t01 = texCoord(u0, v1);

            dibujarTrianguloSinGrietas(ctx, gCanvas, p00, p10, p11, t00, t10, t11);
            dibujarTrianguloSinGrietas(ctx, gCanvas, p00, p11, p01, t00, t11, t01);
        }
    }

    ctx.restore();
}

function renderizarEscenaVTO(ocultarGuias = false) {
    const canvas = document.getElementById('vtoCanvas');
    if (!canvas || !vtoState.userImg) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(vtoState.userImg, 0, 0, canvas.width, canvas.height);

    if (vtoState.workingGarmentCanvas && vtoState.corners) {
        dibujarPrendaEnPerspectiva(ctx, vtoState.workingGarmentCanvas, vtoState.corners);

        const showHandles = document.getElementById('vtoShowHandles')?.checked;
        if (!ocultarGuias && vtoState.mode === 'move' && showHandles) {
            const c = vtoState.corners;
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(c[0].x, c[0].y);
            ctx.lineTo(c[1].x, c[1].y);
            ctx.lineTo(c[2].x, c[2].y);
            ctx.lineTo(c[3].x, c[3].y);
            ctx.closePath();
            ctx.stroke();

            ctx.setLineDash([]);
            c.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
                ctx.fillStyle = '#111111';
                ctx.fill();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            });
            ctx.restore();
        }
    }
}

function aplicarPincelEnPrenda(canvasPos) {
    const c = vtoState.corners;
    const wCanvas = vtoState.workingGarmentCanvas;
    const oCanvas = vtoState.originalTrimmedCanvas;
    if (!c || !wCanvas || !oCanvas) return;

    const minX = Math.min(c[0].x, c[1].x, c[2].x, c[3].x);
    const maxX = Math.max(c[0].x, c[1].x, c[2].x, c[3].x);
    const minY = Math.min(c[0].y, c[1].y, c[2].y, c[3].y);
    const maxY = Math.max(c[0].y, c[1].y, c[2].y, c[3].y);

    const u = (canvasPos.x - minX) / (maxX - minX || 1);
    const v = (canvasPos.y - minY) / (maxY - minY || 1);

    if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) return;

    const gx = (vtoState.flipX ? (1 - u) : u) * wCanvas.width;
    const gy = v * wCanvas.height;

    const brushPx = parseInt(document.getElementById('vtoBrushSize')?.value || '22', 10);
    const radius = (brushPx / (maxX - minX || 1)) * wCanvas.width * 0.5;

    const wCtx = wCanvas.getContext('2d');
    wCtx.save();
    wCtx.beginPath();
    wCtx.arc(gx, gy, radius, 0, Math.PI * 2);
    wCtx.clip();

    if (vtoState.mode === 'erase') {
        wCtx.clearRect(gx - radius, gy - radius, radius * 2, radius * 2);
    } else if (vtoState.mode === 'restore') {
        wCtx.drawImage(oCanvas, 0, 0);
    }
    wCtx.restore();

    renderizarEscenaVTO();
}

function puntoEnPoligono(pt, vs) {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y;
        const xj = vs[j].x, yj = vs[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 0.0001) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function inicializarEventosCanvasVTO() {
    const canvas = document.getElementById('vtoCanvas');
    if (!canvas) return;

    const obtenerPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: ((clientX - rect.left) / rect.width) * canvas.width,
            y: ((clientY - rect.top) / rect.height) * canvas.height
        };
    };

    const onDown = (e) => {
        if (!vtoState.userImg || !vtoState.corners) return;
        const pos = obtenerPos(e);
        vtoState.lastMouse = pos;

        if (vtoState.mode === 'erase' || vtoState.mode === 'restore') {
            vtoState.isPainting = true;
            aplicarPincelEnPrenda(pos);
            return;
        }

        const showHandles = document.getElementById('vtoShowHandles')?.checked;
        if (showHandles) {
            for (let i = 0; i < 4; i++) {
                const dx = pos.x - vtoState.corners[i].x;
                const dy = pos.y - vtoState.corners[i].y;
                if (Math.hypot(dx, dy) <= 18) {
                    vtoState.activeCorner = i;
                    return;
                }
            }
        }

        if (puntoEnPoligono(pos, vtoState.corners)) {
            vtoState.isDraggingBody = true;
            canvas.style.cursor = 'grabbing';
        }
    };

    const onMove = (e) => {
        if (!vtoState.userImg || !vtoState.corners) return;
        const pos = obtenerPos(e);

        if (vtoState.isPainting) {
            if (e.cancelable) e.preventDefault();
            aplicarPincelEnPrenda(pos);
            return;
        }

        if (vtoState.activeCorner !== -1) {
            if (e.cancelable) e.preventDefault();
            vtoState.corners[vtoState.activeCorner] = { x: pos.x, y: pos.y };
            renderizarEscenaVTO();
            return;
        }

        if (vtoState.isDraggingBody) {
            if (e.cancelable) e.preventDefault();
            const dx = pos.x - vtoState.lastMouse.x;
            const dy = pos.y - vtoState.lastMouse.y;
            vtoState.corners = vtoState.corners.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
            vtoState.lastMouse = pos;
            renderizarEscenaVTO();
        }
    };

    const onUp = () => {
        vtoState.activeCorner = -1;
        vtoState.isDraggingBody = false;
        vtoState.isPainting = false;
        if (canvas && vtoState.mode === 'move') canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    canvas.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
}

function descargarFotoVTO() {
    const canvas = document.getElementById('vtoCanvas');
    if (!canvas || !vtoState.userImg) {
        alert('Primero sube una foto para descargar tu prueba virtual.');
        return;
    }

    renderizarEscenaVTO(true);

    const enlace = document.createElement('a');
    enlace.download = `vertice-outfit-${Date.now()}.png`;
    enlace.href = canvas.toDataURL('image/png');
    enlace.click();

    renderizarEscenaVTO(false);
}

function agregarDesdeProbador() {
    cerrarProbadorVirtual();
    const formAgregar = document.querySelector('.form-agregar-carrito');
    if (formAgregar) {
        formAgregar.requestSubmit ? formAgregar.requestSubmit() : formAgregar.submit();
    }
}

window.abrirProbadorVirtual = abrirProbadorVirtual;
window.cerrarProbadorVirtual = cerrarProbadorVirtual;
window.cambiarModoVTO = cambiarModoVTO;
window.procesarPrendaVTO = procesarPrendaVTO;
window.cargarFotoUsuario = cargarFotoUsuario;
window.iniciarCamaraVTO = iniciarCamaraVTO;
window.detenerCamaraVTO = detenerCamaraVTO;
window.capturarFotoCamara = capturarFotoCamara;
window.ajustarPrendaAlCuerpoAutomatico = ajustarPrendaAlCuerpoAutomatico;
window.voltearPrendaVTO = voltearPrendaVTO;
window.reiniciarAjustesVTO = reiniciarAjustesVTO;
window.actualizarTransformVTO = actualizarTransformVTO;
window.renderizarEscenaVTO = renderizarEscenaVTO;
window.descargarFotoVTO = descargarFotoVTO;
window.agregarDesdeProbador = agregarDesdeProbador;
window.generarTryOnRealIA = generarTryOnRealIA;