"use client";


import { ResponsiveImage } from "@/components/responsive-image";
import type { Feature, FeatureCollection, Geometry, MultiLineString, Point } from "geojson";
import { TransitionLink as Link } from "@/components/navigation-transition";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from "maplibre-gl";
import { globeConfig } from "@/content/globe-config";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { densifyLandPolygons, rewindLandPolygons, splitAntimeridianPolygons } from "@/lib/rewind-geojson.mjs";
import { solarLightPosition } from "@/lib/solar-light.mjs";

export type GlobePlace = {
  slug: string;
  title: string;
  location: string;
  note: string | null;
  photoCount: number;
  coordinates: { latitude: number; longitude: number };
  cover: {
    src: string;
    srcSet: string;
    alt: string;
    width: number;
    height: number;
  };
};

type LandTopology = Topology<{ land: GeometryCollection }>;
type CountriesTopology = Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
type GlobeResolution = "50m" | "10m";
type GlobeGeometry = { land: FeatureCollection<Geometry>; countryBorders: MultiLineString };
type PlaceProperties = { slug: string; title: string };
type ClusterMarker = { marker: MapLibreMarker; element: HTMLSpanElement };
type GlobeCameraMemory = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readGlobeCamera(): GlobeCameraMemory | null {
  try {
    const raw = window.sessionStorage.getItem(globeConfig.memory.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { center?: unknown; zoom?: unknown; bearing?: unknown; pitch?: unknown };
    if (!Array.isArray(parsed.center) || parsed.center.length !== 2) return null;
    const [longitude, latitude] = parsed.center;
    if (
      !isFiniteNumber(longitude) ||
      !isFiniteNumber(latitude) ||
      !isFiniteNumber(parsed.zoom) ||
      !isFiniteNumber(parsed.bearing) ||
      !isFiniteNumber(parsed.pitch)
    ) return null;
    return {
      center: [longitude, latitude],
      zoom: parsed.zoom,
      bearing: parsed.bearing,
      pitch: parsed.pitch,
    };
  } catch {
    return null;
  }
}

function rememberGlobeCamera(map: MapLibreMap) {
  const center = map.getCenter();
  try {
    window.sessionStorage.setItem(globeConfig.memory.storageKey, JSON.stringify({
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    }));
  } catch {
    // Session storage may be disabled; the map remains fully usable without memory.
  }
}

function placeDistance(first: GlobePlace, second: GlobePlace) {
  const latitude = (first.coordinates.latitude + second.coordinates.latitude) / 2;
  const longitudeScale = Math.cos(latitude * Math.PI / 180);
  return Math.hypot(
    first.coordinates.latitude - second.coordinates.latitude,
    (first.coordinates.longitude - second.coordinates.longitude) * longitudeScale,
  );
}

const emptyPoints: FeatureCollection<Point, PlaceProperties> = { type: "FeatureCollection", features: [] };

async function loadGlobeGeometry(resolution: GlobeResolution, signal?: AbortSignal): Promise<GlobeGeometry> {
  const [landResponse, countriesResponse] = await Promise.all([
    fetch(`/globe/land-${resolution}.json`, { cache: "force-cache", signal }),
    fetch(`/globe/countries-${resolution}.json`, { cache: "force-cache", signal }),
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

const borderOpacity = ["interpolate", ["linear"], ["zoom"], ...globeConfig.style.countryBorderOpacity];

function worldPadding() {
  return { top: 0, right: 0, bottom: window.matchMedia(globeConfig.mediaQueries.mobile).matches ? globeConfig.padding.mobileBottom : globeConfig.padding.desktopBottom, left: 0 };
}

function globePalette() {
  const styles = getComputedStyle(document.documentElement);
  const color = (token: keyof typeof globeConfig.colorTokens) => styles.getPropertyValue(globeConfig.colorTokens[token]).trim();
  return {
    ocean: color("ocean"),
    land: color("land"),
    countryBorder: color("countryBorder"),
    pin: color("pin"),
    selectedPin: color("selectedPin"),
    paperBright: color("paperBright"),
    clusterRing: color("clusterRing"),
    selectedHalo: color("selectedHalo"),
    horizon: color("horizon"),
    sunlight: color("sunlight"),
  };
}

function placeFeature(place: GlobePlace): Feature<Point, PlaceProperties> {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [place.coordinates.longitude, place.coordinates.latitude],
    },
    properties: { slug: place.slug, title: place.title },
  };
}

function isOnVisibleHemisphere(center: { lat: number; lng: number }, coordinates: [number, number]) {
  const radians = Math.PI / 180;
  const centerLatitude = center.lat * radians;
  const pointLatitude = coordinates[1] * radians;
  const longitudeDelta = (coordinates[0] - center.lng) * radians;
  const cosineDistance = Math.sin(centerLatitude) * Math.sin(pointLatitude)
    + Math.cos(centerLatitude) * Math.cos(pointLatitude) * Math.cos(longitudeDelta);
  return cosineDistance > globeConfig.visibleHemisphereThreshold;
}

function makeGlobeStyle(
  places: GlobePlace[],
  palette: ReturnType<typeof globePalette>,
  geometry: GlobeGeometry,
  date = new Date(),
): StyleSpecification {
  const lightPosition = solarLightPosition(date, globeConfig.style.lightRadius) as [number, number, number];
  const placePoints: FeatureCollection<Point, PlaceProperties> = {
    type: "FeatureCollection",
    features: places.map(placeFeature),
  };

  return {
    version: 8,
    projection: { type: "globe" },
    sources: {
      land: { type: "geojson", data: geometry.land },
      "country-borders": { type: "geojson", data: geometry.countryBorders },
      places: {
        type: "geojson",
        data: placePoints,
        cluster: true,
        clusterMaxZoom: globeConfig.cluster.maxZoom,
        clusterRadius: globeConfig.cluster.radius,
      },
      "selected-place": { type: "geojson", data: emptyPoints },
    },
    layers: [
      {
        id: "ocean",
        type: "background",
        paint: { "background-color": palette.ocean },
      },
      {
        id: "land-fill",
        type: "fill",
        source: "land",
        paint: {
          "fill-color": palette.land,
          "fill-opacity": globeConfig.style.landOpacity,
        },
      },
      {
        id: "country-borders",
        type: "line",
        source: "country-borders",
        paint: {
          "line-color": palette.countryBorder,
          "line-opacity": borderOpacity,
          "line-width": ["interpolate", ["linear"], ["zoom"], ...globeConfig.style.countryBorderWidth],
        },
      },
      {
        id: "place-clusters-ring",
        type: "circle",
        source: "places",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": palette.clusterRing,
          "circle-radius": ["step", ["get", "point_count"], ...globeConfig.style.clusterRingRadius],
          "circle-blur": globeConfig.style.clusterBlur,
        },
      },
      {
        id: "place-clusters",
        type: "circle",
        source: "places",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": palette.pin,
          "circle-radius": ["step", ["get", "point_count"], ...globeConfig.style.clusterRadius],
          "circle-stroke-color": palette.paperBright,
          "circle-stroke-width": globeConfig.style.clusterStrokeWidth,
        },
      },
      {
        id: "place-pin-hit-area",
        type: "circle",
        source: "places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": globeConfig.style.pinTouchRadius,
          "circle-opacity": 0,
        },
      },
      {
        id: "place-pins",
        type: "circle",
        source: "places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": palette.pin,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], ...globeConfig.style.pinRadius],
          "circle-stroke-color": palette.paperBright,
          "circle-stroke-width": globeConfig.style.pinStrokeWidth,
        },
      },
      {
        id: "selected-place-halo",
        type: "circle",
        source: "selected-place",
        paint: {
          "circle-color": palette.selectedHalo,
          "circle-radius": globeConfig.style.selectedHaloRadius,
          "circle-blur": globeConfig.style.selectedHaloBlur,
        },
      },
      {
        id: "selected-place-hit-area",
        type: "circle",
        source: "selected-place",
        paint: {
          "circle-radius": globeConfig.style.selectedPinTouchRadius,
          "circle-opacity": 0,
        },
      },
      {
        id: "selected-place-pin",
        type: "circle",
        source: "selected-place",
        paint: {
          "circle-color": palette.selectedPin,
          "circle-radius": globeConfig.style.selectedPinRadius,
          "circle-stroke-color": palette.paperBright,
          "circle-stroke-width": globeConfig.style.selectedPinStrokeWidth,
        },
      },
    ],
    sky: {
      "sky-color": palette.ocean,
      "horizon-color": palette.horizon,
      "fog-color": palette.horizon,
      "sky-horizon-blend": globeConfig.style.horizonBlend,
      "horizon-fog-blend": globeConfig.style.horizonBlend,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], ...globeConfig.style.atmosphereBlend],
    },
    light: { anchor: "map", position: lightPosition, color: palette.sunlight, intensity: globeConfig.style.lightIntensity },
  } as StyleSpecification;
}

