$ErrorActionPreference = 'Stop'
$resultPath = Join-Path $PSScriptRoot 'firewall-home-access-result.txt'
$blockName = 'TCP Query User{B4F04D00-9FE9-44E8-A1ED-FF2D4E7EF949}C:\users\karli\.jdks\openjdk-25.0.2\bin\java.exe'
$javaPath = 'C:\Users\karli\.jdks\openjdk-25.0.2\bin\java.exe'
$allowName = 'ComfyModelLibrary-Home-TCP8080'
$changedBlock = $false
try {
    $listener = Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object -First 1
    $appProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if ($appProcess.ExecutablePath -ne $javaPath) { throw 'Server executable changed. No firewall change applied.' }
    $block = Get-NetFirewallRule -Name $blockName
    if ($block.Action -ne 'Block' -or ($block | Get-NetFirewallApplicationFilter).Program -ne $javaPath) { throw 'Block rule did not match.' }
    Set-NetFirewallRule -Name $blockName -LocalPort @('1-8079','8081-65535')
    $changedBlock = $true
    if (Get-NetFirewallRule -Name $allowName -ErrorAction SilentlyContinue) {
        Set-NetFirewallRule -Name $allowName -Enabled True -Direction Inbound -Action Allow -Profile Private -Program $javaPath -Protocol TCP -LocalPort 8080 -RemoteAddress '192.168.1.0/24'
    } else {
        New-NetFirewallRule -Name $allowName -DisplayName 'Comfy Model Library - Home TCP 8080' -Enabled True -Direction Inbound -Action Allow -Profile Private -Program $javaPath -Protocol TCP -LocalPort 8080 -RemoteAddress '192.168.1.0/24' | Out-Null
    }
    'SUCCESS: Allowed app TCP 8080 from 192.168.1.0/24 on Private networks; other Java TCP ports remain blocked.' | Set-Content -LiteralPath $resultPath
} catch {
    $failure = $_.Exception.Message
    if ($changedBlock) { Set-NetFirewallRule -Name $blockName -LocalPort Any }
    "ERROR: $failure" | Set-Content -LiteralPath $resultPath
    exit 1
}
