"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, LineString } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { journey as exampleJourney } from "@/lib/journeyData";
import type { Journey } from "@/lib/journeyData";
import { createJourneyMarker } from "@/components/JourneyMarker";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceBetweenCoordinates = (
  start: [number, number],
  end: [number, number],
) => {
  const [startLng, startLat] = start;
  const [endLng, endLat] = end;

  const earthRadiusInMeters = 6371000;
  const deltaLat = toRadians(endLat - startLat);
  const deltaLng = toRadians(endLng - startLng);
  const startLatRad = toRadians(startLat);
  const endLatRad = toRadians(endLat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLatRad) *
      Math.cos(endLatRad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadiusInMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const interpolateCoordinate = (
  start: [number, number],
  end: [number, number],
  ratio: number,
): [number, number] => [
  start[0] + (end[0] - start[0]) * ratio,
  start[1] + (end[1] - start[1]) * ratio,
];

const buildRevealedRoute = (
  coordinates: [number, number][],
  progress: number,
) => {
  if (coordinates.length === 0) {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [],
      },
    };
  }

  if (progress <= 0) {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [coordinates[0], coordinates[0]],
      },
    };
  }

  if (progress >= 1) {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    };
  }

  const totalDistance = coordinates.slice(1).reduce((sum, point, index) => {
    const previous = coordinates[index];
    return sum + getDistanceBetweenCoordinates(previous, point);
  }, 0);

  const targetDistance = totalDistance * progress;
  let distanceTraveled = 0;
  const revealedCoordinates: [number, number][] = [coordinates[0]];

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const segmentDistance = getDistanceBetweenCoordinates(previous, current);

    if (distanceTraveled + segmentDistance >= targetDistance) {
      const segmentProgress =
        segmentDistance === 0
          ? 0
          : (targetDistance - distanceTraveled) / segmentDistance;

      revealedCoordinates.push(
        interpolateCoordinate(previous, current, segmentProgress),
      );
      break;
    }

    distanceTraveled += segmentDistance;
    revealedCoordinates.push(current);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: revealedCoordinates,
    },
  };
};

