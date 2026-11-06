import {
  MAX_POKEMON,
  randomSpriteEntry,
  formatPokemonName,
  maybePublishFromQuery,
  spriteDisplayName,
} from "../lib/trigger.js";

export default async function handler(req, res) {
  try {
    const query = req.query || {};
    const wantsTrigger = query.ch !== undefined || query.key !== undefined;
    let id;
    let variation = null;

    if (query.id !== undefined) {
      const requested = Number(query.id);
      if (!Number.isInteger(requested) || requested < 1 || requested > MAX_POKEMON) {
        res.status(400).send("invalid id");
        return;
      }
      id = requested;
    } else if (wantsTrigger) {
      // Trigger path: pick a random pokemon (equal weight), then a random
      // sprite from its pool (base + every deployed variation).
      const entry = await randomSpriteEntry();
      id = entry.id;
      variation = entry.variation;
    } else {
      id = Math.floor(Math.random() * MAX_POKEMON) + 1;
    }

    let data;
    let name;
    let nameIsFormatted = false; // tracker display names are already formatted
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (response.ok) {
      data = await response.json();
      if (variation) {
        // Variation rolled: use the tracker display name (already formatted).
        const trackerName = spriteDisplayName(id, variation);
        name = trackerName || data.name;
        nameIsFormatted = !!trackerName;
      } else {
        name = data.name;
      }
    } else {
      // id may sit outside PokeAPI's range (e.g. sheet 1024); fall back to tracker name.
      name = spriteDisplayName(id, variation) || `pokemon-${id}`;
      nameIsFormatted = true;
    }

    const formattedName = nameIsFormatted ? name : formatPokemonName(name);
    const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    await maybePublishFromQuery(query, id, name, undefined, variation);

    const format = typeof req.query?.format === "string" ? req.query.format.toLowerCase() : "text";

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.status(200).json({
        id,
        name: data ? data.name : name,
        formattedName,
        imageUrl,
        variation,
      });
      return;
    }

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(`${formattedName} ${imageUrl}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("missingno");
  }
}
