# ── Messenger API Test Script ─────────────────────────────────────────────────
# Запуск: .\test-api.ps1
# Требования: API запущен на localhost:8080

chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$BASE    = "http://localhost:8080/api"
$passed  = 0
$failed  = 0

# ── Helpers ───────────────────────────────────────────────────────────────────

function Check($name, $condition) {
    if ($condition) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  [FAIL] $name" -ForegroundColor Red
        $script:failed++
    }
}

function Req($method, $url, $body = $null, $token = $null, [switch]$StatusOnly) {
    $headers = @{ "Accept" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    if ($body)  { $headers["Content-Type"]  = "application/json" }

    $params = @{
        Uri         = "$BASE$url"
        Method      = $method
        Headers     = $headers
        TimeoutSec  = 10
    }
    if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 5) }

    try {
        $resp = Invoke-WebRequest @params -UseBasicParsing -ErrorAction Stop
        if ($StatusOnly) { return [int]$resp.StatusCode }
        if ($resp.Content) { return $resp.Content | ConvertFrom-Json }
        return $true
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        if ($StatusOnly) { return $code }
        return $null
    }
}

function Upload($chatId, $filePath, $caption, $token) {
    try {
        $url = "$BASE/chats/$chatId/messages/upload"
        if ($caption) { $url += "?caption=$([Uri]::EscapeDataString($caption))" }

        $curlArgs = @(
            "-s", "-X", "POST", $url,
            "-H", "Authorization: Bearer $token",
            "-F", "file=@$filePath;type=text/plain"
        )

        $result = & curl.exe @curlArgs 2>$null
        if ($result) { return $result | ConvertFrom-Json }
        return $null
    } catch { return $null }
}

# ── Connectivity check ────────────────────────────────────────────────────────
try {
    Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  API недоступен на localhost:8080. Запусти: docker compose up -d api" -ForegroundColor Red
    exit 1
}

# ── Temp file ─────────────────────────────────────────────────────────────────
$tmpFile = "$env:TEMP\messenger_test.txt"
"Hello from test" | Out-File $tmpFile -Encoding utf8

# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  Messenger API Tests" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# ── 1. Auth ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> Auth" -ForegroundColor Yellow

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
Req POST "/auth/register" @{ email="owner_$ts@t.com"; password="Test1234!"; displayName="Owner" }   | Out-Null
Req POST "/auth/register" @{ email="member_$ts@t.com"; password="Test1234!"; displayName="Member" } | Out-Null
Req POST "/auth/register" @{ email="out_$ts@t.com";    password="Test1234!"; displayName="Out" }    | Out-Null

$l1 = Req POST "/auth/login" @{ email="owner_$ts@t.com";  password="Test1234!" }
$l2 = Req POST "/auth/login" @{ email="member_$ts@t.com"; password="Test1234!" }
$l3 = Req POST "/auth/login" @{ email="out_$ts@t.com";    password="Test1234!" }

$t1 = $l1.accessToken; $t2 = $l2.accessToken; $t3 = $l3.accessToken
Check "Register & login 3 users" ($t1 -and $t2 -and $t3)

Req POST "/users/" @{ displayName="Owner" }  $t1 | Out-Null
Req POST "/users/" @{ displayName="Member" } $t2 | Out-Null
Req POST "/users/" @{ displayName="Out" }    $t3 | Out-Null

$m1 = Req GET "/users/me" -token $t1
$m2 = Req GET "/users/me" -token $t2
$m3 = Req GET "/users/me" -token $t3
$id1 = $m1.userId; $id2 = $m2.userId; $id3 = $m3.userId
Check "Get user IDs" ($id1 -and $id2 -and $id3)

if (-not ($id1 -and $id2 -and $id3)) {
    Write-Host "  Cannot continue without user IDs" -ForegroundColor Red
    exit 1
}

# ── 2. Direct chat ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> Direct Chat" -ForegroundColor Yellow

$directId  = Req POST "/chats/direct" @{ otherUserId=$id2 } $t1
$directId2 = Req POST "/chats/direct" @{ otherUserId=$id2 } $t1
Check "Create direct chat"           ($directId -ne $null)
Check "Idempotent -- same ID"        ($directId -eq $directId2)

$s = Req POST "/chats/direct" @{ otherUserId=$id1 } $t1 -StatusOnly
Check "Cannot chat with yourself -> 422" ($s -eq 422)

# ── 3. Group chat ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> Group Chat" -ForegroundColor Yellow

$groupId = Req POST "/chats/group" @{ name="Test Group"; memberIds=@($id2) } $t1
Check "Create group chat" ($groupId -ne $null)

$s = Req POST "/chats/group" @{ name="   " } $t1 -StatusOnly
Check "Empty name -> 422" ($s -eq 422)

$s = Req POST "/chats/group" @{ name=("A"*101) } $t1 -StatusOnly
Check "Name > 100 chars -> 422" ($s -eq 422)

# ── 4. GET /chats ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> GET /chats" -ForegroundColor Yellow

