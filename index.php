<?php
/**
 * Router y Servidor Estático de Enlace para Hosting Compartido (PHP)
 * Redirecciona peticiones web a archivos estáticos (/public/...) y
 * peticiones de API a api_php.php de forma transparente.
 */

// Desactivar limitación de visualización de errores en producción si se desea
ini_set('display_errors', 0);
error_reporting(0);

$requestUri = $_SERVER['REQUEST_URI'];

// Obtener solo el path de la URL quitando query parameters
$parsedUrl = parse_url($requestUri);
$path = $parsedUrl['path'];

// Si se aloja en un subdirectorio, podemos remover la ruta base.
// Buscamos si es un API Call
if (strpos($path, '/api/') !== false || strpos($path, 'api_php.php') !== false) {
    // Es una llamada a la API de Licenciamiento, incluir api_php.php para resolverla
    require_once __DIR__ . '/api_php.php';
    exit;
}

// Si es la ruta principal del dominio, servir la Landing Page index.html
if ($path === '/' || $path === '/index.php' || empty($path) || $path === '/index.html') {
    header("Content-Type: text/html; charset=UTF-8");
    readfile(__DIR__ . '/public/index.html');
    exit;
}

// Intentar servir archivos estáticos desde la carpeta pública
$localFile = __DIR__ . '/public' . $path;

if (file_exists($localFile) && !is_dir($localFile)) {
    $ext = strtolower(pathinfo($localFile, PATHINFO_EXTENSION));
    
    // Mime types correspondientes
    $mimeTypes = [
        'css'  => 'text/css',
        'js'   => 'application/javascript',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',
        'ico'  => 'image/x-icon',
        'svg'  => 'image/svg+xml',
        'json' => 'application/json',
        'exe'  => 'application/octet-stream',
        'zip'  => 'application/zip'
    ];

    $contentType = isset($mimeTypes[$ext]) ? $mimeTypes[$ext] : 'text/plain';
    
    header("Content-Type: " . $contentType);
    
    if ($ext === 'exe') {
        header("Content-Disposition: attachment; filename=\"" . basename($localFile) . "\"");
        header("Content-Length: " . filesize($localFile));
    }
    
    readfile($localFile);
    exit;
}

// Si no coincide con nada, responder con un error 404
http_response_code(404);
header("Content-Type: application/json");
echo json_encode(["error" => "Recurso no encontrado en el servidor: " . $path]);
exit;
