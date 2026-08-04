#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getSellablePhotoKeys, printSelectionKey } from "../lib/print-availability.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argumentsList = process.argv.slice(2);
const collectionSlug = argumentsList.find((argument) => !argument.startsWith("--"));
const options = argumentsList.filter((argument) => argument.startsWith("--"));
const replaceExisting = options.includes("--replace");
const portraits = options.includes("--portraits");

if (!collectionSlug) {
  console.error("Usage: npm run photos:prepare -- <collection-slug> [--replace] | npm run portraits:prepare -- <collection-slug> [--replace]");
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(collectionSlug)) {
  console.error("Collection slugs may contain lowercase letters, numbers, and hyphens only.");
  process.exit(1);
}

if (options.some((option) => option !== "--replace" && option !== "--portraits")) {
  console.error("The only supported options are --replace and --portraits.");
  process.exit(1);
}

const publicCollectionSlug = portraits ? `portrait-${collectionSlug}` : collectionSlug;
const publicDirectory = path.join(root, "public", "media", publicCollectionSlug);
const workDirectory = path.join(root, ".photo-work", publicCollectionSlug);
const manifestDirectory = path.join(root, "content", "generated", ...(portraits ? ["portraits"] : []));
const collectionDetailsPath = path.join(root, "content", portraits ? "portrait-details.json" : "collection-details.json");
const printSelectionsPath = path.join(root, "content", "prints.json");
const manifestPath = path.join(manifestDirectory, `${collectionSlug}.json`);
const imageSizes = [768, 1600, 2400];
const jpegtran = "/opt/homebrew/bin/jpegtran";
let sharpModule;

async function getSharp() {
  sharpModule ??= (await import("sharp")).default;
  return sharpModule;
}

async function macToolsAvailable() {
  if (process.platform !== "darwin") return false;
  try {
    await execFileAsync("sips", ["-h"]);
    await access(jpegtran);
    return true;
  } catch {
    return false;
  }
}

const useSharp = !(await macToolsAvailable());


function parseSipsMetadata(stdout) {
  const valueFor = (property) => {
    const match = stdout.match(new RegExp(`\\n\\s*${property}:\\s*(.+)`));
    const value = match?.[1]?.trim();
    return value && value !== "<nil>" ? value : null;
  };

  return {
    width: Number(valueFor("pixelWidth")),
    height: Number(valueFor("pixelHeight")),
    cameraMake: valueFor("make"),
    cameraBody: valueFor("model"),
    captureDate: valueFor("creation"),
  };
}

function parseExifValue(exif, tiffOffset, littleEndian, entryOffset, type, count) {
  const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 }[type];
  if (!typeSize) return null;
  const byteLength = typeSize * count;
  const readU16 = (offset) => littleEndian ? exif.readUInt16LE(offset) : exif.readUInt16BE(offset);
  const readU32 = (offset) => littleEndian ? exif.readUInt32LE(offset) : exif.readUInt32BE(offset);
  const valueOffset = byteLength <= 4 ? entryOffset + 8 : tiffOffset + readU32(entryOffset + 8);
  if (valueOffset < 0 || valueOffset + byteLength > exif.length) return null;

  if (type === 2) {
    return exif.toString("utf8", valueOffset, valueOffset + byteLength).replace(/\0+$/, "").trim() || null;
  }
  if (type === 3) return readU16(valueOffset);
  if (type === 4) return readU32(valueOffset);
  return null;
}

function parseExifDirectory(exif, tiffOffset, littleEndian, relativeOffset) {
  const readU16 = (offset) => littleEndian ? exif.readUInt16LE(offset) : exif.readUInt16BE(offset);
  const readU32 = (offset) => littleEndian ? exif.readUInt32LE(offset) : exif.readUInt32BE(offset);
  const directoryOffset = tiffOffset + relativeOffset;
  if (directoryOffset < 0 || directoryOffset + 2 > exif.length) return new Map();

  const entryCount = readU16(directoryOffset);
  const values = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = directoryOffset + 2 + index * 12;
    if (entryOffset + 12 > exif.length) break;
    const tag = readU16(entryOffset);
    const type = readU16(entryOffset + 2);
    const count = readU32(entryOffset + 4);
    const value = parseExifValue(exif, tiffOffset, littleEndian, entryOffset, type, count);
    if (value !== null) values.set(tag, value);
  }
  return values;
}

