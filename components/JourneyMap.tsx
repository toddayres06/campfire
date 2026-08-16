"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { journeyLocations } from "@/lib/journeyData";
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

export default function JourneyMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initialLocation = journeyLocations[0];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard",
      center: initialLocation.coordinates,
      zoom: 5,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl(),
      "bottom-right",
    );

    map.current.on("load", () => {
      const currentMap = map.current;

      if (!currentMap) return;

      const routeCoordinates = journeyLocations.map(
        (location) => location.coordinates,
      );

      currentMap.addSource("journey-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeCoordinates,
          },
        },
      });

      currentMap.addLayer({
        id: "journey-route-line",
        type: "line",
        source: "journey-route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#292524",
          "line-width": 4,
          "line-opacity": 0,
        },
      });

      currentMap.addSource("journey-route-reveal", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [routeCoordinates[0], routeCoordinates[0]],
          },
        },
      });

      currentMap.addLayer({
        id: "journey-route-line-reveal",
        type: "line",
        source: "journey-route-reveal",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#292524",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });

      journeyLocations.forEach((location, index) => {
        const marker = new mapboxgl.Marker({
          element: createJourneyMarker(index === 0),
        })
          .setLngLat(location.coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 4px;">
                <strong>${location.name}</strong>
                <p style="margin: 4px 0 0;">
                  ${location.state}
                </p>
                <p style="margin: 4px 0 0;">
                  ${location.date}
                </p>
                <p style="margin: 4px 0 0;">
                  ${location.description}
                </p>
              </div>
            `),
          )
          .addTo(currentMap);

        if (index === 0) {
          marker.togglePopup();
        }
      });

      const bounds = new mapboxgl.LngLatBounds();

      journeyLocations.forEach((location) => {
        bounds.extend(location.coordinates);
      });

      currentMap.fitBounds(bounds, {
        padding: 80,
        duration: 1500,
      });

      const revealSource = currentMap.getSource(
        "journey-route-reveal",
      ) as mapboxgl.GeoJSONSource;

      const animationDuration = 2600;
      const animationStart = performance.now();

      const animateReveal = (timestamp: number) => {
        const elapsed = timestamp - animationStart;
        const rawProgress = Math.min(elapsed / animationDuration, 1);
        const easedProgress = 1 - (1 - rawProgress) ** 3;
        const partialRoute = buildRevealedRoute(routeCoordinates, easedProgress);

        revealSource.setData(partialRoute);

        if (rawProgress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(animateReveal);
        }
      };

      animationFrameRef.current = window.requestAnimationFrame(animateReveal);
    });

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return <div ref={mapContainer} className="h-full w-full" />;
}