export default function JourneyMap({
  trip = exampleJourney,
  focusId,
  onDestination,
}: {
  trip?: Journey;
  focusId?: string;
  onDestination?: (id: string) => void;
}) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const prevSelectedRef = useRef<string | null>(null);
  const callbacks = useRef(onDestination);
  useEffect(() => {
    callbacks.current = onDestination;
  }, [onDestination]);
  const destinations = [
    ...new Map(
      trip.legs.flatMap((l) => l.destinations).map((d) => [d.id, d]),
    ).values(),
  ];
  const boundsFor = (coords: [number, number][]) =>
    coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds());

  useEffect(() => {
    if (!mapContainer.current || map.current || !trip.legs.length) return;
    if (!mapboxgl.accessToken) return;
    let disposed = false;
    const all = [
      ...new Map(
        trip.legs.flatMap((l) => l.destinations).map((d) => [d.id, d]),
      ).values(),
    ];
    let currentMap: mapboxgl.Map;
    try {
      currentMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/standard",
        center: all[0].coordinates,
        zoom: 5,
        config: { basemap: { lightPreset: "dusk" } },
      });
    } catch {
      queueMicrotask(() => {
        if (!disposed)
          setError(
            "Interactive maps are unavailable in this browser. Your itinerary is still available below.",
          );
      });
      return;
    }
    map.current = currentMap;
    currentMap.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    currentMap.on("error", () => {
      if (!disposed)
        setError(
          "Map could not load. Check your connection and Mapbox token. Your itinerary is still available.",
        );
    });
    currentMap.on("load", () => {
      if (disposed) return;
      setError("");
      const coordinates = trip.legs.flatMap((l) => l.route.coordinates);
      currentMap.addSource("journey-route-reveal", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [coordinates[0], coordinates[0]],
          },
        },
      });
      currentMap.addLayer({
        id: "journey-route-line-reveal",
        type: "line",
        source: "journey-route-reveal",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#e9b17b",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
      currentMap.addSource("legs", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: trip.legs.map((leg) => ({
            type: "Feature",
            id: leg.id,
            properties: { id: leg.id },
            geometry: {
              type: "LineString",
              coordinates: leg.route.coordinates,
            },
          })),
        },
      });
      currentMap.addLayer({
        id: "legs-line",
        type: "line",
        source: "legs",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#f5d6ae",
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            7,
            3,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            1,
            0.12,
          ],
        },
      });
      currentMap.addLayer({
        id: "legs-hit",
        type: "line",
        source: "legs",
        paint: { "line-width": 32, "line-opacity": 0 },
      });
      // One owner per gesture: the same wide layer handles selection and empty-map deselection.
      currentMap.on("click", (e) => {
        const feature = currentMap.queryRenderedFeatures(e.point, {
          layers: ["legs-hit"],
        })[0] as unknown as Feature<LineString> | undefined;
        setSelectedLegId(
          feature ? String(feature.properties?.id ?? feature.id) : null,
        );
      });
      currentMap.on("mouseenter", "legs-hit", () => {
        currentMap.getCanvas().style.cursor = "pointer";
      });
      currentMap.on("mouseleave", "legs-hit", () => {
        currentMap.getCanvas().style.cursor = "";
      });
      all.forEach((destination, index) => {
        const element = createJourneyMarker(index === 0);
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.setAttribute("aria-label", "Explore " + destination.name);
        const select = () => callbacks.current?.(destination.id);
        element.addEventListener("click", (e) => {
          e.stopPropagation();
          select();
        });
        element.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select();
          }
        });
        new mapboxgl.Marker({ element })
          .setLngLat(destination.coordinates)
          .addTo(currentMap);
      });
      currentMap.fitBounds(boundsFor(coordinates), {
        padding: 55,
        duration: 1000,
      });
      const source = currentMap.getSource(
        "journey-route-reveal",
      ) as mapboxgl.GeoJSONSource;
      const start = performance.now();
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const reveal = (timestamp: number) => {
        if (disposed) return;
        const progress = reduced ? 1 : Math.min((timestamp - start) / 2600, 1);
        source.setData(
          buildRevealedRoute(
            coordinates,
            1 - (1 - progress) ** 3,
          ) as Feature<LineString>,
        );
        if (progress < 1)
          animationFrameRef.current = requestAnimationFrame(reveal);
      };
      animationFrameRef.current = requestAnimationFrame(reveal);
      setReady(true);
    });
    return () => {
      disposed = true;
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      currentMap.remove();
      map.current = null;
    };
  }, [trip]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m?.getLayer("legs-line")) return;
    if (prevSelectedRef.current)
      m.setFeatureState(
        { source: "legs", id: prevSelectedRef.current },
        { selected: false },
      );
    if (selectedLegId) {
      m.setFeatureState(
        { source: "legs", id: selectedLegId },
        { selected: true },
      );
      const leg = trip.legs.find((l) => l.id === selectedLegId);
      if (leg)
        m.fitBounds(boundsFor(leg.route.coordinates), {
          padding: 65,
          maxZoom: 11,
          duration: 900,
        });
    } else if (prevSelectedRef.current) {
      m.fitBounds(boundsFor(trip.legs.flatMap((l) => l.route.coordinates)), {
        padding: 55,
        duration: 900,
        pitch: 0,
        bearing: 0,
      });
    }
    prevSelectedRef.current = selectedLegId;
  }, [selectedLegId, ready, trip]);

  useEffect(() => {
    const destination = trip.legs
      .flatMap((l) => l.destinations)
      .find((d) => d.id === focusId);
    if (ready && destination)
      map.current?.flyTo({
        center: destination.coordinates,
        zoom: 11.5,
        pitch: 45,
        duration: 1300,
      });
  }, [focusId, ready, trip]);

  return (
    <div className="map-wrap">
      <div ref={mapContainer} className="map-canvas" />
      {(!mapboxgl.accessToken || error) && (
        <div className="map-fallback">
          <span className="eyebrow">THE ROAD AHEAD</span>
          <h2>
            {destinations[0]?.name} to {destinations.at(-1)?.name}
          </h2>
          <p>
            {error ||
              "Add a Mapbox public token in your server environment to explore the interactive map."}
          </p>
          <p>The itinerary and your memories are available below.</p>
        </div>
      )}
      <div className="map-caption">
        <span className="live-dot" /> YOUR JOURNEY{" "}
        <span>Tap a route or a stop to explore</span>
      </div>
      {ready && (
        <button
          className="map-reset"
          onClick={() => {
            setSelectedLegId(null);
            map.current?.fitBounds(
              boundsFor(trip.legs.flatMap((l) => l.route.coordinates)),
              { padding: 55, pitch: 0, bearing: 0, duration: 900 },
            );
          }}
        >
          ↗ Full journey
        </button>
      )}
      <div className="map-note">
        {selectedLegId
          ? trip.legs.find((l) => l.id === selectedLegId)?.title
          : "Itinerary connections · not driving directions"}
      </div>
    </div>
  );
}
