/**
 * Escondido Water (Invoice Cloud) bill fetcher.
 * Logs into https://www.invoicecloud.com/escondidoca, scrapes the bill list,
 * and inserts new bills into utility_provider_bills.
 *
 * Run: npx tsx scripts/fetch-escondido-bills.ts
 * Watch locally: ESCONDIDO_WATCH=1 npm run fetch-escondido-bills
 *
 * Required env (or in .env):
 *   ESCONDIDO_LOGIN_EMAIL, ESCONDIDO_LOGIN_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional (recommended in CI for reCAPTCHA):
 *   ESCONDIDO_2CAPTCHA_API_KEY — 2Captcha API key from https://2captcha.com/enterpage.
 *   When set, reCAPTCHA on the login page is solved via 2Captcha (createTask → getTaskResult)
 *   and the token is injected before submit. See https://2captcha.com/api-docs/quick-start
 *   and https://2captcha.com/api-docs/recaptcha-v2 (and recaptcha-v2-enterprise if needed).
 *
 * Optional (generic proxy for Playwright): ESCONDIDO_PROXY_SERVER, ESCONDIDO_PROXY_USERNAME, ESCONDIDO_PROXY_PASSWORD
 */
import "dotenv/config"

import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const PORTAL_URL = "https://www.invoicecloud.com/escondidoca"
const UTILITY_KEY = "escondido_water"

