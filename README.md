# pokeapi-commands

Node API with an endpoint that returns a random Pokémon name from [PokeAPI v2](https://pokeapi.co/).

## Setup

```bash
npm install
```

## Run locally

```bash
npx vercel dev
```

Then open `http://localhost:3000/api/random-pokemon` to get a random Pokémon name.

## Deploy

```bash
npx vercel
```

## API

**GET** `/api/random-pokemon`

Returns a random Pokémon name as plain text (e.g. `pikachu`, `charizard`).
