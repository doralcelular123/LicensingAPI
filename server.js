const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

const DB_FILE = path.join(__dirname, 'licenses.db.json');

// Cargar Base de Datos
function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        // Pre-poblar con las credenciales sugeridas por el usuario
        const initialDB = {
            users: [
                {
                    email: "doralcelular@gmail.com",
                    // Hash SHA256 de "Doral2277*$"
                    passwordHash: hashSHA256("Doral2277*$"),
                    hwid: "", // Se asignará en el primer login
                    registrationDate: new Date().toISOString(),
                    trialExpiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 días
                    isRegistered: true,
                    securityQuestion: "Nombre de tu primera mascota",
                    securityAnswerHash: hashSHA256("doral") // por defecto
                }
            ]
        };
        saveDB(initialDB);
        return initialDB;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Guardar Base de Datos
function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Helper para hashing SHA256
function hashSHA256(text) {
    return crypto.createHash('sha256').update(text).digest('hex').toUpperCase();
}

// ==========================================
// ENDPOINTS
// ==========================================

// 1. Registro de copia de prueba
app.post('/api/register', (req, res) => {
    const { email, passwordHash, hwid, securityAnswerHash } = req.body;

    if (!email || !passwordHash || !securityAnswerHash) {
        return res.status(400).json({ error: "Datos incompletos para el registro." });
    }

    const db = loadDB();
    const cleanEmail = email.toLowerCase().trim();

    // Validar si ya existe el correo
    const existingUser = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existingUser) {
        return res.status(400).json({ error: "El correo electrónico ya está registrado." });
    }

    const newUser = {
        email: cleanEmail,
        passwordHash: passwordHash.toUpperCase(),
        hwid: hwid || "",
        registrationDate: new Date().toISOString(),
        trialExpiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        isRegistered: true,
        securityQuestion: "Nombre de tu primera mascota",
        securityAnswerHash: securityAnswerHash.toUpperCase()
    };

    db.users.push(newUser);
    saveDB(db);

    console.log(`[Registro] Nuevo usuario: ${cleanEmail} (HWID: ${hwid})`);

    res.json({
        message: "Registro completado con éxito.",
        registrationDate: newUser.registrationDate,
        trialExpiryDate: newUser.trialExpiryDate
    });
});

// 2. Validación de Login / Activación
app.post('/api/login', (req, res) => {
    const { email, passwordHash, hwid } = req.body;

    if (!email || !passwordHash || !hwid) {
        return res.status(400).json({ error: "Credenciales incompletas." });
    }

    const db = loadDB();
    const cleanEmail = email.toLowerCase().trim();

    const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
        return res.status(404).json({ error: "Usuario no registrado." });
    }

    // Verificar Contraseña
    if (user.passwordHash.toUpperCase() !== passwordHash.toUpperCase()) {
        return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    // Si el usuario no tiene HWID asignado, se le asigna el del primer login
    if (!user.hwid) {
        user.hwid = hwid;
        saveDB(db);
        console.log(`[HWID] Asignado primer HWID a ${cleanEmail}: ${hwid}`);
    }

    // Validar coincidencia de HWID
    if (user.hwid !== hwid) {
        return res.status(403).json({ error: "HWID mismatch: Esta cuenta está registrada para otro equipo." });
    }

    console.log(`[Acceso] Login exitoso: ${cleanEmail}`);

    res.json({
        email: user.email,
        registrationDate: user.registrationDate,
        trialExpiryDate: user.trialExpiryDate,
        isRegistered: user.isRegistered
    });
});

// 3. Recuperar / Restablecer Contraseña
app.post('/api/reset-password', (req, res) => {
    const { email, securityAnswerHash, newPasswordHash } = req.body;

    if (!email || !securityAnswerHash || !newPasswordHash) {
        return res.status(400).json({ error: "Datos de recuperación incompletos." });
    }

    const db = loadDB();
    const cleanEmail = email.toLowerCase().trim();

    const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // Validar Respuesta de Seguridad
    if (user.securityAnswerHash.toUpperCase() !== securityAnswerHash.toUpperCase()) {
        return res.status(403).json({ error: "Respuesta de seguridad incorrecta." });
    }

    user.passwordHash = newPasswordHash.toUpperCase();
    saveDB(db);

    console.log(`[Seguridad] Contraseña restablecida para: ${cleanEmail}`);
    res.json({ message: "Contraseña restablecida con éxito." });
});

