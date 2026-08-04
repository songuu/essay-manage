#!/usr/bin/env pwsh

[CmdletBinding()]
param(
  [string]$DeployHost = "root@47.253.230.197",
  [string]$Domain = "songuu.top",
  [string]$RemoteRoot = "/opt/essay-manage",
  [ValidateRange(1024, 65535)]
  [int]$AppPort = 3200,
  [string]$ContentId = (Get-Date -Format "yyyyMMddHHmmss"),
  [string]$SourceCommit = "",
  [switch]$SkipTests,
  [switch]$DryRun,
  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Step([string]$Message) {
  Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Quote-BashValue([string]$Value) {
  if ($Value -match "['`r`n]") {
    throw "Remote value contains unsupported quote or newline characters."
  }
  return "'$Value'"
}

function Invoke-Native([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): $File $($Arguments -join ' ')"
  }
}

function Invoke-Remote([string]$Script) {
  Invoke-Native "ssh" @(
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=yes",
    $DeployHost,
    $Script
  )
}

function Assert-CommittedWorktree([string[]]$Pathspec) {
  $arguments = @(
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--"
  ) + $Pathspec
  $changes = @(& git @arguments)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect Git worktree before production content sync."
  }
  if ($changes.Count -gt 0) {
    $preview = ($changes | Select-Object -First 8) -join "; "
    throw "Refusing to publish uncommitted content. Commit essay changes first: $preview"
  }
}

function Remove-SyncTemp([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }

  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if (-not $resolvedPath.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside the system temp directory: $resolvedPath"
  }
  Remove-Item -LiteralPath $resolvedPath -Recurse -Force
}

