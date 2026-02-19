# Invite Email Template (Supabase)

So invite links go to our **Accept invite** page and work when the user clicks, do this in Supabase:

## 1. URL configuration

In **Authentication → URL Configuration**:

- **Site URL:** `https://coast-metering.vercel.app` (no trailing slash)
- **Redirect URLs:** include:
  - `https://coast-metering.vercel.app/auth/accept-invite`
  - `https://coast-metering.vercel.app/auth/set-password`
  - `https://coast-metering.vercel.app/auth/confirm`
  - `https://coast-metering.vercel.app/auth/callback`

## 2. Invite user email template

In **Authentication → Email Templates**, open **Invite user** and replace the body so the main link goes to our accept-invite page (not Supabase’s default link).

**Subject** (optional, you can keep the default):

```
You've been invited to Coast Metering
```

**Body** (use this so the link points to our app):

```html
<h2>You've been invited</h2>

<p>You've been invited to create an account on Coast Metering.</p>

<p>Click the link below to go to our site and accept the invite. You'll then set a password to finish setting up your account.</p>

<p><a href="{{ .SiteURL }}/auth/accept-invite?token_hash={{ .TokenHash }}&type=invite">Accept invite</a></p>

<p>If you didn't expect this email, you can ignore it.</p>
```

Important: the link must be exactly:

`{{ .SiteURL }}/auth/accept-invite?token_hash={{ .TokenHash }}&type=invite`

So that:

- The email sends the user to **our** page (`/auth/accept-invite`).
- The token is only used when they click **“Accept invite”** on that page, which avoids “link already used” from email prefetching.

Save the template. New invites will use this link.
