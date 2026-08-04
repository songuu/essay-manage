#!/usr/bin/env pwsh

[CmdletBinding()]
param(
  [string]$DeployHost = "root@47.253.230.197",
  [string]$Domain = "songuu.top",
  [string]$RemoteRoot = "/opt/essay-manage",
  [ValidateRange(1024, 65535)]
  [int]$AppPort = 3200,
  [string]$SourceCommit = "",

  [switch]$RemoteBuild,
  [switch]$SkipTests,
  [switch]$SkipTypecheck,
  [switch]$SkipLocalBuild,
  [switch]$SkipImageBuild,
  [switch]$SkipPublicVerify,
  [switch]$Rollback,
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
    throw "Unable to inspect Git worktree before production deployment."
  }
  if ($changes.Count -gt 0) {
    $preview = ($changes | Select-Object -First 8) -join "; "
    throw "Refusing to deploy uncommitted files. Commit changes first: $preview"
  }
}

function Assert-SafeSettings {
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
  if ($ImageTag -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$') {
    throw "ImageTag is not a valid Docker tag. Received: $ImageTag"
  }
  if (-not $Rollback -and $SourceCommit -notmatch '^[a-f0-9]{40}$') {
    throw "SourceCommit must be a full Git commit. Received: $SourceCommit"
  }
  if ($RemoteBuild -and $SkipImageBuild) {
    throw "-RemoteBuild and -SkipImageBuild cannot be used together."
  }
}

function Assert-RequiredLocalFiles {
  $requiredFiles = @(
    "Dockerfile",
    "compose.yaml",
    ".env.production.example",
    "package.json",
    "pnpm-lock.yaml",
    "deploy/nginx/essay-manage.location.conf.template"
  )
  foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $relativePath))) {
      throw "Required deployment file is missing: $relativePath"
    }
  }
}

