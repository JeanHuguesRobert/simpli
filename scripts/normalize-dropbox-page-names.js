#!/usr/bin/env node
"use strict";

const Fs = require("fs");
const Path = require("path");

function usage(){
  console.error([
    "Usage:",
    "  node scripts/normalize-dropbox-page-names.js --store <dir> [--store <dir>...] [--apply] [--json]",
    "",
    "Rule:",
    "  Aa_Ba -> AaBa, by removing underscores that immediately precede A-Z.",
    "  If AaBa already exists in the same store, Aa_Ba is reported as obsolete.",
    "  If AaBa is missing, --apply renames Aa_Ba to AaBa.",
    "",
    "No files are deleted by this script."
  ].join("\n"));
}

function parseArgs(argv){
  const args = {
    stores: [],
    apply: false,
    json: false
  };
  for( let ii = 2; ii < argv.length; ii++ ){
    const arg = argv[ii];
    if( arg === "--help" || arg === "-h" ){
      usage();
      process.exit(0);
    }
    if( arg === "--apply" ){
      args.apply = true;
      continue;
    }
    if( arg === "--json" ){
      args.json = true;
      continue;
    }
    if( arg === "--store" ){
      args.stores.push(argv[++ii]);
      continue;
    }
    throw new Error("Unknown argument: " + arg);
  }
  if( !args.stores.length ) throw new Error("Missing at least one --store <dir>");
  return args;
}

function canonicalName(name){
  return name.replace(/_([A-Z])/g, "$1");
}

function inspectStore(storeDir, apply){
  const dir = Path.resolve(storeDir);
  const entries = Fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort((aa, bb) => aa.localeCompare(bb));
  const names = new Set(entries);
  const candidates = [];
  const renamed = [];
  const obsolete = [];
  const collisions = [];

  for( const name of entries ){
    const canonical = canonicalName(name);
    if( canonical === name ) continue;
    const item = {
      old_name: name,
      canonical_name: canonical,
      old_path: Path.join(dir, name),
      canonical_path: Path.join(dir, canonical),
      canonical_exists: names.has(canonical)
    };
    candidates.push(item);
    if( item.canonical_exists ){
      obsolete.push(item);
      continue;
    }
    if( apply ){
      if( Fs.existsSync(item.canonical_path) ){
        collisions.push({ ...item, reason: "canonical path appeared during run" });
        continue;
      }
      Fs.renameSync(item.old_path, item.canonical_path);
      renamed.push(item);
      names.delete(name);
      names.add(canonical);
    }
  }

  return {
    store_path: dir,
    apply,
    scanned_pages: entries.length,
    candidate_count: candidates.length,
    renamed_count: renamed.length,
    obsolete_count: obsolete.length,
    collision_count: collisions.length,
    candidates,
    renamed,
    obsolete,
    collisions
  };
}

function main(){
  const args = parseArgs(process.argv);
  const stores = args.stores.map(store => inspectStore(store, args.apply));
  const result = {
    apply: args.apply,
    stores,
    totals: {
      scanned_pages: stores.reduce((sum, store) => sum + store.scanned_pages, 0),
      candidate_count: stores.reduce((sum, store) => sum + store.candidate_count, 0),
      renamed_count: stores.reduce((sum, store) => sum + store.renamed_count, 0),
      obsolete_count: stores.reduce((sum, store) => sum + store.obsolete_count, 0),
      collision_count: stores.reduce((sum, store) => sum + store.collision_count, 0)
    }
  };

  if( args.json ){
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for( const store of stores ){
    console.log(store.store_path);
    console.log("  scanned: " + store.scanned_pages);
    console.log("  candidates: " + store.candidate_count);
    console.log("  renamed: " + store.renamed_count);
    console.log("  obsolete: " + store.obsolete_count);
    console.log("  collisions: " + store.collision_count);
  }
}

try {
  main();
} catch( err ){
  console.error("normalize-dropbox-page-names: " + err.message);
  process.exit(1);
}
