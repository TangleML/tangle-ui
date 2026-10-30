import assert from "node:assert/strict";
import * as http from "node:http";
import * as net from "node:net";
import { after, before, test } from "node:test";

import { EmbedProxy, isWebviewOrigin } from "./embedProxy.ts";

const WEBVIEW_ORIGIN = "vscode-webview://panel-id";

interface SeenRequest {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
}

interface ProxyResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const seen: SeenRequest[] = [];
let upstream: http.Server;
let upstreamHost: string;
let proxy: EmbedProxy;

function portOf(server: http.Server): number {
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("Test server is not listening.");
  }
  return address.port;
}

function startUpstream(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, headers: req.headers });
    res.writeHead(200, {
      "content-type": "text/plain",
      "access-control-allow-origin": "http://localhost:5173",
    });
    res.end(`upstream ${req.url}`);
  });
  server.on("upgrade", (_req, socket) => {
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\n\r\n",
    );
    socket.on("data", (chunk: Buffer) => socket.write(`echo:${chunk}`));
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}

function send(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders } = {},
): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${proxy.origin}${path}`,
      { method: options.method ?? "GET", headers: options.headers },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function readUntil(socket: net.Socket, marker: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let received = "";
    socket.on("data", (chunk: Buffer) => {
      received += chunk.toString();
      if (received.includes(marker)) resolve(received);
    });
    socket.on("error", reject);
  });
}

before(async () => {
  upstream = await startUpstream();
  upstreamHost = `127.0.0.1:${portOf(upstream)}`;
  proxy = await EmbedProxy.start(`http://${upstreamHost}/tangent/`);
});

after(() => {
  proxy.dispose();
  upstream.close();
});

test("the proxy keeps the Shell's path prefix in its base URL", () => {
  assert.match(proxy.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(proxy.baseUrl, `${proxy.origin}/tangent`);
});

test("webview requests reach the Shell as same-origin calls", async () => {
  seen.length = 0;
  const response = await send("/tangent/api/sessions/s1", {
    headers: { origin: WEBVIEW_ORIGIN, referer: "vscode-webview://panel-id/" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body, "upstream /tangent/api/sessions/s1");
  assert.equal(response.headers["access-control-allow-origin"], WEBVIEW_ORIGIN);
  assert.equal(response.headers.vary, "Origin");
  assert.equal(seen[0]?.headers.host, upstreamHost);
  assert.equal(seen[0]?.headers.origin, undefined);
  assert.equal(seen[0]?.headers.referer, undefined);
});

test("the SSO cookie rides along, appended to the webview's own cookies", async () => {
  seen.length = 0;
  const cookieProxy = await EmbedProxy.start(
    `http://${upstreamHost}/tangent/`,
    {
      cookieProvider: () => Promise.resolve("SSO_TOKEN=abc"),
    },
  );

  await new Promise<void>((resolve, reject) => {
    http
      .request(
        `${cookieProxy.origin}/tangent/api/sessions`,
        { headers: { origin: WEBVIEW_ORIGIN, cookie: "existing=1" } },
        (res) => {
          res.resume();
          res.on("end", resolve);
        },
      )
      .on("error", reject)
      .end();
  });

  assert.equal(seen[0]?.headers.cookie, "existing=1; SSO_TOKEN=abc");
  cookieProxy.dispose();
});

test("a 401 refreshes the cookie once and replays the request", async () => {
  const calls: Array<string | undefined> = [];
  const gated = http.createServer((req, res) => {
    calls.push(req.headers.cookie);
    if (req.headers.cookie === "SSO=stale") {
      res.writeHead(401).end("expired");
      return;
    }
    res.writeHead(200).end("ok");
  });
  await new Promise<void>((resolve) => gated.listen(0, "127.0.0.1", resolve));
  let refreshed = false;
  const retryProxy = await EmbedProxy.start(
    `http://127.0.0.1:${portOf(gated)}/`,
    {
      cookieProvider: ({ forceRefresh } = {}) => {
        if (forceRefresh) refreshed = true;
        return Promise.resolve(refreshed ? "SSO=fresh" : "SSO=stale");
      },
    },
  );

  const status = await new Promise<number>((resolve, reject) => {
    http
      .request(
        `${retryProxy.origin}/api/sessions`,
        { headers: { origin: WEBVIEW_ORIGIN } },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode ?? 0));
        },
      )
      .on("error", reject)
      .end();
  });

  assert.equal(status, 200);
  assert.deepEqual(calls, ["SSO=stale", "SSO=fresh"]);
  retryProxy.dispose();
  await new Promise((resolve) => gated.close(resolve));
});

test("callers without an origin get no CORS headers", async () => {
  const response = await send("/tangent/embed/v1/tangent-elements.js");

  assert.equal(response.status, 200);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});

