import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { addClaim, addCorroboration, listClaims, type Refusal } from "./claims.ts";
import { nameFor, newToken, readCookie } from "./identity.ts";
import { claimsPage, markdown, page } from "./render.ts";

const PORT = Number(process.env.PORT ?? 8080);
const COOKIE = "who";

async function formData(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

const html = (res: ServerResponse, status: number, body: string, cookie?: string): void => {
  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (cookie) headers["set-cookie"] = cookie;
  res.writeHead(status, headers);
  res.end(body);
};

const seeOther = (res: ServerResponse, to: string, cookie?: string): void => {
  const headers: Record<string, string> = { location: to };
  if (cookie) headers["set-cookie"] = cookie;
  res.writeHead(303, headers);
  res.end();
};

/** Every refusal gets words. An app whose argument is that systems should say
 *  what they know must never silently drop an action. */
const REFUSALS: Record<NonNullable<Refusal>, string> = {
  "unknown-claim": "That claim doesn't exist, so nothing was recorded.",
  "own-claim": "You can't corroborate your own claim — a claim can't be its own witness.",
  already: "You'd already said you saw that. One person is one witness, however many times they click.",
};

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    let token = readCookie(req.headers.cookie, COOKIE);
    let setCookie: string | undefined;
    if (!token) {
      token = newToken();
      setCookie = `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      const message = url.searchParams.get("said");
      html(res, 200, claimsPage(listClaims(token), nameFor(token), message), setCookie);
      return;
    }

    if (req.method === "GET" && (url.pathname === "/readme/" || url.pathname === "/readme")) {
      const src = readFileSync(new URL("../README.md", import.meta.url), "utf8");
      html(res, 200, page("About — Corroborated", `<main>${markdown(src)}</main>`), setCookie);
      return;
    }

    if (req.method === "POST" && url.pathname === "/claim") {
      const form = await formData(req);
      const body = (form.get("body") ?? "").trim();
      const place = (form.get("place") ?? "").trim();
      if (!body || !place) {
        seeOther(res, "/?said=" + encodeURIComponent("A claim needs both what you saw and where."), setCookie);
        return;
      }
      addClaim(body, place, token);
      seeOther(res, "/", setCookie);
      return;
    }

    if (req.method === "POST" && url.pathname === "/corroborate") {
      const form = await formData(req);
      const claimId = Number(form.get("claim"));
      if (!Number.isInteger(claimId)) {
        seeOther(res, "/?said=" + encodeURIComponent(REFUSALS["unknown-claim"]), setCookie);
        return;
      }
      const refusal = addCorroboration(claimId, token);
      seeOther(res, refusal ? "/?said=" + encodeURIComponent(REFUSALS[refusal]) : "/", setCookie);
      return;
    }

    html(res, 404, page("Not found", "<main><h1>Not found</h1><p>No such page.</p></main>"), setCookie);
  })().catch((err: unknown) => {
    console.error(JSON.stringify({ at: new Date().toISOString(), level: "error", err: String(err) }));
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Something went wrong.");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ at: new Date().toISOString(), level: "info", msg: "listening", port: PORT }));
});
