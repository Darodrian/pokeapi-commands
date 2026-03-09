import fetch from "node-fetch";

const MAX_POKEMON = 1017; // update when new gen releases

export default async function handler(req, res) {
  try {
    const id = Math.floor(Math.random() * MAX_POKEMON) + 1;
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
    const name = parts.join(hasTitle ? " " : "-");
    const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(`${name} ${imageUrl}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("missingno");
  }
}