type FetchedBill = {
  accountNumber: string
  periodStart: string
  periodEnd: string
  amountDue: number
  dueDate: string | null
  externalId: string | null
  pdfUrl: string | null
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

async function getPropertyAccountMapping(supabase: any) {
  const { data, error } = await supabase
    .from("property_utility_accounts")
    .select("property_id, account_number")
    .eq("utility_key", UTILITY_KEY)
  if (error) throw new Error(`Failed to load property_utility_accounts: ${error.message}`)
  const map = new Map<string, string>()
  const rows = (data || []) as { property_id: string; account_number: string }[]
  for (const row of rows) {
    map.set(String(row.account_number).trim(), row.property_id)
  }
  if (map.size === 0) {
    const fallback = process.env.ESCONDIDO_PROPERTY_ACCOUNTS
    if (fallback) {
      try {
        const parsed = JSON.parse(fallback) as Record<string, string>
        for (const [account, propertyId] of Object.entries(parsed)) {
          map.set(String(account).trim(), propertyId)
        }
      } catch {
        console.warn("ESCONDIDO_PROPERTY_ACCOUNTS is not valid JSON, ignoring")
      }
    }
  }
  return map
}

function normalizeDate(s: string): string {
  const parts = s.replace(/\//g, "-").split("-")
  if (parts.length !== 3) return s
  const [a, b, c] = parts
  const year = c!.length === 2 ? `20${c}` : c
  const month = a!.length === 1 ? `0${a}` : a
  const day = b!.length === 1 ? `0${b}` : b
  return `${year}-${month}-${day}`
}

const log = (msg: string) => console.log(`[Escondido] ${msg}`)

const TWOCAPTCHA_CREATE = "https://api.2captcha.com/createTask"
const TWOCAPTCHA_RESULT = "https://api.2captcha.com/getTaskResult"

/** Get reCAPTCHA v2 params only (div with data-sitekey, no data-action). */
async function getRecaptchaV2Params(
  frame: import("playwright").Frame
): Promise<{ siteKey: string } | null> {
  return frame.evaluate(() => {
    const withKey = document.querySelector("[data-sitekey]") as HTMLElement | null
    if (!withKey) return null
    const key = withKey.getAttribute("data-sitekey")
    const action = withKey.getAttribute("data-action")
    if (key && !action) return { siteKey: key }
    return null
  })
}

type RecaptchaV2Params = {
  siteKey: string
  apiDomain?: "recaptcha.net" | "google.com"
  isEnterprise?: boolean
}

/**
 * Lenient v2 site key + apiDomain for when checkbox challenge is shown.
 * Prefers the visible widget key (iframe with size=normal) when the page has both invisible and checkbox.
 * Detects Enterprise (recaptcha/enterprise) so we can use 2Captcha Enterprise API.
 */
async function getRecaptchaV2ParamsLenient(
  frame: import("playwright").Frame
): Promise<RecaptchaV2Params | null> {
  const result = await frame.evaluate((): RecaptchaV2Params | null => {
    let siteKey: string | null = null
    let useRecaptchaNet = false
    let enterprise = false
    // Prefer key from visible checkbox iframe (size=normal); Invoice Cloud loads both invisible + normal
    for (const iframe of Array.from(document.querySelectorAll("iframe[src*='recaptcha']"))) {
      const src = iframe.getAttribute("src") || ""
      if (src.includes("recaptcha.net")) useRecaptchaNet = true
      if (src.includes("enterprise")) enterprise = true
      if (src.includes("size=normal")) {
        const k = src.match(/[\?&]k=([^&]+)/)
        if (k) return { siteKey: k[1]!, apiDomain: useRecaptchaNet ? "recaptcha.net" : "google.com", isEnterprise: enterprise }
      }
    }
    const withKey = document.querySelector("[data-sitekey]") as HTMLElement | null
    if (withKey) {
      siteKey = withKey.getAttribute("data-sitekey")
      for (const s of Array.from(document.scripts)) {
        if ((s.getAttribute("src") || "").includes("enterprise")) enterprise = true
      }
      if (siteKey) return { siteKey, apiDomain: useRecaptchaNet ? "recaptcha.net" : "google.com", isEnterprise: enterprise }
    }
    for (const iframe of Array.from(document.querySelectorAll("iframe[src*='recaptcha']"))) {
      const src = iframe.getAttribute("src") || ""
      if (src.includes("recaptcha.net")) useRecaptchaNet = true
      if (src.includes("enterprise")) enterprise = true
      const k = src.match(/[\?&]k=([^&]+)/)
      if (k) {
        siteKey = k[1]!
        break
      }
    }
    if (!siteKey) {
      for (const s of Array.from(document.scripts)) {
        const src = s.getAttribute("src") || ""
        if (!/recaptcha|google\.com|recaptcha\.net/i.test(src)) continue
        if (src.includes("recaptcha.net")) useRecaptchaNet = true
        if (src.includes("enterprise")) enterprise = true
        const k = src.match(/[\?&]k=([^&]+)/)
        if (k) {
          siteKey = k[1]!
          break
        }
        const render = src.match(/[\?&]render=([^&]+)/)
        if (render) {
          siteKey = render[1]!
          break
        }
      }
    }
    if (!siteKey) {
      const html = document.documentElement.outerHTML
      const longKey = html.match(/['"]?(6L[\w\-]{20,})['"]?/)
      if (longKey) siteKey = longKey[1]!
    }
    if (!siteKey) return null
    return { siteKey, apiDomain: useRecaptchaNet ? "recaptcha.net" : "google.com", isEnterprise: enterprise }
  })
  return result
}

/** Get reCAPTCHA v3 params only (script render= or div with data-action). */
async function getRecaptchaV3Params(
  frame: import("playwright").Frame
): Promise<{ siteKey: string; action?: string } | null> {
  return frame.evaluate(() => {
    const withKey = document.querySelector("[data-sitekey]") as HTMLElement | null
    if (withKey) {
      const key = withKey.getAttribute("data-sitekey")
      const action = withKey.getAttribute("data-action") ?? undefined
      if (key && action) return { siteKey: key, action }
    }
    for (const s of Array.from(document.scripts)) {
      const src = s.getAttribute("src") || ""
      const render = src.match(/[\?&]render=([^&]+)/)
      if (render) return { siteKey: render[1]!, action: undefined }
    }
    return null
  })
}

/** Get first available recaptcha params (v2 preferred) for retry/checkbox path. */
async function getRecaptchaParams(
  frame: import("playwright").Frame
): Promise<{ siteKey: string; action?: string; version: "v2" | "v3" } | null> {
  const v2 = await getRecaptchaV2Params(frame)
  if (v2) return { ...v2, version: "v2" }
  const v3 = await getRecaptchaV3Params(frame)
  if (v3) return { ...v3, version: "v3" }
  return null
}

/**
 * Solve reCAPTCHA v2 (checkbox + image challenge) using 2Captcha API v2.
 * Workflow: createTask → wait 15s (per 2Captcha limits for reCAPTCHA) → getTaskResult every 5s until ready.
 * @see https://2captcha.com/api-docs/recaptcha-v2
 * @see https://2captcha.com/api-docs/limits (wait 10-20s for recaptcha before first getTaskResult)
 */
async function solveRecaptchaV2With2Captcha(
  apiKey: string,
  pageUrl: string,
  siteKey: string,
  isInvisible = false,
  userAgent?: string,
  apiDomain?: "google.com" | "recaptcha.net"
): Promise<string | null> {
  const task: Record<string, unknown> = {
    type: "RecaptchaV2TaskProxyless",
    websiteURL: pageUrl,
    websiteKey: siteKey,
    isInvisible: !!isInvisible,
  }
  if (userAgent) task.userAgent = userAgent
  if (apiDomain) task.apiDomain = apiDomain
  const createRes = await fetch(TWOCAPTCHA_CREATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientKey: apiKey, task }),
  })
  const createJson = (await createRes.json()) as { errorId?: number; taskId?: number; errorCode?: string; errorDescription?: string }
  if (createJson.errorId !== 0 || createJson.taskId == null) {
    log(`2Captcha createTask failed: errorId=${createJson.errorId} ${createJson.errorCode ?? ""} ${createJson.errorDescription ?? ""}`)
    if (createJson.errorId === 1) log("Check ESCONDIDO_2CAPTCHA_API_KEY (copy from https://2captcha.com/enterpage, no spaces/newlines).")
    if (createJson.errorId === 10) log("2Captcha balance is zero; add funds at https://2captcha.com/enterpage.")
    if (createJson.errorId === 5) log("websiteURL missing or invalid; ensure page URL is passed to solver.")
    if (createJson.errorId === 31) log("Invalid reCAPTCHA sitekey; check the page uses a valid data-sitekey.")
    return null
  }
  const taskId = createJson.taskId
  // Per 2Captcha limits: wait 10-20s for reCAPTCHA before first getTaskResult (avg solve ~30s)
  const INITIAL_WAIT_MS = 20000
  await new Promise((r) => setTimeout(r, INITIAL_WAIT_MS))
  const maxPolls = 40
  for (let i = 0; i < maxPolls; i++) {
    const resultRes = await fetch(TWOCAPTCHA_RESULT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    })
    const resultJson = (await resultRes.json()) as {
      errorId?: number
      status?: string
      solution?: { gRecaptchaResponse?: string; token?: string }
      errorCode?: string
      errorDescription?: string
    }
    if (resultJson.status === "ready" && resultJson.solution) {
      const token = resultJson.solution.gRecaptchaResponse ?? resultJson.solution.token
      if (token) {
        log(`2Captcha v2 solved (poll ${i + 1}).`)
        return token
      }
    }
    if (resultJson.errorId !== 0) {
      log(`2Captcha getTaskResult error: errorId=${resultJson.errorId} ${resultJson.errorCode ?? ""} ${resultJson.errorDescription ?? ""}`)
      if (resultJson.errorId === 12) log("Captcha unsolvable; workers could not solve it (no charge).")
      return null
    }
    if (resultJson.status === "processing") {
      await new Promise((r) => setTimeout(r, 5000))
      continue
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  log("2Captcha v2 timed out waiting for solution.")
  return null
}

/**
 * Solve reCAPTCHA v2 Enterprise using 2Captcha API.
 * Same timing as v2: 15s after createTask, then getTaskResult every 5s.
 * @see https://2captcha.com/api-docs/recaptcha-v2-enterprise
 */
async function solveRecaptchaV2EnterpriseWith2Captcha(
  apiKey: string,
  pageUrl: string,
  siteKey: string,
  isInvisible = false,
  userAgent?: string,
  apiDomain?: "google.com" | "recaptcha.net"
): Promise<string | null> {
  const task: Record<string, unknown> = {
    type: "RecaptchaV2EnterpriseTaskProxyless",
    websiteURL: pageUrl,
    websiteKey: siteKey,
    isInvisible: !!isInvisible,
  }
  if (userAgent) task.userAgent = userAgent
  if (apiDomain) task.apiDomain = apiDomain
  const createRes = await fetch(TWOCAPTCHA_CREATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientKey: apiKey, task }),
  })
  const createJson = (await createRes.json()) as { errorId?: number; taskId?: number; errorCode?: string; errorDescription?: string }
  if (createJson.errorId !== 0 || createJson.taskId == null) {
    log(`2Captcha Enterprise createTask failed: errorId=${createJson.errorId} ${createJson.errorCode ?? ""} ${createJson.errorDescription ?? ""}`)
    return null
  }
  const taskId = createJson.taskId
  await new Promise((r) => setTimeout(r, 20000))
  const maxPolls = 40
  for (let i = 0; i < maxPolls; i++) {
    const resultRes = await fetch(TWOCAPTCHA_RESULT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    })
    const resultJson = (await resultRes.json()) as {
      errorId?: number
      status?: string
      solution?: { gRecaptchaResponse?: string; token?: string }
      errorCode?: string
      errorDescription?: string
    }
    if (resultJson.status === "ready" && resultJson.solution) {
      const token = resultJson.solution.gRecaptchaResponse ?? resultJson.solution.token
      if (token) {
        log(`2Captcha Enterprise solved (poll ${i + 1}).`)
        return token
      }
    }
    if (resultJson.errorId !== 0) {
      log(`2Captcha Enterprise getTaskResult error: errorId=${resultJson.errorId} ${resultJson.errorDescription ?? ""}`)
      return null
    }
    if (resultJson.status === "processing") {
      await new Promise((r) => setTimeout(r, 5000))
      continue
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  log("2Captcha Enterprise timed out waiting for solution.")
  return null
}

