$ErrorActionPreference = 'Stop'

$androidSdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\sdk' }
$adb = Join-Path $androidSdk 'platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $adb)) {
    throw "ADB was not found at $adb. Set ANDROID_SDK_ROOT to your Android SDK directory."
}

$devices = & $adb devices
$deviceLines = @($devices | Select-String -Pattern "\sdevice$")
if ($deviceLines.Count -eq 0) {
    throw 'No authorized Android device is connected. Connect the tablet and accept its USB debugging prompt.'
}

& $adb reverse tcp:8080 tcp:8080
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to forward tablet port 8080 to the laptop API.'
}

Write-Host 'ADB API forwarding is active. Starting Flutter on the connected tablet...'
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8080
