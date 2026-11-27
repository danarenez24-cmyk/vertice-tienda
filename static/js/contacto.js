document.addEventListener('DOMContentLoaded', function () {
    // 1. Validar solo letras en Nombre
    const nombreInput = document.getElementById('nombre');
    if (nombreInput) {
        nombreInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        });
    }

    // 2. Validar formato de Teléfono
    const telefonoInput = document.getElementById('telefono');
    if (telefonoInput) {
        telefonoInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9\s+\-]/g, '');
        });
    }

    // 3. Contador en tiempo real de caracteres en Mensaje
    const mensajeInput = document.getElementById('mensaje');
    const contador = document.getElementById('contadorCaracteres');
    const LIMITE_CARACTERES = 500;

    if (mensajeInput && contador) {
        const actualizarContador = () => {
            if (mensajeInput.value.length > LIMITE_CARACTERES) {
                mensajeInput.value = mensajeInput.value.substring(0, LIMITE_CARACTERES);
            }

            const totalCaracteres = mensajeInput.value.length;
            contador.textContent = `${totalCaracteres} / ${LIMITE_CARACTERES} caracteres`;

            if (totalCaracteres >= LIMITE_CARACTERES) {
                contador.style.color = '#dc3545';
                contador.style.fontWeight = 'bold';
            } else {
                contador.style.color = '#666666';
                contador.style.fontWeight = 'normal';
            }
        };

        mensajeInput.addEventListener('input', actualizarContador);
        actualizarContador();
    }

    // 4. Limitar fecha de nacimiento (mínimo 17/18 años)
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const hoy = new Date();
        const hace18Anos = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
        const maxFecha = hace18Anos.toISOString().split('T')[0];
        dateInput.setAttribute('max', maxFecha);
    }
});