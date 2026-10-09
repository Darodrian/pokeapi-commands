import {
  MAX_POKEMON,
  randomSpriteId,
  formatPokemonName,
  maybePublishFromQuery,
} from "../lib/trigger.js";

export default async function handler(req, res) {
  try {
    const query = req.query || {};
    const wantsTrigger = query.ch !== undefined || query.key !== undefined;
    let id;
    if (query.id !== undefined) {
      const requested = Number(query.id);
      if (!Number.isInteger(requested) || requested < 1 || requested > MAX_POKEMON) {
        res.status(400).send("invalid id");
        return;
      }
      id = requested;
    } else if (wantsTrigger) {
      id = await randomSpriteId();
    } else {
      id = Math.floor(Math.random() * MAX_POKEMON) + 1;
    }
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await response.json();
    const formattedName = formatPokemonName(data.name);
    const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    await maybePublishFromQuery(query, id, data.name);

    const format = typeof req.query?.format === "string" ? req.query.format.toLowerCase() : "text";

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.status(200).json({
        id,
        name: data.name,
        formattedName,
        imageUrl,
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
