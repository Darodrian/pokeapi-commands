import tracker from "../lib/tracker.json" with { type: "json" };

import {
  maybePublishFromQuery,
  spriteExists,
  shinyExists,
  spritePoolForSheetId,
  spriteDisplayName,
} from "../lib/trigger.js";

export default async function handler(req, res) {
  const { name, lang } = req.query;
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const formatTypes = (types, conjunction = "and") => {
    const normalizedTypes = types.map(capitalize);
    if (normalizedTypes.length === 1) return normalizedTypes[0];
    if (normalizedTypes.length === 2) {
      return `${normalizedTypes[0]} ${conjunction} ${normalizedTypes[1]}`;
    }
    return `${normalizedTypes.slice(0, -1).join(", ")} ${conjunction} ${normalizedTypes[normalizedTypes.length - 1]}`;
  };

  // Sprite variations are resolved from the deployed manifest (lib/trigger.js)
  // per pokemon sheet id, and display names come from SpriteCollab's
  // tracker.json. No hardcoded form map is maintained here.

  const sendEmpty = () => {
    res.setHeader("Content-Type", "text/plain");
    res.status(200).send("");
  };

  if (!name || typeof name !== "string") {
    console.log("poketype: missing name parameter");
    sendEmpty();
    return;
  }

  const normalizedName = name.trim().toLowerCase();
  const requestedLang =
    typeof lang === "string" ? lang.trim().toLowerCase() : "en";

  // Normalize a tracker variant name to a PokeAPI form suffix:
  // underscores become hyphens, lowercase, strip other non-alphanumeric.
  // E.g. "Mega_X" -> "mega-x", "Rock_Star" -> "rock-star".
  const normalizeForm = (text) => String(text)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  // Look up a SpriteCollab tracker sheet by name (case-insensitive).
  // Some base names (e.g. "basculin", "aegislash", "zygarde", "mimikyu",
  // and many more) are not accepted by PokeAPI without a form suffix, but
  // exist in the tracker. This covers every pokemon in the tracker, not
  // just a hardcoded list.
  const findTrackerSheetByName = (name) => {
    const normalized = name.toLowerCase();
    for (const [sheetId, sheet] of Object.entries(tracker)) {
      if (sheet.name && sheet.name.toLowerCase() === normalized) {
        return { sheetId: Number(sheetId), sheet };
      }
    }
    return undefined;
  };

  try {
    let data;
    let spriteId;
    let selectedVariation = null;
    let displayName = null;

    // Exact lookup of the requested pokemon (base name or form).
    let response = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalizedName)}`
    );

    if (!response.ok) {
      // PokeAPI does not recognize this base name. Fall back to the tracker
      // to find the sheet by name, then fetch by numeric ID.
      const match = findTrackerSheetByName(normalizedName);
      if (!match) {
        console.log(`poketype: pokemon not found "${normalizedName}"`);
        sendEmpty();
        return;
      }
      response = await fetch(`https://pokeapi.co/api/v2/pokemon/${match.sheetId}`);
      if (!response.ok) {
        console.log(`poketype: pokemon not found by id ${match.sheetId}`);
        sendEmpty();
        return;
      }
    }

    data = await response.json();

    // All deployed sprite variations (base + variants) for this pokemon.
    const pool = await spritePoolForSheetId(data.id);
    const picked =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : { id: data.id, variation: null };
    spriteId = picked.id;
    selectedVariation = picked.variation;

    // Display name from the SpriteCollab tracker, specific to the variation.
    const trackerName = spriteDisplayName(data.id, selectedVariation);
    displayName = trackerName || capitalize(data.name);

    // Resolve types: try the variation-specific PokeAPI form first, fall back
    // to the base pokemon's types when no matching form exists.
    let typeEntries = data.types.sort((a, b) => a.slot - b.slot);
    if (selectedVariation) {
      const sheet = tracker[String(data.id).padStart(4, "0")];
      const trackerVariant = sheet?.subgroups?.[selectedVariation]?.name;
      if (trackerVariant) {
        const normalizedVariant = normalizeForm(trackerVariant);
        const baseName = data.name;
        const formName = `${baseName}-${normalizedVariant}`;
        try {
          const formResponse = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(formName)}`
          );
          if (formResponse.ok) {
            const formData = await formResponse.json();
            typeEntries = formData.types.sort((a, b) => a.slot - b.slot);
          }
        } catch (err) {
          // fall back to base types
        }
      }
    }

    let types = typeEntries.map((entry) => entry.type.name);

    if (requestedLang === "es") {
      types = await Promise.all(
        typeEntries.map(async (entry) => {
          const typeResponse = await fetch(entry.type.url);
          if (!typeResponse.ok) return entry.type.name;
          const typeData = await typeResponse.json();
          const localizedName = typeData.names.find(
            (item) => item.language.name === "es"
          )?.name;
          return localizedName || entry.type.name;
        })
      );
    }

    const formattedTypes = formatTypes(
      types,
      requestedLang === "es" ? "y" : "and"
    );
    const message =
      requestedLang === "es"
        ? `El pok\u00e9mon ${displayName} es de tipo: ${formattedTypes}`
        : `Pokemon ${displayName} is type: ${formattedTypes}`;

    // Publish trigger (~5% shiny, only if sprite/shiny available).
    // maybePublishFromQuery silently skips when no sprite exists.
    const wantsShiny = Math.random() < 0.05;
    const isShiny = wantsShiny && (await shinyExists(spriteId, selectedVariation));
    await maybePublishFromQuery(
      req.query,
      spriteId,
      data.name,
      isShiny,
      selectedVariation
    );

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(message);
  } catch (err) {
    console.error(`poketype: error for "${normalizedName}"`, err);
    sendEmpty();
  }
}
