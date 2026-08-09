export type JourneyLocation = {
  id: string;
  name: string;
  state: string;
  coordinates: [number, number];
  date: string;
  description: string;
};

export const journeyLocations: JourneyLocation[] = [
  {
    id: "houston",
    name: "Houston",
    state: "Texas",
    coordinates: [-95.3698, 29.7604],
    date: "August 5, 2026",
    description: "Where our journey began.",
  },
  {
    id: "galveston",
    name: "Galveston",
    state: "Texas",
    coordinates: [-94.7977, 29.3013],
    date: "August 7, 2026",
    description: "Our first stop by the Gulf.",
  },
  {
    id: "new-orleans",
    name: "New Orleans",
    state: "Louisiana",
    coordinates: [-90.0715, 29.9511],
    date: "August 10, 2026",
    description: "Next stop: New Orleans.",
  },
  {
    id: "mobile",
    name: "Mobile",
    state: "Alabama",
    coordinates: [-88.0399, 30.6954],
    date: "August 13, 2026",
    description: "A stop along the Gulf Coast.",
  },
  {
    id: "pensacola",
    name: "Pensacola",
    state: "Florida",
    coordinates: [-87.2169, 30.4213],
    date: "August 16, 2026",
    description: "Our easternmost stop so far.",
  },
];