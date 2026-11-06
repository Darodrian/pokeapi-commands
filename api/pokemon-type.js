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
  // Base pokemon name -> PokeAPI form variants that have a sprite in the
  // DEPLOYED spritecollab manifest (sprite IDs 1-898).
  // Only variants with sprite IDs <= 898 are listed, since others cannot be
  // animated by the overlay. Variants are verified against PokeAPI directly.
  const FORM_VARIANTS = {
    mimikyu: [{ name: "mimikyu-disguised", id: 778 }],
    indeedee: [{ name: "indeedee-male", id: 876 }],
    meowstic: [{ name: "meowstic-male", id: 678 }],
    zygarde: [{ name: "zygarde-50", id: 718 }],
    basculin: [{ name: "basculin-red-striped", id: 550 }],
    gourgeist: [{ name: "gourgeist-average", id: 711 }],
    pumpkaboo: [{ name: "pumpkaboo-average", id: 710 }],
    wishiwashi: [{ name: "wishiwashi-solo", id: 746 }],
    keldeo: [{ name: "keldeo-ordinary", id: 647 }],
    meloetta: [{ name: "meloetta-aria", id: 648 }],
    eiscue: [{ name: "eiscue-ice", id: 875 }],
    morpeko: [{ name: "morpeko-full-belly", id: 877 }],
    urshifu: [{ name: "urshifu-single-strike", id: 892 }],
    gastrodon: [{ name: "gastrodon-west", id: 423 }],
    castform: [{ name: "castform-normal", id: 351 }],
    unown: [{ name: "unown-a", id: 201 }],
    shellos: [{ name: "shellos-west", id: 422 }],
    cherrim: [{ name: "cherrim-overcast", id: 487 }],
    nidoran: [
      { name: "nidoran-m", id: 32 },
      { name: "nidoran-f", id: 29 },
    ],
    // New variants discovered by auditing all PokeAPI base names that 404:
    deoxys: [{ name: "deoxys-normal", id: 386 }],
    frillish: [{ name: "frillish-male", id: 592 }],
    jellicent: [{ name: "jellicent-male", id: 593 }],
    pyroar: [{ name: "pyroar-male", id: 668 }],
    aegislash: [{ name: "aegislash-shield", id: 681 }],
    oricorio: [{ name: "oricorio-baile", id: 741 }],
    toxtricity: [{ name: "toxtricity-amped", id: 849 }],
    wormadam: [{ name: "wormadam-plant", id: 413 }],
  };

  const VARIANT_TO_BASE = Object.fromEntries(
    Object.entries(FORM_VARIANTS).flatMap(([base, variants]) =>
      variants.map((v) => [v.name, base])
    )
  );

  // PokeAPI form name -> { id: spriteId, variation: spritecollabVariationFolder }
  // Variation folders match SpriteCollab's sprite/{id}/{variation}/ structure.
  // Only forms with sprite IDs <= 898 are listed (available in spritecollab).
  const SPRITE_VARIATION_MAP = {
    "mimikyu-disguised": { id: 778, variation: null },
    "indeedee-male": { id: 876, variation: null },
    "meowstic-male": { id: 678, variation: null },
    "zygarde-50": { id: 718, variation: null },
    "basculin-red-striped": { id: 550, variation: null },
    "gourgeist-average": { id: 711, variation: null },
    "pumpkaboo-average": { id: 710, variation: null },
    "wishiwashi-solo": { id: 746, variation: null },
    "keldeo-ordinary": { id: 647, variation: null },
    "meloetta-aria": { id: 648, variation: null },
    "eiscue-ice": { id: 875, variation: null },
    "morpeko-full-belly": { id: 877, variation: null },
    "urshifu-single-strike": { id: 892, variation: null },
    "gastrodon-west": { id: 423, variation: null },
    "castform-normal": { id: 351, variation: null },
    "unown-a": { id: 201, variation: null },
    "shellos-west": { id: 422, variation: null },
    "cherrim-overcast": { id: 487, variation: null },
    "nidoran-m": { id: 32, variation: null },
    "nidoran-f": { id: 29, variation: null },
    "deoxys-normal": { id: 386, variation: null },
    "frillish-male": { id: 592, variation: null },
    "jellicent-male": { id: 593, variation: null },
    "pyroar-male": { id: 668, variation: null },
    "aegislash-shield": { id: 681, variation: null },
    "oricorio-baile": { id: 741, variation: null },
    "toxtricity-amped": { id: 849, variation: null },
    "wormadam-plant": { id: 413, variation: null },
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
