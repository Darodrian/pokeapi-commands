import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    i++;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const source = path.resolve(args.source || path.join(repoRoot, "..", "SpriteCollab-master", "sprite"));
const assetsOut = path.resolve(args["assets-out"] || path.join(repoRoot, "..", "pokeapi-sprites"));
const manifestOut = path.resolve(args["manifest-out"] || path.join(repoRoot, "public", "sprites"));
const minId = Number.parseInt(args.min || "1", 10);
const maxId = Number.parseInt(args.max || "898", 10);

if (!Number.isInteger(minId) || !Number.isInteger(maxId) || minId < 1 || maxId < minId) {
  console.error("invalid --min/--max");
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`source not found: ${source}`);
  process.exit(1);
}

const ANIM_SUFFIX = "-Anim.png";
const id4 = (id) => String(id).padStart(4, "0");

function clearPrevious(destDir) {
  if (!fs.existsSync(destDir)) return;
  for (const entry of fs.readdirSync(destDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(ANIM_SUFFIX) || entry.name === "AnimData.xml") {
      fs.rmSync(path.join(destDir, entry.name));
    }
  }
}

function copySet(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return null;
  const files = fs.readdirSync(srcDir, { withFileTypes: true }).filter((e) => e.isFile());
  const animFiles = files
    .map((e) => e.name)
    .filter((name) => name.endsWith(ANIM_SUFFIX))
    .sort();
  const hasXml = files.some((e) => e.name === "AnimData.xml");
  if (animFiles.length === 0 && !hasXml) return null;

  fs.mkdirSync(destDir, { recursive: true });
  clearPrevious(destDir);

  let bytes = 0;
  for (const name of animFiles) {
    const src = path.join(srcDir, name);
    fs.copyFileSync(src, path.join(destDir, name));
    bytes += fs.statSync(src).size;
  }
  if (hasXml) {
    const src = path.join(srcDir, "AnimData.xml");
    fs.copyFileSync(src, path.join(destDir, "AnimData.xml"));
    bytes += fs.statSync(src).size;
  }
  return {
    anims: animFiles.map((name) => name.slice(0, -ANIM_SUFFIX.length)),
    bytes,
  };
}

const normalManifest = {};
const shinyManifest = {};
const stats = { normal: { dex: 0, files: 0, bytes: 0 }, shiny: { dex: 0, files: 0, bytes: 0 } };
const missingShiny = [];

for (let id = minId; id <= maxId; id++) {
  const d4 = id4(id);

  const normal = copySet(path.join(source, d4), path.join(assetsOut, "sprites", d4));
  if (normal) {
    normalManifest[d4] = normal.anims;
    stats.normal.dex++;
    stats.normal.files += normal.anims.length + 1;
    stats.normal.bytes += normal.bytes;
  }

  const shiny = copySet(path.join(source, d4, "0000", "0001"), path.join(assetsOut, "sprites", "shiny", d4));
  if (shiny) {
    shinyManifest[d4] = shiny.anims;
    stats.shiny.dex++;
    stats.shiny.files += shiny.anims.length + 1;
    stats.shiny.bytes += shiny.bytes;
  } else if (normal) {
    missingShiny.push(d4);
  }
}

fs.mkdirSync(manifestOut, { recursive: true });
fs.writeFileSync(path.join(manifestOut, "manifest.json"), JSON.stringify(normalManifest));
fs.writeFileSync(path.join(manifestOut, "manifest-shiny.json"), JSON.stringify(shinyManifest));

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
console.log(`source:       ${source}`);
console.log(`assets out:   ${assetsOut}`);
console.log(`manifest out: ${manifestOut}`);
console.log(`normal: ${stats.normal.dex} dex, ${stats.normal.files} files, ${mb(stats.normal.bytes)} MB`);
console.log(`shiny:  ${stats.shiny.dex} dex, ${stats.shiny.files} files, ${mb(stats.shiny.bytes)} MB`);
console.log(
  `total:  ${stats.normal.files + stats.shiny.files} files, ${mb(stats.normal.bytes + stats.shiny.bytes)} MB`
);
if (missingShiny.length > 0) {
  console.log(`normal without shiny (${missingShiny.length}): ${missingShiny.join(", ")}`);
}
