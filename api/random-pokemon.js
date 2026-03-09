import fetch from "node-fetch";

const MAX_POKEMON = 1017; // update when new gen releases

export default async function handler(req, res) {
  try {
    const id = Math.floor(Math.random() * MAX_POKEMON) + 1;
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await response.json();
    const name = data.name;

    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(name);
  } catch (err) {
    console.error(err);
    res.status(500).send("missingno");
  }
}
