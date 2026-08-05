import algarveData from "@/content/generated/algarve.json";
import aveiroAndCostaNovaData from "@/content/generated/aveiro-and-costa-nova.json";
import bangkokData from "@/content/generated/bangkok.json";
import belmontParkData from "@/content/generated/belmont-park.json";
import carlsbadData from "@/content/generated/carlsbad.json";
import coronadoData from "@/content/generated/coronado.json";
import costaRicaData from "@/content/generated/costa-rica.json";
import joshuaTreeData from "@/content/generated/joshua-tree.json";
import kohSamuiData from "@/content/generated/koh-samui.json";
import lakeTahoeData from "@/content/generated/lake-tahoe.json";
import lisbonData from "@/content/generated/lisbon.json";
import mexicoCityData from "@/content/generated/mexico-city.json";
import portoData from "@/content/generated/porto.json";
import railayBeachData from "@/content/generated/railay-beach.json";
import sanDiegoData from "@/content/generated/san-diego.json";
import seattleData from "@/content/generated/seattle.json";
import sintraData from "@/content/generated/sintra.json";
import tokyoData from "@/content/generated/tokyo.json";
import yosemiteData from "@/content/generated/yosemite.json";
import printsData from "@/content/prints.json";
import { commerceConfig, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { getSellablePhotoKeys, printSelectionKey } from "@/lib/print-availability.mjs";

export type ImageMetadata = {
  cameraMake: string | null;
  cameraBody: string | null;
  lens: string | null;
  focalLength: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: string | null;
  captureDate: string | null;
};

export type Photo = {
  id: string;
  title: string | null;
  alt: string;
  sourceFile?: string;
  printSource?: string;
  order: number;
  sellable: boolean;
  releaseStatus: "not-applicable" | "released" | "review-required";
  width: number;
  height: number;
  placeholderColor?: string | null;
  variants: Record<string, string>;
  metadata: ImageMetadata;
};

export type Collection = {
  slug: string;
  title: string;
  location: string;
  note: string | null;
  featured: boolean;
  coverImageId: string;
  coordinates: { latitude: number; longitude: number };
  images: Photo[];
};

export type PrintOption = {
  id: string;
  label: string;
  ratio: number;
  price: number;
  shippingClass: "flat" | "tube";
};

export type PrintSelection = {
  collectionSlug: string;
  photoId: string;
  available: boolean;
  title?: string | null;
  note?: string | null;
  sizeIds?: string[];
  priceOverrides?: Record<string, number>;
};

type PrintsData = { items: PrintSelection[] };

export const printSelections = (printsData as PrintsData).items;

const sellablePhotoKeys = getSellablePhotoKeys(printSelections);

const sourceCollections = [
  algarveData as Collection,
  aveiroAndCostaNovaData as Collection,
  bangkokData as Collection,
  belmontParkData as Collection,
  carlsbadData as Collection,
  coronadoData as Collection,
  costaRicaData as Collection,
  joshuaTreeData as Collection,
  kohSamuiData as Collection,
  lakeTahoeData as Collection,
  lisbonData as Collection,
  mexicoCityData as Collection,
  portoData as Collection,
  railayBeachData as Collection,
  sanDiegoData as Collection,
  seattleData as Collection,
  sintraData as Collection,
  tokyoData as Collection,
  yosemiteData as Collection,
];

export const collections = sourceCollections
  .map((collection) => ({
    ...collection,
    images: collection.images.map((photo) => ({
      ...photo,
      sellable: sellablePhotoKeys.has(printSelectionKey(collection.slug, photo.id)),
    })),
  }))
  .sort((left, right) => left.title.localeCompare(right.title));

export const printOptions = commerceConfig.printOptions as readonly PrintOption[];

export function getCollection(slug: string) {
  return collections.find((collection) => collection.slug === slug);
}

export function getPhoto(collectionSlug: string, photoId: string) {
  return getCollection(collectionSlug)?.images.find((photo) => photo.id === photoId);
}

export function getPrintSelection(collectionSlug: string, photoId: string) {
  return printSelections.find(
    (selection) => selection.collectionSlug === collectionSlug && selection.photoId === photoId,
  );
}

export function getAvailablePrints() {
  return printSelections.flatMap((selection) => {
    if (!selection.available) return [];
    const collection = getCollection(selection.collectionSlug);
    const photo = getPhoto(selection.collectionSlug, selection.photoId);
    return collection && photo ? [{ selection, collection, photo }] : [];
  });
}

export function getCover(collection: Collection) {
  return collection.images.find((photo) => photo.id === collection.coverImageId) ?? collection.images[0];
}

export function formatPhotoName(collection: Pick<Collection, "title">, photo: Photo) {
  return photo.title ?? siteCopy.common.photoNumber(collection.title.replace(/\s*['’]\d+$/, ""), photo.order);
}

export function formatPrintName(collection: Collection, photo: Photo) {
  return getPrintSelection(collection.slug, photo.id)?.title ?? formatPhotoName(collection, photo);
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: commerceConfig.displayCurrency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function compatiblePrintOptions(photo: Photo) {
  const ratio = Math.max(photo.width, photo.height) / Math.min(photo.width, photo.height);
  return printOptions.filter((option) => Math.abs(option.ratio - ratio) < commerceConfig.aspectRatioTolerance);
}

export function getPrintOptionsForPhoto(collectionSlug: string, photo: Photo) {
  const selection = getPrintSelection(collectionSlug, photo.id);
  if (!selection?.available) return [];
  const allowedSizeIds = selection.sizeIds ? new Set(selection.sizeIds) : null;
  const availableOptions = allowedSizeIds
    ? printOptions.filter((option) => allowedSizeIds.has(option.id))
    : compatiblePrintOptions(photo);
  return availableOptions
    .map((option) => {
      const override = selection.priceOverrides?.[option.id];
      return typeof override === "number" && Number.isInteger(override) && override >= 0
        ? { ...option, price: override }
        : option;
    });
}

export function getPrintOptionForPhoto(collectionSlug: string, photo: Photo, sizeId: string) {
  return getPrintOptionsForPhoto(collectionSlug, photo).find((option) => option.id === sizeId);
}

export function displayDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value.replace(/^([0-9]{4}):([0-9]{2}):([0-9]{2})/, "$1-$2-$3"));
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(siteConfig.locale, { month: "long", year: "numeric" }).format(parsed);
}