function parseExifMetadata(exif) {
  if (!exif) return {};
  const littleMarker = exif.indexOf(Buffer.from([0x49, 0x49, 0x2a, 0x00]));
  const bigMarker = exif.indexOf(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]));
  const tiffOffset = littleMarker >= 0 ? littleMarker : bigMarker;
  if (tiffOffset < 0) return {};

  const littleEndian = littleMarker >= 0;
  const readU32 = (offset) => littleEndian ? exif.readUInt32LE(offset) : exif.readUInt32BE(offset);
  const ifd0 = parseExifDirectory(exif, tiffOffset, littleEndian, readU32(tiffOffset + 4));
  const exifIfdOffset = ifd0.get(0x8769);
  const exifIfd = typeof exifIfdOffset === "number"
    ? parseExifDirectory(exif, tiffOffset, littleEndian, exifIfdOffset)
    : new Map();

  return {
    cameraMake: ifd0.get(0x010f) ?? null,
    cameraBody: ifd0.get(0x0110) ?? null,
    captureDate: exifIfd.get(0x9003) ?? exifIfd.get(0x9004) ?? ifd0.get(0x0132) ?? null,
  };
}

function publicId(filename) {
  return path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function run(command, args) {
  await execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024 });
}

async function inspect(sourcePath) {
  if (useSharp) {
    const sharp = await getSharp();
    const metadata = await sharp(sourcePath).metadata();
    const exif = parseExifMetadata(metadata.exif);
    return {
      width: Number(metadata.width),
      height: Number(metadata.height),
      cameraMake: exif.cameraMake,
      cameraBody: exif.cameraBody,
      captureDate: exif.captureDate,
    };
  }

  const { stdout } = await execFileAsync("sips", [
    "-g", "pixelWidth",
    "-g", "pixelHeight",
    "-g", "make",
    "-g", "model",
    "-g", "creation",
    sourcePath,
  ]);
  return parseSipsMetadata(stdout);
}


async function contentHash(sourcePath) {
  const contents = await readFile(sourcePath);
  return createHash("sha256").update(contents).digest("hex").slice(0, 12);
}

