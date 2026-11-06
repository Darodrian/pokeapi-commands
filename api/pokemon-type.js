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
    nidoran: [
      { name: "nidoran-m", id: 32 },
      { name: "nidoran-f", id: 29 },
    ],
    charizard: [
      { name: "charizard", id: 6 },
      { name: "charizard-mega-x", id: 10034 },
      { name: "charizard-mega-y", id: 10035 },
      { name: "charizard-gmax", id: 10196 },
    ],
    rattata: [{ name: "rattata", id: 19 }, { name: "rattata-alola", id: 10091 }],
    raticate: [{ name: "raticate", id: 20 }, { name: "raticate-alola", id: 10092 }],
    arbok: [{ name: "arbok", id: 24 }],
    pikachu: [{ name: "pikachu", id: 25 }, { name: "pikachu-rock-star", id: 10080 }],
    raichu: [{ name: "raichu", id: 26 }, { name: "raichu-alola", id: 10100 }],
    vulpix: [{ name: "vulpix", id: 37 }, { name: "vulpix-alola", id: 10103 }],
    ninetales: [{ name: "ninetales", id: 38 }, { name: "ninetales-alola", id: 10104 }],
    diglett: [{ name: "diglett", id: 50 }, { name: "diglett-alola", id: 10105 }],
    dugtrio: [{ name: "dugtrio", id: 51 }, { name: "dugtrio-alola", id: 10106 }],
    meowth: [{ name: "meowth", id: 52 }, { name: "meowth-alola", id: 10107 }],
    growlithe: [{ name: "growlithe", id: 58 }, { name: "growlithe-hisui", id: 10229 }],
    arcanine: [{ name: "arcanine", id: 59 }, { name: "arcanine-hisui", id: 10230 }],
    alakazam: [{ name: "alakazam", id: 65 }, { name: "alakazam-mega", id: 10037 }],
    geodude: [{ name: "geodude", id: 74 }, { name: "geodude-alola", id: 10109 }],
    graveler: [{ name: "graveler", id: 75 }, { name: "graveler-alola", id: 10110 }],
    golem: [{ name: "golem", id: 76 }, { name: "golem-alola", id: 10111 }],
    ponyta: [{ name: "ponyta", id: 77 }, { name: "ponyta-galar", id: 10162 }],
    slowpoke: [{ name: "slowpoke", id: 79 }, { name: "slowpoke-galar", id: 10164 }],
    slowbro: [{ name: "slowbro", id: 80 }, { name: "slowbro-mega", id: 10071 }, { name: "slowbro-galar", id: 10165 }],
    farfetchd: [{ name: "farfetchd", id: 83 }, { name: "farfetchd-galar", id: 10166 }],
    grimer: [{ name: "grimer", id: 88 }, { name: "grimer-alola", id: 10112 }],
    muk: [{ name: "muk", id: 89 }, { name: "muk-alola", id: 10113 }],
    gengar: [{ name: "gengar", id: 94 }, { name: "gengar-mega", id: 10038 }],
    exeggutor: [{ name: "exeggutor", id: 103 }, { name: "exeggutor-alola", id: 10114 }],
    marowak: [{ name: "marowak", id: 105 }, { name: "marowak-alola", id: 10115 }],
    weezing: [{ name: "weezing", id: 110 }, { name: "weezing-galar", id: 10167 }],
    kangaskhan: [{ name: "kangaskhan", id: 115 }, { name: "kangaskhan-mega", id: 10039 }],
    "mr-mime": [{ name: "mr-mime", id: 122 }, { name: "mr-mime-galar", id: 10168 }],
    tauros: [{ name: "tauros", id: 128 }, { name: "tauros-paldea-combat-breed", id: 10250 }, { name: "tauros-paldea-blaze-breed", id: 10251 }, { name: "tauros-paldea-aqua-breed", id: 10252 }],
    gyarados: [{ name: "gyarados", id: 130 }, { name: "gyarados-mega", id: 10041 }],
    aerodactyl: [{ name: "aerodactyl", id: 142 }, { name: "aerodactyl-mega", id: 10042 }],
    articuno: [{ name: "articuno", id: 144 }, { name: "articuno-galar", id: 10169 }],
    zapdos: [{ name: "zapdos", id: 145 }, { name: "zapdos-galar", id: 10170 }],
    moltres: [{ name: "moltres", id: 146 }, { name: "moltres-galar", id: 10171 }],
    mewtwo: [{ name: "mewtwo", id: 150 }, { name: "mewtwo-mega-x", id: 10043 }],
    typhlosion: [{ name: "typhlosion", id: 157 }, { name: "typhlosion-hisui", id: 10233 }],
    wooper: [{ name: "wooper", id: 194 }, { name: "wooper-paldea", id: 10253 }],
    slowking: [{ name: "slowking", id: 199 }, { name: "slowking-galar", id: 10172 }],
    qwilfish: [{ name: "qwilfish", id: 211 }, { name: "qwilfish-hisui", id: 10234 }],
    scizor: [{ name: "scizor", id: 212 }, { name: "scizor-mega", id: 10046 }],
    sneasel: [{ name: "sneasel", id: 215 }, { name: "sneasel-hisui", id: 10235 }],
    skarmory: [{ name: "skarmory", id: 227 }, { name: "skarmory-mega", id: 10284 }],
    houndoom: [{ name: "houndoom", id: 229 }, { name: "houndoom-mega", id: 10048 }],
    tyranitar: [{ name: "tyranitar", id: 248 }, { name: "tyranitar-mega", id: 10049 }],
    gardevoir: [{ name: "gardevoir", id: 282 }, { name: "gardevoir-mega", id: 10051 }],
    sableye: [{ name: "sableye", id: 302 }, { name: "sableye-mega", id: 10066 }],
    mawile: [{ name: "mawile", id: 303 }, { name: "mawile-mega", id: 10052 }],
    aggron: [{ name: "aggron", id: 306 }, { name: "aggron-mega", id: 10053 }],
    medicham: [{ name: "medicham", id: 308 }, { name: "medicham-mega", id: 10054 }],
    sharpedo: [{ name: "sharpedo", id: 319 }, { name: "sharpedo-mega", id: 10070 }],
    camerupt: [{ name: "camerupt", id: 323 }, { name: "camerupt-mega", id: 10087 }],
    spinda: [{ name: "spinda", id: 327 }],
    altaria: [{ name: "altaria", id: 334 }, { name: "altaria-mega", id: 10067 }],
    corphish: [{ name: "corphish", id: 341 }],
    armaldo: [{ name: "armaldo", id: 348 }],
    castform: [{ name: "castform", id: 351 }, { name: "castform-sunny", id: 10013 }, { name: "castform-rainy", id: 10014 }, { name: "castform-snowy", id: 10015 }],
    banette: [{ name: "banette", id: 354 }, { name: "banette-mega", id: 10056 }],
    chimecho: [{ name: "chimecho", id: 358 }, { name: "chimecho-mega", id: 10306 }],
    absol: [{ name: "absol", id: 359 }, { name: "absol-mega", id: 10057 }, { name: "absol-mega-z", id: 10307 }],
    latias: [{ name: "latias", id: 380 }, { name: "latias-mega", id: 10062 }],
    latios: [{ name: "latios", id: 381 }, { name: "latios-mega", id: 10063 }],
    kyogre: [{ name: "kyogre", id: 382 }, { name: "kyogre-primal", id: 10077 }],
    groudon: [{ name: "groudon", id: 383 }, { name: "groudon-primal", id: 10078 }],
    rayquaza: [{ name: "rayquaza", id: 384 }, { name: "rayquaza-mega", id: 10079 }],
    jirachi: [{ name: "jirachi", id: 385 }],
    deoxys: [{ name: "deoxys-normal", id: 386 }, { name: "deoxys-attack", id: 10001 }, { name: "deoxys-defense", id: 10002 }, { name: "deoxys-speed", id: 10003 }],
    burmy: [{ name: "burmy", id: 412 }],
    wormadam: [{ name: "wormadam-plant", id: 413 }, { name: "wormadam-sandy", id: 10004 }, { name: "wormadam-trash", id: 10005 }],
    cherrim: [{ name: "cherrim", id: 421 }],
    lopunny: [{ name: "lopunny", id: 428 }, { name: "lopunny-mega", id: 10088 }],
    lucario: [{ name: "lucario", id: 448 }, { name: "lucario-mega", id: 10059 }],
    gallade: [{ name: "gallade", id: 475 }, { name: "gallade-mega", id: 10068 }],
    rotom: [{ name: "rotom", id: 479 }, { name: "rotom-heat", id: 10008 }, { name: "rotom-wash", id: 10009 }, { name: "rotom-frost", id: 10010 }, { name: "rotom-fan", id: 10011 }, { name: "rotom-mow", id: 10012 }],
    dialga: [{ name: "dialga", id: 483 }, { name: "dialga-origin", id: 10245 }],
    palkia: [{ name: "palkia", id: 484 }, { name: "palkia-origin", id: 10246 }],
    "giratina-altered": [{ name: "giratina-altered", id: 487 }, { name: "giratina-origin", id: 10007 }],
    darkrai: [{ name: "darkrai", id: 491 }, { name: "darkrai-mega", id: 10312 }],
    "shaymin-land": [{ name: "shaymin-land", id: 492 }, { name: "shaymin-sky", id: 10006 }],
    arceus: [{ name: "arceus", id: 493 }],
    "basculin-red-striped": [{ name: "basculin-red-striped", id: 550 }, { name: "basculin-blue-striped", id: 10016 }],
    "darmanitan-standard": [{ name: "darmanitan-standard", id: 555 }, { name: "darmanitan-zen", id: 10017 }],
    deerling: [{ name: "deerling", id: 585 }],
    sawsbuck: [{ name: "sawsbuck", id: 586 }],
    kyurem: [{ name: "kyurem", id: 646 }, { name: "kyurem-black", id: 10022 }, { name: "kyurem-white", id: 10023 }],
    genesect: [{ name: "genesect", id: 649 }],
    vivillon: [{ name: "vivillon", id: 666 }],
    flabebe: [{ name: "flabebe", id: 669 }],
    floette: [{ name: "floette", id: 670 }, { name: "floette-eternal", id: 10061 }, { name: "floette-mega", id: 10296 }],
    florges: [{ name: "florges", id: 671 }],
    hawlucha: [{ name: "hawlucha", id: 701 }, { name: "hawlucha-mega", id: 10300 }],
    "pumpkaboo-average": [{ name: "pumpkaboo-average", id: 710 }, { name: "pumpkaboo-small", id: 10027 }, { name: "pumpkaboo-large", id: 10028 }],
    "zygarde-50": [{ name: "zygarde-50", id: 718 }, { name: "zygarde-10-power-construct", id: 10118 }, { name: "zygarde-50-power-construct", id: 10119 }, { name: "zygarde-complete", id: 10120 }, { name: "zygarde-10", id: 10181 }],
    "oricorio-baile": [{ name: "oricorio-baile", id: 741 }, { name: "oricorio-pom-pom", id: 10123 }],
    "lycanroc-midday": [{ name: "lycanroc-midday", id: 745 }, { name: "lycanroc-midnight", id: 10126 }],
    silvally: [{ name: "silvally", id: 773 }],
    "minior-red-meteor": [{ name: "minior-red-meteor", id: 774 }, { name: "minior-orange-meteor", id: 10130 }, { name: "minior-yellow-meteor", id: 10131 }, { name: "minior-green-meteor", id: 10132 }, { name: "minior-blue-meteor", id: 10133 }, { name: "minior-indigo-meteor", id: 10134 }, { name: "minior-violet-meteor", id: 10135 }],
    alcremie: [{ name: "alcremie", id: 869 }, { name: "alcremie-gmax", id: 10223 }],
    falinks: [{ name: "falinks", id: 870 }, { name: "falinks-mega", id: 10303 }],
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
    "charizard": { id: 6, variation: "0000" },
    "charizard-mega-x": { id: 10034, variation: "0003" },
    "charizard-mega-y": { id: 10035, variation: "0004" },
    "charizard-gmax": { id: 10196, variation: "0005" },
    "rattata": { id: 19, variation: "0000" },
    "rattata-alola": { id: 10091, variation: "0002" },
    "raticate": { id: 20, variation: "0000" },
    "raticate-alola": { id: 10092, variation: "0002" },
    "arbok": { id: 24, variation: "0000" },
    "pikachu": { id: 25, variation: "0000" },
    "pikachu-rock-star": { id: 10080, variation: "0007" },
    "raichu": { id: 26, variation: "0000" },
    "raichu-alola": { id: 10100, variation: "0004" },
    "vulpix": { id: 37, variation: "0000" },
    "vulpix-alola": { id: 10103, variation: "0002" },
    "ninetales": { id: 38, variation: "0000" },
    "ninetales-alola": { id: 10104, variation: "0002" },
    "diglett": { id: 50, variation: "0000" },
    "diglett-alola": { id: 10105, variation: "0003" },
    "dugtrio": { id: 51, variation: "0000" },
    "dugtrio-alola": { id: 10106, variation: "0002" },
    "meowth": { id: 52, variation: "0000" },
    "meowth-alola": { id: 10107, variation: "0002" },
    "growlithe": { id: 58, variation: "0000" },
    "growlithe-hisui": { id: 10229, variation: "0002" },
    "arcanine": { id: 59, variation: "0000" },
    "arcanine-hisui": { id: 10230, variation: "0002" },
    "alakazam": { id: 65, variation: "0000" },
    "alakazam-mega": { id: 10037, variation: "0002" },
    "geodude": { id: 74, variation: "0000" },
    "geodude-alola": { id: 10109, variation: "0002" },
    "graveler": { id: 75, variation: "0000" },
    "graveler-alola": { id: 10110, variation: "0002" },
    "golem": { id: 76, variation: "0000" },
    "golem-alola": { id: 10111, variation: "0002" },
    "ponyta": { id: 77, variation: "0000" },
    "ponyta-galar": { id: 10162, variation: "0002" },
    "slowpoke": { id: 79, variation: "0000" },
    "slowpoke-galar": { id: 10164, variation: "0002" },
    "slowbro": { id: 80, variation: "0000" },
    "slowbro-mega": { id: 10071, variation: "0002" },
    "slowbro-galar": { id: 10165, variation: "0003" },
    "farfetchd": { id: 83, variation: "0000" },
    "farfetchd-galar": { id: 10166, variation: "0002" },
    "grimer": { id: 88, variation: "0000" },
    "grimer-alola": { id: 10112, variation: "0003" },
    "muk": { id: 89, variation: "0000" },
    "muk-alola": { id: 10113, variation: "0002" },
    "gengar": { id: 94, variation: "0000" },
    "gengar-mega": { id: 10038, variation: "0003" },
    "drowzee": { id: 96, variation: "0000" },
    "exeggutor": { id: 103, variation: "0000" },
    "exeggutor-alola": { id: 10114, variation: "0002" },
    "marowak": { id: 105, variation: "0000" },
    "marowak-alola": { id: 10115, variation: "0002" },
    "weezing": { id: 110, variation: "0000" },
    "weezing-galar": { id: 10167, variation: "0002" },
    "kangaskhan": { id: 115, variation: "0000" },
    "kangaskhan-mega": { id: 10039, variation: "0004" },
    "mr-mime": { id: 122, variation: "0000" },
    "mr-mime-galar": { id: 10168, variation: "0002" },
    "tauros": { id: 128, variation: "0000" },
    "tauros-paldea-combat-breed": { id: 10250, variation: "0002" },
    "tauros-paldea-blaze-breed": { id: 10251, variation: "0003" },
    "tauros-paldea-aqua-breed": { id: 10252, variation: "0004" },
    "gyarados": { id: 130, variation: "0000" },
    "gyarados-mega": { id: 10041, variation: "0004" },
    "aerodactyl": { id: 142, variation: "0000" },
    "aerodactyl-mega": { id: 10042, variation: "0002" },
    "articuno": { id: 144, variation: "0000" },
    "articuno-galar": { id: 10169, variation: "0002" },
    "zapdos": { id: 145, variation: "0000" },
    "zapdos-galar": { id: 10170, variation: "0002" },
    "moltres": { id: 146, variation: "0000" },
    "moltres-galar": { id: 10171, variation: "0002" },
    "mewtwo": { id: 150, variation: "0000" },
    "mewtwo-mega-x": { id: 10043, variation: "0003" },
    "typhlosion": { id: 157, variation: "0000" },
    "typhlosion-hisui": { id: 10233, variation: "0002" },
    "wooper": { id: 194, variation: "0000" },
    "wooper-paldea": { id: 10253, variation: "0003" },
    "slowking": { id: 199, variation: "0000" },
    "slowking-galar": { id: 10172, variation: "0002" },
    "unown": { id: 201, variation: "0000" },
    "gligar": { id: 207, variation: "0000" },
    "qwilfish": { id: 211, variation: "0000" },
    "qwilfish-hisui": { id: 10234, variation: "0002" },
    "scizor": { id: 212, variation: "0000" },
    "scizor-mega": { id: 10046, variation: "0005" },
    "sneasel": { id: 215, variation: "0000" },
    "sneasel-hisui": { id: 10235, variation: "0002" },
    "octillery": { id: 224, variation: "0000" },
    "mantine": { id: 226, variation: "0000" },
    "skarmory": { id: 227, variation: "0000" },
    "skarmory-mega": { id: 10284, variation: "0002" },
    "houndoom": { id: 229, variation: "0000" },
    "houndoom-mega": { id: 10048, variation: "0002" },
    "stantler": { id: 234, variation: "0000" },
    "entei": { id: 244, variation: "0000" },
    "suicune": { id: 245, variation: "0000" },
    "tyranitar": { id: 248, variation: "0000" },
    "tyranitar-mega": { id: 10049, variation: "0002" },
    "lugia": { id: 249, variation: "0000" },
    "grovyle": { id: 253, variation: "0000" },
    "zigzagoon": { id: 263, variation: "0000" },
    "zigzagoon-galar": { id: 10174, variation: "0002" },
    "lombre": { id: 271, variation: "0000" },
    "ludicolo": { id: 272, variation: "0000" },
    "gardevoir": { id: 282, variation: "0000" },
    "gardevoir-mega": { id: 10051, variation: "0002" },
    "sableye": { id: 302, variation: "0000" },
    "sableye-mega": { id: 10066, variation: "0002" },
    "mawile": { id: 303, variation: "0000" },
    "mawile-mega": { id: 10052, variation: "0003" },
    "aggron": { id: 306, variation: "0000" },
    "aggron-mega": { id: 10053, variation: "0003" },
    "medicham": { id: 308, variation: "0000" },
    "medicham-mega": { id: 10054, variation: "0002" },
    "volbeat": { id: 313, variation: "0000" },
    "illumise": { id: 314, variation: "0000" },
    "sharpedo": { id: 319, variation: "0000" },
    "sharpedo-mega": { id: 10070, variation: "0002" },
    "camerupt": { id: 323, variation: "0000" },
    "camerupt-mega": { id: 10087, variation: "0002" },
    "spinda": { id: 327, variation: "0000" },
    "altaria": { id: 334, variation: "0000" },
    "altaria-mega": { id: 10067, variation: "0002" },
    "corphish": { id: 341, variation: "0000" },
    "armaldo": { id: 348, variation: "0000" },
    "castform": { id: 351, variation: "0000" },
    "castform-sunny": { id: 10013, variation: "0002" },
    "castform-rainy": { id: 10014, variation: "0003" },
    "castform-snowy": { id: 10015, variation: "0003" },
    "banette": { id: 354, variation: "0000" },
    "banette-mega": { id: 10056, variation: "0002" },
    "chimecho": { id: 358, variation: "0000" },
    "chimecho-mega": { id: 10306, variation: "0002" },
    "absol": { id: 359, variation: "0000" },
    "absol-mega": { id: 10057, variation: "0003" },
    "absol-mega-z": { id: 10307, variation: "0004" },
    "walrein": { id: 365, variation: "0000" },
    "latias": { id: 380, variation: "0000" },
    "latias-mega": { id: 10062, variation: "0002" },
    "latios": { id: 381, variation: "0000" },
    "latios-mega": { id: 10063, variation: "0002" },
    "kyogre": { id: 382, variation: "0000" },
    "kyogre-primal": { id: 10077, variation: "0002" },
    "groudon": { id: 383, variation: "0000" },
    "groudon-primal": { id: 10078, variation: "0002" },
    "rayquaza": { id: 384, variation: "0000" },
    "rayquaza-mega": { id: 10079, variation: "0002" },
    "jirachi": { id: 385, variation: "0000" },
    "deoxys-normal": { id: 386, variation: "0000" },
    "deoxys-attack": { id: 10001, variation: "0002" },
    "deoxys-defense": { id: 10002, variation: "0003" },
    "deoxys-speed": { id: 10003, variation: "0004" },
    "burmy": { id: 412, variation: "0000" },
    "wormadam-plant": { id: 413, variation: "0000" },
    "wormadam-sandy": { id: 413, variation: "0001" },
    "wormadam-trash": { id: 413, variation: "0002" },
    "cherrim": { id: 421, variation: "0000" },
    "lopunny": { id: 428, variation: "0000" },
    "lopunny-mega": { id: 10088, variation: "0002" },
    "lucario": { id: 448, variation: "0000" },
    "lucario-mega": { id: 10059, variation: "0003" },
    "croagunk": { id: 453, variation: "0000" },
    "weavile": { id: 461, variation: "0000" },
    "gallade": { id: 475, variation: "0000" },
    "gallade-mega": { id: 10068, variation: "0002" },
    "probopass": { id: 476, variation: "0000" },
    "rotom": { id: 479, variation: "0000" },
    "rotom-heat": { id: 10008, variation: "0002" },
    "rotom-wash": { id: 10009, variation: "0003" },
    "rotom-frost": { id: 10010, variation: "0004" },
    "rotom-fan": { id: 10011, variation: "0005" },
    "rotom-mow": { id: 10012, variation: "0008" },
    "dialga": { id: 483, variation: "0000" },
    "dialga-origin": { id: 10245, variation: "0002" },
    "palkia": { id: 484, variation: "0000" },
    "palkia-origin": { id: 10246, variation: "0002" },
    "giratina-altered": { id: 487, variation: "0000" },
    "giratina-origin": { id: 10007, variation: "0002" },
    "darkrai": { id: 491, variation: "0000" },
    "darkrai-mega": { id: 10312, variation: "0002" },
    "shaymin-land": { id: 492, variation: "0000" },
    "shaymin-sky": { id: 10006, variation: "0002" },
    "arceus": { id: 493, variation: "0000" },
    "basculin-red-striped": { id: 550, variation: "0000" },
    "basculin-blue-striped": { id: 550, variation: "0001" },
    "darmanitan-standard": { id: 555, variation: "0000" },
    "darmanitan-zen": { id: 555, variation: "0002" },
    "deerling": { id: 585, variation: "0000" },
    "sawsbuck": { id: 586, variation: "0000" },
    "kyurem": { id: 646, variation: "0000" },
    "kyurem-black": { id: 646, variation: "0002" },
    "kyurem-white": { id: 646, variation: "0006" },
    "genesect": { id: 649, variation: "0000" },
    "vivillon": { id: 666, variation: "0000" },
    "flabebe": { id: 669, variation: "0000" },
    "floette": { id: 670, variation: "0000" },
    "floette-eternal": { id: 670, variation: "0002" },
    "floette-mega": { id: 670, variation: "0003" },
    "florges": { id: 671, variation: "0000" },
    "hawlucha": { id: 701, variation: "0000" },
    "hawlucha-mega": { id: 701, variation: "0002" },
    "pumpkaboo-average": { id: 710, variation: "0000" },
    "pumpkaboo-small": { id: 710, variation: "0002" },
    "pumpkaboo-large": { id: 710, variation: "0003" },
    "zygarde-50": { id: 718, variation: "0000" },
    "zygarde-10-power-construct": { id: 718, variation: "0002" },
    "zygarde-50-power-construct": { id: 718, variation: "0005" },
    "zygarde-complete": { id: 718, variation: "0006" },
    "zygarde-10": { id: 718, variation: "0007" },
    "oricorio-baile": { id: 741, variation: "0000" },
    "oricorio-pom-pom": { id: 741, variation: "0002" },
    "lycanroc-midday": { id: 745, variation: "0000" },
    "lycanroc-midnight": { id: 745, variation: "0002" },
    "silvally": { id: 773, variation: "0000" },
    "minior-red-meteor": { id: 774, variation: "0000" },
    "minior-orange-meteor": { id: 774, variation: "0002" },
    "minior-yellow-meteor": { id: 774, variation: "0003" },
    "minior-green-meteor": { id: 774, variation: "0004" },
    "minior-blue-meteor": { id: 774, variation: "0005" },
    "minior-indigo-meteor": { id: 774, variation: "0006" },
    "minior-violet-meteor": { id: 774, variation: "0007" },
    "alcremie": { id: 869, variation: "0000" },
    "alcremie-gmax": { id: 869, variation: "0002" },
    "falinks": { id: 870, variation: "0000" },
    "falinks-mega": { id: 870, variation: "0003" },
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