$chats = Req GET "/chats" -token $t1
Check "Get chats list"       ($chats -ne $null)
Check "Contains direct chat" ($chats | Where-Object { $_.id -eq $directId })
Check "Contains group chat"  ($chats | Where-Object { $_.id -eq $groupId })

# ── 5. GET /chats/:id ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> GET /chats/:id" -ForegroundColor Yellow

$chat = Req GET "/chats/$groupId" -token $t1
Check "Get group chat info"  ($chat -ne $null)
Check "Has 2 members"        ($chat.members.Count -eq 2)
Check "Creator is Owner"     (($chat.members | Where-Object { $_.userId -eq $id1 }).role -eq "owner")

$s = Req GET "/chats/$groupId" -token $t3 -StatusOnly
Check "Outsider -> 403" ($s -eq 403)

$s = Req GET "/chats/00000000-0000-0000-0000-000000000000" -token $t1 -StatusOnly
Check "Non-existent -> 404" ($s -eq 404)

# ── 6. Members ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> Members" -ForegroundColor Yellow

$s = Req POST "/chats/$groupId/members" @{ userId=$id3 } $t1 -StatusOnly
Check "Owner adds member -> 204" ($s -eq 204)

$chat = Req GET "/chats/$groupId" -token $t1
Check "Group now has 3 members" ($chat.members.Count -eq 3)

$s = Req POST "/chats/$groupId/members" @{ userId=$id3 } $t2 -StatusOnly
Check "Member cannot add -> 403" ($s -eq 403)

$s = Req POST "/chats/$directId/members" @{ userId=$id3 } $t1 -StatusOnly
Check "Cannot add to direct -> 422" ($s -eq 422)

$s = Req DELETE "/chats/$groupId/members/$id3" -token $t1 -StatusOnly
Check "Owner removes member -> 204" ($s -eq 204)

$chat = Req GET "/chats/$groupId" -token $t1
Check "Back to 2 members" ($chat.members.Count -eq 2)

$s = Req DELETE "/chats/$groupId/members/$id1" -token $t2 -StatusOnly
Check "Member cannot remove Owner -> 403" ($s -eq 403)

# ── 7. PATCH /chats/:id ───────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> PATCH /chats/:id" -ForegroundColor Yellow

$s = Req PATCH "/chats/$groupId" @{ name="Updated Group" } $t1 -StatusOnly
Check "Owner updates name -> 204" ($s -eq 204)

$chat = Req GET "/chats/$groupId" -token $t1
Check "Name changed" ($chat.name -eq "Updated Group")

$s = Req PATCH "/chats/$groupId" @{ name="Hacked" } $t2 -StatusOnly
Check "Member cannot update -> 403" ($s -eq 403)

$s = Req PATCH "/chats/$directId" @{ name="Test" } $t1 -StatusOnly
Check "Cannot update direct -> 422" ($s -eq 422)

# ── 8. Messages ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> Messages" -ForegroundColor Yellow

$msgId = Req POST "/chats/$groupId/messages" @{ content="Hello!" } $t1
Check "Send message" ($msgId -ne $null)

$replyId = Req POST "/chats/$groupId/messages" @{ content="Reply"; replyToMessageId=$msgId } $t2
Check "Send reply" ($replyId -ne $null)

for ($i = 1; $i -le 5; $i++) {
    Req POST "/chats/$groupId/messages" @{ content="Msg $i" } $t1 | Out-Null
}

$page1 = Req GET "/chats/$groupId/messages?limit=3" -token $t1
Check "Get page 1 (limit=3)"  ($page1.items.Count -eq 3)
Check "Has nextCursor"         ($page1.nextCursor -ne $null)

$page2 = Req GET "/chats/$groupId/messages?before=$($page1.nextCursor)&limit=3" -token $t1
Check "Page 2 has items"       ($page2.items.Count -gt 0)
Check "Pages don't overlap"    (-not ($page2.items | Where-Object { $_.id -eq $page1.items[0].id }))

$s = Req POST "/chats/$groupId/messages" @{ content="" } $t1 -StatusOnly
Check "Empty message -> 422"   ($s -eq 422)

# ── 9. File Upload ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ">> File Upload" -ForegroundColor Yellow

$up = Upload $groupId $tmpFile "My caption" $t1
Check "Upload file -> 201" ($up -ne $null)

$msgs = Req GET "/chats/$groupId/messages?limit=1" -token $t1
$last = $msgs.items[0]
Check "Last message has fileUrl" ($last.fileUrl -ne $null)
Check "Caption saved correctly"  ($last.content -eq "My caption")

if ($last.fileUrl) {
    try {
        $dl = Invoke-WebRequest -Uri "http://localhost:8080$($last.fileUrl)" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        Check "File downloadable -> 200" ($dl.StatusCode -eq 200)
    } catch { Check "File downloadable -> 200" $false }
}

# ── Summary ───────────────────────────────────────────────────────────────────
Remove-Item $tmpFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
$total = $passed + $failed
$color = if ($failed -eq 0) { "Green" } else { "Yellow" }
Write-Host "  Results: $passed/$total passed" -ForegroundColor $color
if ($failed -gt 0) { Write-Host "  $failed test(s) FAILED" -ForegroundColor Red }
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
