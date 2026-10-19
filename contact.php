<?php
// Estimate form endpoint. Screens each request for spam, then forwards real leads to the
// lead webhook. The email itself is sent by Web3Forms from the visitor's browser, only after
// this endpoint answers relay: true.
// While LIVE is false, nothing is forwarded and the page shows a test message.
const LIVE = true;
const FORM_ID = 'estimate';

// WEBHOOK_URL lives in config.php, which is kept out of git (see config.example.php).
if (is_file(__DIR__ . '/config.php')) {
    require __DIR__ . '/config.php';
}

// Requests must come from these hosts (the form page itself).
const ALLOWED_HOSTS = ['imperialconcretecoatings.com', 'www.imperialconcretecoatings.com', 'localhost', '127.0.0.1'];

// Anti-spam limits.
const MIN_FILL_MS = 3000;       // A person needs at least a few seconds to fill three steps.
const MAX_PER_HOUR = 5;         // Submissions allowed per IP address per hour.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

function respond(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body);
    exit;
}

// Spam gets the same answer as a real send, so bots learn nothing from the response.
// Without relay: true the page does not hand the lead to Web3Forms either.
function silent_reject(): void {
    respond(200, ['ok' => true]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

// 1. Origin check: the request must be sent from this site.
$source = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$sourceHost = strtolower((string)parse_url($source, PHP_URL_HOST));
if ($sourceHost === '' || !in_array($sourceHost, ALLOWED_HOSTS, true)) {
    respond(403, ['ok' => false, 'error' => 'Please send the form from our website.']);
}

// 2. Honeypot: real visitors never fill this hidden field.
if (!empty($_POST['website'])) {
    silent_reject();
}

// 3. Time trap: the page reports how long it was open before sending.
$elapsed = (int)($_POST['t'] ?? 0);
if ($elapsed < MIN_FILL_MS) {
    silent_reject();
}

// 4. Rate limit per IP address, stored as hashed files in the server temp folder.
function too_many_requests(string $ip): bool {
    $dir = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'imperial-form-rate';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return false; // Never block a real lead because the folder is unavailable.
    }
    $file = $dir . DIRECTORY_SEPARATOR . hash('sha256', $ip);
    $now = time();
    $hits = [];
    if (is_file($file)) {
        $hits = array_filter(array_map('intval', explode(',', (string)file_get_contents($file))), fn($t) => $t > $now - 3600);
    }
    if (count($hits) >= MAX_PER_HOUR) {
        return true;
    }
    $hits[] = $now;
    @file_put_contents($file, implode(',', $hits), LOCK_EX);
    return false;
}
if (too_many_requests($_SERVER['REMOTE_ADDR'] ?? 'unknown')) {
    respond(429, ['ok' => false, 'error' => 'Too many requests. Please call (913) 995-2657.']);
}

function field(string $key, int $max = 120): string {
    $value = trim((string)($_POST[$key] ?? ''));
    $value = str_replace(["\r", "\n", "\0"], ' ', $value);
    return mb_substr(strip_tags($value), 0, $max);
}

$space  = field('space', 30);
$finish = field('finish', 30);
$size   = field('size', 60);
$name   = field('name', 80);
$phone  = field('phone', 30);
$email  = field('email', 120);
$zip    = field('zip', 10);

// 5. Content filter: links or markup in short fields are a spam signature.
foreach ([$name, $space, $finish, $size, $zip] as $value) {
    if (preg_match('~https?://|www\.|\[url|<a\s~i', $value)) {
        silent_reject();
    }
}

// 6. Choice fields must match the options the form offers.
$spaces   = ['Garage', 'Basement', 'Patio', 'Other'];
$finishes = ['Flake', 'Quartz', 'Metallic', 'Marble', 'Not sure'];
if (!in_array($space, $spaces, true) || !in_array($finish, $finishes, true)) {
    silent_reject();
}

$errors = [];
if ($name === '') $errors['name'] = 'Enter your name.';
if (strlen(preg_replace('/\D/', '', $phone)) < 10) $errors['phone'] = 'Enter a 10 digit phone number.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Enter a valid email address.';
if (!preg_match('/^\d{5}$/', $zip)) $errors['zip'] = 'Enter a 5 digit ZIP code.';
if ($errors) {
    respond(422, ['ok' => false, 'errors' => $errors]);
}

if (!LIVE) {
    respond(200, ['ok' => true, 'test' => true]);
}

// Forward the lead to the webhook. A webhook failure never blocks the lead: the browser still
// sends it to Web3Forms, and the failure is written to the server error log.
$lead = [
    'form_id' => FORM_ID,
    'source' => 'imperialconcretecoatings.com',
    'submitted_at' => gmdate('c'),
    'name' => $name,
    'phone' => $phone,
    'email' => $email,
    'zip' => $zip,
    'space' => $space,
    'finish' => $finish,
    'size' => $size,
];

function post_json(string $url, array $data): bool {
    $json = json_encode($data);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
        ]);
        curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code >= 200 && $code < 300;
    }
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
        'content' => $json,
        'timeout' => 8,
        'ignore_errors' => true,
    ]]);
    $result = @file_get_contents($url, false, $context);
    return $result !== false && preg_match('~^HTTP/\S+\s+2\d\d~', $http_response_header[0] ?? '') === 1;
}

if (!defined('WEBHOOK_URL')) {
    error_log('Imperial form: config.php with WEBHOOK_URL is missing, lead not sent to the webhook.');
} elseif (!post_json(WEBHOOK_URL, $lead)) {
    error_log('Imperial form: webhook did not accept the lead for ' . $email);
}

respond(200, ['ok' => true, 'relay' => true]);