async function createVariant(sourcePath, assetKey, longestEdge) {
  const temporaryPath = path.join(workDirectory, `${assetKey}-${longestEdge}.jpg`);
  const outputPath = path.join(publicDirectory, `${assetKey}-${longestEdge}.jpg`);

  if (useSharp) {
    const sharp = await getSharp();
    await sharp(sourcePath)
      .rotate()
      .resize({
        width: longestEdge,
        height: longestEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toFile(outputPath);
    return "/media/" + publicCollectionSlug + "/" + assetKey + "-" + longestEdge + ".jpg";
  }
  await run("sips", [
    "-Z", String(longestEdge),
    "-s", "format", "jpeg",
    "-s", "formatOptions", "82",
    sourcePath,
    "--out", temporaryPath,
  ]);

  await run(jpegtran, [
    "-copy", "none",
    "-optimize",
    "-outfile", outputPath,
    temporaryPath,
  ]);

  return `/media/${publicCollectionSlug}/${assetKey}-${longestEdge}.jpg`;
}

async function readJson(pathname, fallback) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function captureDateValue(image) {
  return image.sortCaptureDate ?? image.metadata?.captureDate ?? "9999-99-99";
}

function sortPhotos(left, right) {
  return captureDateValue(left).localeCompare(captureDateValue(right))
    || left.sourceFile.localeCompare(right.sourceFile);
}

const collectionDetails = await readJson(collectionDetailsPath, {});
const collection = collectionDetails[collectionSlug];
const printSelections = portraits ? [] : (await readJson(printSelectionsPath, { items: [] })).items ?? [];
const sellablePhotoKeys = getSellablePhotoKeys(printSelections);

if (!collection) {
  console.error(`No collection details found for ${collectionSlug} in ${collectionDetailsPath}`);
  process.exit(1);
}

if (portraits && typeof collection.sourceDirectory !== "string") {
  console.error(`Portrait collection ${collectionSlug} needs a sourceDirectory in ${collectionDetailsPath}`);
  process.exit(1);
}

const sourceDirectory = path.join(root, "photo-intake", portraits ? "portraits" : "places", portraits ? collection.sourceDirectory : collectionSlug);

const previousManifest = await readJson(manifestPath, null);
const previousPhotos = previousManifest?.images ?? [];
const previousBySource = new Map(previousPhotos.map((photo) => [photo.sourceFile, photo]));
const previousByAssetKey = new Map(previousPhotos.map((photo) => [photo.assetKey, photo]));

await rm(publicDirectory, { recursive: true, force: true });
await mkdir(publicDirectory, { recursive: true });
await mkdir(workDirectory, { recursive: true });
await mkdir(manifestDirectory, { recursive: true });

const files = (await readdir(sourceDirectory))
  .filter((filename) => /\.(jpe?g)$/i.test(filename))
  .sort((left, right) => left.localeCompare(right));

if (files.length === 0) {
  console.error(`No JPEG files found in ${sourceDirectory}`);
  process.exit(1);
}

const preparedImages = [];
for (const [index, filename] of files.entries()) {
  const sourcePath = path.join(sourceDirectory, filename);
  const hash = await contentHash(sourcePath);
  const id = portraits ? `photo-${hash}` : publicId(filename);
  const assetKey = portraits ? `portrait-${hash}` : `${id}-${hash}`;
  const previous = portraits ? previousByAssetKey.get(assetKey) : previousBySource.get(filename);
  const metadata = await inspect(sourcePath);
  const variants = {};

  for (const size of imageSizes) {
    variants[String(size)] = await createVariant(sourcePath, assetKey, size);
  }

  preparedImages.push({
    id,
    title: previous?.title ?? null,
    alt: previous?.alt ?? `${collection.title} photograph ${index + 1}`,
    ...(portraits ? {} : { sourceFile: filename, printSource: filename }),
    assetKey,
    sortCaptureDate: metadata.captureDate,
    order: 0,
    sellable: !portraits && sellablePhotoKeys.has(printSelectionKey(collectionSlug, id)),
    releaseStatus: portraits ? "review-required" : previous?.releaseStatus ?? "not-applicable",
    width: metadata.width,
    height: metadata.height,
    variants,
    metadata: portraits ? {
      cameraMake: null,
      cameraBody: null,
      lens: null,
      focalLength: null,
      aperture: null,
      shutterSpeed: null,
      iso: null,
      captureDate: null,
    } : {
      cameraMake: metadata.cameraMake ?? previous?.metadata?.cameraMake ?? null,
      cameraBody: metadata.cameraBody ?? previous?.metadata?.cameraBody ?? null,
      lens: previous?.metadata?.lens ?? null,
      focalLength: previous?.metadata?.focalLength ?? null,
      aperture: previous?.metadata?.aperture ?? null,
      shutterSpeed: previous?.metadata?.shutterSpeed ?? null,
      iso: previous?.metadata?.iso ?? null,
      captureDate: previous?.metadata?.captureDate ?? metadata.captureDate ?? null,
    },
  });
}

const intakeFilenames = new Set(files);
const images = (portraits || replaceExisting ? preparedImages : [
  ...previousPhotos.filter((photo) => !intakeFilenames.has(photo.sourceFile)),
  ...preparedImages,
])
  .sort(sortPhotos)
  .map((photo, index) => {
    const publicPhoto = { ...photo };
    delete publicPhoto.sortCaptureDate;
    return { ...publicPhoto, order: index + 1 };
  });

const preservedCover = replaceExisting ? null : previousManifest?.coverImageId;
const coverImageId = images.some((image) => image.id === preservedCover)
  ? preservedCover
  : images.find((image) => image.width / image.height > 1.6)?.id ?? images[0].id;

const collectionData = portraits
  ? { title: collection.title, note: collection.note, featured: collection.featured }
  : collection;
const manifest = {
  slug: collectionSlug,
  ...collectionData,
  coverImageId,
  images,
};

await writeFile(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
);

await rm(workDirectory, { recursive: true, force: true });
console.log(`Prepared ${images.length} photographs for ${collectionSlug}${replaceExisting ? " (replaced existing collection)" : ""}.`);
