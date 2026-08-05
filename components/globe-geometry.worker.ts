import { feature, mesh } from "topojson-client";
import type { FeatureCollection, Geometry, MultiLineString } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import {
  densifyLandPolygons,
  rewindLandPolygons,
  splitAntimeridianPolygons,
} from "../lib/rewind-geojson.mjs";

type GlobeResolution = "50m" | "10m";
type LandTopology = Topology<{ land: GeometryCollection }>;
type CountriesTopology = Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
type GlobeGeometry = {
  land: FeatureCollection<Geometry>;
  countryBorders: MultiLineString;
};
type GeometryWorkerRequest = {
  type: "load";
  requestId: number;
  resolution: GlobeResolution;
};
type GeometryWorkerResponse =
  | { type: "geometry"; requestId: number; geometry: GlobeGeometry }
  | { type: "error"; requestId: number; message: string };

type GeometryWorkerScope = {
  onmessage: ((event: MessageEvent<GeometryWorkerRequest>) => void) | null;
  postMessage(message: GeometryWorkerResponse): void;
};

const workerScope = globalThis as unknown as GeometryWorkerScope;
let activeController: AbortController | null = null;

async function loadGlobeGeometry(resolution: GlobeResolution, signal: AbortSignal): Promise<GlobeGeometry> {
  const [landResponse, countriesResponse] = await Promise.all([
    fetch("/globe/land-" + resolution + ".json", { cache: "force-cache", signal }),
    fetch("/globe/countries-" + resolution + ".json", { cache: "force-cache", signal }),
  ]);
  if (!landResponse.ok || !countriesResponse.ok) {
    throw new Error("The globe geometry could not be loaded.");
  }

  const [landTopology, countriesTopology] = await Promise.all([
    landResponse.json() as Promise<LandTopology>,
    countriesResponse.json() as Promise<CountriesTopology>,
  ]);
  const land = rewindLandPolygons(
    densifyLandPolygons(
      splitAntimeridianPolygons(feature(landTopology, landTopology.objects.land) as FeatureCollection<Geometry>),
    ),
  ) as FeatureCollection<Geometry>;
  const countryBorders = mesh(
    countriesTopology,
    countriesTopology.objects.countries,
    (left, right) => left !== right,
  ) as MultiLineString;

  return { land, countryBorders };
}

workerScope.onmessage = async (event) => {
  if (event.data.type !== "load") return;

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  try {
    const geometry = await loadGlobeGeometry(event.data.resolution, controller.signal);
    workerScope.postMessage({ type: "geometry", requestId: event.data.requestId, geometry });
  } catch (error) {
    if (controller.signal.aborted) return;
    workerScope.postMessage({
      type: "error",
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : "The globe geometry could not be loaded.",
    });
  } finally {
    if (activeController === controller) activeController = null;
  }
};
