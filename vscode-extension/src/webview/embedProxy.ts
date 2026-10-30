import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";
import type { Duplex } from "node:stream";
import * as tls from "node:tls";

const LOOPBACK_HOST = "127.0.0.1";
const WEBVIEW_ORIGIN_PREFIX = "vscode-webview://";
// The body is buffered in full so a 401 can be replayed, so it must be bounded.
const MAX_BUFFERED_BODY_BYTES = 32 * 1024 * 1024;
const CORS_ALLOW_HEADERS = {
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type",
};

export type OriginPolicy = (origin: string) => boolean;

export type ProxyCookieProvider = (options?: {
  forceRefresh?: boolean;
}) => Promise<string | undefined>;

export interface EmbedProxyOptions {
  allowOrigin?: OriginPolicy;
  log?: (line: string) => void;
  cookieProvider?: ProxyCookieProvider;
}

export function isWebviewOrigin(origin: string): boolean {
  return origin.startsWith(WEBVIEW_ORIGIN_PREFIX);
}

function corsHeaders(origin: string | undefined): http.OutgoingHttpHeaders {
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    vary: "Origin",
    ...CORS_ALLOW_HEADERS,
  };
}

function mergeCookie(
  existing: string | string[] | undefined,
  extra: string,
): string {
  const base = Array.isArray(existing) ? existing.join("; ") : existing;
  return base ? `${base}; ${extra}` : extra;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

class BodyTooLargeError extends Error {}

function collectBody(
  req: http.IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(
          new BodyTooLargeError(`Request body exceeds ${maxBytes} bytes.`),
        );
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Drops the browser's `Origin` so the Shell treats the call as same-origin;
 * the proxy has already applied its own origin policy. When the SSO gate is on,
 * the minted session cookie rides along so the embed clears the API gate too.
 */
function upstreamHeaders(
  headers: http.IncomingHttpHeaders,
  target: URL,
  cookieHeader?: string,
): http.OutgoingHttpHeaders {
  const forwarded: http.OutgoingHttpHeaders = { ...headers, host: target.host };
  delete forwarded.origin;
  delete forwarded.referer;
  if (cookieHeader) {
    forwarded.cookie = mergeCookie(forwarded.cookie, cookieHeader);
  }
  return forwarded;
}

function withoutCorsHeaders(
  headers: http.IncomingHttpHeaders,
): http.OutgoingHttpHeaders {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !name.startsWith("access-control-"),
    ),
  );
}

function headerLines(headers: http.OutgoingHttpHeaders): string[] {
  return Object.entries(headers).flatMap(([name, value]) => {
    if (value === undefined) return [];
    const values = Array.isArray(value) ? value : [String(value)];
    return values.map((item) => `${name}: ${item}`);
  });
}

export function upgradeRequestHead(
  req: http.IncomingMessage,
  target: URL,
  cookieHeader?: string,
): string {
  return [
    `${req.method} ${req.url} HTTP/1.1`,
    ...headerLines(upstreamHeaders(req.headers, target, cookieHeader)),
    "",
    "",
  ].join("\r\n");
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      if (address && typeof address === "object") resolve(address.port);
      else reject(new Error("The embed proxy did not get a port."));
    });
  });
}

/**
 * Forwards a webview's HTTP and WebSocket traffic to the Tangent Shell over
 * loopback. The Shell answers CORS only for an exact allowlist of origins, and
 * a webview's origin is a fresh `vscode-webview://<id>` per panel, so it can
 * never be listed there.
 */
export class EmbedProxy {
  readonly origin: string;
  readonly baseUrl: string;
  readonly port: number;
  private readonly server: http.Server;
  private readonly target: URL;
  private readonly allowOrigin: OriginPolicy;
  private readonly log: (line: string) => void;
  private readonly cookieProvider: ProxyCookieProvider | undefined;
  private readonly sockets = new Set<Duplex>();

  private constructor(
    server: http.Server,
    port: number,
    target: URL,
    options: EmbedProxyOptions,
  ) {
    this.server = server;
    this.port = port;
    this.target = target;
    this.allowOrigin = options.allowOrigin ?? isWebviewOrigin;
    this.log = options.log ?? (() => undefined);
    this.cookieProvider = options.cookieProvider;
    this.origin = `http://${LOOPBACK_HOST}:${port}`;
    this.baseUrl = `${this.origin}${target.pathname.replace(/\/+$/, "")}`;
    server.on("request", (req, res) => this.handleRequest(req, res));
    server.on("upgrade", (req, socket, head) =>
      this.handleUpgrade(req, socket, head),
    );
    server.on("connection", (socket) => this.track(socket));
  }

  static async start(
    targetUrl: string,
    options: EmbedProxyOptions = {},
  ): Promise<EmbedProxy> {
    const server = http.createServer();
    const port = await listen(server);
    return new EmbedProxy(server, port, new URL(targetUrl), options);
  }

  /** Maps a URL the embed produced against the proxy back onto the Shell. */
  toTargetUrl(url: string): string {
    const resolved = new URL(url, `${this.baseUrl}/`);
    if (resolved.origin !== this.origin) return resolved.toString();
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return new URL(path, this.target.origin).toString();
  }

  dispose(): void {
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    this.server.close();
  }

  private track(socket: Duplex): void {
    this.sockets.add(socket);
    socket.once("close", () => this.sockets.delete(socket));
  }

  /** `undefined` for a non-browser caller, `false` for a refused origin. */
  private checkOrigin(origin: string | undefined): string | undefined | false {
    if (origin === undefined) return undefined;
    return this.allowOrigin(origin) ? origin : false;
  }

