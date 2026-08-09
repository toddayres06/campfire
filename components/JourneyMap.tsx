"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { journeyLocations } from "@/lib/journeyData";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export default function JourneyMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

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

      /*
       * Build the route from our journey locations.
       *
       * Mapbox expects GeoJSON coordinates in:
       * [longitude, latitude]
       */
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
          "line-opacity": 0.8,
        },
      });

      journeyLocations.forEach((location, index) => {
        const marker = new mapboxgl.Marker()
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

      /*
       * Fit the camera around the entire journey.
       */
      const bounds = new mapboxgl.LngLatBounds();

      journeyLocations.forEach((location) => {
        bounds.extend(location.coordinates);
      });

      currentMap.fitBounds(bounds, {
        padding: 80,
        duration: 1500,
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return <div ref={mapContainer} className="h-full w-full" />;
}