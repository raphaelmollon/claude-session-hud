<#
.SYNOPSIS
  Declares this mod in CLAUDE_CODE_PLUGIN_DIRS, in the `env` block of the
  Claude Code user settings. Other folders already listed are kept.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1
  powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall
#>
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'

$modDir = (Resolve-Path $PSScriptRoot).Path.TrimEnd('\', '/')
$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$settingsPath = Join-Path $configDir 'settings.json'
$var = 'CLAUDE_CODE_PLUGIN_DIRS'

# Compares folders the way Claude Code does: `~` expanded, full path, no trailing separator.
function Get-Key([string]$dir) {
  $dir = $dir.Trim()
  if ($dir -eq '~' -or $dir.StartsWith('~/') -or $dir.StartsWith('~\')) {
    $dir = $HOME + $dir.Substring(1)
  }
  try { $dir = [IO.Path]::GetFullPath($dir) } catch { }
  return $dir.TrimEnd('\', '/').ToLowerInvariant()
}

$settings = [pscustomobject]@{}
if (Test-Path $settingsPath) {
  $text = [IO.File]::ReadAllText($settingsPath)
  if ($text.Trim() -ne '') { $settings = $text | ConvertFrom-Json }
  Copy-Item $settingsPath "$settingsPath.bak-session-hud" -Force
} else {
  New-Item -ItemType Directory -Force $configDir | Out-Null
}

if ($null -eq $settings.PSObject.Properties['env']) {
  $settings | Add-Member -NotePropertyName env -NotePropertyValue ([pscustomobject]@{})
}

$current = ''
if ($null -ne $settings.env.PSObject.Properties[$var]) { $current = [string]$settings.env.$var }
$dirs = @($current.Split(';') | Where-Object { $_.Trim() -ne '' } | ForEach-Object { $_.Trim() })
$modKey = Get-Key $modDir
$others = @($dirs | Where-Object { (Get-Key $_) -ne $modKey })

if ($Uninstall) {
  $dirs = $others
} elseif ($others.Count -lt $dirs.Count) {
  Write-Host "session-hud is already declared in $settingsPath"
  exit 0
} else {
  $dirs = $others + $modDir
}

if ($dirs.Count -gt 0) {
  $settings.env | Add-Member -NotePropertyName $var -NotePropertyValue ($dirs -join ';') -Force
} else {
  $settings.env.PSObject.Properties.Remove($var)
}

# UTF-8 without BOM, which Windows PowerShell 5.1's Set-Content cannot write.
$json = $settings | ConvertTo-Json -Depth 100
[IO.File]::WriteAllText($settingsPath, $json + "`n", (New-Object Text.UTF8Encoding $false))

if ($Uninstall) {
  Write-Host "session-hud removed from $settingsPath"
} else {
  Write-Host "session-hud declared in $settingsPath ($modDir)"
}
Write-Host 'Restart Claude Code to apply.'
