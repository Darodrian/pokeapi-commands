import { getLastTrigger, redis, isValidCh, triggerRedisKey } from "./trigger-pokemon.js";

export default async function handler(req, res) {
  if (!req.query || req.query.ch === undefined || req.query.ch === "") {
    return respond(req, res, undefined);
  }
  const raw = Array.isArray(req.query.ch) ? req.query.ch[0] : req.query.ch;
  const ch = String(raw);
  if (!isValidCh(ch)) {
    res.setHeader("Content-Type", "application/json");
    res.status(400).json({ error: "invalid channel" });
    return;
  }
  return respond(req, res, ch);
}

async function respond(req, res, ch) {
  let last = null;
  if (redis) {
    try {
      last = await redis.get(triggerRedisKey(ch));
    } catch (err) {
      console.error("redis get failed", err);
    }
  }
  last = last ?? getLastTrigger(ch);
  res.setHeader("Content-Type", "application/json");
  if (!last) {
    res.status(200).json({ triggered: false });
    return;
  }
  res.status(200).json(last);
}
