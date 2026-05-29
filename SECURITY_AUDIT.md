# FilaMama — Security Audit Report

> **Status:** COMPLETE — findings triaged; code fixes applied for 16/20 (see §5 Fix status)
> **Auditor:** Claude — human-directed multi-agent audit (orchestrator + 48 sub-agents, adversarial verification)
> **Date:** 2026-05-29
> **Scope:** FilaMama file manager — FastAPI backend + React frontend + deployment artifacts.
> **Commit baseline:** branch `claude/hardcore-panini-fcc9e3` (HEAD `d59e1b4`)

---

## 1. Methodology

- **Recon (manual):** every backend source file was read and its data flow traced from the HTTP entry
  point to the sink (filesystem / subprocess / SQL / response / DOM).
- **Fan-out (7 agents):** independent agents audited disjoint dimensions — path traversal & filesystem,
  agent subsystem access-control, command injection, DoS/resource exhaustion, auth/CORS/config,
  deployment/infra, frontend. Every agent was instructed to **never assume** and to confirm each claim
  by reading the real code and tracing the full flow.
- **Adversarial verification (one verifier per finding):** every candidate was handed to a separate
  agent whose job was to *refute* it by re-reading the code and building a concrete PoC where feasible.
  **9 candidates were refuted as false positives** (Appendix A).
- **Cross-check:** the orchestrator independently confirmed the highest-impact findings with its own
  runnable PoCs (Appendix B), and re-verified two specific agent claims firsthand
  (`docker-compose` exposure; XML billion-laughs via stdlib ElementTree).
- Raw run: 33 dimension findings (16 confirmed / 9 severity-adjusted / 8 FP) + 8 orchestrator seeds
  (6 confirmed / 1 adjusted / 1 FP). Deduplicated below into F1–F20.

### Threat model / intended security boundaries

FilaMama is a single-process server exposing `/api/*` and a built SPA. The shipped configs bind
`0.0.0.0`; HTTP Basic Auth (a single shared credential) is optional. Intended boundaries:

1. **Filesystem confinement** — all access stays within `root_path` / `mounts`; `.filamama` is reserved.
2. **No arbitrary command execution** from user input.
3. **Human-in-the-loop** — agent "proposals" that mutate files require human approval.
4. **No information disclosure** beyond a legitimate file browser.

Attacker = anyone who can reach the HTTP API: a low-trust authenticated user, an autonomous "agent"
actor, a malicious file placed in the tree, or — given the shipped defaults — an unauthenticated
network client.

---

## 2. Findings summary