/**
 * Solve reCAPTCHA v3 using 2Captcha API. Same 15s initial wait, 5s poll interval.
 */
async function solveRecaptchaV3With2Captcha(
  apiKey: string,
  pageUrl: string,
  siteKey: string,
  pageAction?: string
): Promise<string | null> {
  const createRes = await fetch(TWOCAPTCHA_CREATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: "RecaptchaV3TaskProxyless",
        websiteURL: pageUrl,
        websiteKey: siteKey,
        minScore: 0.9,
        pageAction: pageAction || "submit",
      },
    }),
  })
  const createJson = (await createRes.json()) as { errorId?: number; taskId?: number }
  if (createJson.errorId !== 0 || createJson.taskId == null) return null
  const taskId = createJson.taskId
  await new Promise((r) => setTimeout(r, 20000))
  for (let i = 0; i < 40; i++) {
    const resultRes = await fetch(TWOCAPTCHA_RESULT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    })
    const resultJson = (await resultRes.json()) as {
      errorId?: number
      status?: string
      solution?: { gRecaptchaResponse?: string; token?: string }
    }
    if (resultJson.status === "ready" && resultJson.solution) {
      const token = resultJson.solution.gRecaptchaResponse ?? resultJson.solution.token
      if (token) return token
    }
    if (resultJson.errorId !== 0) return null
    await new Promise((r) => setTimeout(r, 5000))
  }
  return null
}

