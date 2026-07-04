export type TestPoint = {
  id: string;
  inputAddress: string;
  expectedStory: string;
  latitude: number;
  longitude: number;
};

export const TEST_POINTS: TestPoint[] = [
  {
    id: "wapping_pub_quiet_aircraft",
    inputAddress: "78-80 Wapping Ln, London E1W 2RT",
    expectedStory:
      "Pub in Wapping; modest road/rail, possible aircraft/Heathrow approach context.",
    latitude: 51.5043,
    longitude: -0.0586,
  },
  {
    id: "kings_cross_euston_road_noisy",
    inputAddress: "5/7 Euston Rd., London NW1 2SA",
    expectedStory:
      "In front of King's Cross on Euston Road; very noisy transport corridor.",
    latitude: 51.5308,
    longitude: -0.1238,
  },
  {
    id: "fabric_day_night_pattern",
    inputAddress: "77A Charterhouse St, London EC1M 6HJ",
    expectedStory:
      "Fabric London near Smithfield; distinct day versus night pattern.",
    latitude: 51.5202,
    longitude: -0.1017,
  },
  {
    id: "fulham_residential_quiet",
    inputAddress: "33 Rosaville Rd, London SW6 7BN",
    expectedStory:
      "Residential Fulham street away from major road; quieter baseline.",
    latitude: 51.4689,
    longitude: -0.1989,
  },
];

export const getTestPoint = (testPointId: string) =>
  TEST_POINTS.find((point) => point.id === testPointId) ?? null;

export const getTestPoints = () => TEST_POINTS;
