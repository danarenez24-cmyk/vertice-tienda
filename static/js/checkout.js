document.addEventListener("DOMContentLoaded", () => {
    initMetodoPagoToggle();
    initFormatosTarjeta();
});

function initMetodoPagoToggle() {
    const radios = document.querySelectorAll('input[name="metodo_pago"]');
    const seccionNueva = document.getElementById("seccion-nueva-tarjeta");

    const inputNum = document.getElementById("num_tarjeta");
    const inputTitular = document.getElementById("titular_tarjeta");
    const inputExp = document.getElementById("exp_tarjeta");
    const inputCvv = document.getElementById("cvv_tarjeta");

    function actualizarRequeridos(esNueva) {
        if (!seccionNueva) return;

        if (esNueva) {
            seccionNueva.classList.remove("oculto");
            if (inputNum) inputNum.required = true;
            if (inputTitular) inputTitular.required = true;
            if (inputExp) inputExp.required = true;
            if (inputCvv) inputCvv.required = true;
        } else {
            seccionNueva.classList.add("oculto");
            if (inputNum) inputNum.required = false;
            if (inputTitular) inputTitular.required = false;
            if (inputExp) inputExp.required = false;
            if (inputCvv) inputCvv.required = false;
        }
    }

    if (radios.length > 0) {
        radios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                actualizarRequeridos(e.target.value === "nueva_tarjeta");
            });
        });

        const seleccionado = document.querySelector('input[name="metodo_pago"]:checked');
        if (seleccionado) {
            actualizarRequeridos(seleccionado.value === "nueva_tarjeta");
        }
    } else {
        actualizarRequeridos(true);
    }
}

function initFormatosTarjeta() {
    const inputNumero = document.getElementById("num_tarjeta");
    const inputExp = document.getElementById("exp_tarjeta");

    if (inputNumero) {
        inputNumero.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            val = val.replace(/(.{4})/g, "$1 ").trim();
            e.target.value = val.substring(0, 19);
        });
    }

    if (inputExp) {
        inputExp.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length >= 2) {
                val = val.substring(0, 2) + "/" + val.substring(2, 4);
            }
            e.target.value = val.substring(0, 5);
        });
    }
}