test("preflights from a webview are answered without the Shell", async () => {
  seen.length = 0;
  const response = await send("/tangent/api/sessions", {
    method: "OPTIONS",
    headers: { origin: WEBVIEW_ORIGIN },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers["access-control-allow-origin"], WEBVIEW_ORIGIN);
  assert.match(
    String(response.headers["access-control-allow-methods"]),
    /PATCH/,
  );
  assert.equal(seen.length, 0);
});

test("other origins are refused before reaching the Shell", async () => {
  seen.length = 0;
  const response = await send("/tangent/api/sessions", {
    headers: { origin: "https://evil.example" },
  });

  assert.equal(response.status, 403);
  assert.equal(seen.length, 0);
});

test("a foreign Host header is refused (DNS rebinding)", async () => {
  seen.length = 0;
  const response = await send("/tangent/api/sessions", {
    headers: { origin: WEBVIEW_ORIGIN, host: "attacker.example" },
  });

  assert.equal(response.status, 403);
  assert.equal(seen.length, 0);
});

test("a scheme-relative target is refused before reaching another host", async () => {
  const attacker = http.createServer((req, res) => {
    res.writeHead(200).end(`attacker saw cookie: ${req.headers.cookie ?? ""}`);
  });
  await new Promise<void>((resolve) =>
    attacker.listen(0, "127.0.0.1", resolve),
  );
  const seenByAttacker: Array<string | undefined> = [];
  attacker.on("request", (req) => seenByAttacker.push(req.headers.cookie));

  const cookieProxy = await EmbedProxy.start(
    `http://${upstreamHost}/tangent/`,
    {
      cookieProvider: () => Promise.resolve("SSO_TOKEN=secret"),
    },
  );
  const attackerHost = `127.0.0.1:${portOf(attacker)}`;
  const status = await new Promise<number>((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: cookieProxy.port,
        method: "GET",
        path: `//${attackerHost}/steal`,
        headers: { host: `127.0.0.1:${cookieProxy.port}` },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.equal(status, 400);
  assert.deepEqual(seenByAttacker, []);
  cookieProxy.dispose();
  await new Promise((resolve) => attacker.close(resolve));
});

test("an absolute-form target is refused", async () => {
  const status = await new Promise<number>((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: proxy.port,
        method: "GET",
        path: "http://attacker.example/steal",
        headers: { host: `127.0.0.1:${proxy.port}` },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.equal(status, 400);
});

test("WebSocket upgrades are piped through to the Shell", async () => {
  const socket = net.connect(proxy.port, "127.0.0.1");
  const handshake = readUntil(socket, "\r\n\r\n");
  socket.write(
    [
      "GET /tangent/socket.io/?EIO=4&transport=websocket HTTP/1.1",
      `host: ${proxy.origin.replace("http://", "")}`,
      `origin: ${WEBVIEW_ORIGIN}`,
      "upgrade: websocket",
      "connection: Upgrade",
      "",
      "",
    ].join("\r\n"),
  );

  assert.match(await handshake, /^HTTP\/1\.1 101/);
  const echo = readUntil(socket, "echo:ping");
  socket.write("ping");
  assert.match(await echo, /echo:ping/);
  socket.destroy();
});

test("upgrades from other origins are refused", async () => {
  const socket = net.connect(proxy.port, "127.0.0.1");
  const reply = readUntil(socket, "\r\n\r\n");
  socket.write(
    "GET /tangent/socket.io/ HTTP/1.1\r\norigin: https://evil.example\r\nupgrade: websocket\r\nconnection: Upgrade\r\n\r\n",
  );

  assert.match(await reply, /^HTTP\/1\.1 403/);
  socket.destroy();
});

test("an unreachable Shell answers 502", async () => {
  const deadServer = http.createServer();
  await new Promise<void>((resolve) =>
    deadServer.listen(0, "127.0.0.1", resolve),
  );
  const port = portOf(deadServer);
  await new Promise((resolve) => deadServer.close(resolve));
  const deadProxy = await EmbedProxy.start(`http://127.0.0.1:${port}`);

  const response = await new Promise<number>((resolve, reject) => {
    http
      .get(`${deadProxy.origin}/api/sessions`, (res) =>
        resolve(res.statusCode ?? 0),
      )
      .on("error", reject);
  });

  assert.equal(response, 502);
  deadProxy.dispose();
});

test("artifact URLs map from the proxy back onto the Shell", () => {
  assert.equal(
    proxy.toTargetUrl(`${proxy.origin}/tangent/sessions/s1?tab=files#a`),
    `http://${upstreamHost}/tangent/sessions/s1?tab=files#a`,
  );
  assert.equal(
    proxy.toTargetUrl("files/report.html"),
    `http://${upstreamHost}/tangent/files/report.html`,
  );
  assert.equal(
    proxy.toTargetUrl("https://docs.example/page"),
    "https://docs.example/page",
  );
});

test("only VS Code webview origins are allowed by default", () => {
  assert.equal(isWebviewOrigin(WEBVIEW_ORIGIN), true);
  assert.equal(isWebviewOrigin("http://localhost:5173"), false);
});