function Assert-ContentArchive([string]$ArchivePath) {
  $entries = @(& tar -tf $ArchivePath)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect content archive: $ArchivePath"
  }

  $normalized = @($entries | ForEach-Object { $_.Replace('\', '/').TrimStart('.', '/') })
  $unexpected = @($normalized | Where-Object {
    $_ -ne "essay" -and
    -not $_.StartsWith("essay/") -and
    $_ -ne "content/article-manifest.json"
  })
  if ($unexpected.Count -gt 0) {
    throw "Content archive contains unexpected paths: $($unexpected -join ', ')"
  }
  if ($normalized -notcontains "content/article-manifest.json") {
    throw "Content archive is missing content/article-manifest.json"
  }
}

$RemoteRoot = $RemoteRoot.TrimEnd('/')
if ($DeployHost -notmatch '^[A-Za-z0-9._-]+@[A-Za-z0-9.:-]+$') {
  throw "DeployHost must look like user@host. Received: $DeployHost"
}
if ($Domain -notmatch '^[A-Za-z0-9.-]+$') {
  throw "Domain contains unsupported characters. Received: $Domain"
}
if (-not $RemoteRoot.StartsWith('/') -or $RemoteRoot -notmatch '^/[A-Za-z0-9._/-]+$') {
  throw "RemoteRoot must be a simple absolute Linux path. Received: $RemoteRoot"
}
if (($RemoteRoot -split '/') -contains '..') {
  throw "RemoteRoot cannot contain '..'. Received: $RemoteRoot"
}
if ($ContentId -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
  throw "ContentId is not safe. Received: $ContentId"
}

$headOutput = @(& git rev-parse HEAD)
if ($LASTEXITCODE -ne 0) {
  throw "Unable to resolve the current Git commit."
}
$headCommit = ($headOutput -join "").Trim()
if ([string]::IsNullOrWhiteSpace($SourceCommit)) {
  $SourceCommit = $headCommit
}
if ($SourceCommit -notmatch '^[a-f0-9]{40}$') {
  throw "SourceCommit must be a full Git commit. Received: $SourceCommit"
}
if ($SourceCommit -ne $headCommit) {
  throw "SourceCommit must match the checked-out HEAD ($headCommit). Received: $SourceCommit"
}

Step "Content sync configuration"
Write-Host ("  {0,-20} {1}" -f "DeployHost", $DeployHost)
Write-Host ("  {0,-20} {1}" -f "Public URL", "https://$Domain/essay/")
Write-Host ("  {0,-20} {1}" -f "Content ID", $ContentId)
Write-Host ("  {0,-20} {1}" -f "Source commit", $SourceCommit)
Write-Host ("  {0,-20} {1}" -f "Remote root", $RemoteRoot)

if ($DryRun) {
  Step "Dry run"
  Write-Host "No manifest write, test, archive, upload, database, symlink, or public-health mutation was executed." -ForegroundColor Yellow
  return
}

Assert-CommittedWorktree @("essay")

Step "Generate and verify content manifest"
Invoke-Native "pnpm" @("content:manifest")
Invoke-Native "pnpm" @("content:verify")

if (-not $SkipTests) {
  Step "Content contract tests"
  Invoke-Native "pnpm" @("test")
} else {
  Write-Host "Skipping tests (-SkipTests)" -ForegroundColor Yellow
}

$descriptorOutput = @(& node "node_modules/tsx/dist/cli.mjs" "scripts/content-release-descriptor.ts")
if ($LASTEXITCODE -ne 0) {
  throw "Unable to create content release descriptor."
}
$descriptor = ($descriptorOutput -join "`n") | ConvertFrom-Json
& git merge-base --is-ancestor ([string]$descriptor.sourceCommit) $SourceCommit
if ($LASTEXITCODE -ne 0) {
  throw "Manifest content commit is not an ancestor of SourceCommit."
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "essay-content-sync-$ContentId"
$archivePath = Join-Path $tempRoot "essay-content-$ContentId.tgz"
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
  Step "Package secret-free content snapshot"
  Invoke-Native "tar" @(
    "-czf", $archivePath,
    "-C", $RepoRoot,
    "essay",
    "content/article-manifest.json"
  )
  Assert-ContentArchive $archivePath

  $remoteArchive = "/tmp/essay-manage-content-$ContentId.tgz"
  Step "Upload content snapshot"
  Invoke-Native "scp" @(
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=yes",
    $archivePath,
    "${DeployHost}:$remoteArchive"
  )

  $quotedRoot = Quote-BashValue $RemoteRoot
  $quotedContentId = Quote-BashValue $ContentId
  $quotedRemoteArchive = Quote-BashValue $remoteArchive
  $quotedDomain = Quote-BashValue $Domain
  $quotedPort = Quote-BashValue ([string]$AppPort)
  $quotedTotal = Quote-BashValue ([string]$descriptor.totalArticles)
  $quotedPublished = Quote-BashValue ([string]$descriptor.publishedArticles)
  $quotedDraft = Quote-BashValue ([string]$descriptor.draftArticles)
  $quotedDigest = Quote-BashValue ([string]$descriptor.digest)
  $quotedSourceCommit = Quote-BashValue $SourceCommit
  $quotedContentSourceCommit = Quote-BashValue ([string]$descriptor.sourceCommit)

  Step "Import and verify content on production"
  $remoteSync = @(
    'set -Eeuo pipefail',
    "ROOT=$quotedRoot",
    "CONTENT_ID=$quotedContentId",
    "REMOTE_ARCHIVE=$quotedRemoteArchive",
    "DOMAIN=$quotedDomain",
    "APP_PORT=$quotedPort",
    "EXPECTED_TOTAL=$quotedTotal",
    "EXPECTED_PUBLISHED=$quotedPublished",
    "EXPECTED_DRAFT=$quotedDraft",
    "EXPECTED_DIGEST=$quotedDigest",
    "SOURCE_COMMIT=$quotedSourceCommit",
    "CONTENT_SOURCE_COMMIT=$quotedContentSourceCommit",
    'ENV_FILE="$ROOT/shared/.env.production"',
    'cleanup_archive() { rm -f "$REMOTE_ARCHIVE"; }',
    'trap cleanup_archive EXIT',
    'command -v flock >/dev/null || { echo "ERROR: flock is not installed" >&2; exit 59; }',
    'LOCK_FILE="$ROOT/shared/deploy.lock"',
    'exec 9>"$LOCK_FILE"',
    'if ! flock -w 900 9; then echo "ERROR: timed out waiting for the production deployment lock" >&2; exit 60; fi',
    'CURRENT=$(readlink -f "$ROOT/current" 2>/dev/null || true)',
    'if [ -z "$CURRENT" ]; then echo "ERROR: current release is missing" >&2; exit 61; fi',
    'case "$CURRENT" in "$ROOT/releases/"*) ;; *) echo "ERROR: current points outside $ROOT/releases" >&2; exit 62;; esac',
    'test -f "$CURRENT/compose.yaml" && test -f "$CURRENT/.deploy-image"',
    'test -s "$ENV_FILE" || { echo "ERROR: production environment file is missing or empty" >&2; exit 63; }',
    'IMAGE=$(tr -d ''\r\n'' < "$CURRENT/.deploy-image")',
    'case "$IMAGE" in essay-manage:*) ;; *) echo "ERROR: current image metadata is invalid" >&2; exit 64;; esac',
    'NETWORK=essay-manage-backend',
    'docker image inspect "$IMAGE" >/dev/null',
    'docker network inspect "$NETWORK" >/dev/null',
    'CONTENT_ROOT="$ROOT/content-releases"',
    'CONTENT_LINK="$ROOT/content-current"',
    'CONTENT_RELEASE="$CONTENT_ROOT/$CONTENT_ID"',
    'case "$CONTENT_RELEASE" in "$ROOT/content-releases/"*) ;; *) echo "ERROR: unsafe content release path" >&2; exit 65;; esac',
    'if [ -e "$CONTENT_RELEASE" ]; then echo "ERROR: content release already exists: $CONTENT_RELEASE" >&2; exit 66; fi',
    'if [ -e "$CONTENT_LINK" ] && [ ! -L "$CONTENT_LINK" ]; then echo "ERROR: content-current exists but is not a symlink" >&2; exit 67; fi',
    'install -d -m 755 "$CONTENT_ROOT" "$CONTENT_RELEASE"',
    'COMMITTED=0',
    'cleanup() {',
    '  rm -f "$REMOTE_ARCHIVE" "$CONTENT_LINK.next"',
    '  if [ "$COMMITTED" != "1" ]; then rm -rf "$CONTENT_RELEASE"; fi',
    '}',
    'trap cleanup EXIT',
    'if tar -tzf "$REMOTE_ARCHIVE" | grep -Eq ''(^/|(^|/)\.\.(/|$))''; then echo "ERROR: unsafe path in content archive" >&2; exit 68; fi',
    'tar -xzf "$REMOTE_ARCHIVE" -C "$CONTENT_RELEASE"',
    'test -d "$CONTENT_RELEASE/essay" && test -f "$CONTENT_RELEASE/content/article-manifest.json"',
    'printf ''%s\n'' "$SOURCE_COMMIT" > "$CONTENT_RELEASE/.source-commit"',
    'chmod -R a+rX "$CONTENT_RELEASE"',
    'OLD_CONTENT="$CURRENT"',
    'OLD_CONTENT_LINK=''''',
    'if [ -L "$CONTENT_LINK" ]; then',
    '  OLD_CONTENT=$(readlink -f "$CONTENT_LINK")',
    '  OLD_CONTENT_LINK="$OLD_CONTENT"',
    '  case "$OLD_CONTENT" in "$ROOT/content-releases/"*|"$ROOT/releases/"*) ;; *) echo "ERROR: content-current points outside managed roots" >&2; exit 69;; esac',
    '  test -d "$OLD_CONTENT/essay" && test -f "$OLD_CONTENT/content/article-manifest.json"',
    'fi',
    'export ESSAY_ENV_FILE="$ENV_FILE" ESSAY_IMAGE="$IMAGE" ESSAY_IMAGE_TAG="${IMAGE#essay-manage:}" ESSAY_APP_PORT="$APP_PORT"',
    'compose() { docker compose --project-name essay-manage --env-file "$ENV_FILE" -f "$CURRENT/compose.yaml" "$@"; }',
    'compose exec -T db sh -ec ''PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1" | grep -qx 1''',
    'run_content_import() {',
    '  snapshot="$1"',
    '  docker run --rm --network "$NETWORK" --env-file "$ENV_FILE" --volume "$snapshot/essay:/app/essay:ro" --volume "$snapshot/content:/app/content:ro" "$IMAGE" node dist/db-deploy.mjs',
    '}',
    'snapshot_descriptor() {',
    '  snapshot="$1"',
    '  docker run --rm --network none --volume "$snapshot/content:/snapshot:ro" "$IMAGE" node -e ''const fs=require("node:fs");const crypto=require("node:crypto");const manifest=JSON.parse(fs.readFileSync("/snapshot/article-manifest.json","utf8"));const rows=manifest.articles.filter((article)=>article.status!=="archived").sort((left,right)=>Buffer.compare(Buffer.from(left.sourcePath),Buffer.from(right.sourcePath)));if(rows.length===0)process.exit(2);const body=rows.map((article)=>[article.sourcePath,article.sourceHash,article.status].join("|")).join("\n")+"\n";process.stdout.write([rows.length,rows.filter((article)=>article.status==="published").length,rows.filter((article)=>article.status==="draft").length,crypto.createHash("sha256").update(body).digest("hex")].join("|"));''',
    '}',
    'database_descriptor() {',
    '  db_rows=$(compose exec -T db sh -ec ''PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F "|" -tAc "SELECT source_path, source_hash, status::text FROM articles ORDER BY source_path COLLATE \"C\";"'')',
    '  active_rows=$(printf ''%s\n'' "$db_rows" | awk -F ''|'' ''NF && $3 != "archived"'')',
    '  actual_total=$(printf ''%s\n'' "$active_rows" | awk ''NF { count++ } END { print count + 0 }'')',
    '  actual_published=$(printf ''%s\n'' "$active_rows" | awk -F ''|'' ''$3 == "published" { count++ } END { print count + 0 }'')',
    '  actual_draft=$(printf ''%s\n'' "$active_rows" | awk -F ''|'' ''$3 == "draft" { count++ } END { print count + 0 }'')',
    '  actual_digest=$(printf ''%s\n'' "$active_rows" | sha256sum | awk ''{ print $1 }'')',
    '  printf ''%s|%s|%s|%s\n'' "$actual_total" "$actual_published" "$actual_draft" "$actual_digest"',
    '}',
    'verify_database_snapshot() {',
    '  snapshot="$1"',
    '  expected_descriptor=$(snapshot_descriptor "$snapshot")',
    '  actual_descriptor=$(database_descriptor)',
    '  if [ "$actual_descriptor" != "$expected_descriptor" ]; then echo "ERROR: restored database content does not match snapshot" >&2; return 1; fi',
    '}',
    'LINK_COMMIT_STARTED=0',
    'SYNC_STARTED=0',
    'restore_content_link() {',
    '  if [ "$LINK_COMMIT_STARTED" != "1" ]; then return 0; fi',
    '  rm -f "$CONTENT_LINK.next"',
    '  if [ -n "$OLD_CONTENT_LINK" ]; then ln -sfn "$OLD_CONTENT_LINK" "$CONTENT_LINK"; else rm -f "$CONTENT_LINK"; fi',
    '}',
    'restore_content_transaction() {',
    '  status="$1"',
    '  trap - ERR HUP INT TERM',
    '  set +e',
    '  restore_status=0',
    '  link_restore_status=0',
    '  if [ "$SYNC_STARTED" = "1" ]; then',
    '    run_content_import "$OLD_CONTENT" || restore_status=$?',
    '    if [ "$restore_status" = "0" ]; then verify_database_snapshot "$OLD_CONTENT" || restore_status=$?; fi',
    '  fi',
    '  restore_content_link || link_restore_status=$?',
    '  set -e',
    '  if [ "$restore_status" != "0" ] || [ "$link_restore_status" != "0" ]; then echo "ERROR: content sync failed and previous content restore also failed (database=$restore_status link=$link_restore_status)" >&2; exit 90; fi',
    '  exit "$status"',
    '}',
    'restore_content_on_error() { status=$?; restore_content_transaction "$status"; }',
    'trap restore_content_on_error ERR',
    'trap ''restore_content_transaction 129'' HUP',
    'trap ''restore_content_transaction 130'' INT',
    'trap ''restore_content_transaction 143'' TERM',
    'SYNC_STARTED=1',
    'run_content_import "$CONTENT_RELEASE"',
    'ACTUAL_DESCRIPTOR=$(database_descriptor)',
    'IFS=''|'' read -r ACTUAL_TOTAL ACTUAL_PUBLISHED ACTUAL_DRAFT ACTUAL_DIGEST <<< "$ACTUAL_DESCRIPTOR"',
    'if [ "$ACTUAL_TOTAL" != "$EXPECTED_TOTAL" ] || [ "$ACTUAL_PUBLISHED" != "$EXPECTED_PUBLISHED" ] || [ "$ACTUAL_DRAFT" != "$EXPECTED_DRAFT" ]; then echo "ERROR: database counts do not match manifest (actual=$ACTUAL_TOTAL/$ACTUAL_PUBLISHED/$ACTUAL_DRAFT expected=$EXPECTED_TOTAL/$EXPECTED_PUBLISHED/$EXPECTED_DRAFT)" >&2; false; fi',
    'if [ "$ACTUAL_DIGEST" != "$EXPECTED_DIGEST" ]; then echo "ERROR: database source/hash/status digest does not match manifest" >&2; false; fi',
    'LOCAL_HEALTH=$(curl -fsS --retry 12 --retry-delay 2 "http://127.0.0.1:$APP_PORT/essay/api/health/")',
    'printf ''%s'' "$LOCAL_HEALTH" | grep -Fq "\"publishedArticles\":$EXPECTED_PUBLISHED"',
    'PUBLIC_HEALTH=$(curl -fsS --retry 12 --retry-delay 2 "https://$DOMAIN/essay/api/health/")',
    'printf ''%s'' "$PUBLIC_HEALTH" | grep -Fq "\"publishedArticles\":$EXPECTED_PUBLISHED"',
    'ln -sfn "$CONTENT_RELEASE" "$CONTENT_LINK.next"',
    'LINK_COMMIT_STARTED=1',
    'mv -Tf "$CONTENT_LINK.next" "$CONTENT_LINK"',
    'COMMITTED=1',
    'SYNC_STARTED=0',
    'LINK_COMMIT_STARTED=0',
    'trap - ERR HUP INT TERM',
    'echo "CONTENT_RELEASE=$CONTENT_RELEASE"',
    'echo "SOURCE_COMMIT=$SOURCE_COMMIT"',
    'echo "CONTENT_SOURCE_COMMIT=$CONTENT_SOURCE_COMMIT"',
    'echo "CONTENT_COUNTS=$ACTUAL_TOTAL/$ACTUAL_PUBLISHED/$ACTUAL_DRAFT"',
    'echo "CONTENT_DIGEST=$ACTUAL_DIGEST"',
    'echo "PUBLIC_HTTPS=healthy"'
  ) -join "`n"
  Invoke-Remote $remoteSync

  Step "Content sync complete"
  Write-Host "Public URL: https://$Domain/essay/" -ForegroundColor Green
} finally {
  if ($KeepArtifacts) {
    Write-Host "Keeping local content artifact: $tempRoot" -ForegroundColor Yellow
  } else {
    Remove-SyncTemp $tempRoot
  }
}
