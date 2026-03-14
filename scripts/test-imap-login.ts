/**
 * Test Gmail IMAP login locally. Use this to verify your App Password works
 * before relying on Vercel.
 *
 * 1. Put in .env (or export):
 *    ESCONDIDO_IMAP_HOST=imap.gmail.com
 *    ESCONDIDO_IMAP_USER=your@gmail.com
 *    ESCONDIDO_IMAP_PASSWORD=your-16-char-app-password-no-spaces
 *
 * 2. Run: npx tsx scripts/test-imap-login.ts
 *
 * If you see "IMAP login OK", the credentials work. If you see
 * AUTHENTICATIONFAILED, the App Password or account is wrong (or use
 * 2-Step Verification + App Password, not your normal password).
 */
import "dotenv/config"
import { ImapFlow } from "imapflow"

const host = process.env.ESCONDIDO_IMAP_HOST?.trim() ?? "imap.gmail.com"
const user = process.env.ESCONDIDO_IMAP_USER?.trim()
const pass = process.env.ESCONDIDO_IMAP_PASSWORD?.trim()

if (!user || !pass) {
  console.error("Set ESCONDIDO_IMAP_USER and ESCONDIDO_IMAP_PASSWORD in .env")
  process.exit(1)
}

console.log("Connecting to", host, "as", user, "... (password length:", pass.length, ")")
if (pass.length !== 16) {
  console.warn("Warning: Gmail App Passwords are usually 16 characters. Yours is", pass.length)
}

const client = new ImapFlow({
  host,
  port: 993,
  secure: true,
  auth: { user, pass },
})

client
  .connect()
  .then(() => {
    console.log("IMAP login OK")
    return client.logout()
  })
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error("IMAP login failed:", err.message)
    if (err.message.includes("AUTHENTICATIONFAILED") || (err as { authenticationFailed?: boolean }).authenticationFailed) {
      console.error("\n→ Use a Gmail App Password (Google Account → Security → App passwords), not your normal password.")
      console.error("→ Ensure 2-Step Verification is ON for that account.")
      console.error("→ Paste the 16-character App Password with no spaces.")
    }
    process.exit(1)
  })
