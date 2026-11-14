import { journey, type Journey } from "./journeyData";

export const states =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split(
    "|",
  );
export type Memory = {
  id: string;
  title: string;
  note: string;
  place: string;
  state: string;
  date: string;
  photo?: string;
};
export type Shift = {
  id: string;
  city: string;
  platform: string;
  date: string;
  hours: number;
  earned: number;
  fuel: number;
};
export type TripData = {
  version: 1;
  journey: Journey;
  currentId: string;
  memories: Memory[];
  collected: string[];
  shifts: Shift[];
  preferences: string;
};
export const initialTrip: TripData = {
  version: 1,
  journey,
  currentId: "conroe",
  memories: [],
  collected: [],
  shifts: [],
  preferences:
    "Scenic roads, affordable stops, and time for gig work. Traveling together.",
};

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("campfire", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("trip");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not open local storage."));
  });
}
export async function readTrip(): Promise<TripData> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("trip").objectStore("trip").get("current");
    request.onsuccess = () => {
      db.close();
      try {
        resolve(
          request.result
            ? validateTrip(request.result)
            : structuredClone(initialTrip),
        );
      } catch {
        reject(
          new Error(
            "This device’s saved trip could not be read. Import a valid backup to recover it.",
          ),
        );
      }
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Could not read your trip."));
    };
  });
}
export async function writeTrip(data: TripData) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("trip", "readwrite");
    tx.objectStore("trip").put(data, "current");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(
        new Error(
          "Your changes could not be saved. Export a backup before closing.",
        ),
      );
    };
  });
}
export function validateTrip(value: unknown): TripData {
  const d = value as TripData;
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.journey?.legs) ||
    !Array.isArray(d.memories) ||
    !Array.isArray(d.collected) ||
    !Array.isArray(d.shifts) ||
    typeof d.currentId !== "string" ||
    typeof d.preferences !== "string"
  )
    throw new Error("This is not a Campfire backup.");
  const text = (v: unknown, max = 20000) =>
    typeof v === "string" && v.length <= max;
  const coord = (v: unknown): boolean =>
    Array.isArray(v) &&
    v.length === 2 &&
    v.every(Number.isFinite) &&
    Math.abs(v[0]) <= 180 &&
    Math.abs(v[1]) <= 90;
  if (
    d.journey.legs.length < 1 ||
    d.journey.legs.length > 100 ||
    d.journey.legs.some(
      (l) =>
        !text(l.id) ||
        !Array.isArray(l.destinations) ||
        !l.destinations.length ||
        !l.destinations.every(
          (p) =>
            text(p.id) && text(p.name) && p.name.trim() && coord(p.coordinates),
        ) ||
        l.route?.type !== "LineString" ||
        !Array.isArray(l.route.coordinates) ||
        l.route.coordinates.length < 2 ||
        l.route.coordinates.length > 100000 ||
        !l.route.coordinates.every(coord),
    )
  )
    throw new Error("The trip route is invalid.");
  if (
    d.memories.some(
      (m) =>
        !text(m.id) ||
        !text(m.title) ||
        !text(m.note) ||
        !text(m.place) ||
        !text(m.date) ||
        (!states.includes(m.state) && m.state !== "") ||
        (m.photo !== undefined &&
          (!text(m.photo, 5000000) ||
            !/^data:image\/(jpeg|png|webp);base64,/.test(m.photo))),
    )
  )
    throw new Error("The memories are invalid.");
  if (
    new Set(d.collected).size !== d.collected.length ||
    !d.collected.every((s) => states.includes(s)) ||
    d.shifts.some(
      (s) =>
        !text(s.id) ||
        !text(s.city) ||
        !text(s.date) ||
        !text(s.platform) ||
        ![s.hours, s.earned, s.fuel].every(
          (v) => Number.isFinite(v) && v >= 0,
        ) ||
        s.hours <= 0,
    )
  )
    throw new Error("The collection or work log is invalid.");
  return d;
}
export async function photoData(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 20000000)
    throw new Error("Choose an image under 20 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Photo processing is unavailable.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}