| ID | Title | Severity | Confidence | Proof |
|----|-------|:--------:|:----------:|:-----:|
| **F1** | ripgrep argument injection via search query → **RCE** | 🔴 Critical | High | PoC ✅ |
| **F2** | Human-in-the-loop proposal approval bypass (spoofable actor headers) + unauthenticated mutating file API | 🟠 High | High | Code ✅ |
| **F3** | Insecure-by-default exposure: `docker compose up` ships `ALLOW_INSECURE=true`, mounts host `$HOME` on `0.0.0.0`, runs as root; dev launcher disables the guard | 🟠 High | High | Verified ✅ |
| **F4** | Stored XSS: `/api/files/preview` serves attacker bytes inline with sniffed Content-Type (no CSP/nosniff) | 🟠 High | High | PoC ✅ |
| **F5** | Thumbnail image decode blocks the event loop, no `MAX_IMAGE_PIXELS` → decompression-bomb / DoS | 🟠 High | High | PoC ✅ |
| **F6** | `write_text` proposal overwrites arbitrary existing in-root files (no existence check) | 🟡 Medium* | High | PoC ✅ |
| **F7** | Symlink dereference (copy / download-zip / python search fallback) leaks out-of-root content into/through root | 🟡 Medium | High | PoC ✅ |
| **F8** | EPUB thumbnail: XML billion-laughs + unbounded zip-entry decompression → DoS | 🟡 Medium | High | Verified ✅ |
| **F9** | `/api/files/text` `max_size` unbounded → whole-file read into memory (DoS) | 🟡 Medium | High | Code ✅ |
| **F10** | Audio metadata (mutagen) runs synchronously on the event loop + loads full cover-art → DoS | 🟡 Medium | Med | Code ✅ |
| **F11** | systemd / launchd units ship with almost no hardening (defense-in-depth) | 🟡 Medium | High | Code ✅ |
| **F12** | Unauthenticated information disclosure (`/api/config`, `/api/system/info`) | 🟢 Low | High | Code ✅ |
| **F13** | `FILAMAMA_CORS_ORIGINS=*` → credentialed wildcard reflecting any origin | 🟢 Low | High | PoC ✅ |
| **F14** | Reserved-dir (`.filamama`) check skipped on `create_directory` / `rename` destination | 🟢 Low | High | PoC ✅ |
| **F15** | Trash manifest is user-writable (`.deleted_items` not reserved) | 🟢 Low | Med | Code ✅ |
| **F16** | Upload has no file-count cap; `download-zip` no concurrency limit → disk/inode exhaustion | 🟢 Low | High | Code ✅ |
| **F17** | Agent text/metadata/note inputs unbounded → SQLite/disk growth | 🟢 Low | Med | Code ✅ |
| **F18** | launchd logs to predictable world-readable `/tmp` paths | 🟢 Low | Med | Code ✅ |
| **F19** | Frontend: unencoded path in "Open in new tab"; PDF.js loaded from unpkg CDN without SRI | 🟢 Low | High | Code ✅ |
| **F20** | No security headers (CSP/X-Content-Type-Options/X-Frame-Options) and no rate limiting | 🟢 Low | High | Code ✅ |

\* F6 is rated Medium with a calibration note: it is **redundant** with the already-unauthenticated
mutating file API (see finding). One verifier rated it High, another Low — flagged for your triage.

> **Confirmed non-issue:** classic `../` path traversal and symlink-out **reads** are **blocked** —
> `resolve_within_root` is robust (proven, Appendix B-2). FFmpeg/ffprobe/`lscpu` subprocess calls are
> **not** injectable (absolute paths, arg-list exec). See Appendix A for all refuted candidates.

---

## 3. Findings (detailed)

### F1 — ripgrep argument injection via search query → Remote Code Execution · 🔴 Critical
- **File:** [`backend/app/services/content_search.py:100-114`](backend/app/services/content_search.py:114) · reached from [`routers/files.py:213-236`](backend/app/routers/files.py:231)
- **Root cause:** the user query is appended to the ripgrep argv as a **leading positional argument
  with no `--` separator and no `-e PATTERN`**: `cmd.extend([query, str(search_path)])`. ripgrep's
  `--pre=COMMAND` runs an arbitrary command per file. `--fixed-strings`/`-i` do not help — option
  parsing precedes pattern interpretation. The only input guard is `len(query) >= 2`.
- **Attack chain:** `GET /api/config` (discloses absolute `root_path`) → upload a script to root →
  `GET /api/files/search-content?query=--pre=/<root>/evil.sh&path=/` → ripgrep executes it.
- **Impact:** RCE as the server user — **root** in the Docker image (F3).
- **Proof:** Appendix B-1 — injected `--pre` command executed, wrote `RCE-EXECUTED uid=501`.
- **Fix:** `cmd.extend(['-e', query, '--', str(search_path)])` (pattern explicit + end-of-options).

### F2 — Human-in-the-loop approval bypass + unauthenticated mutating API · 🟠 High
- **File:** [`routers/agent.py:43-58`](backend/app/routers/agent.py:43) (`get_actor`), [`services/agent.py:854-871`](backend/app/services/agent.py:867) (`_validate_approval_actor`), [`_execute_proposal:916-945`](backend/app/services/agent.py:916)
- **Root cause:** `_validate_approval_actor` requires `actor.type == HUMAN` and `creator != approver`,
  but the actor is built **entirely from unauthenticated request headers** `X-FilaMama-Actor-*`. An
  attacker creates a proposal with one header set and approves it with another, executing
  `write_text/move/copy/rename/trash` with no real human.
