param([ValidateSet("app-image", "exe", "msi")][string]$Type = "app-image")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
if (!$env:JAVA_HOME) { throw "Set JAVA_HOME to JDK 21 or newer." }
& "$projectRoot/mvnw.cmd" -Pdesktop -DskipTests package
if ($LASTEXITCODE -ne 0) { throw "Application build failed" }
$stage = Join-Path $projectRoot "target/desktop-input"
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -LiteralPath "target/comfy-library-0.0.1-SNAPSHOT.jar" -Destination "$stage/comfy-library.jar" -Force
$out = Join-Path $projectRoot ("target/windows-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $out | Out-Null
if (Test-Path "$projectRoot/target/wix3/candle.exe") { $env:PATH = "$projectRoot/target/wix3;" + $env:PATH }
$argsList = @("--type", $Type, "--name", "ComfyLibrary", "--app-version", "1.0.0", "--vendor", "Comfy Library", "--icon", "$PSScriptRoot/ComfyLibrary.ico", "--input", $stage, "--main-jar", "comfy-library.jar", "--main-class", "org.springframework.boot.loader.launch.JarLauncher", "--dest", $out, "--java-options", "-Djava.awt.headless=false")
if ($Type -ne "app-image") { $argsList += @("--win-per-user-install", "--win-menu", "--win-shortcut", "--win-dir-chooser", "--win-upgrade-uuid", "bf97ab1c-8778-42bf-a15e-59a6be9dd4b5") }
& "$env:JAVA_HOME/bin/jpackage.exe" @argsList
if ($LASTEXITCODE -ne 0) { throw "Packaging failed. EXE/MSI builds with JDK 21 require WiX 3 candle.exe and light.exe on PATH." }
Write-Output "Package created in $out"
