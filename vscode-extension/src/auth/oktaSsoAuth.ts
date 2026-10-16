import crypto from "node:crypto";
import http from "node:http";

import * as vscode from "vscode";
import { object, optional, string } from "zod/mini";

import {
  getOktaSsoConfig,
  isOktaSsoEnabled,
  type OktaSsoConfig,
} from "./oktaSsoConfig.ts";
import { emailFromSessionCookie } from "./oktaSsoIdentity.ts";

const SECRET_PREFIX = "tangent.oktaSso";
const CALLBACK_TIMEOUT_MS = 120_000;

const accessTokenSchema = object({ access_token: optional(string()) });

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
 * their own. Tokens live in VS Code SecretStorage; a cold or stale cache opens
 * the browser once, with concurrent callers awaiting the same flow.
 */
export class OktaSsoAuthProvider {
  private readonly secrets: vscode.SecretStorage;
  private readonly config: OktaSsoConfig;
  private readonly inFlight = new Map<string, Promise<string>>();
  private flowChain: Promise<unknown> = Promise.resolve();

  constructor(secrets: vscode.SecretStorage, config = getOktaSsoConfig()) {
    this.secrets = secrets;
    this.config = config;
  }

  /** A provider bound to one audience, suitable to hand an API client. */
  cookieProviderFor(audienceUrl: string): CookieProvider {
    return (options) => this.getCookieHeader(audienceUrl, options);
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
    { forceRefresh = false }: GetCookieOptions = {},
  ): Promise<string | undefined> {
    if (!isOktaSsoEnabled(this.config)) return undefined;

    const key = this.secretKey(audienceUrl);
    if (!forceRefresh) {
      const cached = await this.readCache(key);
      if (cached) return cached;
    }
    return this.runFlow(key, audienceUrl);
  }

  /** Dedupes concurrent flows for one audience so only one browser opens. */
  private runFlow(key: string, audienceUrl: string): Promise<string> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const flow = this.enqueue(() => this.authorize(audienceUrl))
      .then(async (cookie) => {
        await this.writeCache(key, cookie);
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
    try {
      const payload: CachedCookie = JSON.parse(raw);
      const ageMs = Date.now() - payload.createdAt;
      if (ageMs >= this.config.refreshAfterMs) return undefined;
      return payload.cookie || undefined;
    } catch {
      return undefined;
    }
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
    const codePromise = waitForAuthorizationCode(this.config.callbackPort);

    const url = new URL("authorize", this.config.oauthEndpointBase);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("callback_url", this.config.redirectUri);
    url.searchParams.set("scope", this.config.scopes);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", crypto.randomUUID());
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

function waitForAuthorizationCode(port: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (!requestUrl.pathname.startsWith("/auth")) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const code = requestUrl.searchParams.get("code");
      if (!code) {
        res.statusCode = 400;
        res.end("Missing ?code");
        reject(new Error("OktaSSO: callback missing ?code parameter."));
        server.close();
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(SUCCESS_PAGE);
      setImmediate(() => server.close());
      resolve(code);
    });

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
