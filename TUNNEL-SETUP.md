# Permanent tunnel with Tailscale Funnel

Replaces the cloudflared quick tunnel, whose URL changes on every restart and
forces a Vercel redeploy each time. Tailscale Funnel gives a fixed hostname on
`ts.net`, free, with no domain to buy.

Nothing in the app changes. Funnel points at Caddy on 8189 exactly like
cloudflared did, Caddy still checks the Bearer key, and the path allowlist still
applies. Only the value of `COMFY_URL` changes — once, permanently.

```
browser → generati.vercel.app → /api/generate-image (server)
                                      ↓ Bearer key
        Tailscale Funnel :443 → Caddy :8189 → ComfyUI :8188 → RTX 4050
```

---

## 1. Install Tailscale

```powershell
winget install Tailscale.Tailscale
```

If winget doesn't find it, use the installer from `tailscale.com/download/windows`.
Open a new terminal afterwards so `tailscale` is on `PATH`.

```powershell
tailscale up
```

This opens a browser to sign in.

> **Which account to sign in with.** Signing up with `r.chakhunashvili@skillwill.edu.ge`
> may place you in a tailnet shared with other people on that domain. Check the
> Users page in the admin console after signing in; if you'd rather not think
> about it, use a personal Google account instead. Either way this does not
> affect who can reach your GPU — the Bearer key does that — only who can see
> the tailnet.

## 2. Enable MagicDNS and HTTPS certificates

Both are required before Funnel will work. In the Tailscale admin console:

- **DNS** → enable **MagicDNS**
- **DNS** → enable **HTTPS Certificates**

## 3. Start the funnel

```powershell
tailscale funnel --bg 8189
```

Port **8189**, not 8188. 8189 is Caddy, which checks the key. Pointing Funnel at
8188 would put ComfyUI on the open internet with no authentication at all.

`--bg` runs it in the background and persists it, so it survives reboots once
the Tailscale service starts. Without `--bg` it runs in the foreground and dies
with the terminal, which is the thing we're trying to get away from.

The first run may print a link to enable Funnel for your tailnet — open it,
approve, and run the command again.

```powershell
tailscale funnel status
```

Prints your permanent URL, of the form:

```
https://asus-tuf-fx607vu.<your-tailnet>.ts.net
```

To stop it later: `tailscale funnel --bg off`

## 4. Verify before touching Vercel

```powershell
# expect 401 — Caddy rejecting an unauthenticated request through the funnel
curl.exe -s -o NUL -w "%{http_code}`n" https://<your-url>.ts.net/system_stats

# expect 200 and a JSON blob
curl.exe -s -H "Authorization: Bearer <key from C:\comfy-proxy\Caddyfile>" https://<your-url>.ts.net/system_stats
```

401 then 200 means the whole chain is good. If both are 401, the key in the
header doesn't match the Caddyfile. If both fail to connect, ComfyUI or Caddy
isn't running.

## 5. Set the Vercel environment variables

Project **generati** → Settings → Environment Variables:

| Name | Value |
|---|---|
| `COMFY_URL` | `https://asus-tuf-fx607vu.<tailnet>.ts.net` — no trailing slash |
| `COMFY_API_KEY` | the key from `C:\comfy-proxy\Caddyfile` |
| `ADMIN_EMAILS` | `r.chakhunashvili@skillwill.edu.ge` |

`ADMIN_EMAILS` is what makes the app yours alone. `lib/auth.js` blocks anyone
not on that list from signing in at all, and `requireAdmin()` refuses to
generate when the list is empty rather than defaulting open — so if you forget
it, the feature switches itself off instead of handing your GPU to the internet.

Then **Deployments → Redeploy**. Vercel only picks up environment variable
changes on a new deployment.

This is the last time you set `COMFY_URL`.

---

## What still needs doing

Tailscale installs itself as a Windows service, so the tunnel now starts on boot
and restarts itself. ComfyUI and Caddy don't — they're still terminal windows.
[NSSM](https://nssm.cc/) wraps them:

```powershell
nssm install ComfyUI "C:\Users\User\Desktop\AI\ComfyUI_windows_portable\run_nvidia_gpu.bat"
nssm set ComfyUI AppDirectory "C:\Users\User\Desktop\AI\ComfyUI_windows_portable"
nssm set ComfyUI Start SERVICE_AUTO_START

nssm install Caddy "C:\path\to\caddy.exe" run
nssm set Caddy AppDirectory "C:\comfy-proxy"
nssm set Caddy Start SERVICE_AUTO_START
```

A service runs headless, so confirm the GPU works without an interactive
session before relying on it.

## The limit no tunnel removes

Generation needs this laptop awake, online, and running all three pieces. Asleep
or shut down, the button returns the 503 your code already handles:

> The image service is unreachable. Check that ComfyUI, Caddy and cloudflared
> are running…

That's inherent to keeping the GPU at home, and it's the one thing a permanent
URL doesn't fix. Worth updating that message to say Tailscale rather than
cloudflared once you've switched.

Also worth closing whatever is holding ~3.5 GB of VRAM — ComfyUI's own torch
allocation was only 0.03 GB while 3.5 GB of the 6 GB was gone, which is why the
first render is slow.
