import fetch from "node-fetch";

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

  if (!name || typeof name !== "string") {
    res.status(400).send("Please provide a pokemon name using ?name=<pokemon>");
    return;
  }

  try {
    const normalizedName = name.trim().toLowerCase();
    const requestedLang = typeof lang === "string" ? lang.trim().toLowerCase() : "en";
    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalizedName)}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        res.status(404).send("Pokemon not found");
        return;
      }

      throw new Error(`PokeAPI request failed with status ${response.status}`);
    }

    const data = await response.json();
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

    const displayName = capitalize(data.name);
    const formattedTypes = formatTypes(types, requestedLang === "es" ? "y" : "and");
    const message =
      requestedLang === "es"
        ? `El pokémon ${displayName} es de tipo: ${formattedTypes}`
        : `Pokemon ${displayName} is type: ${formattedTypes}`;

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(message);
  } catch (err) {
    console.error(err);
    res.status(500).send("missingno");
  }
}
