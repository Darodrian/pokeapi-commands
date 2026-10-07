import fetch from "node-fetch";
import { Redis } from "@upstash/redis";

const MAX_POKEMON = 1017; // update when new gen releases

export const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

let lastTrigger = null;

export function getLastTrigger() {
  return lastTrigger;
}

export default async function handler(req, res) {
  try {
    let id;
    if (req.query && req.query.id !== undefined) {
      const requested = Number(req.query.id);
      if (!Number.isInteger(requested) || requested < 1 || requested > MAX_POKEMON) {
        res.status(400).send("invalid id");
        return;
      }
      id = requested;
    } else {
      id = Math.floor(Math.random() * MAX_POKEMON) + 1;
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
    lastTrigger = {
      id,
      name: data.name,
      formattedName,
      imageUrl,
      ts: Date.now(),
      triggerId,
    };

    if (redis) {
      try {
        await redis.set("lastTrigger", lastTrigger);
      } catch (err) {
        console.error("redis set failed", err);
      }
    }

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(`${formattedName} ${imageUrl}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("missingno");
  }
}
