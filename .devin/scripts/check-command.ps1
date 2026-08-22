# Read stdin as JSON
$inputJson = $Input | Out-String
if ([string]::IsNullOrWhiteSpace($inputJson)) {
    exit 0
}

try {
    $data = $inputJson | ConvertFrom-Json -ErrorAction Stop
} catch {
    exit 0
}

$toolInput = $data.tool_input
if (-not $toolInput) {
    exit 0
}

$command = ""
if ($toolInput.command) {
    $command = $toolInput.command
} elseif ($toolInput.PSObject.Properties['command']) {
    $command = $toolInput.command
}

if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
}

$lower = $command.ToLowerInvariant()

# Destructive patterns that always block
$destructive = @(
    '\brm\s+-rf\s+/',
    '\brm\s+-rf\s+~',
    '\brm\s+-rf\s+c:\\',
    '\brm\s+-rf\s+\"?c:\\',
    '\bformat\s+[a-z]:',
    '\bdiskpart\b',
    '\bmkfs\b',
    '\bdd\s+if=',
    '\bdrop\s+database\b',
    '\bdrop\s+schema\b',
    '\btruncate\s+table\b',
    '\btruncate\s+database\b',
    '\bdelete\s+from\s+.*\bwhere\b.*=\s*\d+',
    '\bgit\s+reset\s+--hard\b',
    '\bgit\s+push\s+--force\b',
    '\bgit\s+push\s+-f\b',
    '\bkubectl\s+delete\s',
    '\bdocker\s+system\s+prune',
    '\bdocker\s+volume\s+rm'
)

foreach ($pattern in $destructive) {
    if ($lower -match $pattern) {
        Write-Output (@{
            decision = "block"
            reason = "Destructive command blocked by policy: matches '$pattern'. Explicit approval required."
        } | ConvertTo-Json -Compress)
        exit 2
    }
}

# Suspicious patterns that require confirmation (block and ask)
$suspicious = @(
    '\brm\s+-rf\b',
    '\brmdir\s+/s\b',
    '\bRemove-Item\s+.*-Recurse',
    '\bDROP\s+',
    '\bTRUNCATE\s+',
    '\bDELETE\s+FROM\s+',
    '\bUPDATE\s+.*\s+SET\s+',
    '\bALTER\s+TABLE\s+.*\s+DROP',
    '\bgit\s+clean\s+-fd',
    '\bkubectl\s+apply\b',
    '\bkubectl\s+delete\b',
    '\bdocker\s+compose\s+down\b',
    '\bdocker\s+stack\s+rm\b',
    '\bmigration:run\b',
    '\bknex\s+migrate:\w+\b',
    '\bnpx\s+.*migrate\b',
    '\bterraform\s+apply\b',
    '\bterraform\s+destroy\b'
)

foreach ($pattern in $suspicious) {
    if ($lower -match $pattern) {
        Write-Output (@{
            decision = "block"
            reason = "Potentially destructive command requires explicit approval: matches '$pattern'."
        } | ConvertTo-Json -Compress)
        exit 2
    }
}

exit 0
