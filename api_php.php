<?php
/**
 * API Web de Licenciamiento y Comercialización para Taller Celulares Pro (Versión PHP)
 * Listo para subir a cPanel o cualquier hosting compartido.
 * 
 * Uso en C#: Configurar WebApiLicensingUrl como "https://tusitio.com/api_php.php"
 */

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

define('DB_FILE', __DIR__ . '/licenses.db.json');

// Obtener base de datos
function loadDB() {
    if (!file_exists(DB_FILE)) {
        // Pre-poblar con credenciales del creador
        $initial = [
            "users" => [
                [
                    "email" => "doralcelular@gmail.com",
                    "passwordHash" => strtoupper(hash('sha256', 'Doral2277*$')),
                    "hwid" => "",
                    "registrationDate" => date(DATE_ATOM),
                    "trialExpiryDate" => date(DATE_ATOM, time() + 15 * 24 * 60 * 60),
                    "isRegistered" => true,
                    "securityQuestion" => "Nombre de tu primera mascota",
                    "securityAnswerHash" => strtoupper(hash('sha256', 'doral'))
                ]
            ]
        ];
        saveDB($initial);
        return $initial;
    }
    return json_decode(file_get_contents(DB_FILE), true);
}

// Guardar base de datos
function saveDB($db) {
    file_put_contents(DB_FILE, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

// Obtener datos del cuerpo del request (JSON)
$inputData = json_decode(file_get_contents('php://input'), true);

// Enrutamiento rudimentario por query string o URI
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Si no viene en GET, intentar deducir de la URL
if (empty($action)) {
    $requestUri = $_SERVER['REQUEST_URI'];
    if (strpos($requestUri, 'register') !== false) $action = 'register';
    elseif (strpos($requestUri, 'login') !== false) $action = 'login';
    elseif (strpos($requestUri, 'reset-password') !== false) $action = 'reset-password';
    elseif (strpos($requestUri, 'admin') !== false) $action = 'admin';
    else $action = 'status';
}

// ROUTING LOGIC
switch ($action) {
    case 'register':
        handleRegister($inputData);
        break;
    case 'login':
        handleLogin($inputData);
        break;
    case 'reset-password':
        handleResetPassword($inputData);
        break;
    case 'admin':
        handleAdmin($inputData);
        break;
    case 'status':
    default:
        echo json_encode([
            "status" => "API de Licenciamiento PHP Activa",
            "time" => date(DATE_ATOM)
        ]);
        break;
}

// ──────────────────────────────────────────
// FUNCIONES DE CONTROLADORES
// ──────────────────────────────────────────

function handleRegister($data) {
    if (!$data || empty($data['email']) || empty($data['passwordHash']) || empty($data['securityAnswerHash'])) {
        http_response_code(400);
        echo json_encode(["error" => "Datos incompletos para el registro."]);
        return;
    }

    $email = strtolower(trim($data['email']));
    $passwordHash = strtoupper($data['passwordHash']);
    $securityAnswerHash = strtoupper($data['securityAnswerHash']);
    $hwid = isset($data['hwid']) ? $data['hwid'] : '';

    $db = loadDB();

    foreach ($db['users'] as $user) {
        if (strtolower($user['email']) === $email) {
            http_response_code(400);
            echo json_encode(["error" => "El correo electrónico ya está registrado."]);
            return;
        }
    }

    $newUser = [
        "email" => $email,
        "passwordHash" => $passwordHash,
        "hwid" => $hwid,
        "registrationDate" => date(DATE_ATOM),
        "trialExpiryDate" => date(DATE_ATOM, time() + 15 * 24 * 60 * 60),
        "isRegistered" => true,
        "securityQuestion" => "Nombre de tu primera mascota",
        "securityAnswerHash" => $securityAnswerHash
    ];

    $db['users'][] = $newUser;
    saveDB($db);

    echo json_encode([
        "message" => "Registro completado con éxito.",
        "registrationDate" => $newUser["registrationDate"],
        "trialExpiryDate" => $newUser["trialExpiryDate"]
    ]);
}

function handleLogin($data) {
    if (!$data || empty($data['email']) || empty($data['passwordHash']) || empty($data['hwid'])) {
        http_response_code(400);
        echo json_encode(["error" => "Credenciales incompletas."]);
        return;
    }

    $email = strtolower(trim($data['email']));
    $passwordHash = strtoupper($data['passwordHash']);
    $hwid = $data['hwid'];

    $db = loadDB();
    $foundUserIndex = -1;

    for ($i = 0; $i < count($db['users']); $i++) {
        if (strtolower($db['users'][$i]['email']) === $email) {
            $foundUserIndex = $i;
            break;
        }
    }

    if ($foundUserIndex === -1) {
        http_response_code(404);
        echo json_encode(["error" => "Usuario no registrado."]);
        return;
    }

    $user = &$db['users'][$foundUserIndex];

    if (strtoupper($user['passwordHash']) !== $passwordHash) {
        http_response_code(401);
        echo json_encode(["error" => "Contraseña incorrecta."]);
        return;
    }

    // Guardar primer HWID si no tiene
    if (empty($user['hwid'])) {
        $user['hwid'] = $hwid;
        saveDB($db);
    }

    // Validar HWID
    if ($user['hwid'] !== $hwid) {
        http_response_code(403);
        echo json_encode(["error" => "HWID mismatch: Esta cuenta está registrada para otro equipo."]);
        return;
    }

    echo json_encode([
        "email" => $user['email'],
        "registrationDate" => $user['registrationDate'],
        "trialExpiryDate" => $user['trialExpiryDate'],
        "isRegistered" => $user['isRegistered']
    ]);
}

function handleResetPassword($data) {
    if (!$data || empty($data['email']) || empty($data['securityAnswerHash']) || empty($data['newPasswordHash'])) {
        http_response_code(400);
        echo json_encode(["error" => "Datos de recuperación incompletos."]);
        return;
    }

    $email = strtolower(trim($data['email']));
    $securityAnswerHash = strtoupper($data['securityAnswerHash']);
    $newPasswordHash = strtoupper($data['newPasswordHash']);

    $db = loadDB();
    $foundIndex = -1;

    for ($i = 0; $i < count($db['users']); $i++) {
        if (strtolower($db['users'][$i]['email']) === $email) {
            $foundIndex = $i;
            break;
        }
    }

    if ($foundIndex === -1) {
        http_response_code(404);
        echo json_encode(["error" => "Usuario no encontrado."]);
        return;
    }

    $user = &$db['users'][$foundIndex];

    if (strtoupper($user['securityAnswerHash']) !== $securityAnswerHash) {
        http_response_code(403);
        echo json_encode(["error" => "Respuesta de seguridad incorrecta."]);
        return;
    }

    $user['passwordHash'] = $newPasswordHash;
    saveDB($db);

    echo json_encode(["message" => "Contraseña restablecida con éxito."]);
}

function handleAdmin($data) {
    if (!$data || empty($data['adminSecret'])) {
        http_response_code(401);
        echo json_encode(["error" => "No autorizado."]);
        return;
    }

    $SECRET = "ADMIN_TALLER_CELULARES_PRO_SECURE";
    if ($data['adminSecret'] !== $SECRET) {
        http_response_code(401);
        echo json_encode(["error" => "No autorizado."]);
        return;
    }

    if (empty($data['email'])) {
        http_response_code(400);
        echo json_encode(["error" => "Email requerido para administración."]);
        return;
    }

    $email = strtolower(trim($data['email']));
    $db = loadDB();
    $foundIndex = -1;

    for ($i = 0; $i < count($db['users']); $i++) {
        if (strtolower($db['users'][$i]['email']) === $email) {
            $foundIndex = $i;
            break;
        }
    }

    if ($foundIndex === -1) {
        http_response_code(404);
        echo json_encode(["error" => "Usuario no encontrado."]);
        return;
    }

    $user = &$db['users'][$foundIndex];

    // Resetear HWID
    if (isset($data['resetHwid']) && $data['resetHwid']) {
        $user['hwid'] = "";
    }

    // Agregar días de prueba
    if (!empty($data['daysToAdd']) && intval($data['daysToAdd']) > 0) {
        $days = intval($data['daysToAdd']);
        $currentExpiry = strtotime($user['trialExpiryDate']);
        if ($currentExpiry < time()) {
            $currentExpiry = time();
        }
        $user['trialExpiryDate'] = date(DATE_ATOM, $currentExpiry + $days * 24 * 60 * 60);
    }

    saveDB($db);

    echo json_encode([
        "message" => "Licencia actualizada correctamente.",
        "email" => $user['email'],
        "hwid" => $user['hwid'],
        "trialExpiryDate" => $user['trialExpiryDate']
    ]);
}
