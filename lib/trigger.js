import crypto from "crypto";
import fs from "node:fs";

export const MAX_POKEMON = 1017; // update when new gen releases
const CH_PATTERN = /^[a-zA-Z0-9_-]{1,25}$/;

function parseChance(raw) {
  if (raw === undefined || raw === "") return 0.01;
  const value = String(raw).trim();
  const fraction = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const den = Number(fraction[2]);
    if (den > 0) return Number(fraction[1]) / den;
  }
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0.01;
}

const SHINY_CHANCE = parseChance(process.env.SHINY_CHANCE);

let spriteIds = null;
let spriteIdSet = null;
let shinyIds = null;
let shinyIdSet = null;

function loadIds(file) {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(new URL(file, import.meta.url), "utf8")
    );
    return Object.keys(manifest)
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
  } catch (err) {
    console.error(`sprites manifest unreadable: ${file}`, err);
    return [];
  }
}

function ensureSprites() {
  if (!spriteIds) {
    spriteIds = loadIds("../public/sprites/manifest.json");
    spriteIdSet = new Set(spriteIds);
  }
  return spriteIdSet;
}

function ensureShiny() {
  if (!shinyIds) {
    shinyIds = loadIds("../public/sprites/manifest-shiny.json");
    shinyIdSet = new Set(shinyIds);
  }
  return shinyIdSet;
}

export function spriteExists(id) {
  return ensureSprites().has(id);
}

export function randomSpriteId() {
  ensureSprites();
  if (spriteIds.length === 0) return Math.floor(Math.random() * MAX_POKEMON) + 1;
  return spriteIds[Math.floor(Math.random() * spriteIds.length)];
}

export function rollShiny(id) {
  if (!ensureShiny().has(id)) return false;
  return Math.random() < SHINY_CHANCE;
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

export function checkAuth(ch, key) {
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

export function formatPokemonName(name) {
  const parts = name.split("-").map((part) => {
    const lower = part.toLowerCase();
    const capitalized =
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    if (lower === "mr" || lower === "jr") {
      return capitalized + ".";
    }
    return capitalized;
  });
  const hasTitle = parts.some((p) => p.endsWith("."));
  return parts.join(hasTitle ? " " : "-");
}

export function buildTriggerPayload(id, name, shiny = false) {
  return {
    id,
    name,
    shiny: !!shiny,
    formattedName: formatPokemonName(name),
    imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
    ts: Date.now(),
    triggerId: Date.now().toString(36) + Math.random().toString(36).slice(2),
  };
}

export async function publishTrigger(ch, data) {
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

function queryValue(query, name) {
  if (!query || query[name] === undefined) return undefined;
  const v = Array.isArray(query[name]) ? query[name][0] : query[name];
  if (v === undefined || v === "") return undefined;
  return String(v);
}

export async function maybePublishFromQuery(query, id, name) {
  const ch = queryValue(query, "ch");
  const key = queryValue(query, "key");
  if (ch === undefined && key === undefined) return;
  if (ch !== undefined && !isValidCh(ch)) {
    console.warn(`trigger skipped: invalid channel "${ch}"`);
    return;
  }
  const auth = checkAuth(ch, key);
  if (!auth.ok) {
    console.info(`trigger skipped: ${auth.message}`);
    return;
  }
  if (!spriteExists(id)) {
    console.info(`trigger skipped: no sprite for id ${id}`);
    return;
  }
  await publishTrigger(ch, buildTriggerPayload(id, name, rollShiny(id)));
}
