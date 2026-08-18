// Domain types for Journey / Leg / Destination / Moment / Media

export type Coordinate = [number, number]; // [lng, lat]
export type ISODateString = string;

export enum DestinationType {
  City = "city",
  Stop = "stop",
  Viewpoint = "viewpoint",
  Camp = "camp",
  Other = "other",
}

export enum MediaKind {
  Photo = "photo",
  Video = "video",
  Audio = "audio",
  Other = "other",
}

export interface Media {
  id: string;
  kind: MediaKind;
  uri: string;
  thumbnailUri?: string;
  caption?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: ISODateString;
}

export interface Moment {
  id: string;
  timestamp?: ISODateString;
  coordinates?: Coordinate;
  text?: string;
  media?: Media[];
  // optional backlink to a destination within the same leg
  destinationId?: string;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface Destination {
  id: string;
  name: string;
  state?: string; // preserve the existing 'state' field
  coordinates: Coordinate;
  type?: DestinationType;
  date?: string; // keep original format for display; canonical ISO when available
  description?: string;
  moments?: Moment[];
  markerColor?: string;
}

export interface LineStringRoute {
  type: "LineString";
  coordinates: Coordinate[];
  cumulativeDistancesMeters?: number[]; // optional cache for animations
}

export interface Leg {
  id: string;
  title?: string;
  description?: string;
  startDate?: ISODateString;
  endDate?: ISODateString;
  color?: string;
  route: LineStringRoute;
  // In the initial nested model, legs contain destinations and moments arrays (may be empty)
  destinations: Destination[];
  moments: Moment[];
}

export interface Journey {
  id: string;
  title?: string;
  description?: string;
  startDate?: ISODateString;
  endDate?: ISODateString;
  coverMedia?: Media | null;
  legs: Leg[];
}

// --- Mock data migration: convert the previous flat journeyLocations into a single Journey with one Leg ---

const legacyLocations = [
  {
    id: "houston",
    name: "Houston",
    state: "Texas",
    coordinates: [-95.3698, 29.7604] as Coordinate,
    date: "August 5, 2026",
    description: "Where our journey began.",
  },
  {
    id: "galveston",
    name: "Galveston",
    state: "Texas",
    coordinates: [-94.7977, 29.3013] as Coordinate,
    date: "August 7, 2026",
    description: "Our first stop by the Gulf.",
  },
  {
    id: "new-orleans",
    name: "New Orleans",
    state: "Louisiana",
    coordinates: [-90.0715, 29.9511] as Coordinate,
    date: "August 10, 2026",
    description: "Next stop: New Orleans.",
  },
  {
    id: "mobile",
    name: "Mobile",
    state: "Alabama",
    coordinates: [-88.0399, 30.6954] as Coordinate,
    date: "August 13, 2026",
    description: "A stop along the Gulf Coast.",
  },
  {
    id: "pensacola",
    name: "Pensacola",
    state: "Florida",
    coordinates: [-87.2169, 30.4213] as Coordinate,
    date: "August 16, 2026",
    description: "Our easternmost stop so far.",
  },
];

export const journey: Journey = {
  id: "current-journey",
  title: "Gulf Coast Trip",
  description: "A short trip along the Gulf Coast.",
  legs: [
    {
      id: "leg-1",
      title: "Full trip",
      color: "#292524",
      route: {
        type: "LineString",
        coordinates: legacyLocations.map((l) => l.coordinates as Coordinate),
      },
      destinations: legacyLocations.map((l) => ({
        id: l.id,
        name: l.name,
        state: l.state,
        coordinates: l.coordinates as Coordinate,
        date: l.date,
        description: l.description,
      } as Destination)),
      moments: [],
    },
  ],
};

// Backwards-compatible alias: keep journeyLocations shape for any existing imports while encouraging new code to use `journey`.
const primaryLeg = journey.legs[0]!;
export const journeyLocations = primaryLeg.destinations.map((d) => ({
  id: d.id,
  name: d.name,
  state: d.state ?? "",
  coordinates: d.coordinates,
  date: d.date ?? "",
  description: d.description ?? "",
}));
