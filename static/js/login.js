document.addEventListener('DOMContentLoaded', function () {
    const passwordInput = document.getElementById('passwordInput');
    const toggleIcon = document.getElementById('togglePasswordIcon');
    const chkTerminos = document.getElementById('acepta_terminos');
    const errTerminos = document.getElementById('error-terminos');
    const formStep1 = document.getElementById('formStep1');

    // Ojito de contraseña
    if (toggleIcon && passwordInput) {
        toggleIcon.addEventListener('click', function () {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }
        });
    }

    // Validación de Checkbox Términos y Condiciones
    if (formStep1 && chkTerminos) {
        formStep1.addEventListener('submit', function (e) {
            if (!chkTerminos.checked) {
                e.preventDefault();
                if (errTerminos) {
                    errTerminos.textContent = 'Debes aceptar los Términos de uso y la Política de privacidad para continuar.';
                    errTerminos.style.display = 'block';
                }
            }
        });

        chkTerminos.addEventListener('change', function () {
            if (chkTerminos.checked && errTerminos) {
                errTerminos.style.display = 'none';
            }
        });
    }
});

let intervalPollingQR = null;
let currentQRToken = null;

function abrirModalQR() {
    document.getElementById('modalQR').style.display = 'flex';
    document.getElementById('qrImageContainer').innerHTML = '<p>Generando código QR...</p>';

    fetch('/generar-qr-login/')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                currentQRToken = data.token;
                document.getElementById('qrImageContainer').innerHTML = `
                    <img src="data:image/png;base64,${data.qr_image}" alt="Código QR" style="max-width: 200px; width: 100%;">
                `;

                if (intervalPollingQR) clearInterval(intervalPollingQR);
                intervalPollingQR = setInterval(verificarAutorizacionQR, 2000);
            }
        });
}

function verificarAutorizacionQR() {
    if (!currentQRToken) return;

    fetch(`/verificar-estado-qr/${currentQRToken}/`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'exito') {
                clearInterval(intervalPollingQR);
                window.location.href = data.redirect_url;
            }
        });
}

function cerrarModalQR() {
    document.getElementById('modalQR').style.display = 'none';
    if (intervalPollingQR) clearInterval(intervalPollingQR);
    currentQRToken = null;
}