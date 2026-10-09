# pokeapi-commands

A chat bot with on-screen sprites, with two endpoints:

- **random-pokemon** — returns a random Pokémon with an image link attached
- **pokemon-type** — takes a name and returns that Pokémon's type

Both endpoints can optionally trigger a sprite animation in the
[overlay](#showing-sprites-for-the-commands).

## Chat bot setup

The chat bot can be used by itself, or together with the sprite overlay.

Create a custom command in StreamElements or similar for each endpoint, and
point the response to each URL:

| Command | Response URL |
| --- | --- |
| `!pokerandom` | `https://pokeapi-commands.vercel.app/api/random-pokemon` |
| `!poketype` | `https://pokeapi-commands.vercel.app/api/pokemon-type?name=$(queryescape $(1:))` |

The `!poketype` command takes the first word after it as the Pokémon name
(e.g. `!poketype pikachu`).

## Sprite overlay

Add the overlay to OBS as a **Browser Source**:

- URL: `https://pokeapi-commands.vercel.app/overlay.html`
- Minimum width: **400**
- Minimum height: **800** (the bigger sprite animations need the space)

The sprite always walks in from the right edge, plays a random animation, and
leaves from the same edge. The wider the source, the longer the walk the
Pokémon makes until reaching the center. You can flip the source horizontally
in OBS to match your streaming layout.

### Showing sprites for the commands

Sprites only appear when a channel and its secret key (provided by me) are
added to the URLs:

- **Overlay URL** — add the channel: `overlay.html?ch=yourchannel`
- **API URLs** — add the channel and key: `random-pokemon?ch=yourchannel&key=yourkey`
  (same for pokemon-type)

### Shiny sprites

Each trigger has a random chance to appear shiny (default **1%**). Change it
with the `SHINY_CHANCE` environment variable — a decimal (`0.01`) or a fraction
(`1/100`). Set it to `0` to disable shinies. Preview one in manual mode with
`overlay.html?id=25&shiny=1`.

### Sprite assets

Sprite images *and* the animation manifests are hosted on GitHub Pages at
`https://darodrian.github.io/pokeapi-sprites/sprites/` — this repo keeps no
sprite data and only depends on that site. The overlay loads assets directly
from Pages, and the server fetches the manifests (`manifest.json`,
`manifest-shiny.json`) from the same origin. To (re)build the hosted assets
and manifests from a local SpriteCollab checkout, run the script with the
assets repo as the output, then commit and push that repo:

```
npm run build:assets -- --source "<SpriteCollab>/sprite" --assets-out "<pokeapi-sprites clone>"
```

## Credits

- [PokeAPI](https://pokeapi.co/docs/v2)
- [PMDCollab — SpriteCollab](https://github.com/PMDCollab/SpriteCollab)
