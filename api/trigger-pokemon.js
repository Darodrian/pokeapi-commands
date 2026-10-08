import crypto from "crypto";
import fs from "node:fs";

const MAX_POKEMON = 1017; // update when new gen releases
const CH_PATTERN = /^[a-zA-Z0-9_-]{1,25}$/;

let spriteIds = null;

function loadSpriteIds() {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(new URL("../public/sprites/manifest.json", import.meta.url), "utf8")
    );
    return Object.keys(manifest)
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
  } catch (err) {
    console.error("sprites manifest unreadable, falling back to 1-1017", err);
    return [];
  }
}

function randomSpriteId() {
  if (!spriteIds || spriteIds.length === 0) spriteIds = loadSpriteIds();
  if (spriteIds.length === 0) return Math.floor(Math.random() * MAX_POKEMON) + 1;
  return spriteIds[Math.floor(Math.random() * spriteIds.length)];
}

async function publishTrigger(ch, data) {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;
  const channel = ch ? `t:${ch}` : "t:@global";
  try {
    const res = await fetch(`https://rest.ably.io/channels/${channel}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(key, "utf8").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "trigger", data }),
    });
    if (!res.ok) console.error("ably publish failed", res.status, await res.text());
  } catch (err) {
    console.error("ably publish failed", err);
  }
}

export function isValidCh(ch) {
  return typeof ch === "string" && CH_PATTERN.test(ch);
}

function timingSafeEqualStr(expected, provided) {
  if (typeof provided !== "string" || provided.length === 0) return false;
  const a = crypto.createHash("sha256").update(expected, "utf8").digest();
  const b = crypto.createHash("sha256").update(provided, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

function checkAuth(ch, key) {
  const raw = process.env.TRIGGER_KEYS;
  if (raw === undefined || raw === "") return { ok: true };
  let map;
  try {
    map = JSON.parse(raw);
  } catch (err) {
    console.error("TRIGGER_KEYS is not valid JSON", err);
    return { ok: false, status: 500, message: "auth misconfigured" };
  }
  if (!ch) return { ok: false, status: 401, message: "missing channel" };
  const secret = map[ch];
  if (typeof secret !== "string" || secret.length === 0) {
    return { ok: false, status: 401, message: "invalid key" };
  }
  if (!timingSafeEqualStr(secret, key)) {
    return { ok: false, status: 401, message: "invalid key" };
  }
  return { ok: true };
}

function queryValue(query, name) {
  if (!query || query[name] === undefined) return undefined;
  const v = Array.isArray(query[name]) ? query[name][0] : query[name];
  if (v === undefined || v === "") return undefined;
  return String(v);
}

export default async function handler(req, res) {
  try {
    const ch = queryValue(req.query, "ch");
    if (ch !== undefined && !isValidCh(ch)) {
      res.status(400).send("invalid channel");
      return;
    }
    const auth = checkAuth(ch, queryValue(req.query, "key"));
    if (!auth.ok) {
      res.status(auth.status).send(auth.message);
      return;
    }
    let id;
    if (req.query && req.query.id !== undefined) {
      const requested = Number(req.query.id);
      if (!Number.isInteger(requested) || requested < 1 || requested > MAX_POKEMON) {
        res.status(400).send("invalid id");
        return;
      }
      id = requested;
    } else {
      id = randomSpriteId();
    }
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await response.json();
    const parts = data.name.split("-").map((part) => {
      const lower = part.toLowerCase();
      const capitalized =
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      if (lower === "mr" || lower === "jr") {
        return capitalized + ".";
      }
      return capitalized;
    });
    const hasTitle = parts.some((p) => p.endsWith("."));
    const formattedName = parts.join(hasTitle ? " " : "-");
    const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    const triggerId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const lastTrigger = {
      id,
      name: data.name,
      formattedName,
      imageUrl,
      ts: Date.now(),
      triggerId,
    };
    await publishTrigger(ch, lastTrigger);

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(`${formattedName} ${imageUrl}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("missingno");
  }
}
