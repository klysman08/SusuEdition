#!/usr/bin/env node
// Sincroniza a versão em package.json e src-tauri/Cargo.toml.
// (tauri.conf.json lê a versão do package.json automaticamente.)
//
// Uso: pnpm version:bump 0.2.0      → atualiza os arquivos
//      pnpm version:bump 0.2.0 --tag → também cria commit e tag v0.2.0
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [version, flag] = process.argv.slice(2);
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Uso: pnpm version:bump <semver> [--tag]");
  process.exit(1);
}

const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8").replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

// Atualiza o Cargo.lock para refletir a nova versão do crate.
execFileSync("cargo", ["update", "-p", "susuedition", "--manifest-path", cargoPath], { stdio: "inherit" });

console.log(`Versão atualizada para ${version}`);

if (flag === "--tag") {
  execFileSync("git", ["add", pkgPath, cargoPath, "src-tauri/Cargo.lock"], { stdio: "inherit" });
  execFileSync("git", ["commit", "-m", `chore(release): v${version}`], { stdio: "inherit" });
  execFileSync("git", ["tag", "-a", `v${version}`, "-m", `v${version}`], { stdio: "inherit" });
  console.log(`Tag v${version} criada. Envie com: git push --follow-tags`);
}
