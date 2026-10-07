import { getLastTrigger, redis } from "./trigger-pokemon.js";

export default async function handler(req, res) {
  let last = null;
  if (redis) {
    try {
      last = await redis.get("lastTrigger");
    } catch (err) {
      console.error("redis get failed", err);
    }
  }
  last = last ?? getLastTrigger();
  if (!last) {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ triggered: false });
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(last);
}