- **Deeper issue (calibration):** the boundary is moot because the **mutating file API is itself
  unauthenticated** — `/api/files/move|copy|delete|rename`, `POST /api/files/text`, `/api/upload`,
  `/api/trash/*` have no per-actor authorization. An attacker need not use proposals at all. Whether
  this is Critical or just confirms "the API is fully trusted" depends on your deployment intent.
- **Impact:** the documented human-approval control provides no security; full filesystem mutation
  within root for any API client.
- **Fix:** authenticate actor identity (signed token / session), not headers; require real authz on
  mutating endpoints; never derive a trust decision from a client-set header.

### F3 — Insecure-by-default network exposure · 🟠 High
- **Files:** [`docker-compose.yml:4-13`](docker-compose.yml:12), [`Dockerfile:18-55`](Dockerfile:55), [`start.sh:10,49`](start.sh:49), [`main.py:35,80,173-177`](backend/app/main.py:173), `config*.yaml` (`host: 0.0.0.0`)
- **Root cause:** the startup guard refuses unauthenticated `0.0.0.0` startup **unless** `allow_insecure`.
  The shipped `docker compose up` quickstart sets `FILAMAMA_ALLOW_INSECURE=true` (l.12), publishes
  `1031:1031` on all interfaces, **mounts the host `$HOME` (`${BROWSE_PATH:-~/}:/browse`)**, and the
  image runs **as root** (no `USER`). `start.sh` sets `FILAMAMA_DEV=1` (→ `allow_insecure`) and binds
  `0.0.0.0` with root = `$HOME`. Result: an unauthenticated file manager over the whole home dir, as root.
- **Impact:** anyone on the network gets full read/write to the mounted tree; combined with F1 → RCE as root.
- **Fix:** drop `ALLOW_INSECURE` from the shipped compose; require auth (or bind `127.0.0.1` + reverse
  proxy w/ TLS); add a non-root `USER` to the image; don't default-mount `$HOME`.

