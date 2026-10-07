import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { publish, subscribe } from "./events.ts";
import { houseBySlug, listHouses } from "./houses.ts";
import { newToken, readCookie } from "./identity.ts";
import { ensurePerson, getPerson, nameOf, type Person, type PersonRefusal } from "./people.ts";
import { enter, leave, whereEveryoneIs, whoIsIn } from "./presence.ts";
import { housePage, joinPage, mapPage, markdown, page, roomFragment } from "./render.ts";
import { inRoom, place, takeIn, type KeepRefusal, type PlaceRefusal } from "./things.ts";

const PORT = Number(process.env.PORT ?? 8080);
const COOKIE = "who";
const PING_MS = 15_000;

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

const said = (to: string, message: string): string => `${to}?said=${encodeURIComponent(message)}`;

/** A refusal has to land somewhere that can show it. An unvalidated slug from
 *  a form would redirect to a 404, and the 404 page carries no message. */
const backTo = (slug: string): string =>
  houseBySlug(slug) ? `/house/${encodeURIComponent(slug)}` : "/";

/** Every refusal gets words. A button that appears to do nothing teaches the
 *  user the system is broken; being told the rule teaches them the rule. */
const REFUSALS: Record<PersonRefusal | PlaceRefusal | NonNullable<KeepRefusal>, string> = {
  "unknown-house": "There's no such house in this village.",
  "blank-name": "The app needs something to call you.",
  "blank-body": "There's nothing there to put down.",
  "unknown-thing": "That isn't here any more, so nothing was recorded.",
  "own-thing": "You put this down, so you can't be the one who was here for it. A memory is something two of you were there for.",
  already: "You'd already said you were here for this. One person is one keeper, however many times they click.",
};

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const message = url.searchParams.get("said");

    let token = readCookie(req.headers.cookie, COOKIE);
    let setCookie: string | undefined;
    if (!token) {
      token = newToken();
      setCookie = `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
    }
    const me: Person | undefined = getPerson(token);

    // The README is published whether or not you've said who you are.
    if (req.method === "GET" && path === "/readme") {
      const src = readFileSync(new URL("../README.md", import.meta.url), "utf8");
      html(res, 200, page("About — the village", `<main>${markdown(src)}</main>`), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/join") {
      const form = await formData(req);
      const result = ensurePerson(token, form.get("name") ?? "", form.get("home") ?? "");
      if (typeof result === "string") {
        seeOther(res, said("/", REFUSALS[result]), setCookie);
        return;
      }
      seeOther(res, "/", setCookie);
      return;
    }

    if (!me) {
      if (req.method === "POST") {
        // A POST from an unjoined visitor (a stale tab, say) must still be
        // told something — answering with the join page at 200 would read
        // the body never, silently.
        seeOther(res, said("/", "Say who you are first — the app needs a name before you can put anything down."), setCookie);
        return;
      }
      // No door and no password — the brief leaves who counts as a person
      // open — but the app does need something to call you.
      html(res, 200, joinPage(listHouses(), message), setCookie);
      return;
    }

    if (req.method === "GET" && path === "/") {
      const everywhere = whereEveryoneIs();
      const houses = listHouses().map((h) => ({
        ...h,
        hereNames: (everywhere[h.slug] ?? []).map(nameOf),
      }));
      html(res, 200, mapPage(houses, me, message), setCookie);
      return;
    }

    if (req.method === "GET" && path === "/leave") {
      leave(token);
      // Clearing presence but not the cookie would still resolve this token
      // to a person on the next request — the app would say "you've left"
      // and then render the map as you. Leaving means both, and landing on
      // "/" with no cookie is what makes the join page render instead.
      const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
      seeOther(res, said("/", "You've left the village. Everything you put down is still where you put it."), clearCookie);
      return;
    }

    const room = /^\/house\/([a-z-]+)\/room$/.exec(path);
    if (req.method === "GET" && room) {
      const house = houseBySlug(room[1]);
      if (!house) { html(res, 404, page("Not found", "<main><h1>Not found</h1><p>No such house.</p></main>"), setCookie); return; }
      enter(token, house.slug);
      // Computed exactly as the /house/:slug route does, so a reconnecting
      // stream's resync carries the same who-line the full page would.
      const others = whoIsIn(house.slug).filter((p) => p !== token).map(nameOf);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(roomFragment(others, inRoom(house.slug, token), house.slug));
      return;
    }

    const stream = req.method === "GET" && path === "/stream" ? url.searchParams.get("house") : null;
    if (stream) {
      const house = houseBySlug(stream);
      if (!house) { res.writeHead(404).end(); return; }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(": open\n\n");
      const unsubscribe = subscribe(house.slug, (payload) => res.write(`data: ${payload}\n\n`));
      // An open stream is what keeps someone present: the heartbeat refreshes
      // their 45 seconds and keeps intermediaries from closing the socket.
      const ping = setInterval(() => {
        enter(token, house.slug);
        res.write(": ping\n\n");
      }, PING_MS);
      req.on("close", () => {
        clearInterval(ping);
        unsubscribe();
      });
      return;
    }

    const visit = /^\/house\/([a-z-]+)$/.exec(path);
    if (req.method === "GET" && visit) {
      const house = houseBySlug(visit[1]);
      if (!house) { html(res, 404, page("Not found", "<main><h1>Not found</h1><p>No such house.</p></main>"), setCookie); return; }
      // Arriving is what makes you present, so a reader with JavaScript off
      // still counts for the 45 seconds the app will admit to.
      enter(token, house.slug);
      const others = whoIsIn(house.slug).filter((p) => p !== token).map(nameOf);
      html(res, 200, housePage(house, me, others, inRoom(house.slug, token), message), setCookie);
      publish(house.slug, "arrived");
      return;
    }

    if (req.method === "POST" && path === "/place") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const result = place(slug, token, form.get("body") ?? "");
      if (typeof result === "string") {
        seeOther(res, said(backTo(slug), REFUSALS[result]), setCookie);
        return;
      }
      publish(slug, "placed");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/take") {
      const form = await formData(req);
      const thingId = Number(form.get("thing"));
      const back = (form.get("house") ?? "").trim();
      if (!Number.isInteger(thingId)) {
        seeOther(res, said(backTo(back), REFUSALS["unknown-thing"]), setCookie);
        return;
      }
      const refusal = takeIn(thingId, token);
      if (refusal) { seeOther(res, said(backTo(back), REFUSALS[refusal]), setCookie); return; }
      // Only nudge the room that actually changed. A guessed destination
      // would publish to the wrong house's event stream.
      if (houseBySlug(back)) publish(back, "kept");
      seeOther(res, backTo(back), setCookie);
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
