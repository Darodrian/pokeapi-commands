import crypto from "crypto";
import tracker from "./tracker.json" with { type: "json" };

export const MAX_POKEMON = 1017; // update when new gen releases
const CH_PATTERN = /^[a-zA-Z0-9_-]{1,25}$/;
const MANIFEST_BASE = "https://darodrian.github.io/pokeapi-sprites/sprites";

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
let manifestNormal = null;
let manifestState = null;
let manifestPromise = null;

// Per-pokemon sprite pools keyed by base Pokédex sheet id.
// Each pool entry is { id: sheetId, variation: null | "0001".."9999" }.
// Base form uses the 4-digit manifest key; variations use 8-digit keys.
let spritePools = null;
let spritePoolPromise = null;

async function loadManifest(name) {
  try {
    const res = await fetch(`${MANIFEST_BASE}/${name}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${name} -> ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`sprites manifest unreadable: ${name}`, err);
    return {};
  }
}

function ensureManifestState() {
  if (manifestState) return Promise.resolve(manifestState);
  if (!manifestPromise) {
    manifestPromise = Promise.all([
      loadManifest("manifest.json"),
      loadManifest("manifest-shiny.json"),
    ]).then(([normal, shiny]) => {
      spriteIds = Object.keys(normal)
        .filter(k => /^\d{4}$/.test(k))
        .map(Number)
        .filter(Number.isInteger)
        .sort((a, b) => a - b);
      spriteIdSet = new Set(Object.keys(normal));
      shinyIds = Object.keys(shiny)
        .filter(k => /^\d{4}$/.test(k))
        .map(Number)
        .filter(Number.isInteger)
        .sort((a, b) => a - b);
      shinyIdSet = new Set(Object.keys(shiny));
      manifestNormal = normal;
      manifestState = { ready: true };
      return manifestState;
    });
  }
  return manifestPromise;
}

// Build per-pokemon pools from the deployed manifest: one entry per sprite
// sheet variation that actually exists (base form + every variation).
async function loadSpritePools() {
  if (spritePools) return spritePools;
  if (!spritePoolPromise) {
    spritePoolPromise = ensureManifestState().then(() => {
      const pools = new Map();
      for (const key of spriteIdSet) {
        // Only include sprites that have a Walk animation (required by overlay).
        if (!manifestNormal[key]?.includes("Walk")) continue;
        const sheetId = Number(key.slice(0, 4));
        const variation = key.length === 4 ? null : key.slice(4, 8);
        const entry = { id: sheetId, variation };
        const pool = pools.get(sheetId) || [];
        pool.push(entry);
        pools.set(sheetId, pool);
      }
      // Base form (variation null) first, then variations in order.
      for (const pool of pools.values()) {
        pool.sort((a, b) => {
          if (a.variation === null && b.variation !== null) return -1;
          if (a.variation !== null && b.variation === null) return 1;
          return (a.variation || "").localeCompare(b.variation || "");
        });
      }
      spritePools = pools;
      return pools;
    });
  }
  return spritePoolPromise;
}

// All sprite variations (base + deployed) for a single pokemon sheet id.
export async function spritePoolForSheetId(sheetId) {
  await loadSpritePools();
  return spritePools.get(sheetId) || [];
}

// Pick a random pokemon (equal weight), then a random sprite from its pool.
export async function randomSpriteEntry() {
  await loadSpritePools();
  const pools = [...spritePools.values()];
  if (pools.length === 0) return { id: Math.floor(Math.random() * MAX_POKEMON) + 1, variation: null };
  const pool = pools[Math.floor(Math.random() * pools.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function spriteExists(id, variation) {
  await ensureManifestState();
  const key = variation ? String(id).padStart(4, '0') + variation : String(id).padStart(4, '0');
  return spriteIdSet.has(key);
}

export async function randomSpriteId() {
  await ensureManifestState();
  if (spriteIds.length === 0) return Math.floor(Math.random() * MAX_POKEMON) + 1;
  return spriteIds[Math.floor(Math.random() * spriteIds.length)];
}

// Shiny availability, checked per base id (and per variation when given).
export async function shinyExists(id, variation) {
  await ensureManifestState();
  const key = variation ? String(id).padStart(4, '0') + variation : String(id).padStart(4, '0');
  return shinyIdSet.has(key);
}

export async function rollShiny(id, variation) {
  if (!(await shinyExists(id, variation))) return false;
  return Math.random() < SHINY_CHANCE;
}

// Display name for a sprite entry from the SpriteCollab tracker.
// Base form: sheet name (e.g. "Charizard").
// Variation: "BaseName VariantName" with underscores turned to spaces
// (e.g. "Charizard Mega X", "Pikachu Rock Star").
export function spriteDisplayName(sheetId, variation) {
  const sheet = tracker[String(sheetId).padStart(4, "0")];
  if (!sheet) return undefined;
  const base = capitalizeWords(sheet.name);
  if (!variation) return base;
  const variant = sheet.subgroups?.[variation]?.name;
  return variant ? `${base} ${capitalizeWords(variant)}` : base;
}

// Turn tracker names like "Ho_Oh" / "Mega_X" into title case: "Ho Oh" / "Mega X".
function capitalizeWords(text) {
  return String(text)
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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

export function buildTriggerPayload(id, name, shiny = false, variation = null) {
  return {
    id,
    name,
    shiny: !!shiny,
    variation,
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

export async function maybePublishFromQuery(query, id, name, shiny, variation) {
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
  if (!(await spriteExists(id, variation))) {
    console.info(`trigger skipped: no sprite for id ${id}${variation ? ' var ' + variation : ''}`);
    return;
  }
  const isShiny = shiny !== undefined ? shiny : await rollShiny(id, variation);
  await publishTrigger(ch, buildTriggerPayload(id, name, isShiny, variation));
}
