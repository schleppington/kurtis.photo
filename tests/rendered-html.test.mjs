import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/land-50m.json" with { type: "json" };
import { getSellablePhotoKeys, printSelectionKey } from "../lib/print-availability.mjs";
import {
  densifyLandPolygons,
  rewindLandPolygons,
  signedRingArea,
  splitAntimeridianPolygons,
} from "../lib/rewind-geojson.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders kurtis.photo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>kurtis\.photo<\/title>/i);
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="(?:https:\/\/kurtis\.photo)?\/favicon\.svg\?v=2"/i);
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="(?:https:\/\/kurtis\.photo)?\/favicon\.ico"/i);
  assert.match(html, /Things I saw along the way\./);
  assert.match(html, /Yosemite/);
  assert.match(html, /Bangkok/);
  assert.match(html, /Tokyo/);
  assert.match(html, /Koh Samui/);
  assert.match(html, /Costa Rica/);
  assert.match(html, /Explore places/);
  assert.match(html, /Photo index/);
  assert.match(html, /href="\/"[^>]*>Places<\/a>/);
  assert.doesNotMatch(html, /From the archive|Find a place, then wander/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("normalizes globe land polygons to GeoJSON winding order", () => {
  const land = rewindLandPolygons(
    densifyLandPolygons(
      splitAntimeridianPolygons(feature(worldAtlas, worldAtlas.objects.land)),
    ),
  );
  const polygons = land.features[0].geometry.coordinates;

  for (const polygon of polygons) {
    assert.ok(signedRingArea(polygon[0]) >= 0, "exterior rings must not be clockwise");
    for (const hole of polygon.slice(1)) {
      assert.ok(signedRingArea(hole) <= 0, "interior rings must not be counterclockwise");
    }
  }
});

test("keeps a photo-led archive behind the globe home", async () => {
  const response = await render("/places");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Explore the globe/);
  assert.match(html, /All places/);
  assert.match(html, /Cover photograph from Yosemite/);
  assert.doesNotMatch(html, /Follow the pins/);
});

test("renders the curated Prints catalog", async () => {
  const response = await render("/prints");
  assert.equal(response.status, 200);

  const html = await response.text();
  const printData = JSON.parse(await readFile(path.join(root, "content", "prints.json"), "utf8"));
  const availablePrints = printData.items.filter((item) => item.available);
  const availableCollections = new Set(availablePrints.map((item) => item.collectionSlug));
  const algarvePrintCount = availablePrints.filter((item) => item.collectionSlug === "algarve").length;
  assert.match(html, /Algarve No\. 30/);
  assert.equal((html.match(/Add print/g) ?? []).length, 0);
  assert.equal((html.match(/View original collection/g) ?? []).length, availableCollections.size);
  assert.match(html, new RegExp(`${algarvePrintCount} photographs?`));
  assert.match(html, /aria-label="Enlarge Algarve No\. 30"/);
  assert.doesNotMatch(html, /<a[^>]+class="print-catalog-tile"/);
  assert.doesNotMatch(html, /Nothing is for sale right now\./);
});

test("does not trust an unverified Checkout return", async () => {
  const response = await render("/prints?session_id=cs_test_unverified");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Your payment is still being confirmed\./);
  assert.doesNotMatch(html, /Thanks for bringing a moment home\./);
});

test("derives album sellability from the Prints catalog", async () => {
  const prints = JSON.parse(await readFile(path.join(root, "content", "prints.json"), "utf8"));
  const sellableKeys = getSellablePhotoKeys(prints.items);
  const manifestDirectory = path.join(root, "content", "generated");
  const manifestFiles = (await readdir(manifestDirectory)).filter((filename) => filename.endsWith(".json"));
  let sellableCount = 0;

  for (const filename of manifestFiles) {
    const manifest = JSON.parse(await readFile(path.join(manifestDirectory, filename), "utf8"));
    for (const photo of manifest.images) {
      const expected = sellableKeys.has(printSelectionKey(manifest.slug, photo.id));
      assert.equal(photo.sellable, expected, `${manifest.slug}:${photo.id} has a stale sellable value`);
      if (photo.sellable) sellableCount += 1;
    }
  }

  assert.equal(sellableCount, sellableKeys.size);
  assert.equal(sellableCount, 40);
});

test("leads the portraits page with photography", async () => {
  const response = await render("/portraits");
  assert.equal(response.status, 200);

  const html = await response.text();
  const image = html.indexOf("portrait-hero-collage");
  const heading = html.indexOf("People, as they are.");
  assert.ok(image >= 0 && heading >= 0 && image < heading);
  assert.match(html, /portrait-ashley\/portrait-5a22ad78ff68/);
  assert.match(html, /portrait-newborn\/portrait-ca89981e1c9b/);
  assert.match(html, /portrait-maternity\/portrait-7dd7002f6ffc/);
  assert.match(html, /A session shaped around you/);
  assert.match(html, /Portrait from/);
  assert.match(html, /Family/);
  assert.match(html, /Newborn/);
  assert.match(html, /Tell me what you have in mind/);
  assert.doesNotMatch(html, /Have a person, occasion, or loose idea/);
});