### F4 — Stored XSS via file preview (sniffed Content-Type, no CSP/nosniff) · 🟠 High
- **File:** [`routers/files.py:324-330`](backend/app/routers/files.py:330) (`preview_file` → bare `FileResponse(file_path)`); main app sets no security headers ([`main.py:191-245`](backend/app/main.py:191))
- **Root cause:** `/api/files/preview?path=…` returns the file inline with a Content-Type derived from
  its extension and **no** `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, or CSP.
  A user-uploaded `.html` / `.svg` is rendered by the browser **in the app origin**, executing
  attacker JS that can call the API with the victim's Basic-Auth session.
- **Impact:** stored XSS in the application origin (the API and SPA are same-origin in production).
- **Fix:** serve previews with `Content-Disposition: attachment` or a sandboxed origin; always send
  `X-Content-Type-Options: nosniff`; add a restrictive CSP; force benign Content-Types for risky extensions.

### F5 — Thumbnail decode blocks the event loop + no decompression-bomb guard · 🟠 High
- **File:** [`services/thumbnails.py:52-86,117-135,167-178`](backend/app/services/thumbnails.py:117); route [`files.py:314-321`](backend/app/routers/files.py:314)
- **Root cause:** `_generate_image_thumbnail`/SVG/GIF/EPUB do **synchronous** Pillow/cairosvg work
  directly inside the `async` route (no `asyncio.to_thread`), so a single expensive decode **blocks the
  whole event loop**. `Image.MAX_IMAGE_PIXELS` is never set, so a crafted image near the default limit
  (or many concurrent requests) exhausts memory/CPU. No auth on the thumbnail route.
- **Impact:** trivial DoS of the entire server with one or a few crafted-image thumbnail requests.
- **Fix:** offload all CPU/decoding to `asyncio.to_thread`/a worker pool; set a strict
  `Image.MAX_IMAGE_PIXELS`; cap concurrency; validate dimensions before decode.

### F6 — `write_text` proposal overwrites arbitrary existing in-root files · 🟡 Medium*
- **File:** [`services/agent.py:924-930`](backend/app/services/agent.py:924) (contrast `_resolve_new_path:195-205`)
- **Root cause:** the `write_text` proposal branch uses `get_absolute_path(paths[0])` then `write_text`
  with **no existence check** (unlike artifact creation), so an approved proposal overwrites any
  existing in-root file (it cannot touch `.filamama`).
- **Calibration:** redundant with the unauthenticated mutating API (F2) which can already clobber files
  via move/copy; verifiers split High vs Low. Real defect, low marginal impact — **your triage call**.
- **Fix:** mirror `_resolve_new_path` (reject existing) or require explicit overwrite semantics + authz.

### F7 — Symlink dereference leaks out-of-root content · 🟡 Medium
- **Files:** [`filesystem.py:297-298`](backend/app/services/filesystem.py:298) (`copytree`, default `symlinks=False`); [`files.py:285-295`](backend/app/routers/files.py:295) (`download_zip` follows symlinked files); [`content_search.py:247-265`](backend/app/services/content_search.py:247) (python fallback walks symlinked dirs)
- **Root cause:** copy/zip/search dereference nested symlinks. An in-root symlink pointing **outside**
  root (e.g. `proj/etclink → /etc`) lets `copy` materialize `/etc` as **real in-root files** (then
  downloadable), `download-zip` include out-of-root bytes, and the search fallback read out-of-root text.
- **Precondition:** a pre-existing out-of-root symlink in the tree (no API symlink-creation primitive
  exists — verified). Plausible when `root_path` is a home dir / repo checkout.
- **Proof:** Appendix B-2 — copied out-of-root secret became a real in-root file.
- **Fix:** `copytree(..., symlinks=True)` + re-validate targets; in zip/search, skip symlinks whose
  resolved target escapes root.

### F8 — EPUB thumbnail: XML billion-laughs + unbounded zip decompression · 🟡 Medium
- **File:** [`services/thumbnails.py:180-261`](backend/app/services/thumbnails.py:180)
- **Root cause:** EPUB parsing uses stdlib `ET.fromstring` on attacker XML (entity expansion confirmed
  to occur — see note) and `epub.read(name)` decompresses attacker-controlled zip entries fully into
  memory before PIL decode. No size/ratio guard. Reached via the unauthenticated thumbnail route.
- **Verification:** `ET.fromstring` **expands internal entities** (orchestrator test: a 4-level bomb
  expanded fully) → billion-laughs memory/CPU DoS; zip-bomb entry → memory DoS.
- **Fix:** parse with `defusedxml`; enforce entry size and compression-ratio limits; offload to a thread.

### F9 — `/api/files/text` unbounded `max_size` → memory DoS · 🟡 Medium
- **File:** [`routers/files.py:333-348`](backend/app/routers/files.py:335) — `max_size: int = Query(10*1024*1024)` has **no `le=` bound**; `read_text` loads the whole file into memory synchronously.
- **Impact:** `?max_size=99999999999` on a large in-root file exhausts memory / blocks the loop.
- **Fix:** clamp `max_size` (`le=`), stream, and offload to a thread.

### F10 — Audio metadata extraction blocks the loop + loads full cover-art · 🟡 Medium
- **File:** [`services/audio.py:40-49,302-358`](backend/app/services/audio.py:302) — zero `asyncio.to_thread` (every sibling service uses it); mutagen parsing + full embedded cover-art / base64 lyrics load synchronously on the event loop. Unauthenticated routes.
- **Fix:** offload to a thread; cap cover-art/lyrics sizes.

### F11 — Service units lack hardening · 🟡 Medium (defense-in-depth)
- **Files:** [`templates/filamama.service.template:19-21`](templates/filamama.service.template:19), [`filamama-backend.service:15-17`](filamama-backend.service:15), [`filamama-frontend.service`](filamama-frontend.service)
- Both the template ([`filamama.service.template:20-21`](templates/filamama.service.template:20)) and the
  checked-in unit set only `NoNewPrivileges=true` + `PrivateTmp=true` and bind `--host 0.0.0.0`. They lack
  `ProtectSystem`/`ProtectHome`/`ReadWritePaths`/`CapabilityBoundingSet`/`SystemCallFilter`, so a compromised
  process (F1) can write the operator's entire `$HOME` and most of the system.
- **Fix:** add `ProtectSystem=strict`, `ProtectHome`, `ReadWritePaths=`, `PrivateTmp`, `NoNewPrivileges`,
  `CapabilityBoundingSet=`, `SystemCallFilter=`, ideally `DynamicUser`.

### F12 — Unauthenticated information disclosure · 🟢 Low
- **Files:** [`main.py:214-223`](backend/app/main.py:214) (`/api/config` → absolute `root_path`, mounts), [`system.py:66-137`](backend/app/routers/system.py:66) (`/api/system/info|status` → hostname, OS, CPU, disk).
- Recon aid (used by F1's chain). **Fix:** gate behind auth; return relative/minimal data.

### F13 — Credentialed CORS wildcard when `FILAMAMA_CORS_ORIGINS=*` · 🟢 Low
- **File:** [`main.py:74,180-197`](backend/app/main.py:180) — `*` + `allow_credentials=True`. Verified against installed Starlette: with `*` it reflects the request `Origin` and returns `Access-Control-Allow-Credentials: true`, enabling cross-site credentialed reads.
- **Precondition:** operator sets `=*`. **Fix:** reject `*` when credentials are enabled; use an explicit allowlist.

### F14 — Reserved-dir check skipped on mkdir/rename destination · 🟢 Low
- **File:** [`filesystem.py:240-249,266-277`](backend/app/services/filesystem.py:240) — `create_directory`/`rename` validate bounds but not `_ensure_not_reserved` on the **new** path, so a `.filamama`-named directory can be created nested in the tree (cannot clobber the real root `.filamama`, which already exists). **Fix:** apply `_ensure_not_reserved` to destinations too.

### F15 — Trash manifest is user-writable · 🟢 Low
- **File:** [`services/trash.py:29-43,156`](backend/app/services/trash.py:29) — `.deleted_items/.manifest.json` is not under the reserved `.filamama`, so it can be overwritten via upload; `restore()` consumes attacker-influenced `original_path` (still re-validated to stay in root). Integrity/robustness defect, no boundary break. **Fix:** move trash metadata under `.filamama` or validate/lock it.

### F16 — No upload file-count cap / no zip concurrency limit · 🟢 Low
- **Files:** [`routers/upload.py:78-160`](backend/app/routers/upload.py:100) (per-file cap only; unbounded count + deep `relative_paths` mkdir), [`files.py:262-311`](backend/app/routers/files.py:262) (`download-zip` up to 4 GB/temp, no global limit). Disk/inode exhaustion. **Fix:** cap file count & path depth; bound concurrent zips & temp usage.

### F17 — Unbounded agent inputs → DB/disk growth · 🟢 Low
- **File:** [`schemas.py:152-200`](backend/app/models/schemas.py:152), [`services/agent.py:289-342,660-683`](backend/app/services/agent.py:289) — note `body`, artifact `content`, `metadata` dict have no max length. **Fix:** add length caps.

### F18 — launchd logs to world-readable `/tmp` · 🟢 Low
- **File:** [`templates/com.filamama.plist.template:41-45`](templates/com.filamama.plist.template:41) — `StandardOutPath=/tmp/filamama.out.log` etc. Predictable, world-readable; may leak request paths. **Fix:** log to a user-private dir with restrictive perms.

### F19 — Frontend minor issues · 🟢 Low
- [`FileContextMenu.tsx:83`](frontend/src/components/FileContextMenu.tsx:83) — `window.open(\`/browse${file.path}\`)` interpolates an unencoded path (correctness/robustness; React escaping prevents XSS).
- [`PdfViewer.tsx:9-15`](frontend/src/components/PdfViewer.tsx:9) — PDF.js worker from `unpkg` CDN with no Subresource Integrity (supply-chain/availability). **Fix:** encode paths; self-host PDF.js or pin + SRI.

### F20 — Missing security headers & rate limiting · 🟢 Low (cross-cutting)
- No CSP / `X-Content-Type-Options` / `X-Frame-Options` / HSTS anywhere ([`main.py`](backend/app/main.py)); no rate limiting on any route. Amplifies F4 (XSS) and the DoS findings. **Fix:** add a security-headers middleware (esp. `nosniff` + CSP) and basic rate limiting.

---

## Appendix A — False positives (refuted candidates)

Each was refuted by an adversarial verifier that re-read the actual code; several match the orchestrator's
own cross-check.

1. **Classic `../` path traversal / symlink-out read** — blocked. `resolve_within_root` resolves then
   enforces `relative_to(root)`; `root_path` is pre-resolved. Proven in Appendix B-2.
2. **SVG thumbnail XXE / SSRF / local-file read via cairosvg** — refuted: installed **cairosvg 2.9.0**
   does not resolve dangerous external entities/URLs by default. (Recommend keeping SVG handling
   sandboxed as defense-in-depth regardless.)
3. **FFmpeg / ffprobe / `lscpu` command/argument injection** — none: arg-list `create_subprocess_exec`,
   inputs are absolute resolved paths (never leading-dash), fixed flags.
4. **Filesystem write/move before acquiring the write lock** (agent artifacts) — real structural detail,
   not exploitable (single-process asyncio; no concurrent-corruption path proven).
5. **Internal absolute paths leaked via exception messages** — refuted (×2): handled exceptions embed
   only attacker-supplied input, not resolved internal paths.
6. **Native installers expose `$HOME` on `0.0.0.0` with no auth** — refuted: the startup guard *blocks*
   unauthenticated `0.0.0.0` startup for native installs (the insecure path is docker-compose / dev only — F3).
7. **`curl|bash` VPS installer / piping remote scripts to root** — factually accurate but out of the API
   threat model (requires the admin to run the installer); noted as a supply-chain hardening recommendation
   (pin/verify checksums), not an app vulnerability.
8. **Implausible/unverifiable frontend dependency versions** — refuted (premise wrong); no fabricated CVEs.
9. **No catch-all error handler → 500 detail leakage** — refuted: messages don't expose internal state.

## Appendix B — Proofs of concept

Non-destructive, no network. Scripts in `/tmp/filamama_rg_poc/`.

### B-1 — F1 ripgrep RCE (`poc_rg_injection.py`)
Replicates the exact argv from `_search_ripgrep` with `query="--pre=<benign script>"` against real ripgrep 15.0.0:
```
simulated: GET /api/files/search-content?query=--pre=/tmp/filamama_rg_poc/evil_pre.sh&path=/
VERDICT: CONFIRMED: arbitrary command execution via injected --pre option.
Marker written by injected command: RCE-EXECUTED uid=501 arg=notes.txt
```

### B-2 — F7 copytree symlink escape + confinement check (`test_path_and_copytree.py`)
Exercises the real `resolve_within_root` and mirrors `FilesystemService.copy()`:
```
(A) '../../etc/passwd' blocked=True; 'sub/ok.txt' blocked=False; symlink->outside blocked  => confinement HOLDS
(B) ESCAPE CONFIRMED: out-of-root content copied INTO root ... contents: 'OUT-OF-ROOT SECRET DATA'
```

### B-3 — F8 XML billion-laughs via stdlib ElementTree (orchestrator check)
`xml.etree.ElementTree.fromstring` expanded a 4-level entity bomb fully (internal entities are expanded;
only *external* entities are blocked) → confirms the EPUB DoS vector.

---

## 4. Prioritized remediation

1. **F1** — add `--`/`-e` to the ripgrep argv (one-line fix, stops RCE). 🔴 do first.
2. **F3** — remove `ALLOW_INSECURE` from the shipped compose, add non-root `USER`, stop default-mounting `$HOME`.
3. **F2** — require real authn/authz on mutating endpoints; stop trusting `X-FilaMama-Actor-*` for decisions.
4. **F4 + F20** — `nosniff` + `Content-Disposition: attachment` on preview/download, add a CSP.
5. **F5/F8/F9/F10** — offload all decode/parse to threads, set `MAX_IMAGE_PIXELS`, bound sizes, use `defusedxml`.
6. **F7** — `symlinks=True` + bounds re-validation in copy/zip/search.
7. Remaining lows (F11–F19) as hardening.

---

## 5. Fix status (applied on this branch)

Code fixes were applied for the findings below and verified where possible (`backend/venv` is
missing deps, so the full test suite could not run; F1/F7 were proven against the patched real code,
F8's guard and the fixed ripgrep argv were proven by targeted tests; backend files pass `py_compile`).

| ID | Status | What changed |
|----|--------|--------------|
| F1 | ✅ Fixed + verified | `content_search.py`: `cmd.extend(['-e', query, '--', str(search_path)])` — PoC no longer executes the injected `--pre`. |
| F2 | ⚠️ Documented (no code) | Needs real actor authentication — architectural. No "security-theater" patch shipped. |
| F3 | ✅ Fixed (deploy) | `Dockerfile`: non-root `USER`. `docker-compose.yml`: `127.0.0.1` bind, `BROWSE_PATH` now **required** (no silent `$HOME` mount). Dev `start.sh` exposure documented only. |
| F4 | ✅ Fixed | `files.py preview_file`: active-content extensions served as `attachment` + `nosniff`; global security-headers middleware. |
| F5 | ✅ Fixed | `thumbnails.py`: `Image.MAX_IMAGE_PIXELS=40MP`; image/SVG/GIF/EPUB decode moved to `asyncio.to_thread`. |
| F6 | ⚠️ Subsumed by F2 | Exploitability is gated by the F2 approval bypass; no separate code change (avoids breaking the write_text feature). |
| F7 | ✅ Fixed + verified | `filesystem.copy` `copytree(symlinks=True)` + `copy2(follow_symlinks=False)`; `download_zip` and python search-fallback skip out-of-bounds symlinks. |
| F8 | ✅ Fixed + verified | `thumbnails.py`: reject `DOCTYPE`/`ENTITY` before XML parse; per-zip-entry size cap (25 MB). |
| F9 | ✅ Fixed | `files.py /text`: `max_size` bounded `le=50MB`; read offloaded to a thread. |
| F10 | ✅ Fixed | `files.py` audio metadata/cover/lyrics run via `asyncio.to_thread`. |
| F11 | ✅ Fixed | systemd unit + template: `ProtectSystem=full`, kernel/namespace/SUID restrictions added. |
| F12 | ⚠️ Documented (no code) | `/api/config` `root_path` is consumed by the frontend; gating it needs a product decision. |
| F13 | ✅ Fixed | `main.py`: a `*` CORS origin now forces `allow_credentials=False` (+ warning). |
| F14 | ✅ Fixed | `filesystem.py`: `_ensure_not_reserved` on `create_directory` / `rename` destinations. |
| F15 | ⚠️ Documented (no code) | Trash manifest relocation under `.filamama` deferred (low; in-root only). |
| F16 | ✅ Fixed | `upload.py`: max 1000 files/request, max path depth 50. |
| F17 | ✅ Fixed | `schemas.py`: `max_length` on agent note/content/metadata fields. |
| F18 | ✅ Fixed | launchd plist logs to the user-owned install dir, not world-readable `/tmp`. |
| F19 | ✅ Fixed (path) | shared `encodePathForUrl` used in `FileContextMenu`. PDF.js CDN/SRI left as a documented follow-up. |
| F20 | ✅ Fixed (headers) | `SecurityHeadersMiddleware` (nosniff / X-Frame-Options / Referrer-Policy). Global CSP deferred (SPA-compatibility risk). |

**Not code-fixed (need a decision):** F2 (authentication model), F6 (rides on F2), F12 (config disclosure vs
frontend dependency), F15 (trash manifest), plus partials: F3 dev launcher, F19 PDF.js self-hosting, F20 CSP.

**Known duplication spotted:** `encodePathForUrl` is still defined locally in
`useFileNavigation.ts`, `AgentInboxPage.tsx`, `PreviewPage.tsx` — they should be migrated to the new
shared `@/lib/utils` export.
