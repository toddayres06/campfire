"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { journey } from "@/lib/journeyData";
import type { Destination } from "@/lib/journeyData";
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
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);
  const globalBoundsRef = useRef<[[number, number], [number, number]] | null>(null);
  // handler refs for proper cleanup and diagnostics
  const legClickRef = useRef<any>(null);
  const mapClickRef = useRef<any>(null);
  // current selected ref to allow handlers defined in load() to see latest selection
  const currentSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Build a chronologically ordered list of unique destinations across all legs
    const allDestinations = (() => {
      const seen = new Set<string>();
      const out: Destination[] = [];
      for (const leg of journey.legs) {
        for (const d of leg.destinations) {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            out.push(d);
          }
        }
      }
      return out;
    })();

    const initialLocation = allDestinations[0]!;

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

      // Build route coordinates from the deduplicated chronological destination list
      const routeCoordinates = allDestinations.map(d => d.coordinates);

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
            coordinates: routeCoordinates.length > 0 ? [routeCoordinates[0], routeCoordinates[0]] : [],
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

      // --- NEW: per-leg source + interaction layers ---
      const legsFeatureCollection = {
        type: 'FeatureCollection',
        features: journey.legs.map((leg) => ({
          type: 'Feature',
          id: leg.id,
          properties: {
            id: leg.id,
            color: leg.color ?? '#292524',
          },
          geometry: leg.route,
        })),
      };

      currentMap.addSource('legs', {
        type: 'geojson',
        data: legsFeatureCollection,
      });
      // diag: report legs source features count
      try {
        // legs source added
      } catch (err) {
        // ignore diagnostic helper failure
      }

      // visible leg layer using feature property color and feature-state for selection
      currentMap.addLayer({
        id: 'legs-line',
        type: 'line',
        source: 'legs',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 6, 3],
          'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1.0, 0.15],
        },
      }, 'journey-route-line-reveal');

      // invisible, wider hit layer on top for comfortable taps/clicks
      currentMap.addLayer({
        id: 'legs-hit',
        type: 'line',
        source: 'legs',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#000000',
          // keep visually transparent but avoid fully zero opacity to ensure hit-testing/reporting
          'line-opacity': 0,
          'line-width': 28,
        },
      });
      try {
        // layer presence check (diagnostic removed)
        const _ = !!currentMap.getLayer('legs-line');
        const __ = !!currentMap.getLayer('legs-hit');
      } catch (err) {
        // ignore diagnostics
      }

      // create markers for the deduplicated destination list
      allDestinations.forEach((location, index) => {
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

      allDestinations.forEach((location) => {
        bounds.extend(location.coordinates);
      });

      const globalBoundsArray = [[bounds.getWest(), bounds.getSouth()], [bounds.getEast(), bounds.getNorth()]] as [[number, number],[number, number]];
      globalBoundsRef.current = globalBoundsArray;
      // initial global bounds stored
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

      // --- interaction handlers: leg taps and background taps ---
      const onLegClick = (e: any) => {
        try { e.originalEvent.stopPropagation(); } catch (err) { /* ignore */ }
        const feature = e.features && e.features[0];
        if (!feature) return;
        // robustly extract id: prefer properties.id, fall back to feature.id
        const propId = (feature as any).properties && (feature as any).properties.id;
        const topId = (feature as any).id;
        const clickedId = propId ?? topId ?? null;
        if (!clickedId) {
          return;
        }
        const clickedIdStr = String(clickedId);
        // update current selected ref immediately so background handlers see the change during this event loop
        currentSelectedRef.current = clickedIdStr;
        // toggle selection if same leg clicked again
        setSelectedLegId((prev) => (prev === clickedIdStr ? null : clickedIdStr));
      };

      const onMapClick = (e: any) => {
        try {
// Use a narrow test against the visible 'legs-line' to decide empty-map clicks.
const hitPointLineFeatures = currentMap.queryRenderedFeatures(e.point, { layers: ['legs-line'] }) || [];
// small bbox tolerance in case point falls exactly between pixels — 2px radius
const bbox = [[e.point.x - 2, e.point.y - 2], [e.point.x + 2, e.point.y + 2]];
const bboxLineFeatures = currentMap.queryRenderedFeatures(bbox as any, { layers: ['legs-line'] }) || [];

// still compute the wide hit-layer counts for diagnostics if needed but do NOT use them for deselection
const hitLayerFeaturesPoint = currentMap.queryRenderedFeatures(e.point, { layers: ['legs-hit'] }) || [];
const hitLayerFeaturesBBox = currentMap.queryRenderedFeatures(bbox as any, { layers: ['legs-hit'] }) || [];

const isCanvasTarget = e.originalEvent && currentMap.getCanvas && e.originalEvent.target === currentMap.getCanvas();

const hitVisibleLine = (hitPointLineFeatures.length > 0) || (bboxLineFeatures.length > 0);
if (!hitVisibleLine) {
  // log current selection state immediately before changing it (kept for post-deploy audit)
  // deselect because the visible line was not hit
  setSelectedLegId(null);
} else {
  // near the route — do not deselect
}
        } catch (err) {
        console.error('onMapClick error', err);
        }
      };

      // store handlers for cleanup and use them for registration so we can remove them later
      legClickRef.current = onLegClick;
      mapClickRef.current = onMapClick;
      currentMap.on('click', 'legs-hit', onLegClick);
      currentMap.on('click', onMapClick);
      animationFrameRef.current = window.requestAnimationFrame(animateReveal);
    });

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      // remove map and event handlers if present - use stored references
      if (map.current) {
        try {
          if (legClickRef.current) {
            map.current.off('click', 'legs-hit', legClickRef.current);
          }
          if (mapClickRef.current) {
            map.current.off('click', mapClickRef.current);
          }
        } catch (err) {
          console.warn('error during handler cleanup', err);
        }
      }
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // effect: respond to selectedLegId changes by updating feature-state and camera
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;
    const prevId = prevSelectedRef.current;
    const newId = selectedLegId;
    // clear previous selection state
    if (prevId) {
      try {
currentMap.setFeatureState({ source: 'legs', id: prevId }, { selected: false });
      } catch (err) {
console.error('setFeatureState(prev) error', err);
      }
    }
    if (newId) {
      try {
currentMap.setFeatureState({ source: 'legs', id: newId }, { selected: true });
} catch (err) {
console.error('[diag] setFeatureState(new) error', err);
      }
      // Move legs-line above reveal so selected color is visible
      try {
currentMap.moveLayer('legs-line');
currentMap.moveLayer('legs-line');
} catch (err) {
console.warn('moveLayer(legs-line) failed', err);
}      // find the leg and compute bounds for fitBounds camera transition
      const leg = journey.legs.find((l) => l.id === newId);
      if (leg && leg.route && leg.route.coordinates && leg.route.coordinates.length > 0) {
const legBounds = new mapboxgl.LngLatBounds(leg.route.coordinates[0], leg.route.coordinates[0]);
for (const c of leg.route.coordinates) {
  legBounds.extend(c as [number, number]);
}        // cinematic transition with reserved bottom padding ~140px
currentMap.fitBounds(legBounds, {
  padding: { top: 100, bottom: 140, left: 40, right: 40 },
  duration: 900,
  easing: (t) => 1 - Math.pow(1 - t, 3),
});
const onFocusMoveEnd = () => {
  currentMap.off('moveend', onFocusMoveEnd);
};
currentMap.on('moveend', onFocusMoveEnd);
      }
    } else {
      // deselect: return camera to overall journey bounds
      try {
      // move legs-line back below the reveal so initial cinematic reveal remains unchanged
      currentMap.moveLayer('legs-line', 'journey-route-line-reveal');
      } catch (err) {
      console.warn('moveLayer(legs-line, journey-route-line-reveal) failed', err);
      }      // deselect: return camera to overall journey bounds
      if (globalBoundsRef.current) {
try {
  currentMap.fitBounds(globalBoundsRef.current, {
    padding: 80,
    duration: 900,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const onReturnMoveEnd = () => {
    currentMap.off('moveend', onReturnMoveEnd);
  };
  currentMap.on('moveend', onReturnMoveEnd);
} catch (err) {
  console.error('return-to-global fitBounds error', err);
}
      } else {
console.warn('return-to-global: no globalBoundsRef present, attempting to recompute');
try {
  // recompute from journey legs as a safe fallback
  const b = new mapboxgl.LngLatBounds();
  for (const leg of journey.legs) {
    for (const c of leg.route.coordinates) {
      b.extend(c as [number, number]);
    }
  }
  const recomputed = [[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]] as [[number, number],[number, number]];
  globalBoundsRef.current = recomputed;
  currentMap.fitBounds(b, {
    padding: 80,
    duration: 900,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const onReturnMoveEnd2 = () => {
    currentMap.off('moveend', onReturnMoveEnd2);
  };
  currentMap.on('moveend', onReturnMoveEnd2);
} catch (err) {
  console.error('return-to-global recompute error', err);
}
      }
    }
    currentSelectedRef.current = newId;
    prevSelectedRef.current = newId;
  }, [selectedLegId]);


  return <div ref={mapContainer} className="h-full w-full" />;
}