#!/usr/bin/env node
"use strict";

const Fs = require("fs");
const Path = require("path");
const Crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

function usage(){
  console.error([
    "Usage:",
    "  node scripts/migrate-pages-sqlite.js --db <file> --store <id=dir> [--store <id=dir>...] [--json]",
    "",
    "Example:",
    "  node scripts/migrate-pages-sqlite.js --db .tmp/pages.sqlite --store SimpliJs=simplijs/wiki/simplijs.dir",
    "",
    "Notes:",
    "  - Each --store migrates direct page files only; child .dir stores should be passed explicitly.",
    "  - Existing rows are upserted by store_id + page name.",
    "  - Revisions are deduplicated by store_id + page name + body hash."
  ].join("\n"));
}

function parseArgs(argv){
  const args = {
    db: null,
    stores: [],
    json: false
  };

  for( let ii = 2; ii < argv.length; ii++ ){
    const arg = argv[ii];
    if( arg === "--help" || arg === "-h" ){
      usage();
      process.exit(0);
    }
    if( arg === "--json" ){
      args.json = true;
      continue;
    }
    if( arg === "--db" ){
      args.db = argv[++ii];
      continue;
    }
    if( arg === "--store" ){
      const spec = argv[++ii] || "";
      const eq = spec.indexOf("=");
      if( eq <= 0 || eq === spec.length - 1 ){
        throw new Error("Invalid --store value, expected id=dir: " + spec);
      }
      args.stores.push({
        id: spec.slice(0, eq),
        dir: spec.slice(eq + 1)
      });
      continue;
    }
    throw new Error("Unknown argument: " + arg);
  }

  if( !args.db ) throw new Error("Missing --db <file>");
  if( !args.stores.length ) throw new Error("Missing at least one --store <id=dir>");
  return args;
}

function sha256(text){
  return Crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function isoDate(date){
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

function ensureSchema(db){
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS page_stores (
      store_id TEXT PRIMARY KEY,
      source_path TEXT NOT NULL,
      migrated_at TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      byte_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pages (
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      body_sha256 TEXT NOT NULL,
      source_mtime TEXT NOT NULL,
      source_path TEXT NOT NULL,
      migrated_at TEXT NOT NULL,
      PRIMARY KEY (store_id, name),
      FOREIGN KEY (store_id) REFERENCES page_stores(store_id)
    );

    CREATE TABLE IF NOT EXISTS page_revisions (
      revision_id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      body_sha256 TEXT NOT NULL,
      source_mtime TEXT NOT NULL,
      source_path TEXT NOT NULL,
      migrated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES page_stores(store_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS page_revisions_source_hash
      ON page_revisions(store_id, name, body_sha256);
  `);
}

function readStore(store){
  const sourceDir = Path.resolve(store.dir);
  const stat = Fs.statSync(sourceDir);
  if( !stat.isDirectory() ){
    throw new Error("Store is not a directory: " + sourceDir);
  }

  const entries = Fs.readdirSync(sourceDir, { withFileTypes: true });
  const pages = [];
  for( const entry of entries ){
    if( !entry.isFile() ) continue;
    const pagePath = Path.join(sourceDir, entry.name);
    const pageStat = Fs.statSync(pagePath);
    const body = Fs.readFileSync(pagePath, "utf8");
    pages.push({
      name: entry.name,
      body,
      byteLength: Buffer.byteLength(body, "utf8"),
      hash: sha256(body),
      sourceMtime: isoDate(pageStat.mtime),
      sourcePath: pagePath
    });
  }

  pages.sort((aa, bb) => aa.name.localeCompare(bb.name));
  return {
    id: store.id,
    sourceDir,
    pages
  };
}

function migrateStore(db, storeData, migratedAt){
  const totalBytes = storeData.pages.reduce((sum, page) => sum + page.byteLength, 0);
  db.prepare(`
    INSERT INTO page_stores (store_id, source_path, migrated_at, page_count, byte_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(store_id) DO UPDATE SET
      source_path = excluded.source_path,
      migrated_at = excluded.migrated_at,
      page_count = excluded.page_count,
      byte_count = excluded.byte_count
  `).run(storeData.id, storeData.sourceDir, migratedAt, storeData.pages.length, totalBytes);

  const upsertPage = db.prepare(`
    INSERT INTO pages (
      store_id, name, body, byte_length, body_sha256, source_mtime, source_path, migrated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(store_id, name) DO UPDATE SET
      body = excluded.body,
      byte_length = excluded.byte_length,
      body_sha256 = excluded.body_sha256,
      source_mtime = excluded.source_mtime,
      source_path = excluded.source_path,
      migrated_at = excluded.migrated_at
  `);

  const insertRevision = db.prepare(`
    INSERT OR IGNORE INTO page_revisions (
      revision_id, store_id, name, body, byte_length, body_sha256, source_mtime, source_path, migrated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for( const page of storeData.pages ){
      upsertPage.run(
        storeData.id,
        page.name,
        page.body,
        page.byteLength,
        page.hash,
        page.sourceMtime,
        page.sourcePath,
        migratedAt
      );
      const revisionId = sha256([storeData.id, page.name, page.hash].join("\0"));
      insertRevision.run(
        revisionId,
        storeData.id,
        page.name,
        page.body,
        page.byteLength,
        page.hash,
        page.sourceMtime,
        page.sourcePath,
        migratedAt
      );
    }
    db.exec("COMMIT");
  } catch( err ){
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    store_id: storeData.id,
    source_path: storeData.sourceDir,
    page_count: storeData.pages.length,
    byte_count: totalBytes
  };
}

function main(){
  const args = parseArgs(process.argv);
  const dbPath = Path.resolve(args.db);
  Fs.mkdirSync(Path.dirname(dbPath), { recursive: true });

  const migratedAt = new Date().toISOString();
  const db = new DatabaseSync(dbPath);
  ensureSchema(db);

  const summaries = [];
  for( const store of args.stores ){
    const storeData = readStore(store);
    summaries.push(migrateStore(db, storeData, migratedAt));
  }
  db.close();

  const result = {
    db_path: dbPath,
    migrated_at: migratedAt,
    stores: summaries,
    totals: {
      store_count: summaries.length,
      page_count: summaries.reduce((sum, item) => sum + item.page_count, 0),
      byte_count: summaries.reduce((sum, item) => sum + item.byte_count, 0)
    }
  };

  if( args.json ){
    console.log(JSON.stringify(result, null, 2));
  }else{
    console.log("Migrated page stores to " + result.db_path);
    for( const item of result.stores ){
      console.log("- " + item.store_id + ": " + item.page_count + " pages, " + item.byte_count + " bytes");
    }
  }
}

try {
  main();
} catch( err ){
  console.error("migrate-pages-sqlite: " + err.message);
  process.exit(1);
}
