import {
  maybePublishFromQuery,
  spriteExists,
  shinyExists,
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

  // Base pokemon name -> PokeAPI form variants that have a sprite in the
  // DEPLOYED spritecollab manifest (flat, one entry per numeric ID 1-898).
  // Each variant includes its PokeAPI form name and sprite ID.
  // Variants with sprite IDs above 898 are not in the deployed manifest
  // and are intentionally omitted so we never try to publish a trigger
  // for a missing sprite.
  const FORM_VARIANTS = {
    mimikyu: [
      { name: "mimikyu-disguised", id: 778 },
      { name: "mimikyu-busted", id: 778 },
    ],
    indeedee: [
      { name: "indeedee-male", id: 876 },
      { name: "indeedee-female", id: 876 },
    ],
    meowstic: [
      { name: "meowstic-male", id: 678 },
    ],
    zygarde: [
      { name: "zygarde-50", id: 718 },
      { name: "zygarde-10", id: 718 },
      { name: "zygarde-complete", id: 718 },
      { name: "zygarde-50-power-construct", id: 718 },
      { name: "zygarde-10-power-construct", id: 718 },
    ],
    basculin: [
      { name: "basculin-red-striped", id: 550 },
      { name: "basculin-white-striped", id: 550 },
      { name: "basculin-blue-striped", id: 550 },
    ],
    gourgeist: [
      { name: "gourgeist-average", id: 711 },
      { name: "gourgeist-small", id: 711 },
      { name: "gourgeist-large", id: 711 },
      { name: "gourgeist-super-size", id: 711 },
    ],
    pumpkaboo: [
      { name: "pumpkaboo-average", id: 710 },
      { name: "pumpkaboo-small", id: 710 },
      { name: "pumpkaboo-large", id: 710 },
      { name: "pumpkaboo-super-size", id: 710 },
    ],
    wishiwashi: [
      { name: "wishiwashi-solo", id: 746 },
      { name: "wishiwashi-school", id: 746 },
    ],
    keldeo: [
      { name: "keldeo-ordinary", id: 647 },
      { name: "keldeo-resolute", id: 647 },
    ],
    meloetta: [
      { name: "meloetta-aria", id: 648 },
      { name: "meloetta-pirouette", id: 648 },
    ],
    eiscue: [
      { name: "eiscue-ice", id: 875 },
      { name: "eiscue-noice", id: 875 },
    ],
    morpeko: [
      { name: "morpeko-full-belly", id: 877 },
      { name: "morpeko-hangry", id: 877 },
    ],
    urshifu: [
      { name: "urshifu-single-strike", id: 892 },
      { name: "urshifu-rapid-strike", id: 892 },
    ],
    gastrodon: [
      { name: "gastrodon-west", id: 423 },
      { name: "gastrodon-east", id: 423 },
    ],
    castform: [
      { name: "castform-normal", id: 351 },
      { name: "castform-sunny", id: 351 },
      { name: "castform-rainy", id: 351 },
      { name: "castform-snowy", id: 351 },
    ],
    unown: [
      { name: "unown-a", id: 201 },
      { name: "unown-b", id: 201 },
      { name: "unown-c", id: 201 },
      { name: "unown-d", id: 201 },
      { name: "unown-e", id: 201 },
      { name: "unown-f", id: 201 },
      { name: "unown-g", id: 201 },
      { name: "unown-h", id: 201 },
      { name: "unown-i", id: 201 },
      { name: "unown-j", id: 201 },
      { name: "unown-k", id: 201 },
      { name: "unown-l", id: 201 },
      { name: "unown-m", id: 201 },
      { name: "unown-n", id: 201 },
      { name: "unown-o", id: 201 },
      { name: "unown-p", id: 201 },
      { name: "unown-q", id: 201 },
      { name: "unown-r", id: 201 },
      { name: "unown-s", id: 201 },
      { name: "unown-t", id: 201 },
      { name: "unown-u", id: 201 },
      { name: "unown-v", id: 201 },
      { name: "unown-w", id: 201 },
      { name: "unown-x", id: 201 },
      { name: "unown-y", id: 201 },
      { name: "unown-z", id: 201 },
      { name: "unown-exclamation", id: 201 },
      { name: "unown-question", id: 201 },
    ],
    shellos: [
      { name: "shellos-west", id: 422 },
      { name: "shellos-east", id: 422 },
    ],
    cherrim: [
      { name: "cherrim-overcast", id: 487 },
      { name: "cherrim-sunshine", id: 487 },
    ],
    nidoran: [
      { name: "nidoran-m", id: 32 },
      { name: "nidoran-f", id: 29 },
    ],
  };

  const VARIANT_TO_BASE = Object.fromEntries(
    Object.entries(FORM_VARIANTS).flatMap(([base, variants]) =>
      variants.map((v) => [v.name, base])
    )
  );

  // PokeAPI form name -> { id: spriteId, variation: spritecollabVariationFolder }
  // Variation folders match SpriteCollab's sprite/{id}/{variation}/ structure.
  // Only forms with spritecollab variation folders are listed here; others
  // fall back to the base sprite (variation = null).
  const SPRITE_VARIATION_MAP = {
    "mimikyu-disguised": { id: 778, variation: null },
    "mimikyu-busted": { id: 778, variation: "0001" },
    "indeedee-male": { id: 876, variation: null },
    "indeedee-female": { id: 876, variation: "0001" },
    "meowstic-male": { id: 678, variation: null },
    "zygarde-50": { id: 718, variation: null },
    "zygarde-10": { id: 718, variation: "0001" },
    "zygarde-complete": { id: 718, variation: "0002" },
    "zygarde-50-power-construct": { id: 718, variation: "0005" },
    "zygarde-10-power-construct": { id: 718, variation: "0006" },
    "basculin-red-striped": { id: 550, variation: null },
    "basculin-white-striped": { id: 550, variation: "0001" },
    "basculin-blue-striped": { id: 550, variation: "0002" },
    "gourgeist-average": { id: 711, variation: null },
    "gourgeist-small": { id: 711, variation: "0001" },
    "gourgeist-large": { id: 711, variation: "0002" },
    "gourgeist-super-size": { id: 711, variation: "0003" },
    "pumpkaboo-average": { id: 710, variation: null },
    "pumpkaboo-small": { id: 710, variation: "0001" },
    "pumpkaboo-large": { id: 710, variation: "0002" },
    "pumpkaboo-super-size": { id: 710, variation: "0003" },
    "wishiwashi-solo": { id: 746, variation: null },
    "wishiwashi-school": { id: 746, variation: "0001" },
    "keldeo-ordinary": { id: 647, variation: null },
    "keldeo-resolute": { id: 647, variation: "0001" },
    "meloetta-aria": { id: 648, variation: null },
    "meloetta-pirouette": { id: 648, variation: "0001" },
    "eiscue-ice": { id: 875, variation: null },
    "eiscue-noice": { id: 875, variation: "0001" },
    "morpeko-full-belly": { id: 877, variation: null },
    "morpeko-hangry": { id: 877, variation: "0001" },
    "urshifu-single-strike": { id: 892, variation: null },
    "urshifu-rapid-strike": { id: 892, variation: "0001" },
    "gastrodon-west": { id: 423, variation: null },
    "gastrodon-east": { id: 423, variation: "0001" },
    "castform-normal": { id: 351, variation: null },
    "castform-sunny": { id: 351, variation: "0001" },
    "castform-rainy": { id: 351, variation: "0002" },
    "castform-snowy": { id: 351, variation: "0003" },
    "unown-a": { id: 201, variation: null },
    "unown-b": { id: 201, variation: "0001" },
    "unown-c": { id: 201, variation: "0002" },
    "unown-d": { id: 201, variation: "0003" },
    "unown-e": { id: 201, variation: "0004" },
    "unown-f": { id: 201, variation: "0005" },
    "unown-g": { id: 201, variation: "0006" },
    "unown-h": { id: 201, variation: "0007" },
    "unown-i": { id: 201, variation: "0008" },
    "unown-j": { id: 201, variation: "0009" },
    "unown-k": { id: 201, variation: "0010" },
    "unown-l": { id: 201, variation: "0011" },
    "unown-m": { id: 201, variation: "0012" },
    "unown-n": { id: 201, variation: "0013" },
    "unown-o": { id: 201, variation: "0014" },
    "unown-p": { id: 201, variation: "0015" },
    "unown-q": { id: 201, variation: "0016" },
    "unown-r": { id: 201, variation: "0017" },
    "unown-s": { id: 201, variation: "0018" },
    "unown-t": { id: 201, variation: "0019" },
    "unown-u": { id: 201, variation: "0020" },
    "unown-v": { id: 201, variation: "0021" },
    "unown-w": { id: 201, variation: "0022" },
    "unown-x": { id: 201, variation: "0023" },
    "unown-y": { id: 201, variation: "0024" },
    "unown-z": { id: 201, variation: "0025" },
    "unown-exclamation": { id: 201, variation: "0026" },
    "unown-question": { id: 201, variation: "0027" },
    "shellos-west": { id: 422, variation: null },
    "shellos-east": { id: 422, variation: "0001" },
    "cherrim-overcast": { id: 487, variation: null },
    "cherrim-sunshine": { id: 487, variation: "0001" },
    "nidoran-m": { id: 32, variation: null },
    "nidoran-f": { id: 29, variation: null },
  };

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

  try {
    let data;
    let spriteId;
    let selectedVariation = null;

    // Check if the user typed a base name that has known variants.
    const baseVariants = FORM_VARIANTS[normalizedName];

    if (baseVariants && baseVariants.length > 0) {
      // Randomly pick a sprite-available variant.
      const availability = await Promise.all(
        baseVariants.map(async (v) => {
          const info =
            SPRITE_VARIATION_MAP[v.name] || { id: v.id, variation: null };
          return spriteExists(info.id, info.variation);
        })
      );
      const spriteVariants = baseVariants.filter((_, i) => availability[i]);

      if (spriteVariants.length > 0) {
        const picked =
          spriteVariants[Math.floor(Math.random() * spriteVariants.length)];
        const info =
          SPRITE_VARIATION_MAP[picked.name] || {
            id: picked.id,
            variation: null,
          };

        // Try fetching the variant's PokeAPI entry for correct types.
        const variantResponse = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(
            picked.name
          )}`
        );
        if (variantResponse.ok) {
          data = await variantResponse.json();
          spriteId = info.id;
          selectedVariation = info.variation;
        } else {
          // Variant not in PokeAPI (e.g. gastrodon-east), fall back to base name.
          const baseResponse = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(
              normalizedName
            )}`
          );
          if (baseResponse.ok) {
            data = await baseResponse.json();
            spriteId = info.id;
            selectedVariation = info.variation;
          }
        }
      } else {
        // No sprite-available variants; fall back to base name.
        const baseResponse = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(
            normalizedName
          )}`
        );
        if (baseResponse.ok) {
          data = await baseResponse.json();
          spriteId = data.id;
        }
      }
    }

    if (!data) {
      // Not a base name with variants — try exact lookup.
      const exactResponse = await fetch(
        `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalizedName)}`
      );

      if (exactResponse.ok) {
        data = await exactResponse.json();
        spriteId = data.id;
        const info =
          SPRITE_VARIATION_MAP[data.name] || {
            id: data.id,
            variation: null,
          };
        spriteId = info.id;
        selectedVariation = info.variation;
      } else {
        console.log(`poketype: pokemon not found "${normalizedName}"`);
        sendEmpty();
        return;
      }
    }

    // Build a normalized display name (strip form suffix for variants).
    const baseName = VARIANT_TO_BASE[data.name] ?? data.name;
    const displayName = capitalize(baseName);

    // Types from the fetched data (variant-specific where available).
    const typeEntries = data.types.sort((a, b) => a.slot - b.slot);
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
        ? `El pokémon ${displayName} es de tipo: ${formattedTypes}`
        : `Pokemon ${displayName} is type: ${formattedTypes}`;

    // Publish trigger (~5% shiny, only if sprite/shiny available).
    // maybePublishFromQuery silently skips when no sprite exists.
    const wantsShiny = Math.random() < 0.05;
    const isShiny = wantsShiny && (await shinyExists(spriteId));
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
