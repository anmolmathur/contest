# Custom Domain Setup (one contest per domain)

Custom-domain whitelabeling is shipped in code but **disabled by default** via the
`ENABLE_CUSTOM_DOMAINS` env var. This document is for the production ops team —
local dev keeps slug-based URLs.

## Environment

Set these on the production app container:

```
ENABLE_CUSTOM_DOMAINS=true
PLATFORM_DOMAINS=hackathon.teamleaseedtech.com     # comma-separated list of apex hosts
PLATFORM_CANONICAL_HOST=hackathon.teamleaseedtech.com  # shown to customers in DNS instructions + used for email links
```

**Do not set `NEXTAUTH_URL` / `AUTH_URL`** when custom domains are on. Auth.js
runs with `trustHost`, so each request's own host (platform domain or a
contest's custom domain) is used for sign-in callbacks and the session cookie.
A fixed `NEXTAUTH_URL` would send every custom-domain login back to the
platform host, and the user would appear logged out on their contest domain.

## What a contest gets on its own domain

A verified domain serves the **whole application for that one contest** —
suitable for handing a contest to a third party:

- `/`, `/rules`, `/agenda`, `/results`, `/dashboard`, `/judging`, `/admin`, … are
  rewritten internally to `/c/<slug>/…` (auth still applies to the rewritten path).
- `/login`, `/register`, `/forgot-password`, `/reset-password` work on that host;
  after sign-in users land on that contest (`/post-login`).
- `GET /api/contests` on that host lists only that contest.
- Password-reset emails link back to the host the user requested them from;
  notification emails use the contest's verified domain.
- Sessions are per host: a user signs in separately on each domain.
- Platform admins can still administer every contest from the platform domain.

## Google sign-in on custom domains

Google SSO (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`) needs one Authorized
redirect URI per host in the Google Cloud OAuth client:

```
https://hackathon.teamleaseedtech.com/api/auth/callback/google
https://<each-custom-domain>/api/auth/callback/google
```

Add the custom domain's URI **before** telling the third party to use Google
sign-in, otherwise Google shows `redirect_uri_mismatch`. Email + password
sign-in works without any Google configuration.

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

Set `ENABLE_CUSTOM_DOMAINS=true` in `.env`. Use a `*.localtest.me` host — it
resolves to 127.0.0.1 without editing `/etc/hosts` (note: `localhost` and
`*.local` are deliberately never treated as custom domains):

Add a row via `POST /api/platform/contests/<slug>/domain` with
`{ "domain": "symposium.localtest.me" }` (or the Custom domain card in the
contest admin Settings tab) and open
`http://symposium.localtest.me:3000/.well-known/contest-verify` once to verify.
Verification only trusts the Host header the request arrived on.
