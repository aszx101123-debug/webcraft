# WebCraft Phase 3 — account and server setup

Status: **code deployed to GitHub; backend not provisioned or connected**. Phase 1/2 demos remain separate and are NOT real balances. No real payment service is enabled.

## Setup (site owner only)

1. Create your own Supabase project. In its SQL Editor run [supabase/webcraft-phase3.sql](../supabase/webcraft-phase3.sql).
2. In Supabase Authentication enable **Email** sign-in and configure your site's redirect URL: `https://aszx101123-debug.github.io/webcraft/`. Configure rate limits and anti-abuse settings appropriate for a publicly accessible app. Review email delivery requirements before inviting users.
3. Copy your project URL and **publishable/anon** key to `js/wc-backend-config.js`. These values may be public. **Never** commit a Supabase secret or service_role key.
4. Sign in to WebCraft once. Find that account's user ID in Supabase Authentication > Users.
5. To authorize the site owner as a moderator, run this **only in your SQL Editor** (never expose it in frontend JavaScript):
   ```sql
   insert into public.wc_admins(user_id) values ('YOUR_AUTH_USER_UUID');
   ```
6. Test with two separate accounts. Check that neither can edit their wallet, the ledger, or proposal statuses. Check admin can review and non-admin cannot. Test repeated same-day check-ins and timezone changes.

## Behavior and boundaries

- Authenticated users can check in once per **Asia/Seoul calendar day**. The database assigns 10 FC atomically. This **does not** convert local browser-demo FC to server FC.
- Authenticated users can submit proposals to a shared list. All signed-in users can view these proposals and their review status. Do **not** put personal information in a proposal.
- A designated moderator can record decisions and reasons (reviewing / accepted / on hold / rejected).
- Phase 2 mock-PC top-ups, mock refunds, and mock review tokens stay entirely in browser localStorage. They cannot purchase anything and do not grant server privileges.
- No money, payment credentials, refunds, or premium entitlement is implemented. A real payment system requires an independently audited server-side payment flow, legal/compliance review, terms, refund policy, and parental/guardian considerations for minors.
- GitHub Pages is static hosting. Backend functionality stays unavailable until you provision and configure Supabase. Do not put service keys in the client.

## Maintenance and security

- Test RLS and function execute privileges on every migration. Keep the SQL file in version control, but keep credentials outside git.
- Review database usage, Supabase limits, moderation, spam protections, user data retention/deletion policies, and error logging before calling it production-ready.
- Server suggestions do not automatically become GitHub Issues. Old GitHub issue submission remains available as an independent, separate flow.
