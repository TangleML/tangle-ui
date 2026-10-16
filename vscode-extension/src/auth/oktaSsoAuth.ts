import crypto from "node:crypto";
import http from "node:http";

import * as vscode from "vscode";
import { number, object, optional, string } from "zod/mini";

import { showError } from "../prompts.ts";
import {
  getOktaSsoConfig,
  isLoopbackAudience,
  isOktaSsoEnabled,
  type OktaSsoConfig,
} from "./oktaSsoConfig.ts";
import { emailFromSessionCookie } from "./oktaSsoIdentity.ts";

const SECRET_PREFIX = "tangent.oktaSso";
const CALLBACK_TIMEOUT_MS = 120_000;

const accessTokenSchema = object({ access_token: optional(string()) });
const cachedCookieSchema = object({ cookie: string(), createdAt: number() });

export interface GetCookieOptions {
  forceRefresh?: boolean;
}

/** Resolves the OktaSSO cookie header for one audience, or `undefined` when off. */
export type CookieProvider = (
  options?: GetCookieOptions,
) => Promise<string | undefined>;

interface CachedCookie {
  cookie: string;
  createdAt: number;
}

/**
 * Mints and caches the SSO session cookie the real-environment API gate expects,
 * following the Okta PKCE flow. One token is kept per audience (the API host the
 * cookie authenticates against), so the Tangle backend and the Shell each get
 * their own. Tokens live in VS Code SecretStorage. A read is silent by default
 * and returns `undefined` when the cache is cold or stale, so background callers
 * (the scoped-connection refresh, auto-connect, REST retries) never open the
 * browser; a silent miss instead surfaces a single "Sign In" notification per
 * audience. The browser opens only when the user accepts that notification, with
 * concurrent callers awaiting the same flow.
 */
export class OktaSsoAuthProvider {
  private readonly secrets: vscode.SecretStorage;
  private readonly config: OktaSsoConfig;
  private readonly inFlight = new Map<string, Promise<string>>();
  private readonly signInPrompts = new Set<string>();
  private readonly signedIn = new vscode.EventEmitter<void>();
  private flowChain: Promise<unknown> = Promise.resolve();

  /** Fires once a browser sign-in warms the cache, so connections can retry. */
  readonly onDidSignIn = this.signedIn.event;

  constructor(secrets: vscode.SecretStorage, config = getOktaSsoConfig()) {
    this.secrets = secrets;
    this.config = config;
  }

  /** A provider bound to one audience, suitable to hand an API client. */
  cookieProviderFor(audienceUrl: string): CookieProvider {
    return (options) => this.getCookieHeader(audienceUrl, options);
  }

  /** The gate guards remote audiences only; loopback dev hosts are exempt. */
  gatesAudience(audienceUrl: string): boolean {
    return isOktaSsoEnabled(this.config) && !isLoopbackAudience(audienceUrl);
  }

  /** The real user's email from the session JWT, reusing the cached cookie. */
  async getAuthenticatedEmail(
    audienceUrl: string,
  ): Promise<string | undefined> {
    const cookie = await this.getCookieHeader(audienceUrl);
    return cookie
      ? emailFromSessionCookie(cookie, this.config.cookieName)
      : undefined;
  }

  async getCookieHeader(
    audienceUrl: string,
    options: GetCookieOptions = {},
  ): Promise<string | undefined> {
    if (!this.gatesAudience(audienceUrl)) return undefined;

    const key = this.secretKey(audienceUrl);
    const cached = options.forceRefresh ? undefined : await this.readCache(key);
    if (cached) return cached;
    this.promptSignIn(key, audienceUrl);
    return undefined;
  }

  /**
   * Offers one browser sign-in per audience when a silent read came up empty,
   * so a stale session surfaces a notification the user can act on instead of a
   * browser tab opening on its own. Clients recover on their next cycle once the
   * flow warms the cache (REST on the next call, the socket on reconnect).
   */
  private promptSignIn(key: string, audienceUrl: string): void {
    if (this.signInPrompts.has(key)) return;
    this.signInPrompts.add(key);
    void vscode.window
      .showWarningMessage(
        `Sign in to Tangent to reach ${new URL(audienceUrl).host}.`,
        "Sign In",
      )
      .then((choice) =>
        choice === "Sign In" ? this.runFlow(key, audienceUrl) : undefined,
      )
      .then(
        () => this.signInPrompts.delete(key),
        (err: unknown) => {
          this.signInPrompts.delete(key);
          showError(err);
        },
      );
  }

  /** Dedupes concurrent flows for one audience so only one browser opens. */
  private runFlow(key: string, audienceUrl: string): Promise<string> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const flow = this.enqueue(() => this.authorize(audienceUrl))
      .then(async (cookie) => {
        await this.writeCache(key, cookie);
        this.signedIn.fire();
        return cookie;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, flow);
    return flow;
  }