// 4. Panel de Administración (Renovar/Extender Licencias o Resetear HWID)
app.post('/api/admin/licenses', (req, res) => {
    const { email, daysToAdd, resetHwid, adminSecret } = req.body;

    // Autenticación básica del administrador (puedes configurar tu clave secreta aquí)
    const SECRET = "ADMIN_TALLER_CELULARES_PRO_SECURE";
    if (adminSecret !== SECRET) {
        return res.status(401).json({ error: "No autorizado." });
    }

    const db = loadDB();
    const cleanEmail = email.toLowerCase().trim();

    const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // Resetear HWID
    if (resetHwid) {
        user.hwid = "";
        console.log(`[Admin] HWID restablecido para ${cleanEmail}`);
    }

    // Agregar Días
    if (daysToAdd && parseInt(daysToAdd) > 0) {
        let currentExpiry = new Date(user.trialExpiryDate);
        if (currentExpiry < new Date()) {
            currentExpiry = new Date();
        }
        user.trialExpiryDate = new Date(currentExpiry.getTime() + parseInt(daysToAdd) * 24 * 60 * 60 * 1000).toISOString();
        console.log(`[Admin] Se agregaron ${daysToAdd} días a ${cleanEmail}. Nueva expiración: ${user.trialExpiryDate}`);
    }

    saveDB(db);

    res.json({
        message: "Licencia actualizada correctamente.",
        email: user.email,
        hwid: user.hwid,
        trialExpiryDate: user.trialExpiryDate
    });
});

// Servir carpeta estática public
app.use(express.static(path.join(__dirname, 'public')));

// 5. Listar usuarios (para el panel admin)
app.get('/api/admin/users', (req, res) => {
    const adminSecret = req.query.adminSecret;
    const SECRET = "ADMIN_TALLER_CELULARES_PRO_SECURE";
    if (adminSecret !== SECRET) {
        return res.status(401).json({ error: "No autorizado." });
    }
    const db = loadDB();
    const safeUsers = db.users.map(u => ({
        email: u.email,
        hwid: u.hwid,
        registrationDate: u.registrationDate,
        trialExpiryDate: u.trialExpiryDate,
        isRegistered: u.isRegistered
    }));
    res.json(safeUsers);
});

// 6. Simular Binance Pay Checkout & Activación Automática
app.post('/api/checkout/binance', (req, res) => {
    const { email, plan, days } = req.body;
    if (!email || !plan || !days) {
        return res.status(400).json({ error: "Faltan datos del plan o cliente." });
    }

    const db = loadDB();
    const cleanEmail = email.toLowerCase().trim();
    let user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
        user = {
            email: cleanEmail,
            passwordHash: hashSHA256("123456"), // Contraseña por defecto
            hwid: "",
            registrationDate: new Date().toISOString(),
            trialExpiryDate: new Date().toISOString(),
            isRegistered: true,
            securityQuestion: "Nombre de tu primera mascota",
            securityAnswerHash: hashSHA256("doral")
        };
        db.users.push(user);
    }

    let currentExpiry = new Date(user.trialExpiryDate);
    if (currentExpiry < new Date()) {
        currentExpiry = new Date();
    }
    user.trialExpiryDate = new Date(currentExpiry.getTime() + parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
    saveDB(db);

    console.log(`[Binance Pay] Compra simulada exitosa para ${cleanEmail}. Plan: ${plan}. Días: ${days}.`);

    res.json({
        message: "Pago con Binance Pay confirmado y procesado con éxito.",
        email: user.email,
        plan: plan,
        newExpiry: user.trialExpiryDate,
        transactionId: "BINANCE-" + Math.random().toString(36).substr(2, 9).toUpperCase()
    });
});

// Endpoint de prueba
app.get('/api/status', (req, res) => {
    res.json({ status: "API de Licenciamiento Activa", date: new Date() });
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Servidor de Licencias Taller Celulares Pro`);
    console.log(` Corriendo en http://localhost:${PORT}`);
    console.log(`==================================================`);
});