/**
 * Try to click the reCAPTCHA checkbox inside its iframe (no 2Captcha).
 * Returns true if we found and clicked it, false otherwise.
 * Note: Google may then show an image challenge; if so, we still need 2Captcha.
 */
async function tryClickRecaptchaCheckbox(
  page: import("playwright").Page
): Promise<boolean> {
  await page.waitForTimeout(1500)
  const frames = page.frames()
  for (const f of frames) {
    const url = f.url()
    if (!/recaptcha|google\.com|recaptcha\.net/i.test(url)) continue
    if (!/anchor|checkbox/i.test(url)) continue
    try {
      const anchor = f.locator("#recaptcha-anchor, [role='checkbox'], .recaptcha-checkbox-border").first()
      await anchor.waitFor({ state: "visible", timeout: 3000 })
      await anchor.click()
      log("Clicked reCAPTCHA checkbox in iframe.")
      return true
    } catch {
      continue
    }
  }
  log("Could not find or click reCAPTCHA checkbox iframe.")
  return false
}

/**
 * Inject 2Captcha token into the g-recaptcha-response for the VISIBLE widget (login form).
 * When the page has both invisible and checkbox widgets, we must fill the one inside the login form.
 * Per https://2captcha.com/api-docs/recaptcha-v2 — token goes in g-recaptcha-response or callback.
 */
async function injectRecaptchaToken(
  frame: import("playwright").Frame,
  token: string
): Promise<boolean> {
  const found = await frame.evaluate((tokenValue) => {
    const form = document.querySelector("form")
    if (!form) return false
    const inForm =
      form.querySelector<HTMLTextAreaElement>("#g-recaptcha-response")
      || form.querySelector<HTMLTextAreaElement>("textarea[name='g-recaptcha-response']")
      || form.querySelector<HTMLTextAreaElement>("textarea[id^='g-recaptcha-response']")
    const el = inForm
      || (document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null)
      || document.querySelector<HTMLTextAreaElement>("textarea[name='g-recaptcha-response']")
    if (!el) return false
    el.value = tokenValue
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))

    const recaptchaDiv = form.querySelector("[data-sitekey]") as HTMLElement | null
      || document.querySelector("[data-sitekey]") as HTMLElement | null
    const callbackName = recaptchaDiv?.getAttribute("data-callback")
    if (callbackName) {
      const fn = (window as unknown as Record<string, (t?: string) => void>)[callbackName]
      if (typeof fn === "function") {
        try {
          fn(tokenValue)
        } catch (_) {}
      }
    }
    const w = window as unknown as { ___grecaptcha_cfg?: { callback?: (t?: string) => void } }
    if (typeof w.___grecaptcha_cfg?.callback === "function") {
      try {
        w.___grecaptcha_cfg.callback(tokenValue)
      } catch {
        w.___grecaptcha_cfg.callback()
      }
    }
    return true
  }, token)
  return found === true
}

