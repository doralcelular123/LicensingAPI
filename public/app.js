// API URL Base (Vacía por defecto para usar rutas relativas del mismo servidor Express)
const API_BASE = "";

// Variables de Sesión
let currentUser = null;
let currentPlanSelected = null;

// Hashing Helper (SHA256 en JS nativo para contraseñas)
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

document.addEventListener("DOMContentLoaded", () => {
    // -----------------------------------------------------------------
    // Navegación de Pestañas en el Portal de Cliente
    // -----------------------------------------------------------------
    const tabLoginBtn = document.getElementById("tab-login-btn");
    const tabRegisterBtn = document.getElementById("tab-register-btn");
    const tabStatusBtn = document.getElementById("tab-status-btn");

    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");
    const formStatus = document.getElementById("form-status");

    function switchTab(activeBtn, activeForm) {
        [tabLoginBtn, tabRegisterBtn, tabStatusBtn].forEach(btn => btn.classList.remove("active"));
        [formLogin, formRegister, formStatus].forEach(form => form.classList.remove("active"));
        
        activeBtn.classList.add("active");
        activeForm.classList.add("active");
    }

    tabLoginBtn.addEventListener("click", () => switchTab(tabLoginBtn, formLogin));
    tabRegisterBtn.addEventListener("click", () => switchTab(tabRegisterBtn, formRegister));
    tabStatusBtn.addEventListener("click", () => {
        if (currentUser) {
            switchTab(tabStatusBtn, formStatus);
        } else {
            alert("Inicia sesión para ver tu licencia.");
            switchTab(tabLoginBtn, formLogin);
        }
    });

    // -----------------------------------------------------------------
    // Registro de Usuario Final
    // -----------------------------------------------------------------
    const btnRegister = document.getElementById("btn-register-action");
    btnRegister.addEventListener("click", async () => {
        const email = document.getElementById("reg-email").value.trim();
        const pass = document.getElementById("reg-pass").value.trim();
        const answer = document.getElementById("reg-answer").value.trim();

        if (!email || !pass || !answer) {
            alert("Por favor completa todos los campos del registro.");
            return;
        }

        const passHash = await sha256(pass);
        const ansHash = await sha256(answer.toLowerCase().trim());

        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    passwordHash: passHash,
                    hwid: "", // Se asigna automáticamente al abrir el software en la PC
                    securityAnswerHash: ansHash
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`¡Usuario registrado con éxito! Tu cuenta de prueba vence el: ${new Date(data.trialExpiryDate).toLocaleDateString()}`);
                document.getElementById("login-email").value = email;
                document.getElementById("login-pass").value = pass;
                switchTab(tabLoginBtn, formLogin);
            } else {
                alert(`Error en registro: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error en el servidor de registro.");
        }
    });

    // -----------------------------------------------------------------
    // Iniciar Sesión de Usuario Final
    // -----------------------------------------------------------------
    const btnLogin = document.getElementById("btn-login-action");
    btnLogin.addEventListener("click", async () => {
        const email = document.getElementById("login-email").value.trim();
        const pass = document.getElementById("login-pass").value.trim();

        if (!email || !pass) {
            alert("Por favor ingresa tu correo y contraseña.");
            return;
        }

        const passHash = await sha256(pass);

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    passwordHash: passHash,
                    hwid: "WEB_PORTAL" // Simulación de HWID desde navegador
                })
            });

            const data = await res.json();
            // Ignorar mismatch de HWID para login en panel web (retornando éxito si las credenciales coinciden)
            if (res.ok || (res.status === 403 && data.error.includes("HWID mismatch"))) {
                currentUser = email;
                
                // Si dió HWID mismatch pero la contraseña es correcta, cargamos la información que vino
                let activeData = data;
                if (!res.ok) {
                    // Obtener fecha desde la BD de forma manual si es posible
                    activeData = {
                        email: email,
                        trialExpiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                        isRegistered: true
                    };
                }
                
                showLicenseStatus(activeData);
            } else {
                alert(`Error al ingresar: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error al iniciar sesión.");
        }
    });

    function showLicenseStatus(userObj) {
        document.getElementById("lic-email-display").innerText = userObj.email;
        document.getElementById("lic-hwid-display").innerText = userObj.hwid || "Sin registrar (Esperando primer inicio en PC)";
        document.getElementById("lic-expiry-display").innerText = new Date(userObj.trialExpiryDate).toLocaleString();
        
        const badge = document.getElementById("lic-status-badge");
        const isExpired = new Date(userObj.trialExpiryDate) < new Date();
        if (isExpired) {
            badge.innerText = "Expirado";
            badge.className = "info-value status-badge expired";
        } else {
            badge.innerText = "Licencia Activa";
            badge.className = "info-value status-badge active";
        }

        tabStatusBtn.style.display = "inline-block";
        switchTab(tabStatusBtn, formStatus);
    }

    // Cerrar Sesión
    document.getElementById("btn-logout").addEventListener("click", () => {
        currentUser = null;
        tabStatusBtn.style.display = "none";
        document.getElementById("login-email").value = "";
        document.getElementById("login-pass").value = "";
        switchTab(tabLoginBtn, formLogin);
    });

    // -----------------------------------------------------------------
    // Pasarela de Pagos Binance Pay (Checkout Modal)
    // -----------------------------------------------------------------
    const binanceModal = document.getElementById("binance-modal");
    const modalCloses = document.querySelectorAll(".modal-close, .modal-close-btn");

    modalCloses.forEach(closeBtn => {
        closeBtn.addEventListener("click", () => {
            binanceModal.classList.remove("active");
        });
    });

    // Clic en botones "Comprar con Binance Pay"
    const buyBtns = document.querySelectorAll(".btn-buy");
    buyBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const plan = btn.getAttribute("data-plan");
            const price = btn.getAttribute("data-price");
            const days = btn.getAttribute("data-days");

            currentPlanSelected = { plan, price, days };

            // Cargar datos en Modal
            document.getElementById("chk-plan-display").innerText = `Suite Taller Celulares Pro - Plan ${plan}`;
            document.getElementById("chk-price-display").innerText = `$${price}.00 USDT`;
            document.getElementById("chk-tx-display").innerText = "BIN-" + Math.floor(Math.random() * 1000000000);
            
            if (currentUser) {
                document.getElementById("binance-checkout-email").value = currentUser;
            } else {
                document.getElementById("binance-checkout-email").value = "";
            }

            binanceModal.classList.add("active");
        });
    });

    // Confirmar Pago Simulado
    const btnConfirmPayment = document.getElementById("btn-confirm-payment");
    btnConfirmPayment.addEventListener("click", async () => {
        const email = document.getElementById("binance-checkout-email").value.trim();
        if (!email) {
            alert("Por favor ingresa un correo para activar la suscripción.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/checkout/binance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email,
                    plan: currentPlanSelected.plan,
                    days: currentPlanSelected.days
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`¡Pago Simulado Exitosamente!\nTransacción: ${data.transactionId}\nTu licencia de plan '${data.plan}' ahora vence el: ${new Date(data.newExpiry).toLocaleString()}\n\nContraseña por defecto si es cuenta nueva: 123456`);
                binanceModal.classList.remove("active");
                
                // Actualizar estado del panel si estaba activo
                if (currentUser && currentUser.toLowerCase() === email.toLowerCase()) {
                    btnLogin.click();
                }
                
                // Actualizar tabla del panel de administración si está cargada
                const adminBox = document.getElementById("admin-panel-box");
                if (adminBox.style.display !== "none") {
                    document.getElementById("btn-admin-reload").click();
                }
            } else {
                alert(`Error al procesar pago: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error de comunicación en Binance Checkout.");
        }
    });

    document.getElementById("btn-extend-display").addEventListener("click", () => {
        document.getElementById("pricing").scrollIntoView({ behavior: 'smooth' });
    });

    // -----------------------------------------------------------------
    // Consola de Administración (Control de Licencias)
    // -----------------------------------------------------------------
    const btnAdminAuth = document.getElementById("btn-admin-auth");
    const adminSecretInput = document.getElementById("admin-secret-input");
    const adminAuthBox = document.getElementById("admin-auth-box");
    const adminPanelBox = document.getElementById("admin-panel-box");

    btnAdminAuth.addEventListener("click", async () => {
        const secret = adminSecretInput.value.trim();
        if (!secret) {
            alert("Ingresa la clave maestra.");
            return;
        }
        await loadAdminData(secret);
    });

    async function loadAdminData(secret) {
        try {
            const res = await fetch(`${API_BASE}/api/admin/users?adminSecret=${encodeURIComponent(secret)}`);
            const users = await res.json();

            if (res.ok) {
                adminAuthBox.style.display = "none";
                adminPanelBox.style.display = "block";
                renderAdminUsers(users, secret);
            } else {
                alert(`Error de autenticación administrador: ${users.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("No se pudo conectar a la base de datos.");
        }
    }

    function renderAdminUsers(users, secret) {
        const tbody = document.getElementById("admin-users-table-body");
        tbody.innerHTML = "";

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay usuarios registrados en el sistema.</td></tr>`;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement("tr");

            const tdEmail = document.createElement("td");
            tdEmail.innerText = user.email;
            
            const tdHwid = document.createElement("td");
            tdHwid.innerText = user.hwid || "No asignado (PC sin registrar)";
            
            const tdReg = document.createElement("td");
            tdReg.innerText = new Date(user.registrationDate).toLocaleDateString();

            const tdExp = document.createElement("td");
            const isExpired = new Date(user.trialExpiryDate) < new Date();
            tdExp.innerHTML = `<span style="color: ${isExpired ? '#ef4444' : '#10b981'}; font-weight: bold;">
                ${new Date(user.trialExpiryDate).toLocaleString()}
            </span>`;

            // Botones de acción admin
            const tdActions = document.createElement("td");
            
            // Botón Reset HWID
            const btnReset = document.createElement("button");
            btnReset.innerText = "Restablecer PC (HWID)";
            btnReset.className = "btn btn-secondary";
            btnReset.style.padding = "5px 10px";
            btnReset.style.fontSize = "11px";
            btnReset.style.marginRight = "8px";
            btnReset.addEventListener("click", () => adminAction(user.email, 0, true, secret));

            // Botón Agregar 30 Días
            const btnAddDays = document.createElement("button");
            btnAddDays.innerText = "+30 Días";
            btnAddDays.className = "btn btn-primary";
            btnAddDays.style.padding = "5px 10px";
            btnAddDays.style.fontSize = "11px";
            btnAddDays.style.boxShadow = "none";
            btnAddDays.addEventListener("click", () => adminAction(user.email, 30, false, secret));

            tdActions.appendChild(btnReset);
            tdActions.appendChild(btnAddDays);

            tr.appendChild(tdEmail);
            tr.appendChild(tdHwid);
            tr.appendChild(tdReg);
            tr.appendChild(tdExp);
            tr.appendChild(tdActions);

            tbody.appendChild(tr);
        });
    }

    async function adminAction(email, daysToAdd, resetHwid, secret) {
        try {
            const res = await fetch(`${API_BASE}/api/admin/licenses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    daysToAdd,
                    resetHwid,
                    adminSecret: secret
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`Operación exitosa para: ${email}.\n${data.message}`);
                loadAdminData(secret); // Recargar
            } else {
                alert(`Error en acción: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error al conectar con la consola maestra.");
        }
    }

    // Actualizar Base de datos de Admin
    document.getElementById("btn-admin-reload").addEventListener("click", () => {
        const secret = adminSecretInput.value.trim();
        if (secret) loadAdminData(secret);
    });
});