function updatePlaceQuery(slug: string | null) {
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set(globeConfig.queries.selectedPlace, slug);
  else url.searchParams.delete(globeConfig.queries.selectedPlace);
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

export function GlobeExplorer({ places }: { places: GlobePlace[] }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const clusterMarkersRef = useRef(new Map<number, ClusterMarker>());
  const initializedUrlRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const placeBySlug = useMemo(
    () => new Map(places.map((place) => [place.slug, place])),
    [places],
  );
  const selectedPlace = selectedSlug ? placeBySlug.get(selectedSlug) ?? null : null;
  const nearbyPlaces = useMemo(() => {
    if (!selectedPlace) return [];
    return places
      .filter((place) => place.slug !== selectedPlace.slug)
      .sort((first, second) => placeDistance(selectedPlace, first) - placeDistance(selectedPlace, second))
      .slice(0, 2);
  }, [places, selectedPlace]);
  const visiblePlaces = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return places;
    return places.filter((place) => (place.title + " " + place.location).toLocaleLowerCase().includes(query));
  }, [filter, places]);

  const moveCamera = useCallback((map: MapLibreMap, place: GlobePlace | null) => {
    map.stop();
    const reducedMotion = window.matchMedia(globeConfig.mediaQueries.reducedMotion).matches;
    const camera = place
      ? {
          center: [place.coordinates.longitude, place.coordinates.latitude] as [number, number],
          zoom: Math.max(map.getZoom(), globeConfig.zoom.selectedPlace),
          bearing: 0,
          pitch: 0,
        }
      : { ...globeConfig.worldView, padding: worldPadding(), bearing: 0, pitch: 0 };

    if (reducedMotion) map.jumpTo(camera);
    else map.easeTo({
      ...camera,
      duration: place ? globeConfig.animation.selectedDuration : globeConfig.animation.resetDuration,
      essential: false,
    });
  }, []);

  const choosePlace = useCallback((slug: string) => {
    if (!placeBySlug.has(slug)) return;
    setSelectedSlug(slug);
    if (window.matchMedia(globeConfig.mediaQueries.mobile).matches) setSheetOpen(false);
  }, [placeBySlug]);

  const surpriseMe = useCallback(() => {
    const candidates = visiblePlaces.length > 1 ? visiblePlaces : places;
    const eligible = candidates.filter((place) => place.slug !== selectedSlug);
    const pool = eligible.length > 0 ? eligible : candidates;
    const place = pool[Math.floor(Math.random() * pool.length)];
    if (place) choosePlace(place.slug);
  }, [choosePlace, places, selectedSlug, visiblePlaces]);

  const clearSelection = useCallback(() => {
    if (!selectedSlug && mapRef.current) moveCamera(mapRef.current, null);
    setSelectedSlug(null);
    setSheetOpen(false);
  }, [moveCamera, selectedSlug]);

  useEffect(() => {
    const fromUrl = () => {
      const slug = new URLSearchParams(window.location.search).get(globeConfig.queries.selectedPlace);
      setSelectedSlug(slug && placeBySlug.has(slug) ? slug : null);
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, [placeBySlug]);

  useEffect(() => {
    if (!initializedUrlRef.current) {
      initializedUrlRef.current = true;
      return;
    }
    updatePlaceQuery(selectedSlug);
  }, [selectedSlug]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    let lightingTimer: ReturnType<typeof setInterval> | null = null;
    let cameraMemoryFrame: number | null = null;
    const clusterMarkers = clusterMarkersRef.current;
    const geometryAbortController = new AbortController();

    async function initializeMap() {
      const container = mapContainerRef.current;
      if (!container) return;

      try {
        const [{ Map: MapConstructor, Marker }, geometry] = await Promise.all([
          import("maplibre-gl"),
          loadGlobeGeometry("50m", geometryAbortController.signal),
        ]);
        if (cancelled) return;
        const rememberedCamera = readGlobeCamera();
        const palette = globePalette();
        instance = new MapConstructor({
          container,
          style: makeGlobeStyle(places, palette, geometry, new Date()),
          center: rememberedCamera?.center ?? globeConfig.worldView.center,
          zoom: rememberedCamera?.zoom ?? globeConfig.worldView.zoom,
          minZoom: globeConfig.zoom.min,
          maxZoom: globeConfig.zoom.max,
          pitch: rememberedCamera?.pitch ?? 0,
          bearing: rememberedCamera?.bearing ?? 0,
          dragPan: true,
          scrollZoom: true,
          touchZoomRotate: true,
          cooperativeGestures: false,
          attributionControl: false,
          renderWorldCopies: false,
          canvasContextAttributes: { antialias: true, powerPreference: "high-performance" },
        });
        mapRef.current = instance;
        instance.setPadding(worldPadding());
        const scheduleCameraMemory = () => {
          if (cameraMemoryFrame !== null) return;
          cameraMemoryFrame = window.requestAnimationFrame(() => {
            cameraMemoryFrame = null;
            if (!cancelled && instance) rememberGlobeCamera(instance);
          });
        };
        instance.on("move", scheduleCameraMemory);
        scheduleCameraMemory();

        const updateClusterMarkers = () => {
          if (!instance?.isStyleLoaded()) return;
          const center = instance.getCenter();
          const seen = new Set<number>();
          for (const cluster of instance.querySourceFeatures("places")) {
            const clusterId = cluster.properties?.cluster_id;
            const count = cluster.properties?.point_count;
            if (typeof clusterId !== "number" || typeof count !== "number" || seen.has(clusterId)) continue;
            if (cluster.geometry.type !== "Point") continue;
            const coordinates = cluster.geometry.coordinates as [number, number];
            if (!isOnVisibleHemisphere(center, coordinates)) continue;
            seen.add(clusterId);
            const existing = clusterMarkers.get(clusterId);
            if (existing) {
              existing.element.textContent = String(count);
              existing.marker.setLngLat(coordinates);
              continue;
            }
            const element = document.createElement("span");
            element.className = "globe-cluster-count";
            element.textContent = String(count);
            element.setAttribute("aria-hidden", "true");
            const marker = new Marker({ element, anchor: "center" }).setLngLat(coordinates).addTo(instance);
            clusterMarkers.set(clusterId, { marker, element });
          }
          for (const [clusterId, { marker }] of clusterMarkers) {
            if (seen.has(clusterId)) continue;
            marker.remove();
            clusterMarkers.delete(clusterId);
          }
        };

        instance.on("load", () => {
          if (cancelled || !instance) return;
          performance.mark("globe-ready");
          setMapReady(true);

          void loadGlobeGeometry("10m", geometryAbortController.signal).then((highResolutionGeometry) => {
            if (cancelled || !instance) return;
            const landSource = instance.getSource("land") as GeoJSONSource | undefined;
            const countryBorderSource = instance.getSource("country-borders") as GeoJSONSource | undefined;
            landSource?.setData(highResolutionGeometry.land);
            countryBorderSource?.setData(highResolutionGeometry.countryBorders);
            performance.mark("globe-high-resolution-ready");
          }).catch((error) => {
            if (!cancelled) console.warn("The high-resolution globe geometry could not be loaded.", error);
          });

          const updateLighting = () => {
            if (!instance) return;
            const lightPosition = solarLightPosition(new Date(), globeConfig.style.lightRadius) as [number, number, number];
            instance.setSky({
              "sky-color": palette.ocean,
              "horizon-color": palette.horizon,
              "fog-color": palette.horizon,
              "sky-horizon-blend": globeConfig.style.horizonBlend,
              "horizon-fog-blend": globeConfig.style.horizonBlend,
              "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], ...globeConfig.style.atmosphereBlend],
            });
            instance.setLight({
              anchor: "map",
              position: lightPosition,
              color: palette.sunlight,
              intensity: globeConfig.style.lightIntensity,
            });
          };
          updateLighting();
          lightingTimer = setInterval(updateLighting, globeConfig.lightingRefreshMs);
          instance.on("render", updateClusterMarkers);

          const reducedMotion = window.matchMedia(globeConfig.mediaQueries.reducedMotion).matches;
          const opensOnPlace = new URLSearchParams(window.location.search).has(globeConfig.queries.selectedPlace);
          if (!reducedMotion && !opensOnPlace && !rememberedCamera) {
            instance.jumpTo({ ...globeConfig.introView, bearing: 0, pitch: 0 });
            instance.easeTo({
              ...globeConfig.worldView,
              padding: worldPadding(),
              duration: globeConfig.animation.introDuration,
              easing: (progress) => 1 - Math.pow(1 - progress, 3),
              essential: false,
            });
          }

          instance.on("click", "place-pin-hit-area", (event) => {
            const slug = event.features?.[0]?.properties?.slug;
            if (typeof slug === "string") choosePlace(slug);
          });
          instance.on("click", "selected-place-hit-area", (event) => {
            const slug = event.features?.[0]?.properties?.slug;
            if (typeof slug === "string") choosePlace(slug);
          });
          instance.on("click", "place-clusters", async (event) => {
            if (!instance) return;
            const cluster = event.features?.[0];
            const clusterId = cluster?.properties?.cluster_id;
            if (typeof clusterId !== "number" || cluster?.geometry.type !== "Point") return;
            const source = instance.getSource("places") as GeoJSONSource;
            const zoom = await source.getClusterExpansionZoom(clusterId) + globeConfig.zoom.clusterExpansionOffset;
            const center = cluster.geometry.coordinates as [number, number];
            const reducedMotion = window.matchMedia(globeConfig.mediaQueries.reducedMotion).matches;
            if (reducedMotion) instance.jumpTo({ center, zoom });
            else instance.easeTo({ center, zoom, duration: globeConfig.animation.clusterDuration, essential: false });
          });

          for (const layer of ["place-pin-hit-area", "place-clusters", "selected-place-hit-area"]) {
            instance.on("mouseenter", layer, () => { if (instance) instance.getCanvas().style.cursor = "pointer"; });
            instance.on("mouseleave", layer, () => { if (instance) instance.getCanvas().style.cursor = "grab"; });
          }
        });
        instance.on("error", (event) => {
          if (event.error) console.error(siteCopy.globe.mapError, event.error);
        });
      } catch (error) {
        if (cancelled) return;
        console.error(siteCopy.globe.startError, error);
        if (!cancelled) setMapFailed(true);
      }
    }

    void initializeMap();
    return () => {
      cancelled = true;
      geometryAbortController.abort();
      if (cameraMemoryFrame !== null) window.cancelAnimationFrame(cameraMemoryFrame);
      if (lightingTimer) clearInterval(lightingTimer);
      for (const { marker } of clusterMarkers.values()) marker.remove();
      clusterMarkers.clear();
      instance?.remove();
      if (mapRef.current === instance) mapRef.current = null;
    };
  }, [choosePlace, places]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;
    const source = map.getSource("selected-place") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(selectedPlace ? placeFeature(selectedPlace) : emptyPoints);
    moveCamera(map, selectedPlace);
  }, [mapReady, moveCamera, selectedPlace]);

  const zoomBy = (amount: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    const reducedMotion = window.matchMedia(globeConfig.mediaQueries.reducedMotion).matches;
    const zoom = Math.min(globeConfig.zoom.max, Math.max(globeConfig.zoom.min, map.getZoom() + amount));
    if (reducedMotion) map.jumpTo({ zoom });
    else map.easeTo({ zoom, duration: globeConfig.animation.zoomDuration, essential: false });
  };

  return (
    <section className={"globe-explorer" + (sheetOpen ? " is-sheet-open" : "")} aria-labelledby="globe-title">
      <aside className={"globe-sidebar" + (sheetOpen ? " is-open" : "")}>
        <button
          aria-expanded={sheetOpen}
          className="globe-sheet-toggle"
          onClick={() => setSheetOpen((open) => !open)}
          type="button"
        >
          <span><b>{siteCopy.globe.explore}</b><small>{siteCopy.globe.collectionCount(places.length)}</small></span>
          <span aria-hidden="true">{sheetOpen ? "↓" : "↑"}</span>
        </button>
        <div className="globe-sidebar-intro">
          <p className="eyebrow">{siteCopy.globe.eyebrow}</p>
          <h1 id="globe-title">{siteCopy.globe.title}</h1>
          <p>{siteCopy.globe.introduction}</p>
        </div>
        <div className="globe-list-heading">
          <label htmlFor="place-filter">{siteCopy.globe.places}</label>
          <span>{siteCopy.globe.shown(visiblePlaces.length)}</span>
        </div>
        <input
          className="globe-place-filter"
          id="place-filter"
          onChange={(event) => setFilter(event.target.value)}
          placeholder={siteCopy.globe.filterPlaceholder}
          type="search"
          value={filter}
        />
        <nav className="globe-place-list" aria-label={siteCopy.globe.placeListLabel}>
          {visiblePlaces.map((place) => (
            <button
              aria-pressed={selectedSlug === place.slug}
              className={"globe-place-row" + (selectedSlug === place.slug ? " is-selected" : "")}
              key={place.slug}
              onClick={() => choosePlace(place.slug)}
              type="button"
            >
              <span><strong>{place.title}</strong><small>{place.location}</small></span>
              <span>{String(place.photoCount).padStart(siteConfig.countPadLength, "0")}</span>
            </button>
          ))}
          {visiblePlaces.length === 0 ? <p className="globe-no-results">{siteCopy.globe.noResults}</p> : null}
        </nav>
        <div className="globe-sidebar-links">
          <Link href={routes.places}>{siteCopy.globe.photoIndex} <span>↗</span></Link>
          <Link href={routes.inquire}>{siteCopy.globe.inquiryLink} <span>↗</span></Link>
        </div>
      </aside>

      <div className="globe-stage">
        <div
          aria-label={siteCopy.globe.mapLabel}
          className="globe-map"
          ref={mapContainerRef}
          role="region"
        />
        {!mapReady && !mapFailed ? <div className="globe-loading"><span /><p>{siteCopy.globe.loading}</p></div> : null}
        {mapFailed ? (
          <div className="globe-fallback">
            <p className="eyebrow">{siteCopy.globe.unavailableEyebrow}</p>
            <h2>{siteCopy.globe.unavailableTitle}</h2>
            <p>{siteCopy.globe.unavailableBody}</p>
            <Link className="button button-ink" href={routes.places}>{siteCopy.globe.browse}</Link>
          </div>
        ) : null}

        <div className="globe-controls" aria-label={siteCopy.globe.controlsLabel}>
          <button disabled={!mapReady} onClick={() => zoomBy(globeConfig.zoom.controlStep)} type="button" aria-label={siteCopy.globe.zoomIn}>+</button>
          <button disabled={!mapReady} onClick={() => zoomBy(-globeConfig.zoom.controlStep)} type="button" aria-label={siteCopy.globe.zoomOut}>−</button>
          <button disabled={!mapReady} onClick={clearSelection} type="button">{siteCopy.globe.reset}</button>
        </div>

        <div className="globe-surprise-control">
          <button className="globe-surprise" disabled={!mapReady || places.length < 2} onClick={surpriseMe} type="button">
            <span aria-hidden="true">*</span>
            {siteCopy.globe.surprise}
          </button>
        </div>

        {selectedPlace ? (
          <article aria-live="polite" className="globe-photo-card" key={selectedPlace.slug}>
            <Link className="globe-photo-card-link" href={routes.place(selectedPlace.slug)} aria-label={siteCopy.globe.openCollectionLabel(selectedPlace.title)}>
              <ResponsiveImage alt={selectedPlace.cover.alt} height={selectedPlace.cover.height} sizes="(max-width: 780px) 110px, 180px" src={selectedPlace.cover.src} srcSet={selectedPlace.cover.srcSet} width={selectedPlace.cover.width} />
              <div>
                <p className="eyebrow">{siteCopy.globe.selectedPlace}</p>
                <h2>{selectedPlace.title}</h2>
                <p className="globe-card-location">{selectedPlace.location}</p>
                {selectedPlace.note ? <p>{selectedPlace.note}</p> : <p>{siteCopy.globe.selectedFallback(selectedPlace.photoCount)}</p>}
                <span className="inline-link">{siteCopy.globe.openCollection} <span>↗</span></span>
              </div>
            </Link>
            {nearbyPlaces.length > 0 ? (
              <div aria-label={siteCopy.globe.nearbyLabel} className="globe-card-related" role="group">
                <span>{siteCopy.globe.nearby}</span>
                {nearbyPlaces.map((place) => (
                  <button key={place.slug} onClick={() => choosePlace(place.slug)} type="button">{place.title}</button>
                ))}
              </div>
            ) : null}
            <button aria-label={siteCopy.globe.closeSelected} className="globe-card-close" onClick={clearSelection} type="button">×</button>
          </article>
        ) : (
          <div className="globe-instructions">
            <p className="eyebrow">{siteCopy.globe.instructionsEyebrow}</p>
            <p>{siteCopy.globe.instructions}</p>
            <small>{siteCopy.globe.instructionsDetail}</small>
          </div>
        )}
      </div>
    </section>
  );
}
