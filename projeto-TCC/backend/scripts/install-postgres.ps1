$ErrorActionPreference = 'Stop'
$localRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.data/postgresql-local'))
$archivePath = Join-Path $localRoot 'postgresql-binaries.zip'
$executable = Join-Path $localRoot 'pgsql/bin/postgres.exe'
$archiveUrl = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609'
$expectedHash = 'E2246BA91D22345BC3D017586C09EDE52D9DF180B1EEB480F050445F1CAD84E2'
if (Test-Path -LiteralPath $executable) { & $executable --version; exit $LASTEXITCODE }
New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
if (!(Test-Path -LiteralPath $archivePath)) {
    Write-Output 'Baixando PostgreSQL 18.6 x64 do distribuidor EDB indicado pelo projeto PostgreSQL...'
    & curl.exe --fail --location --retry 2 --silent --show-error --output $archivePath $archiveUrl
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao baixar o PostgreSQL.' }
}
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) {
    throw 'SHA256 diferente do pacote verificado. Preserve o arquivo para inspeção e confira a origem antes de tentar novamente.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -notmatch '^pgsql/(bin|lib|share)/') { continue }
        $target = [IO.Path]::GetFullPath((Join-Path $localRoot $entry.FullName))
        if (!$target.StartsWith($localRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho inválido no ZIP.' }
        if (!$entry.Name) { New-Item -ItemType Directory -Path $target -Force | Out-Null; continue }
        New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
    }
} finally { $archive.Dispose() }
& $executable --version
if ($LASTEXITCODE -ne 0) { throw 'O executável PostgreSQL não iniciou.' }