  /**
   * Runs browser flows one at a time across all audiences: each opens a loopback
   * server on the same callback port, so overlapping flows would collide.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.flowChain.then(task, task);
    this.flowChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private secretKey(audienceUrl: string): string {
    return `${SECRET_PREFIX}.${new URL(audienceUrl).host}`;
  }

  private async readCache(key: string): Promise<string | undefined> {
    const raw = await this.secrets.get(key);
    if (!raw) return undefined;
    const parsed = cachedCookieSchema.safeParse(safeJsonParse(raw));
    if (!parsed.success) return undefined;
    const ageMs = Date.now() - parsed.data.createdAt;
    if (ageMs >= this.config.refreshAfterMs) return undefined;
    return parsed.data.cookie || undefined;
  }

  private async writeCache(key: string, cookie: string): Promise<void> {
    const payload: CachedCookie = { cookie, createdAt: Date.now() };
    await this.secrets.store(key, JSON.stringify(payload));
  }

  private async authorize(audienceUrl: string): Promise<string> {
    const { verifier, challenge } = generatePkcePair();
    const code = await this.getAuthorizationCode(challenge);
    const accessToken = await this.exchangeCodeForAccessToken(code, verifier);
    const sessionToken = await this.exchangeForSessionToken(
      accessToken,
      audienceUrl,
    );
    return `${this.config.cookieName}=${sessionToken}`;
  }

  private async getAuthorizationCode(challenge: string): Promise<string> {
    const state = crypto.randomUUID();
    const codePromise = waitForAuthorizationCode(
      this.config.callbackPort,
      state,
    );

    const url = new URL("authorize", this.config.oauthEndpointBase);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("callback_url", this.config.redirectUri);
    url.searchParams.set("scope", this.config.scopes);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", this.config.redirectUri);

    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
    return codePromise;
  }

  private async exchangeCodeForAccessToken(
    code: string,
    verifier: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: this.config.redirectUri,
    });

    const res = await fetch(new URL("token", this.config.oauthEndpointBase), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(
        `OktaSSO: token exchange failed (${res.status}): ${await safeText(res)}`,
      );
    }
    const json = accessTokenSchema.parse(await res.json());
    if (!json.access_token) {
      throw new Error("OktaSSO: token response did not include access_token.");
    }
    return json.access_token;
  }

  private async exchangeForSessionToken(
    accessToken: string,
    audienceUrl: string,
  ): Promise<string> {
    const url = new URL(this.config.tokenExchangeUrl);
    url.searchParams.set("audience", audienceUrl);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(
        `OktaSSO: session exchange failed (${res.status}): ${await safeText(res)}`,
      );
    }
    const json = accessTokenSchema.parse(await res.json());
    if (!json.access_token) {
      throw new Error(
        "OktaSSO: session response did not include access_token.",
      );
    }
    return json.access_token;
  }
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64UrlNoPad(crypto.randomBytes(64));
  const challenge = base64UrlNoPad(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

function base64UrlNoPad(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

interface AuthCallback {
  resolve: (code: string) => void;
  reject: (err: Error) => void;
  done: () => void;
}

/**
 * A callback whose `state` does not match is a stray or forged request: it is
 * answered but left to time out, so it cannot abort the real sign-in. Only a
 * matching callback resolves (with the code) or rejects (with the IdP error).
 */
function handleAuthCallback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  expectedState: string,
  callback: AuthCallback,
): void {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  if (!requestUrl.pathname.startsWith("/auth")) {
    res.statusCode = 404;
    res.end();
    return;
  }
  if (requestUrl.searchParams.get("state") !== expectedState) {
    res.statusCode = 400;
    res.end("Unexpected state.");
    return;
  }
  resolveAuthCallback(requestUrl.searchParams, res, callback);
}

function resolveAuthCallback(
  params: URLSearchParams,
  res: http.ServerResponse,
  callback: AuthCallback,
): void {
  const error = params.get("error");
  if (error) {
    const detail = params.get("error_description") ?? error;
    res.statusCode = 400;
    res.end(detail);
    callback.reject(new Error(`OktaSSO: authorization failed: ${detail}.`));
    callback.done();
    return;
  }
  const code = params.get("code");
  if (!code) {
    res.statusCode = 400;
    res.end("Missing ?code");
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(SUCCESS_PAGE);
  callback.resolve(code);
  callback.done();
}

function waitForAuthorizationCode(
  port: number,
  expectedState: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) =>
      handleAuthCallback(req, res, expectedState, {
        resolve,
        reject,
        done: () => setImmediate(() => server.close()),
      }),
    );

    server.on("error", (err) =>
      reject(
        new Error(
          `OktaSSO: local callback server failed on port ${port}: ${stringifyError(err)}`,
        ),
      ),
    );

    const timer = setTimeout(() => {
      server.close();
      reject(
        new Error(
          `OktaSSO: timed out after ${CALLBACK_TIMEOUT_MS / 1000}s waiting for the browser callback.`,
        ),
      );
    }, CALLBACK_TIMEOUT_MS);
    timer.unref();
    server.on("close", () => clearTimeout(timer));

    server.listen(port, "127.0.0.1");
  });
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function stringifyError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const SUCCESS_PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Auth successful</title></head>
<body>
  <h2 style="text-align:center;font-family:Arial,Helvetica,sans-serif;color:#909090;margin-top:50px;">
    Auth successful! This window will close shortly.
  </h2>
  <script>setTimeout(function(){window.close();}, 2000);</script>
</body>
</html>`;