  /**
   * A request whose `Host` is not this proxy's loopback address did not come
   * through the webview's port mapping. Rejecting it is the standard defense
   * against DNS rebinding, which otherwise lets a remote page reach the Shell
   * with the attached session cookie through a request that carries no `Origin`.
   */
  private hostAllowed(req: http.IncomingMessage): boolean {
    return req.headers.host === `${LOOPBACK_HOST}:${this.port}`;
  }

  /**
   * Only an origin-form target (a path starting with a single `/`) is forwarded.
   * A scheme-relative (`//attacker/x`) or absolute-form (`http://attacker/x`)
   * request URL resolves against another host, and since such a request still
   * passes the `Host` and `Origin` checks, `sendUpstream` would otherwise
   * connect to that host with the session cookie attached.
   */
  private isOriginForm(url: string | undefined): boolean {
    if (!url || !url.startsWith("/") || url.startsWith("//")) return false;
    try {
      return new URL(url, this.target.origin).origin === this.target.origin;
    } catch {
      return false;
    }
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    if (!this.hostAllowed(req)) {
      res.writeHead(403).end("Host not allowed.");
      return;
    }
    const origin = this.checkOrigin(req.headers.origin);
    if (origin === false) {
      res.writeHead(403).end("Origin not allowed.");
      return;
    }
    if (!this.isOriginForm(req.url)) {
      res.writeHead(400).end("Invalid request target.");
      return;
    }
    const cors = corsHeaders(origin);
    if (req.method === "OPTIONS" && origin) {
      res.writeHead(204, cors).end();
      return;
    }
    void this.forwardRequest(req, res, cors);
  }

  private resolveCookie(forceRefresh: boolean): Promise<string | undefined> {
    if (!this.cookieProvider) return Promise.resolve(undefined);
    return this.cookieProvider({ forceRefresh }).catch(() => undefined);
  }

  private async forwardRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: http.OutgoingHttpHeaders,
  ): Promise<void> {
    try {
      const body = await collectBody(req, MAX_BUFFERED_BODY_BYTES);
      const response = await this.sendWithAuthRetry(req, body);
      res.writeHead(response.statusCode ?? 502, {
        ...withoutCorsHeaders(response.headers),
        ...cors,
      });
      response.pipe(res);
    } catch (err) {
      this.respondRequestError(req, res, cors, err);
    }
  }

  /**
   * The webview's SSO cookie is resolved per request, not once at startup, so a
   * refreshed session is picked up without reloading the window. When the gate
   * answers 401 the cookie is refreshed once and the request is replayed with
   * the buffered body, the same single-retry contract the REST clients use. The
   * replay is skipped when the refresh yields no new cookie, so a persistent 401
   * surfaces as itself rather than a cookieless resend.
   */
  private async sendWithAuthRetry(
    req: http.IncomingMessage,
    body: Buffer,
  ): Promise<http.IncomingMessage> {
    const cookie = await this.resolveCookie(false);
    const response = await this.sendUpstream(req, body, cookie);
    if (response.statusCode !== 401 || !this.cookieProvider) return response;
    const refreshed = await this.resolveCookie(true);
    if (!refreshed || refreshed === cookie) return response;
    response.resume();
    return this.sendUpstream(req, body, refreshed);
  }

  private respondRequestError(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: http.OutgoingHttpHeaders,
    err: unknown,
  ): void {
    if (err instanceof BodyTooLargeError) {
      if (!res.headersSent) res.writeHead(413, cors);
      res.end("Request body too large.");
      return;
    }
    this.log(`embed proxy: ${req.method} ${req.url} failed: ${errorText(err)}`);
    if (!res.headersSent) res.writeHead(502, cors);
    res.end(`Cannot reach the Tangent Shell at ${this.target.origin}.`);
  }

  private sendUpstream(
    req: http.IncomingMessage,
    body: Buffer,
    cookie: string | undefined,
  ): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
      const upstream = this.transport().request(
        new URL(req.url ?? "/", this.target.origin),
        {
          method: req.method,
          headers: upstreamHeaders(req.headers, this.target, cookie),
        },
        resolve,
      );
      upstream.on("error", reject);
      upstream.end(body);
    });
  }

  private handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    if (!this.hostAllowed(req)) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    if (this.checkOrigin(req.headers.origin) === false) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    if (!this.isOriginForm(req.url)) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    const close = () => socket.destroy();
    this.resolveCookie(false)
      .then((cookie) => this.forwardUpgrade(req, socket, head, cookie))
      .catch((err: unknown) => {
        this.log(`embed proxy: upgrade ${req.url} failed: ${errorText(err)}`);
        close();
      });
  }

  private forwardUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
    cookie: string | undefined,
  ): void {
    const upstream = this.connectUpstream();
    const close = () => {
      socket.destroy();
      upstream.destroy();
    };
    upstream.once(this.isSecure() ? "secureConnect" : "connect", () => {
      upstream.write(upgradeRequestHead(req, this.target, cookie));
      if (head.length > 0) upstream.write(head);
      upstream.pipe(socket).pipe(upstream);
    });
    upstream.on("error", (err) => {
      this.log(`embed proxy: upgrade ${req.url} failed: ${err.message}`);
      close();
    });
    upstream.on("close", close);
    socket.on("error", close);
    socket.on("close", close);
  }

  private isSecure(): boolean {
    return this.target.protocol === "https:";
  }

  private transport(): typeof http | typeof https {
    return this.isSecure() ? https : http;
  }

  private connectUpstream(): net.Socket {
    const host = this.target.hostname.replace(/^\[|\]$/g, "");
    const port = Number(this.target.port) || (this.isSecure() ? 443 : 80);
    if (!this.isSecure()) return net.connect({ host, port });
    const servername = net.isIP(host) ? undefined : host;
    return tls.connect({ host, port, servername });
  }
}