/**
 * Get the frame that contains the Invoice Cloud portal (main frame after redirect or iframe).
 */
async function getPortalFrame(page: import("playwright").Page): Promise<import("playwright").Frame> {
  log("Resolving portal frame...")
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500)
    const url = page.url()
    if (url.includes("portal") || url.includes("Site2")) {
      log(`Using main frame (url has portal/Site2)`)
      return page.mainFrame()
    }
    for (const f of page.frames()) {
      if (f !== page.mainFrame()) {
        const u = f.url()
        if (u.includes("portal") || u.includes("Site2") || u.includes("invoicecloud")) {
          log(`Using iframe (url has portal/invoicecloud)`)
          return f
        }
      }
    }
  }
  for (const f of page.frames()) {
    try {
      if ((await f.locator('a:has-text("Sign In"), button:has-text("Sign In")').count()) > 0) {
        log("Using frame that contains Sign In")
        return f
      }
    } catch {
      continue
    }
  }
  log("Using main frame (fallback)")
  return page.mainFrame()
}

/**
 * Scrape bills from the Invoice Cloud portal.
 * Real flow (from UI): Landing → Sign In link → Login form → Dashboard → "Pay My Invoices" → Open Invoices table.
 * When reCAPTCHA appears, uses 2Captcha (if ESCONDIDO_2CAPTCHA_API_KEY set) to get token, inject, and submit.
 */
