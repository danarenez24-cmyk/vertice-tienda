// --- FUNCIONES PARA ABRIR Y CERRAR MENÚS LATERALES ---

function abrirMenu() {
    const menu = document.getElementById("menu");
    const inicio = document.getElementById("inicio");
    const overlay = document.getElementById("overlay");

    // Cierra el menú de usuario si está abierto y alterna el de categorías
    inicio.classList.remove("mostrar");
    menu.classList.toggle("mostrar");

    // Muestra el overlay oscuro si el menú está visible
    overlay.classList.toggle("mostrar", menu.classList.contains("mostrar"));
}

function inicio() {
    const menu = document.getElementById("menu");
    const inicio = document.getElementById("inicio");
    const overlay = document.getElementById("overlay");

    // Cierra el menú de categorías y alterna el de usuario
    menu.classList.remove("mostrar");
    inicio.classList.toggle("mostrar");

    // Muestra el overlay oscuro si el menú de inicio está visible
    overlay.classList.toggle("mostrar", inicio.classList.contains("mostrar"));
}

function cerrarMenus() {
    document.getElementById("menu").classList.remove("mostrar");
    document.getElementById("inicio").classList.remove("mostrar");
    document.getElementById("overlay").classList.remove("mostrar");
}

// --- CARRUSEL DE PRODUCTOS ---

function moverCarrusel(direccion) {
    const track = document.getElementById('carruselTrack');
    if (!track) return;
    
    const cantidadDesplazamiento = 300;
    track.scrollBy({ 
        left: direccion * cantidadDesplazamiento, 
        behavior: 'smooth' 
    });
}

// --- BÚSQUEDA DINÁMICA DE PRODUCTOS EN EL INDEX ---

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .trim();
}

function filtrarProductosIndex() {
    const input = document.getElementById('inputBuscarIndex');
    const tarjetas = document.querySelectorAll('.tarjeta-producto');
    const contador = document.getElementById('contadorResultados');
    const mensajeSinResultados = document.getElementById('mensajeSinResultados');

    if (!input || !tarjetas.length) return;

    const busqueda = normalizarTexto(input.value);
    let visibles = 0;

    tarjetas.forEach(tarjeta => {
        const nombre = normalizarTexto(tarjeta.getAttribute('data-nombre') || '');
        const categoria = normalizarTexto(tarjeta.getAttribute('data-categoria') || '');
        const textoCompleto = `${nombre} ${categoria}`;

        if (busqueda === '' || textoCompleto.includes(busqueda)) {
            tarjeta.style.display = 'flex';
            visibles++;
        } else {
            tarjeta.style.display = 'none';
        }
    });

    // Actualizar el número de productos visibles
    if (contador) {
        contador.textContent = busqueda === '' 
            ? `Mostrando ${visibles} productos` 
            : `${visibles} resultado(s) para "${input.value}"`;
    }

    // Mostrar mensaje si no hay coincidencias
    if (mensajeSinResultados) {
        mensajeSinResultados.style.display = (visibles === 0) ? 'flex' : 'none';
    }
}

// Exposición global
window.filtrarProductosIndex = filtrarProductosIndex;

// --- ANIMACIÓN DE PORTADA 2 AL HACER SCROLL ---

document.addEventListener("DOMContentLoaded", () => {
    const portada2 = document.querySelector(".portada2");

    if (!portada2) return;

    function animarSegunScroll() {
        if (window.innerWidth <= 768) {
            portada2.style.height = "auto";
            return;
        }
        const rect = portada2.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        const minHeight = 280;
        const maxHeight = 600;

        const start = windowHeight * 0.85;
        const end = windowHeight * 0.55;

        let progreso = (start - rect.top) / (start - end);
        progreso = Math.max(0, Math.min(1, progreso));

        const nuevaAltura = minHeight + (maxHeight - minHeight) * progreso;
        portada2.style.height = `${nuevaAltura}px`;
    }
    window.addEventListener("scroll", animarSegunScroll);
    animarSegunScroll(); // Ejecución inicial
});