# UnNag

**End nagging. Send household tasks anytime — your partner only gets them during quiet windows.**

Product name: **UnNag** · Deploy target: `https://household-vault.vercel.app`  
Stack: **Next.js App Router + Supabase + PWA** · Cost target: **$0** (Supabase free + Vercel Hobby)

---

### Scan to install

Scan this QR with your phone camera to open the vault PWA (`/vault`), then **Add to Home Screen**:

![Scan to Install](https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://household-vault.vercel.app/vault)

*(After your first Vercel deploy, replace the URL above with your live domain if it differs.)*

---

## Architecture (single repo)

```
Desktop visitor  →  /           Landing (pitch, pricing, partner QR)
Mobile QR target →  /vault      PWA: inbox, call overlay, 5s voice, invite
                    /settings   Morning / evening quiet windows
                    /api/queue-cron   Triggers Supabase task-engine
```

```
household-vault/   (this repo — also fine as local folder drop-vault)
├── public/
│   ├── manifest.json      # standalone PWA
│   ├── sw.js              # Web Push + offline shell
│   └── icons/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Landing
│   │   ├── vault/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/queue-cron/route.ts
│   ├── components/
│   │   ├── CallOverlayModal.tsx
│   │   ├── VoiceRecorder.tsx        # hard max 5s
│   │   ├── PartnerInvite.tsx        # 6-char code
│   │   └── VaultApp.tsx
│   └── lib/
└── supabase/
    ├── migrations/…_init_schema.sql
    └── functions/task-engine/       # release + escalate + web push
```

---

## User journey

1. **Desktop `/`** — mental-load pitch + QR: “Scan with your phone, then send the link code to your partner.”
2. **Phone `/vault`** — install banner → Add to Home Screen → sign up → partner code → set windows → record a ≤5s drop.
3. Outside their window → task stays **queued**. When the window opens (or urgent) → Web Push → **Incoming Drop** overlay.

Voice rule: soft cue at **3s**, hard stop at **5s**. Style: *“Liam to school at 5.”*

---

## $0 deploy checklist (GitHub → Vercel → Supabase)

### 1. Create the GitHub repo

```bash
# From this folder (or rename locally to household-vault)
git remote add origin https://github.com/YOUR_USER/household-vault.git
git add .
git commit -m "Initial UnNag Next.js PWA"
git push -u origin main
```

*(Optional second product repo `should-i-though` is separate — not required for UnNag.)*

### 2. Supabase (free)

1. Create project at [supabase.com](https://supabase.com)
2. **SQL Editor** → run `supabase/migrations/20241022000001_init_schema.sql`
3. Auth → Email enabled (disable confirm email for testing)
4. Copy **Project URL**, **anon key**, **service_role** key

### 3. VAPID keys (Web Push)

```bash
npx web-push generate-vapid-keys
```

### 4. Deploy Edge Function

```bash
npx supabase login
npx supabase link --project-ref YOUR_REF
npx supabase secrets set \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:you@example.com"
npx supabase functions deploy task-engine --no-verify-jwt
```

Prefer **Supabase pg_cron every minute** for window delivery (Vercel Hobby cron is limited to ~daily):

```sql
-- After enabling pg_cron + pg_net
select cron.schedule(
  'unnag-task-engine',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_REF.supabase.co/functions/v1/task-engine',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 5. Deploy to Vercel (free)

1. [vercel.com](https://vercel.com) → **Add New Project** → import `household-vault`
2. Framework: **Next.js** (auto-detected)
3. Environment variables:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `NEXT_PUBLIC_APP_URL` | `https://household-vault.vercel.app` (or your URL) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (server only) |
| `CRON_SECRET` | random string |

4. Deploy → live HTTPS URL
5. Optional: Project → Domains → set `household-vault.vercel.app`

`vercel.json` also hits `/api/queue-cron` on a schedule; that route forwards to the Edge Function. Use Supabase cron for *minute* cadence on the free plan.

### 6. Update the QR

After you know the final URL, refresh the README / landing QR (`LandingQr` uses `NEXT_PUBLIC_APP_URL`).

Markdown image:

```md
![Scan to Install](https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://YOUR-APP.vercel.app/vault)
```

---

## Local development

```bash
cp .env.example .env.local
# fill NEXT_PUBLIC_* keys
npm install
npm run dev
```

- Landing: [http://localhost:3000](http://localhost:3000)  
- Vault: [http://localhost:3000/vault](http://localhost:3000/vault)  
- Settings: [http://localhost:3000/settings](http://localhost:3000/settings)

---

## Escalation (Edge Function)

| When | Level | UX |
|---|---|---|
| Delivery | 1 | Vault / quiet notification |
| +15 min unacked | 2 | Call-style overlay push |
| +30 min + urgent | 3 | High-priority / renotify push |

---

## License

Private / your product. Built to ship on free tiers without App Store fees.
