# Custom Domain Setup (production-only)

Custom-domain whitelabeling is shipped in code but **disabled by default** via the
`ENABLE_CUSTOM_DOMAINS` env var. This document is for the production ops team —
local dev keeps slug-based URLs.

## Environment

Set these on the production app container:

```
ENABLE_CUSTOM_DOMAINS=true
PLATFORM_DOMAINS=hackathon.teamleaseedtech.com     # comma-separated list of apex hosts
PLATFORM_CANONICAL_HOST=hackathon.teamleaseedtech.com  # shown to customers in DNS instructions
```

## Reverse-proxy config

Pick one. In all cases the proxy needs to (a) terminate TLS for arbitrary custom
domains and (b) forward the original `Host` header to the Next.js app.

### Option A — Caddy with on-demand TLS (simplest)

```
{
  on_demand_tls {
    ask https://app.internal:3000/api/tls-ask
    interval 2m
    burst 10
  }
}

hackathon.teamleaseedtech.com {
  reverse_proxy app.internal:3000
}

# Catch-all for verified custom domains. Caddy will hit /api/tls-ask before
# issuing a cert; a 200 means "yes issue it".
:443 {
  tls {
    on_demand
  }
  reverse_proxy app.internal:3000
}
```

### Option B — Cloudflare for SaaS

Add your apex as a SaaS zone. In the fallback origin rule, set the origin to
`hackathon.teamleaseedtech.com`. Use the `Custom Hostnames` API to register each
customer domain. Cloudflare handles issuance; no `/api/tls-ask` hook needed
(but the endpoint remains useful for dashboarding).

### Option C — Nginx with certbot (manual)

For each new domain: run `certbot --nginx -d customer.domain.com` after DNS is
pointed, add a `server` block that `proxy_pass`es to the app. Non-automatic.

## Admin workflow

1. Customer contest admin requests their domain (via support).
2. Platform admin:
   ```
   POST /api/platform/contests/<slug>/domain
   { "domain": "ai.customer.edu" }
   ```
   Response includes DNS instructions.
3. Customer creates `CNAME ai.customer.edu -> hackathon.teamleaseedtech.com`.
4. Customer hits `https://ai.customer.edu/.well-known/contest-verify` after DNS
   resolves — this flips `customDomainVerifiedAt` and the tenant resolver
   starts honoring the host.
5. From that moment, the proxy can issue TLS (Caddy on-demand) and traffic to
   `https://ai.customer.edu/*` is internally rewritten to `/c/<slug>/*`.

## Testing on localhost

Set `ENABLE_CUSTOM_DOMAINS=true` in `.env` and add an entry to `/etc/hosts`:

```
127.0.0.1   ai.testcontest.local
```

Then add a row via `POST /api/platform/contests/innovation-challenge/domain`
with `{ "domain": "ai.testcontest.local" }` and hit
`http://ai.testcontest.local:3000/.well-known/contest-verify` once to verify.