function Assert-ReleaseArchive([string]$ArchivePath) {
  $entries = @(& tar -tf $ArchivePath)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect release archive: $ArchivePath"
  }

  $normalized = @($entries | ForEach-Object { $_.Replace('\', '/').TrimStart('.', '/') })
  $forbidden = @($normalized | Where-Object {
    $_ -match '(^|/)(\.git|node_modules|\.next)(/|$)' -or
    $_ -match '(^|/)\.env($|\.)'
  })
  if ($forbidden.Count -gt 0) {
    throw "Release archive contains forbidden paths: $($forbidden -join ', ')"
  }

  foreach ($required in @("Dockerfile", "compose.yaml", "package.json", "pnpm-lock.yaml")) {
    if ($normalized -notcontains $required) {
      throw "Release archive is missing required file: $required"
    }
  }
}

function Remove-DeploymentTemp([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }

  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if (-not $resolvedPath.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside the system temp directory: $resolvedPath"
  }
  Remove-Item -LiteralPath $resolvedPath -Recurse -Force
}

$ReleaseId = Get-Date -Format "yyyyMMddHHmmss"
$ImageTag = $ReleaseId
$RemoteRoot = $RemoteRoot.TrimEnd('/')
$RemoteRelease = "$RemoteRoot/releases/$ReleaseId"
$RemoteEnvFile = "$RemoteRoot/shared/.env.production"
$ImageReference = "essay-manage:$ImageTag"
$ProjectName = "essay-manage"

if (-not $Rollback) {
  $headOutput = @(& git rev-parse HEAD)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to resolve the current Git commit."
  }
  $headCommit = ($headOutput -join "").Trim()
  if ([string]::IsNullOrWhiteSpace($SourceCommit)) {
    $SourceCommit = $headCommit
  }
  if ($SourceCommit -ne $headCommit) {
    throw "SourceCommit must match the checked-out HEAD ($headCommit). Received: $SourceCommit"
  }
}

Assert-SafeSettings
Assert-RequiredLocalFiles

Step "Deployment configuration"
Write-Host ("  {0,-20} {1}" -f "DeployHost", $DeployHost)
Write-Host ("  {0,-20} {1}" -f "Public URL", "https://$Domain/essay/")
Write-Host ("  {0,-20} {1}" -f "Loopback", "127.0.0.1:$AppPort")
Write-Host ("  {0,-20} {1}" -f "Release", $RemoteRelease)
Write-Host ("  {0,-20} {1}" -f "Shared env", $RemoteEnvFile)
Write-Host ("  {0,-20} {1}" -f "Image", $ImageReference)
if (-not $Rollback) {
  Write-Host ("  {0,-20} {1}" -f "Source commit", $SourceCommit)
}
Write-Host ("  {0,-20} {1}" -f "Image build", $(if ($RemoteBuild) { "remote (explicit)" } else { "local + scp/load" }))
Write-Host ("  {0,-20} {1}" -f "Mode", $(if ($Rollback) { "rollback" } else { "deploy" }))

if ($DryRun) {
  Step "Dry run"
  Write-Host "No local build, archive, upload, Docker, Nginx, symlink, or public-health mutation was executed." -ForegroundColor Yellow
  if ($Rollback) {
    Write-Host "Would redeploy the release referenced by $RemoteRoot/previous and swap current/previous after health checks."
  } else {
    Write-Host "Would run enabled local gates, package a secret-free release, deploy the image, run migrations, install the Nginx snippet, and verify all health layers."
  }
  return
}

if (-not $Rollback) {
  Assert-CommittedWorktree @(".", ":(exclude)content/article-manifest.json")
  Step "Generate and verify content manifest"
  Invoke-Native "pnpm" @("content:manifest")
  Invoke-Native "pnpm" @("content:verify")
}

$quotedRoot = Quote-BashValue $RemoteRoot
$quotedEnv = Quote-BashValue $RemoteEnvFile
$quotedProject = Quote-BashValue $ProjectName
$quotedPort = Quote-BashValue ([string]$AppPort)
$quotedSourceCommit = if ($Rollback) { "''" } else { Quote-BashValue $SourceCommit }

Step "Remote prerequisites, shared environment, and port ownership"
$preflight = @(
  'set -Eeuo pipefail',
  "ROOT=$quotedRoot",
  "ENV_FILE=$quotedEnv",
  "PROJECT=$quotedProject",
  "APP_PORT=$quotedPort",
  'if [ ! -f "$ENV_FILE" ]; then',
  '  echo "ERROR: missing production environment file: $ENV_FILE" >&2',
  '  echo "Initialize it once without printing secrets:" >&2',
  '  echo "  install -d -m 700 $ROOT/shared" >&2',
  '  echo "  install -m 600 /dev/null $ENV_FILE" >&2',
  '  echo "  chmod 600 $ENV_FILE && \${EDITOR:-vi} $ENV_FILE" >&2',
  '  exit 42',
  'fi',
  'if [ ! -s "$ENV_FILE" ]; then echo "ERROR: production environment file is empty: $ENV_FILE" >&2; exit 43; fi',
  'for key in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL; do',
  '  if ! grep -Eq "^[[:space:]]*${key}=.+" "$ENV_FILE"; then echo "ERROR: $ENV_FILE is missing required key $key" >&2; exit 44; fi',
  'done',
  'command -v docker >/dev/null || { echo "ERROR: docker is not installed" >&2; exit 45; }',
  'docker compose version >/dev/null || { echo "ERROR: Docker Compose v2 is unavailable" >&2; exit 46; }',
  'command -v nginx >/dev/null || { echo "ERROR: nginx is not installed" >&2; exit 47; }',
  'command -v curl >/dev/null || { echo "ERROR: curl is not installed" >&2; exit 48; }',
  'command -v ss >/dev/null || { echo "ERROR: ss is not installed" >&2; exit 49; }',
  'command -v flock >/dev/null || { echo "ERROR: flock is not installed" >&2; exit 51; }',
  'if ss -H -ltn "sport = :$APP_PORT" | grep -q .; then',
  '  OWNER_PROJECTS=$(docker ps --filter "publish=$APP_PORT" --format ''{{.Label "com.docker.compose.project"}}'' | sed ''/^$/d'' | sort -u)',
  '  if [ "$OWNER_PROJECTS" != "$PROJECT" ]; then',
  '    echo "ERROR: 127.0.0.1:$APP_PORT is already occupied outside Compose project $PROJECT" >&2',
  '    exit 50',
  '  fi',
  'fi'
) -join "`n"
Invoke-Remote $preflight

if ($Rollback) {
  Step "Rollback to previous release"
  $quotedDomain = Quote-BashValue $Domain
  $quotedVerify = Quote-BashValue $(if ($SkipPublicVerify) { "0" } else { "1" })
  $quotedRemoteBuild = Quote-BashValue $(if ($RemoteBuild) { "1" } else { "0" })
  $rollbackScript = @(
    'set -Eeuo pipefail',
    "ROOT=$quotedRoot",
    "ENV_FILE=$quotedEnv",
    "PROJECT=$quotedProject",
    "APP_PORT=$quotedPort",
    "DOMAIN=$quotedDomain",
    "VERIFY_PUBLIC=$quotedVerify",
    "ALLOW_REMOTE_BUILD=$quotedRemoteBuild",
    'LOCK_FILE="$ROOT/shared/deploy.lock"',
    'exec 9>"$LOCK_FILE"',
    'if ! flock -w 900 9; then echo "ERROR: timed out waiting for the production deployment lock" >&2; exit 59; fi',
    'CURRENT=$(readlink -f "$ROOT/current" 2>/dev/null || true)',
    'TARGET=$(readlink -f "$ROOT/previous" 2>/dev/null || true)',
    'if [ -z "$CURRENT" ] || [ -z "$TARGET" ]; then echo "ERROR: both current and previous release links are required for rollback" >&2; exit 60; fi',
    'case "$CURRENT" in "$ROOT/releases/"*) ;; *) echo "ERROR: current points outside $ROOT/releases" >&2; exit 61;; esac',
    'case "$TARGET" in "$ROOT/releases/"*) ;; *) echo "ERROR: previous points outside $ROOT/releases" >&2; exit 62;; esac',
    'test -f "$TARGET/compose.yaml" || { echo "ERROR: rollback compose file is missing: $TARGET/compose.yaml" >&2; exit 63; }',
    'test -f "$TARGET/.deploy-image" || { echo "ERROR: rollback image metadata is missing: $TARGET/.deploy-image" >&2; exit 64; }',
    'test -f "$TARGET/deploy/nginx/essay-manage.location.conf.template" || { echo "ERROR: rollback Nginx template is missing" >&2; exit 65; }',
    'IMAGE=$(tr -d ''\r\n'' < "$TARGET/.deploy-image")',
    'CURRENT_IMAGE=$(tr -d ''\r\n'' < "$CURRENT/.deploy-image")',
    'case "$IMAGE" in essay-manage:[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;; *) echo "ERROR: rollback image metadata is not immutable" >&2; exit 66;; esac',
    'case "$CURRENT_IMAGE" in essay-manage:*) ;; *) echo "ERROR: current image metadata is invalid" >&2; exit 67;; esac',
    'target_compose() { export ESSAY_ENV_FILE="$ENV_FILE" ESSAY_IMAGE="$IMAGE" ESSAY_IMAGE_TAG="${IMAGE#essay-manage:}" ESSAY_APP_PORT="$APP_PORT"; docker compose --project-name "$PROJECT" --env-file "$ENV_FILE" -f "$TARGET/compose.yaml" "$@"; }',
    'current_compose() { export ESSAY_ENV_FILE="$ENV_FILE" ESSAY_IMAGE="$CURRENT_IMAGE" ESSAY_IMAGE_TAG="${CURRENT_IMAGE#essay-manage:}" ESSAY_APP_PORT="$APP_PORT"; docker compose --project-name "$PROJECT" --env-file "$ENV_FILE" -f "$CURRENT/compose.yaml" "$@"; }',
    'target_compose config --quiet',
    'if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then',
    '  if [ "$ALLOW_REMOTE_BUILD" = "1" ]; then target_compose build app; else echo "ERROR: rollback image $IMAGE is absent; rerun with -RemoteBuild only if host disk permits" >&2; exit 68; fi',
    'fi',
    'target_compose exec -T db sh -ec ''PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1" | grep -qx 1''',
    'SNIPPET=/etc/nginx/snippets/essay-manage.location.conf',
    'INCLUDE_LINE=''include /etc/nginx/snippets/essay-manage.location.conf;''',
    'SITE_CONFIG=''''',
    'for candidate in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do',
    '  [ -f "$candidate" ] || continue',
    '  if grep -Fq "$INCLUDE_LINE" "$candidate"; then resolved=$(readlink -f "$candidate"); if [ -n "$SITE_CONFIG" ] && [ "$SITE_CONFIG" != "$resolved" ]; then echo "ERROR: multiple active Nginx configs include essay-manage" >&2; exit 69; fi; SITE_CONFIG="$resolved"; fi',
    'done',
    'test -n "$SITE_CONFIG" || { echo "ERROR: active Nginx essay include was not found" >&2; exit 70; }',
    'test -f "$SNIPPET" || { echo "ERROR: current Nginx essay snippet is missing" >&2; exit 71; }',
    'TMP_SNIPPET=$(mktemp)',
    'sed "s/__ESSAY_APP_PORT__/$APP_PORT/g" "$TARGET/deploy/nginx/essay-manage.location.conf.template" > "$TMP_SNIPPET"',
    'BACKUP_DIR="$ROOT/shared/nginx-backups/rollback-$(date +%Y%m%d%H%M%S)"',
    'install -d -m 700 "$BACKUP_DIR"',
    'SNIPPET_BACKUP="$BACKUP_DIR/snippet.conf"',
    'cp -a "$SNIPPET" "$SNIPPET_BACKUP"',
    'reload_nginx() { if command -v systemctl >/dev/null 2>&1; then systemctl reload nginx; else nginx -s reload; fi; }',
    'ROLLBACK_SWITCH_STARTED=0',
    'ROLLBACK_LINKS_MUTATED=0',
    'restore_current_links() {',
    '  if [ "$ROLLBACK_LINKS_MUTATED" != "1" ]; then return 0; fi',
    '  link_restore_status=0',
    '  ln -sfn "$CURRENT" "$ROOT/current" || link_restore_status=$?',
    '  ln -sfn "$TARGET" "$ROOT/previous" || link_restore_status=$?',
    '  return "$link_restore_status"',
    '}',
    'restore_current() {',
    '  if [ "$ROLLBACK_SWITCH_STARTED" != "1" ]; then return 0; fi',
    '  set +e',
    '  app_restore_status=0',
    '  nginx_restore_status=0',
    '  current_compose up --detach --no-deps --wait app || app_restore_status=$?',
    '  cp -a "$SNIPPET_BACKUP" "$SNIPPET" || nginx_restore_status=$?',
    '  if ! nginx -t >/dev/null 2>&1; then nginx_restore_status=1; elif ! reload_nginx >/dev/null 2>&1; then nginx_restore_status=1; fi',
    '  rm -f "$TMP_SNIPPET" || true',
    '  result=0',
    '  if [ "$app_restore_status" != "0" ] || [ "$nginx_restore_status" != "0" ]; then result=90; fi',
    '  set -e',
    '  return "$result"',
    '}',
    'abort_rollback() {',
    '  status="$1"',
    '  context="$2"',
    '  trap - ERR',
    '  links_restore_status=0',
    '  runtime_restore_status=0',
    '  restore_current_links || links_restore_status=$?',
    '  restore_current || runtime_restore_status=$?',
    '  if [ "$links_restore_status" != "0" ] || [ "$runtime_restore_status" != "0" ]; then',
    '    echo "ERROR: $context; automatic current restoration failed (links=$links_restore_status runtime=$runtime_restore_status)" >&2',
    '    exit 90',
    '  fi',
    '  echo "ERROR: $context; current app, Nginx, and release links restored" >&2',
    '  exit "$status"',
    '}',
    'rollback_on_error() { status=$?; abort_rollback "$status" "unexpected rollback failure"; }',
    'trap rollback_on_error ERR',
    'ROLLBACK_SWITCH_STARTED=1',
    'if ! target_compose up --detach --no-deps --wait app; then abort_rollback 72 "rollback app failed to start"; fi',
    'APP_ID=$(target_compose ps --quiet app)',
    'if [ -z "$APP_ID" ] || [ "$(docker port "$APP_ID" 3000/tcp | tr -d ''\r'')" != "127.0.0.1:$APP_PORT" ] || ! curl -fsS --retry 12 --retry-delay 2 "http://127.0.0.1:$APP_PORT/essay/api/health/" >/dev/null; then',
    '  abort_rollback 73 "rollback app is incompatible with the forward database schema"',
    'fi',
    'if ! install -m 644 "$TMP_SNIPPET" "$SNIPPET" || ! nginx -t || ! reload_nginx; then abort_rollback 74 "rollback Nginx contract failed"; fi',
    'wait_for_http_status() {',
    '  expected="$1"',
    '  url="$2"',
    '  attempts="$3"',
    '  code=000',
    '  attempt=1',
    '  while [ "$attempt" -le "$attempts" ]; do',
    '    code=$(curl -sS --output /dev/null --write-out ''%{http_code}'' "$url" || true)',
    '    if [ "$code" = "$expected" ]; then return 0; fi',
    '    sleep 1',
    '    attempt=$((attempt + 1))',
    '  done',
    '  echo "ERROR: expected HTTP $expected from $url, received $code after $attempts attempts" >&2',
    '  return 1',
    '}',
    'if [ "$VERIFY_PUBLIC" = "1" ]; then',
    '  if ! wait_for_http_status 308 "https://$DOMAIN/essay" 12 || ! wait_for_http_status 200 "https://$DOMAIN/essay/api/health/" 12 || ! wait_for_http_status 200 "https://$DOMAIN/essay/" 12; then abort_rollback 75 "public rollback verification failed"; fi',
    'fi',
    'rm -f "$TMP_SNIPPET"',
    'ROLLBACK_LINKS_MUTATED=1',
    'if ! ln -sfn "$TARGET" "$ROOT/current" || ! ln -sfn "$CURRENT" "$ROOT/previous"; then abort_rollback 76 "rollback release link commit failed"; fi',
    'ROLLBACK_LINKS_MUTATED=0',
    'ROLLBACK_SWITCH_STARTED=0',
    'trap - ERR',
    'echo "ROLLBACK_RELEASE=$TARGET"',
    'echo "ROLLBACK_IMAGE=$IMAGE"',
    'echo "DB_HEALTH=healthy"',
    'echo "MIGRATOR=skipped-forward-compatible"',
    'echo "APP_LOOPBACK=healthy"',
    'if [ "$VERIFY_PUBLIC" = "1" ]; then echo "PUBLIC_HTTPS=healthy"; else echo "PUBLIC_HTTPS=skipped"; fi'
  ) -join "`n"
  Invoke-Remote $rollbackScript
  Step "Rollback complete"
  Write-Host "Current release now points to the prior deployment." -ForegroundColor Green
  return
}

if (-not $SkipTests) {
  Step "Local tests"
  Invoke-Native "pnpm" @("test")
} else {
  Write-Host "Skipping tests (-SkipTests)" -ForegroundColor Yellow
}

if (-not $SkipTypecheck) {
  Step "Local typecheck"
  Invoke-Native "pnpm" @("typecheck")
} else {
  Write-Host "Skipping typecheck (-SkipTypecheck)" -ForegroundColor Yellow
}

if (-not $SkipLocalBuild) {
  Step "Local production build"
  Invoke-Native "pnpm" @("build")
} else {
  Write-Host "Skipping local Next.js build (-SkipLocalBuild)" -ForegroundColor Yellow
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "essay-manage-deploy-$ReleaseId"
$releaseArchive = Join-Path $tempRoot "essay-manage-release-$ReleaseId.tgz"
$imageArchive = Join-Path $tempRoot "essay-manage-image-$ImageTag.tar"
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
  if (-not $RemoteBuild) {
    Step "Local container image"
    $previousImage = $env:ESSAY_IMAGE
    $previousImageTag = $env:ESSAY_IMAGE_TAG
    $previousPort = $env:ESSAY_APP_PORT
    $previousEnvFile = $env:ESSAY_ENV_FILE
    try {
      $env:ESSAY_IMAGE = $ImageReference
      $env:ESSAY_IMAGE_TAG = $ImageTag
      $env:ESSAY_APP_PORT = [string]$AppPort
      $env:ESSAY_ENV_FILE = (Resolve-Path -LiteralPath ".env.production.example").Path
      Invoke-Native "docker" @("compose", "--project-name", $ProjectName, "--env-file", ".env.production.example", "-f", "compose.yaml", "config", "--quiet")
      if (-not $SkipImageBuild) {
        Invoke-Native "docker" @("compose", "--project-name", $ProjectName, "--env-file", ".env.production.example", "-f", "compose.yaml", "build", "app")
      } else {
        Invoke-Native "docker" @("image", "inspect", $ImageReference)
      }
    } finally {
      $env:ESSAY_IMAGE = $previousImage
      $env:ESSAY_IMAGE_TAG = $previousImageTag
      $env:ESSAY_APP_PORT = $previousPort
      $env:ESSAY_ENV_FILE = $previousEnvFile
    }
    Invoke-Native "docker" @("save", "--output", $imageArchive, $ImageReference)
  }

  Step "Secret-free release archive"
  Invoke-Native "tar" @(
    "-czf", $releaseArchive,
    "--exclude=.git",
    "--exclude=node_modules",
    "--exclude=.next",
    "--exclude=dist",
    "--exclude=.env",
    "--exclude=.env.*",
    "--exclude=*.log",
    "--exclude=*.tar",
    "--exclude=*.tgz",
    "-C", $RepoRoot,
    "."
  )
  Assert-ReleaseArchive $releaseArchive

  Step "Upload release payload"
  $quotedRelease = Quote-BashValue $RemoteRelease
  $prepareRelease = @(
    'set -Eeuo pipefail',
    "ROOT=$quotedRoot",
    "RELEASE=$quotedRelease",
    'install -d -m 755 "$ROOT/releases"',
    'if [ -e "$RELEASE" ]; then echo "ERROR: release already exists: $RELEASE" >&2; exit 70; fi',
    'install -d -m 755 "$RELEASE"'
  ) -join "`n"
  Invoke-Remote $prepareRelease
  Invoke-Native "scp" @(
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=yes",
    $releaseArchive,
    "${DeployHost}:$RemoteRelease/release.tgz"
  )
  if (-not $RemoteBuild) {
    Invoke-Native "scp" @(
      "-o", "BatchMode=yes",
      "-o", "StrictHostKeyChecking=yes",
      $imageArchive,
      "${DeployHost}:$RemoteRelease/image.tar"
    )
  }

  Step "Install release and start Compose stack"
  $quotedImage = Quote-BashValue $ImageReference
  $quotedImageTag = Quote-BashValue $ImageTag
  $quotedDomain = Quote-BashValue $Domain
  $quotedVerify = Quote-BashValue $(if ($SkipPublicVerify) { "0" } else { "1" })
  $quotedRemoteBuild = Quote-BashValue $(if ($RemoteBuild) { "1" } else { "0" })
  $remoteDeploy = @(
    'set -Eeuo pipefail',
    "ROOT=$quotedRoot",
    "RELEASE=$quotedRelease",
    "ENV_FILE=$quotedEnv",
    "PROJECT=$quotedProject",
    "APP_PORT=$quotedPort",
    "IMAGE=$quotedImage",
    "IMAGE_TAG=$quotedImageTag",
    "DOMAIN=$quotedDomain",
    "SOURCE_COMMIT=$quotedSourceCommit",
    "VERIFY_PUBLIC=$quotedVerify",
    "REMOTE_BUILD=$quotedRemoteBuild",
    'LOCK_FILE="$ROOT/shared/deploy.lock"',
    'exec 9>"$LOCK_FILE"',
    'if ! flock -w 900 9; then echo "ERROR: timed out waiting for the production deployment lock" >&2; exit 69; fi',
    'tar -xzf "$RELEASE/release.tgz" -C "$RELEASE"',
    'rm -f "$RELEASE/release.tgz"',
    'test -f "$RELEASE/compose.yaml" && test -f "$RELEASE/Dockerfile" && test -f "$RELEASE/deploy/nginx/essay-manage.location.conf.template"',
    'printf ''%s\n'' "$IMAGE" > "$RELEASE/.deploy-image"',
    'printf ''%s'' "$SOURCE_COMMIT" | grep -Eq ''^[a-f0-9]{40}$'' || { echo "ERROR: source commit metadata is invalid" >&2; exit 70; }',
    'printf ''%s\n'' "$SOURCE_COMMIT" > "$RELEASE/.source-commit"',
    'chmod 644 "$RELEASE/.deploy-image" "$RELEASE/.source-commit"',
    'if [ "$REMOTE_BUILD" = "0" ]; then',
    '  cleanup_image_tar() { rm -f "$RELEASE/image.tar"; }',
    '  trap cleanup_image_tar EXIT',
    '  docker load --input "$RELEASE/image.tar"',
    '  rm -f "$RELEASE/image.tar"',
    '  trap - EXIT',
    '  docker image inspect "$IMAGE" >/dev/null',
    'fi',
    'export ESSAY_ENV_FILE="$ENV_FILE" ESSAY_IMAGE="$IMAGE" ESSAY_IMAGE_TAG="$IMAGE_TAG" ESSAY_APP_PORT="$APP_PORT"',
    'compose() { docker compose --project-name "$PROJECT" --env-file "$ENV_FILE" -f "$RELEASE/compose.yaml" "$@"; }',
    'OLD_CURRENT=''''',
    'OLD_IMAGE=''''',
    'if [ -L "$ROOT/current" ]; then',
    '  OLD_CURRENT=$(readlink -f "$ROOT/current")',
    '  case "$OLD_CURRENT" in "$ROOT/releases/"*) ;; *) echo "ERROR: current points outside $ROOT/releases" >&2; exit 68; esac',
    '  test -f "$OLD_CURRENT/compose.yaml" && test -f "$OLD_CURRENT/.deploy-image"',
    '  OLD_IMAGE=$(tr -d ''\r\n'' < "$OLD_CURRENT/.deploy-image")',
    '  docker image inspect "$OLD_IMAGE" >/dev/null',
    'fi',
    'OLD_PREVIOUS=''''',
    'if [ -L "$ROOT/previous" ]; then',
    '  OLD_PREVIOUS=$(readlink -f "$ROOT/previous")',
    '  case "$OLD_PREVIOUS" in "$ROOT/releases/"*) ;; *) echo "ERROR: previous points outside $ROOT/releases" >&2; exit 69; esac',
    'fi',
    'CONTENT_LINK="$ROOT/content-current"',
    'if [ -e "$CONTENT_LINK" ] && [ ! -L "$CONTENT_LINK" ]; then echo "ERROR: content-current exists but is not a symlink" >&2; exit 71; fi',
    'OLD_CONTENT_LINK=''''',
    'OLD_CONTENT="$OLD_CURRENT"',
    'if [ -L "$CONTENT_LINK" ]; then',
    '  OLD_CONTENT_LINK=$(readlink -f "$CONTENT_LINK")',
    '  case "$OLD_CONTENT_LINK" in "$ROOT/content-releases/"*|"$ROOT/releases/"*) ;; *) echo "ERROR: content-current points outside managed roots" >&2; exit 72;; esac',
    '  test -d "$OLD_CONTENT_LINK/essay" && test -f "$OLD_CONTENT_LINK/content/article-manifest.json"',
    '  OLD_CONTENT="$OLD_CONTENT_LINK"',
    'fi',
    'if [ -n "$OLD_CONTENT" ]; then test -d "$OLD_CONTENT/essay" && test -f "$OLD_CONTENT/content/article-manifest.json"; fi',
    'NETWORK=essay-manage-backend',
    'run_content_import() {',
    '  image="$1"',
    '  snapshot="$2"',
    '  docker run --rm --network "$NETWORK" --env-file "$ENV_FILE" --volume "$snapshot/essay:/app/essay:ro" --volume "$snapshot/content:/app/content:ro" "$image" node dist/db-deploy.mjs',
    '}',
    'snapshot_descriptor() {',
    '  image="$1"',
    '  snapshot="$2"',
    '  docker run --rm --network none --volume "$snapshot/content:/snapshot:ro" "$image" node -e ''const fs=require("node:fs");const crypto=require("node:crypto");const manifest=JSON.parse(fs.readFileSync("/snapshot/article-manifest.json","utf8"));const rows=manifest.articles.filter((article)=>article.status!=="archived").sort((left,right)=>Buffer.compare(Buffer.from(left.sourcePath),Buffer.from(right.sourcePath)));if(rows.length===0)process.exit(2);const body=rows.map((article)=>[article.sourcePath,article.sourceHash,article.status].join("|")).join("\n")+"\n";process.stdout.write([rows.length,rows.filter((article)=>article.status==="published").length,rows.filter((article)=>article.status==="draft").length,crypto.createHash("sha256").update(body).digest("hex")].join("|"));''',
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
    '  image="$1"',
    '  snapshot="$2"',
    '  expected_descriptor=$(snapshot_descriptor "$image" "$snapshot")',
    '  actual_descriptor=$(database_descriptor)',
    '  if [ "$actual_descriptor" != "$expected_descriptor" ]; then echo "ERROR: database content does not match snapshot" >&2; return 1; fi',
    '}',
    'CONTENT_IMPORT_STARTED=0',
    'APP_SWITCH_STARTED=0',
    'LINKS_MUTATED=0',
    'restore_release_links() {',
    '  if [ "$LINKS_MUTATED" != "1" ]; then return 0; fi',
    '  link_restore_status=0',
    '  if [ -n "$OLD_CURRENT" ]; then ln -sfn "$OLD_CURRENT" "$ROOT/current" || link_restore_status=$?; else rm -f "$ROOT/current" || link_restore_status=$?; fi',
    '  if [ -n "$OLD_PREVIOUS" ]; then ln -sfn "$OLD_PREVIOUS" "$ROOT/previous" || link_restore_status=$?; else rm -f "$ROOT/previous" || link_restore_status=$?; fi',
    '  rm -f "$CONTENT_LINK.next" || link_restore_status=$?',
    '  if [ -n "$OLD_CONTENT_LINK" ]; then ln -sfn "$OLD_CONTENT_LINK" "$CONTENT_LINK" || link_restore_status=$?; else rm -f "$CONTENT_LINK" || link_restore_status=$?; fi',
    '  return "$link_restore_status"',
    '}',
    'restore_previous_app() {',
    '  if [ "$APP_SWITCH_STARTED" != "1" ]; then return 0; fi',
    '  if [ -n "$OLD_CURRENT" ]; then',
    '    export ESSAY_IMAGE="$OLD_IMAGE" ESSAY_IMAGE_TAG="${OLD_IMAGE#essay-manage:}"',
    '    if docker compose --project-name "$PROJECT" --env-file "$ENV_FILE" -f "$OLD_CURRENT/compose.yaml" up --detach --no-deps --wait app; then result=0; else result=$?; fi',
    '    export ESSAY_IMAGE="$IMAGE" ESSAY_IMAGE_TAG="$IMAGE_TAG"',
    '  else',
    '    if compose stop app >/dev/null 2>&1; then result=0; else result=$?; fi',
    '  fi',
    '  return "$result"',
    '}',
    'restore_previous_content() {',
    '  if [ "$CONTENT_IMPORT_STARTED" != "1" ] || [ -z "$OLD_CONTENT" ]; then return 0; fi',
    '  run_content_import "$OLD_IMAGE" "$OLD_CONTENT" && verify_database_snapshot "$OLD_IMAGE" "$OLD_CONTENT"',
    '}',
    'abort_deploy() {',
    '  status="$1"',
    '  trap - ERR HUP INT TERM',
    '  set +e',
    '  content_restore_status=0',
    '  app_restore_status=0',
    '  restore_previous_content || content_restore_status=$?',
    '  restore_previous_app || app_restore_status=$?',
    '  set -e',
    '  if [ "$content_restore_status" != "0" ] || [ "$app_restore_status" != "0" ]; then echo "ERROR: automatic deployment restore failed (content=$content_restore_status app=$app_restore_status)" >&2; exit 90; fi',
    '  exit "$status"',
    '}',
    'restore_app_on_error() { status=$?; abort_deploy "$status"; }',
    'trap restore_app_on_error ERR',
    'trap ''abort_deploy 129'' HUP',
    'trap ''abort_deploy 130'' INT',
    'trap ''abort_deploy 143'' TERM',
    'compose config --quiet',
    'if [ "$REMOTE_BUILD" = "1" ]; then compose build app; fi',
    'compose rm --stop --force migrator >/dev/null 2>&1 || true',
    'CONTENT_IMPORT_STARTED=1',
    'APP_SWITCH_STARTED=1',
    'if ! compose up --detach --remove-orphans --wait; then',
    '  echo "ERROR: Compose startup failed; bounded diagnostics follow" >&2',
    '  compose ps --all >&2 || true',
    '  compose logs --no-color --tail 120 migrator app >&2 || true',
    '  abort_deploy 71',
    'fi',
    'compose exec -T db sh -ec ''PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1" | grep -qx 1''',
    'MIGRATOR_ID=$(compose ps --all --quiet migrator)',
    'if [ -z "$MIGRATOR_ID" ] || [ "$(docker inspect --format ''{{.State.ExitCode}}'' "$MIGRATOR_ID")" != "0" ]; then echo "ERROR: migrator did not exit successfully" >&2; abort_deploy 72; fi',
    'verify_database_snapshot "$IMAGE" "$RELEASE"',
    'APP_ID=$(compose ps --quiet app)',
    'test -n "$APP_ID" || { echo "ERROR: app container is not running" >&2; abort_deploy 73; }',
    'ACTUAL_BIND=$(docker port "$APP_ID" 3000/tcp | tr -d ''\r'')',
    'if [ "$ACTUAL_BIND" != "127.0.0.1:$APP_PORT" ]; then echo "ERROR: app port is not loopback-only (actual: $ACTUAL_BIND)" >&2; abort_deploy 74; fi',
    'curl -fsS --retry 12 --retry-delay 2 "http://127.0.0.1:$APP_PORT/essay/api/health/" >/dev/null',
    'SNIPPET=/etc/nginx/snippets/essay-manage.location.conf',
    'TEMPLATE="$RELEASE/deploy/nginx/essay-manage.location.conf.template"',
    'MARKER=''include /etc/nginx/snippets/tech-persistence.location.conf;''',
    'INCLUDE_LINE=''include /etc/nginx/snippets/essay-manage.location.conf;''',
    'SITE_CONFIG=''''',
    'for candidate in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do',
    '  [ -f "$candidate" ] || continue',
    '  if grep -Fq "$MARKER" "$candidate" || grep -Fq "$INCLUDE_LINE" "$candidate"; then',
    '    resolved=$(readlink -f "$candidate")',
    '    if [ -n "$SITE_CONFIG" ] && [ "$SITE_CONFIG" != "$resolved" ]; then echo "ERROR: multiple Nginx site files match the essay include marker" >&2; abort_deploy 75; fi',
    '    SITE_CONFIG="$resolved"',
    '  fi',
    'done',
    'if [ -z "$SITE_CONFIG" ]; then echo "ERROR: could not find the existing HTTPS site containing $MARKER; refusing to create a duplicate server block" >&2; abort_deploy 76; fi',
    'install -d -m 755 /etc/nginx/snippets',
    'TMP_SNIPPET=$(mktemp)',
    'sed "s/__ESSAY_APP_PORT__/$APP_PORT/g" "$TEMPLATE" > "$TMP_SNIPPET"',
    'if grep -q ''__ESSAY_APP_PORT__'' "$TMP_SNIPPET"; then echo "ERROR: unresolved Nginx port placeholder" >&2; abort_deploy 77; fi',
    'BACKUP_DIR="$ROOT/shared/nginx-backups/$IMAGE_TAG"',
    'install -d -m 700 "$BACKUP_DIR"',
    'SITE_BACKUP="$BACKUP_DIR/site.conf"',
    'SNIPPET_BACKUP="$BACKUP_DIR/snippet.conf"',
    'cp -a "$SITE_CONFIG" "$SITE_BACKUP"',
    'SNIPPET_EXISTED=0',
    'if [ -e "$SNIPPET" ]; then cp -a "$SNIPPET" "$SNIPPET_BACKUP"; SNIPPET_EXISTED=1; fi',
    'SITE_MUTATED=0',
    'SNIPPET_MUTATED=0',
    'reload_nginx() { if command -v systemctl >/dev/null 2>&1; then systemctl reload nginx; else nginx -s reload; fi; }',
    'restore_nginx_transaction() {',
    '  status="$1"',
    '  trap - ERR HUP INT TERM',
    '  set +e',
    '  links_restore_status=0',
    '  nginx_restore_status=0',
    '  content_restore_status=0',
    '  app_restore_status=0',
    '  restore_release_links || links_restore_status=$?',
    '  if [ "$SITE_MUTATED" = "1" ]; then cp -a "$SITE_BACKUP" "$SITE_CONFIG" || nginx_restore_status=$?; fi',
    '  if [ "$SNIPPET_MUTATED" = "1" ]; then if [ "$SNIPPET_EXISTED" = "1" ]; then cp -a "$SNIPPET_BACKUP" "$SNIPPET" || nginx_restore_status=$?; else rm -f "$SNIPPET" || nginx_restore_status=$?; fi; fi',
    '  rm -f "$TMP_SNIPPET" || true',
    '  if ! nginx -t >/dev/null 2>&1; then nginx_restore_status=1; elif ! reload_nginx >/dev/null 2>&1; then nginx_restore_status=1; fi',
    '  restore_previous_content || content_restore_status=$?',
    '  restore_previous_app || app_restore_status=$?',
    '  if [ "$links_restore_status" != "0" ] || [ "$nginx_restore_status" != "0" ] || [ "$content_restore_status" != "0" ] || [ "$app_restore_status" != "0" ]; then',
    '    echo "ERROR: automatic deployment compensation failed (links=$links_restore_status nginx=$nginx_restore_status content=$content_restore_status app=$app_restore_status)" >&2',
    '    exit 90',
    '  fi',
    '  exit "$status"',
    '}',
    'restore_nginx_on_error() { status=$?; restore_nginx_transaction "$status"; }',
    'trap restore_nginx_on_error ERR',
    'trap ''restore_nginx_transaction 129'' HUP',
    'trap ''restore_nginx_transaction 130'' INT',
    'trap ''restore_nginx_transaction 143'' TERM',
    'install -m 644 "$TMP_SNIPPET" "$SNIPPET"',
    'SNIPPET_MUTATED=1',
    'if ! grep -Fq "$INCLUDE_LINE" "$SITE_CONFIG"; then',
    '  sed -i "\\|$MARKER|a\\    $INCLUDE_LINE" "$SITE_CONFIG"',
    '  SITE_MUTATED=1',
    'fi',
    'nginx -t',
    'reload_nginx',
    'wait_for_http_status() {',
    '  expected="$1"',
    '  url="$2"',
    '  attempts="$3"',
    '  code=000',
    '  attempt=1',
    '  while [ "$attempt" -le "$attempts" ]; do',
    '    code=$(curl -sS --output /dev/null --write-out ''%{http_code}'' "$url" || true)',
    '    if [ "$code" = "$expected" ]; then return 0; fi',
    '    sleep 1',
    '    attempt=$((attempt + 1))',
    '  done',
    '  echo "ERROR: expected HTTP $expected from $url, received $code after $attempts attempts" >&2',
    '  return 1',
    '}',
    'if [ "$VERIFY_PUBLIC" = "1" ]; then',
    '  wait_for_http_status 308 "https://$DOMAIN/essay" 12',
    '  wait_for_http_status 200 "https://$DOMAIN/essay/api/health/" 12',
    '  wait_for_http_status 200 "https://$DOMAIN/essay/" 12',
    'fi',
    'LINKS_MUTATED=1',
    'ln -sfn "$RELEASE" "$CONTENT_LINK.next"',
    'if [ -n "$OLD_CURRENT" ] && [ "$OLD_CURRENT" != "$RELEASE" ]; then ln -sfn "$OLD_CURRENT" "$ROOT/previous"; fi',
    'ln -sfn "$RELEASE" "$ROOT/current"',
    'mv -Tf "$CONTENT_LINK.next" "$CONTENT_LINK"',
    'LINKS_MUTATED=0',
    'CONTENT_IMPORT_STARTED=0',
    'APP_SWITCH_STARTED=0',
    'trap - ERR HUP INT TERM',
    'rm -f "$TMP_SNIPPET"',
    'CURRENT_IMAGE=$(tr -d ''\r\n'' < "$ROOT/current/.deploy-image")',
    'PREVIOUS_IMAGE=''''',
    'if [ -f "$ROOT/previous/.deploy-image" ]; then PREVIOUS_IMAGE=$(tr -d ''\r\n'' < "$ROOT/previous/.deploy-image"); fi',
    'docker image ls --format ''{{.Repository}}:{{.Tag}}'' --filter reference=''essay-manage:*'' | while read -r candidate; do',
    '  if printf ''%s'' "$candidate" | grep -Eq ''^essay-manage:[0-9]{14}$'' && [ "$candidate" != "$CURRENT_IMAGE" ] && [ "$candidate" != "$PREVIOUS_IMAGE" ]; then docker image rm "$candidate" >/dev/null 2>&1 || true; fi',
    'done',
    'echo "RELEASE=$RELEASE"',
    'echo "IMAGE=$IMAGE"',
    'echo "SOURCE_COMMIT=$SOURCE_COMMIT"',
    'echo "POSTGRES_VOLUME=essay-manage-postgres-data"',
    'echo "DB_HEALTH=healthy"',
    'echo "MIGRATOR_EXIT=0"',
    'echo "APP_LOOPBACK=healthy"',
    'if [ "$VERIFY_PUBLIC" = "1" ]; then echo "PUBLIC_HTTPS=healthy"; else echo "PUBLIC_HTTPS=skipped"; fi',
    'echo "NGINX_SITE_BACKUP=$SITE_BACKUP"',
    'if [ "$SNIPPET_EXISTED" = "1" ]; then echo "NGINX_SNIPPET_BACKUP=$SNIPPET_BACKUP"; fi'
  ) -join "`n"
  Invoke-Remote $remoteDeploy

  Step "Deployment complete"
  Write-Host "Public URL: https://$Domain/essay/" -ForegroundColor Green
  Write-Host "Rollback: pwsh scripts/deploy-production.ps1 -Rollback" -ForegroundColor Green
} finally {
  if ($KeepArtifacts) {
    Write-Host "Local deployment artifacts retained at: $tempRoot" -ForegroundColor Yellow
  } else {
    Remove-DeploymentTemp $tempRoot
  }
}

