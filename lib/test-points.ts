export type TestPoint = {
  id: string;
  address: string;
  expectedStory: string;
};

export const TEST_POINTS: TestPoint[] = [
  {
    id: "ramen_space_dalston",
    address:
      "Ramen Space Unit 6, Sledge Tower, Dalston Square, London E8 3GP",
    expectedStory:
      "Hackathon venue in Dalston; mixed urban context with nearby Overground and local nightlife.",
  },
  {
    id: "wapping_pub_quiet_aircraft",
    address: "78-80 Wapping Ln, London E1W 2RT",
    expectedStory:
      "Pub in Wapping; should be relatively quiet for road/rail, but may show aircraft/Heathrow approach context.",
  },
  {
    id: "kings_cross_euston_road_noisy",
    address: "5/7 Euston Rd., London NW1 2SA",
    expectedStory:
      "In front of King's Cross on Euston Road; should be very noisy.",
  },
  {
    id: "fabric_day_night_pattern",
    address: "77A Charterhouse St, London EC1M 6HJ",
    expectedStory:
      "Fabric London near Smithfield Market; should have distinct day versus night pattern.",
  },
  {
    id: "fulham_residential_quiet",
    address: "33 Rosaville Rd, London SW6 7BN",
    expectedStory:
      "Residential Fulham street away from major road; should be quieter.",
  },
];

export const getTestPointById = (id: string): TestPoint | undefined =>
  TEST_POINTS.find((point) => point.id === id);