async function scrapeBillsFromPortal(
  page: import("playwright").Page,
  loginEmail: string,
  loginPassword: string,
  twoCaptchaApiKey: string | undefined,
  userAgent: string
): Promise<FetchedBill[]> {
  log("Loading portal...")
  await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForTimeout(4000)
  log(`Page URL: ${page.url()}`)

  const frame = await getPortalFrame(page)
  const loc = (sel: string) => frame.locator(sel)

  // 1) Click "Sign In" link (top right) to open login form
  log("Looking for Sign In link...")
  const signInLink = loc('a:has-text("Sign In")').first()
  try {
    await signInLink.waitFor({ state: "visible", timeout: 10000 })
    await signInLink.click()
    log("Clicked Sign In link")
    await page.waitForTimeout(2000)
  } catch (e) {
    log(`Sign In link: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2) Login with retries: fill form → Sign In → if captcha, use 2Captcha (or checkbox fallback) → inject token and submit
  log("Looking for email/password inputs...")
  const emailInput = loc('input[type="email"], input[name*="mail" i], input[id*="mail" i], input[placeholder*="mail" i], input[type="text"]').first()
  const passwordInput = loc('input[type="password"]').first()
  await emailInput.waitFor({ state: "visible", timeout: 15000 })
  const MAX_LOGIN_ATTEMPTS = 2
  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
    log(`Login attempt ${attempt}/${MAX_LOGIN_ATTEMPTS}...`)
    await emailInput.fill(loginEmail)
    await passwordInput.fill(loginPassword)
    await page.waitForTimeout(1500)
    log("Clicking Sign In...")
    try {
      const btnByRole = (frame as import("playwright").Frame).getByRole("button", { name: /sign\s*in/i })
      await btnByRole.waitFor({ state: "visible", timeout: 8000 })
      await btnByRole.click()
    } catch {
      try {
        const formContainingPassword = passwordInput.locator("xpath=ancestor::form[1]")
        const submitInForm = formContainingPassword.locator('input[type="submit"], input[type="image"], button, a:has-text("Sign In")').first()
        await submitInForm.waitFor({ state: "visible", timeout: 8000 })
        await submitInForm.click({ force: true })
      } catch {
        const formEl = await passwordInput.locator("xpath=ancestor::form[1]").elementHandle()
        if (formEl) await formEl.evaluate((form: HTMLFormElement) => form.submit())
      }
    }
    await page.waitForTimeout(4000)
    if (!page.url().includes("customerlogin")) {
      log("Reached dashboard.")
      break
    }
    const bodyText = await frame.locator("body").innerText().catch(() => "")
    const needsCheckbox = /checkbox\s*challenge|complete\s*the\s*checkbox|recaptcha/i.test(bodyText)
    if (!needsCheckbox) {
      await page.waitForTimeout(3000)
      if (!page.url().includes("customerlogin")) break
    }
    log("Captcha shown; solving with 2Captcha or checkbox fallback...")
    await passwordInput.fill(loginPassword)
    await page.waitForTimeout(1000)

    let submittedAfterCaptcha = false
    if (twoCaptchaApiKey) {
      const params = await getRecaptchaV2ParamsLenient(frame)
      if (params?.siteKey) {
        const pageUrl = page.url()
        log(`2Captcha: submitting task for ${params.isEnterprise ? "Enterprise" : "v2"} siteKey=${params.siteKey.slice(0, 12)}...`)
        const token = params.isEnterprise
          ? await solveRecaptchaV2EnterpriseWith2Captcha(
              twoCaptchaApiKey,
              pageUrl,
              params.siteKey,
              false,
              userAgent,
              params.apiDomain
            )
          : await solveRecaptchaV2With2Captcha(
              twoCaptchaApiKey,
              pageUrl,
              params.siteKey,
              false,
              userAgent,
              params.apiDomain
            )
        if (token) {
          const injected = await injectRecaptchaToken(frame, token)
          if (injected) {
            log("Injected 2Captcha token; clicking Sign In (so site's submit path runs)...")
            await page.waitForTimeout(1500)
            try {
              const btnByRole = (frame as import("playwright").Frame).getByRole("button", { name: /sign\s*in/i })
              await btnByRole.click()
              await page.waitForURL((url) => !url.href.includes("customerlogin"), { timeout: 25000 })
              submittedAfterCaptcha = true
              log("Submitted after 2Captcha token.")
            } catch {
              try {
                const submitInForm = passwordInput.locator("xpath=ancestor::form[1]").locator('input[type="submit"], button, a:has-text("Sign In")').first()
                await submitInForm.click()
                await page.waitForURL((url) => !url.href.includes("customerlogin"), { timeout: 25000 })
                submittedAfterCaptcha = true
                log("Submitted after 2Captcha token (fallback click).")
              } catch (_) {}
            }
          } else {
            log("Could not inject 2Captcha token into page.")
          }
        }
      } else {
        log("Could not get reCAPTCHA siteKey from page.")
      }
    }
    if (!submittedAfterCaptcha) {
      const clicked = await tryClickRecaptchaCheckbox(page)
      if (clicked) {
        await page.waitForTimeout(4000)
        try {
          const formEl = await passwordInput.locator("xpath=ancestor::form[1]").elementHandle()
          if (formEl) {
            await formEl.evaluate((form: HTMLFormElement) => form.submit())
            await page.waitForURL((url) => !url.href.includes("customerlogin"), { timeout: 15000 })
            log("Submitted after checkbox.")
            submittedAfterCaptcha = true
          }
        } catch (_) {}
      }
    }
    if (submittedAfterCaptcha) break
    await page.waitForTimeout(2000)
  }

  log("Waiting for dashboard (leaving customerlogin)...")
  try {
    await page.waitForURL((url) => !url.href.includes("customerlogin"), { timeout: 35000 })
    log(`Navigated to: ${page.url()}`)
  } catch {
    log(`Still on: ${page.url()}`)
  }
  await page.waitForTimeout(4000)
  log(`After login URL: ${page.url()}`)

  // 3) Dashboard: click "Pay My Invoices" to open Open Invoices page
  log("Looking for Pay My Invoices...")
  const payInvoicesBtn = loc('button:has-text("Pay My Invoices"), a:has-text("Pay My Invoices")').first()
  try {
    await payInvoicesBtn.waitFor({ state: "visible", timeout: 25000 })
    await payInvoicesBtn.click()
    log("Clicked Pay My Invoices")
    await page.waitForTimeout(8000)
  } catch (e) {
    log(`Pay My Invoices: ${e instanceof Error ? e.message : String(e)}`)
  }

  const bills: FetchedBill[] = []
  const bodyText = await frame.locator("body").innerText()

  // 4) Open Invoices page: find every "View Invoice" link and parse its table row
  log("Looking for View Invoice links...")
  const viewInvoiceLinks = loc('a:has-text("View Invoice")')
  const linkCount = await viewInvoiceLinks.count()
  log(`Found ${linkCount} View Invoice link(s)`)

  if (linkCount > 0) {
    for (let i = 0; i < linkCount; i++) {
      const el = viewInvoiceLinks.nth(i)
      const href = (await el.getAttribute("href")) ?? ""
      const pdfUrl = href ? (href.startsWith("http") ? href : new URL(href, PORTAL_URL).href) : null
      const row = el.locator("xpath=ancestor::tr[1]")
      const rowText = (await row.count()) > 0 ? await row.innerText() : bodyText
      const accountMatch = rowText.match(/account\s*#?\s*(\d{4,})/i) || rowText.match(/#\s*(\d{4,})/i)
      const accountNumber = accountMatch ? accountMatch[1]!.trim() : ""
      const amountMatch = rowText.match(/\$[\d,]+\.?\d*/)
      const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
      const dateMatch = rowText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
      const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
      const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
      const dueDate = dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null
      bills.push({
        accountNumber,
        periodStart,
        periodEnd,
        amountDue: amount,
        dueDate,
        externalId: href ? href.slice(0, 500) : null,
        pdfUrl,
      })
      log(`  Bill ${i + 1}: account=${accountNumber} period=${periodStart} amount=$${amount}`)
    }
  }

  // 5) Fallback: parse any table with $ amounts and account # (e.g. Recent Open Invoices on dashboard)
  if (bills.length === 0) {
    log("Trying table fallback...")
    const tables = frame.locator("table")
    const tableCount = await tables.count()
    log(`Tables found: ${tableCount}`)
    for (let t = 0; t < tableCount; t++) {
      const table = tables.nth(t)
      const rows = table.locator("tbody tr")
      const rowCount = await rows.count()
      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i)
        const text = await row.innerText()
        if (!text.includes("$") || text.length < 5) continue
        const accountMatch = text.match(/account\s*#?\s*(\d{4,})/i) || text.match(/#\s*(\d{4,})/i)
        const accountNumber = accountMatch ? accountMatch[1]! : ""
        const amountMatch = text.match(/\$[\d,]+\.?\d*/)
        const amount = amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, "")) : 0
        const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)
        const periodStart = dateMatch?.[0] ? normalizeDate(dateMatch[0]) : ""
        const periodEnd = dateMatch?.[1] ? normalizeDate(dateMatch[1]) : periodStart
        const dueDate = dateMatch?.[2] ? normalizeDate(dateMatch[2]) : null
        const viewLink = row.locator('a:has-text("View Invoice"), a:has-text("View")').first()
        const href = (await viewLink.getAttribute("href").catch(() => null)) ?? null
        const pdfUrl = href ? (href.startsWith("http") ? href : new URL(href, PORTAL_URL).href) : null
        bills.push({
          accountNumber,
          periodStart,
          periodEnd,
          amountDue: amount,
          dueDate,
          externalId: href ? href.slice(0, 500) : null,
          pdfUrl,
        })
      }
      if (bills.length > 0) {
        log(`Parsed ${bills.length} bills from table`)
        break
      }
    }
  }

  // Deduplicate: same account + period can appear twice (e.g. two "View Invoice" links per row)
  const seen = new Set<string>()
  const unique: FetchedBill[] = []
  for (const b of bills) {
    const key = `${b.accountNumber}|${b.periodStart}|${b.amountDue}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(b)
  }
  if (unique.length < bills.length) {
    log(`Deduped ${bills.length} → ${unique.length} bill(s).`)
  }

  if (unique.length === 0) {
    log("Saving debug screenshot and HTML...")
    try {
      await page.screenshot({ path: "debug-escondido.png", fullPage: true })
      const fs = await import("fs")
      fs.writeFileSync("debug-escondido.html", await page.content(), "utf8")
    } catch (e) {
      log(`Debug save failed: ${e}`)
    }
  }

  log(`Done. Parsed ${unique.length} bill(s).`)
  return unique
}

export async function runEscondidoBillFetch(options?: {
  browserWSEndpoint?: string
  loginEmail?: string
  loginPassword?: string
}): Promise<{ inserted: number; errors: string[] }> {
  const loginEmail = options?.loginEmail ?? process.env.ESCONDIDO_LOGIN_EMAIL
  const loginPassword = options?.loginPassword ?? process.env.ESCONDIDO_LOGIN_PASSWORD
  if (!loginEmail || !loginPassword) {
    throw new Error("Missing ESCONDIDO_LOGIN_EMAIL or ESCONDIDO_LOGIN_PASSWORD")
  }

  const supabase = getSupabase()
  const accountToProperty = await getPropertyAccountMapping(supabase)
  const twoCaptchaApiKey = process.env.ESCONDIDO_2CAPTCHA_API_KEY?.trim()

  let browser: Awaited<ReturnType<typeof chromium.launch>> | Awaited<ReturnType<typeof chromium.connect>>
  if (options?.browserWSEndpoint) {
    browser = await chromium.connectOverCDP(options.browserWSEndpoint)
  } else {
    const headless = process.env.PLAYWRIGHT_HEADED !== "1"
    const watch = process.env.ESCONDIDO_WATCH === "1"
    let proxyConfig: { server: string; username?: string; password?: string } | undefined
    const proxyServer = process.env.ESCONDIDO_PROXY_SERVER
    const proxyAuth =
      process.env.ESCONDIDO_PROXY_USERNAME && process.env.ESCONDIDO_PROXY_PASSWORD
        ? {
            username: process.env.ESCONDIDO_PROXY_USERNAME,
            password: process.env.ESCONDIDO_PROXY_PASSWORD,
          }
        : undefined
    if (proxyServer) {
      proxyConfig = { server: proxyServer, ...proxyAuth }
      log(`Using proxy: ${proxyServer.replace(/:[^:@]+@/, ":****@")}`)
    }
    browser = await chromium.launch({
      headless: watch ? false : headless,
      slowMo: watch ? 800 : 0,
      proxy: proxyConfig,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,720",
      ],
    })
    if (watch) log("Watch mode: browser visible, actions slowed so you can see each step.")
  }

  const errors: string[] = []
  let inserted = 0
  let alreadyExisted = 0

  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  let context: import("playwright").BrowserContext | undefined
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent,
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    })
    if (process.env.CI) {
      await context.tracing.start({ screenshots: true, snapshots: true })
      log("Tracing enabled (CI): trace.zip will be saved for Playwright Trace Viewer.")
    }
    const page = await context.newPage()
    const bills = await scrapeBillsFromPortal(page, loginEmail, loginPassword, twoCaptchaApiKey, userAgent)

    console.log(`Scraped ${bills.length} bill(s) from portal. Property mapping has ${accountToProperty.size} account(s).`)

    // If we have a single account in the mapping, use it for all bills from this login
    const defaultAccount =
      accountToProperty.size === 1 ? Array.from(accountToProperty.keys())[0] : null
    const defaultPropertyId = defaultAccount ? accountToProperty.get(defaultAccount) : null

    for (const bill of bills) {
      if (!bill.periodStart && !bill.pdfUrl) {
        errors.push(`Skipped bill (no period or PDF): ${JSON.stringify(bill)}`)
        continue
      }
      const periodStart = bill.periodStart || new Date().toISOString().slice(0, 10)
      const periodEnd = bill.periodEnd || periodStart
      const accountNumber = bill.accountNumber || defaultAccount || ""
      const propertyId = accountToProperty.get(accountNumber) || defaultPropertyId
      if (!propertyId) {
        errors.push(`No property mapped for account "${accountNumber}", skipping bill ${periodStart}`)
        continue
      }

      const { data, error } = await supabase
        .from("utility_provider_bills")
        .upsert(
          {
            property_id: propertyId,
            utility_key: UTILITY_KEY,
            account_number: accountNumber,
            billing_period_start: periodStart,
            billing_period_end: periodEnd,
            amount_due: bill.amountDue >= 0 ? bill.amountDue : 0,
            due_date: bill.dueDate,
            external_id: bill.externalId,
            pdf_url: bill.pdfUrl,
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "property_id,utility_key,billing_period_start",
            ignoreDuplicates: true, // only insert new bills; never overwrite existing (preserves paid status etc.)
          }
        )
        .select("id")

      if (error) {
        errors.push(`Insert failed ${periodStart}: ${error.message}`)
      } else if (data && data.length > 0) {
        inserted++
      } else {
        alreadyExisted++
      }
    }

    if (alreadyExisted > 0) {
      console.log(`${alreadyExisted} bill(s) already in database (unchanged).`)
    }
    console.log(`Inserted ${inserted} new bill(s).`)
  } finally {
    if (context) {
      if (process.env.CI) {
        try {
          await context.tracing.stop({ path: "trace.zip" })
          log("Saved trace.zip — open with: npx playwright show-trace trace.zip")
        } catch (e) {
          log(`Trace save failed: ${e}`)
        }
      }
      await context.close()
    }
    await browser.close()
  }

  return { inserted, errors }
}

async function main() {
  console.log("Starting Escondido bill fetch...")
  if (process.env.ESCONDIDO_WATCH === "1") {
    console.log("Tip: ESCONDIDO_WATCH=1 shows the browser and slows actions. Run locally to watch the bot.")
  }
  try {
    const result = await runEscondidoBillFetch()
    console.log(`Inserted ${result.inserted} bill(s).`)
    if (result.errors.length > 0) {
      console.error("Errors:", result.errors)
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const isMain = process.argv[1]?.includes("fetch-escondido-bills")
if (isMain) {
  main()
}
