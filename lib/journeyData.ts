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

// --- Mock data: multiple legs connecting a list of destinations ---

const destinationList = [
  { id: 'conroe', name: 'Conroe', state: 'Texas', coordinates: [-95.469, 30.3119], date: 'August 1, 2026', description: 'Conroe start' },
  { id: 'houston', name: 'Houston', state: 'Texas', coordinates: [-95.3698, 29.7604], date: 'August 2, 2026', description: 'Houston' },
  { id: 'galveston', name: 'Galveston', state: 'Texas', coordinates: [-94.7977, 29.3013], date: 'August 3, 2026', description: 'Galveston' },
  { id: 'new-braunfels', name: 'New Braunfels', state: 'Texas', coordinates: [-98.1136, 29.7030], date: 'August 5, 2026', description: 'New Braunfels' },
  { id: 'austin', name: 'Austin', state: 'Texas', coordinates: [-97.7431, 30.2672], date: 'August 6, 2026', description: 'Austin' },
  { id: 'dallas', name: 'Dallas', state: 'Texas', coordinates: [-96.7970, 32.7767], date: 'August 8, 2026', description: 'Dallas' },
  { id: 'texarkana', name: 'Texarkana', state: 'Texas', coordinates: [-94.1066, 33.4418], date: 'August 10, 2026', description: 'Texarkana' },
  { id: 'little-rock', name: 'Little Rock', state: 'Arkansas', coordinates: [-92.2896, 34.7465], date: 'August 12, 2026', description: 'Little Rock' },
  { id: 'memphis', name: 'Memphis', state: 'Tennessee', coordinates: [-90.0490, 35.1495], date: 'August 14, 2026', description: 'Memphis' },
  { id: 'nashville', name: 'Nashville', state: 'Tennessee', coordinates: [-86.7816, 36.1627], date: 'August 16, 2026', description: 'Nashville' },
  { id: 'knoxville', name: 'Knoxville', state: 'Tennessee', coordinates: [-83.9207, 35.9606], date: 'August 18, 2026', description: 'Knoxville' },
  { id: 'roanoke', name: 'Roanoke', state: 'Virginia', coordinates: [-79.9414, 37.27097], date: 'August 20, 2026', description: 'Roanoke' },
  { id: 'richmond', name: 'Richmond', state: 'Virginia', coordinates: [-77.4360, 37.5407], date: 'August 22, 2026', description: 'Richmond' },
];

// helper to build leg ids
const legId = (fromId: string, toId: string) => `leg-${fromId}-to-${toId}`;

const legs: Leg[] = destinationList.slice(0, -1).map((start, idx) => {
  const end = destinationList[idx + 1];
  return {
    id: legId(start.id, end.id),
    title: `${start.name} → ${end.name}`,
    startDate: start.date,
    endDate: end.date,
    color: idx % 2 === 0 ? '#292524' : '#78716c',
    route: {
      type: 'LineString',
      coordinates: [start.coordinates as Coordinate, end.coordinates as Coordinate],
    },
    destinations: [
      {
        id: start.id,
        name: start.name,
        state: start.state,
        coordinates: start.coordinates as Coordinate,
        date: start.date,
        description: start.description,
      },
      {
        id: end.id,
        name: end.name,
        state: end.state,
        coordinates: end.coordinates as Coordinate,
        date: end.date,
        description: end.description,
      },
    ],
    moments: [],
  } as Leg;
});

export const journey: Journey = {
  id: 'current-journey',
  title: 'Gulf & Southeast Route',
  description: 'Mock journey broken into multiple legs',
  legs,
};

// Backwards-compatible alias: unique destinations in chronological order
const seen = new Set<string>();
export const journeyLocations = legs.flatMap((l) => l.destinations).filter((d) => {
  if (seen.has(d.id)) return false;
  seen.add(d.id);
  return true;
}).map((d) => ({
  id: d.id,
  name: d.name,
  state: d.state ?? '',
  coordinates: d.coordinates,
  date: d.date ?? '',
  description: d.description ?? '',
}));
