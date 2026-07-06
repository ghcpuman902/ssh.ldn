/**
 * Deterministic calibration harness for the loudness-based noise score model.
 * Run: node scripts/noise-calibration.mjs
 */
import {
  airportDbToPresence,
  buildContributors,
  combineLoudness,
  dbToPresence,
  presenceToScore,
  roadDbToPresence,
} from "../lib/map/noise-score-model.ts";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const scoreFromDbInputs = ({ roadDb, railDb, airportDb, nightlifeScore }) => {
  const scoreByKind = {
    road: presenceToScore("road", roadDbToPresence(roadDb)),
    rail: presenceToScore("rail", dbToPresence(railDb, "rail")),
    airport: presenceToScore("airport", airportDbToPresence(airportDb)),
    nightlife: clamp(nightlifeScore ?? 0, 0, 100),
  };

  return {
    overall: Math.round(combineLoudness(scoreByKind)),
    scoreByKind,
    contributors: buildContributors(scoreByKind),
  };
};

const anchors = [
  {
    name: "Heathrow core (under approach)",
    inputs: { roadDb: 60, railDb: null, airportDb: 72, nightlifeScore: 5 },
    min: 90,
    max: 100,
  },
  {
    name: "Heathrow just outside contour",
    inputs: { roadDb: 65, railDb: null, airportDb: 50, nightlifeScore: 5 },
    min: 45,
    max: 65,
  },
  {
    name: "London Bridge Station",
    inputs: { roadDb: 68, railDb: 70, airportDb: null, nightlifeScore: 55 },
    min: 80,
    max: 95,
  },
  {
    name: "Waterloo IMAX",
    inputs: { roadDb: 76, railDb: 58, airportDb: null, nightlifeScore: 45 },
    min: 80,
    max: 96,
  },
  {
    name: "Soho / Leicester Sq",
    inputs: { roadDb: 64, railDb: null, airportDb: null, nightlifeScore: 88 },
    min: 78,
    max: 92,
  },
  {
    name: "Holborn (27 Red Lion St proxy)",
    inputs: { roadDb: 68, railDb: null, airportDb: null, nightlifeScore: 39 },
    min: 55,
    max: 75,
  },
  {
    name: "Grosvenor Square, Mayfair",
    inputs: { roadDb: 60, railDb: null, airportDb: null, nightlifeScore: 25 },
    min: 45,
    max: 65,
  },
  {
    name: "South of Wapping",
    inputs: { roadDb: 50, railDb: null, airportDb: null, nightlifeScore: 8 },
    min: 0,
    max: 40,
  },
  {
    name: "Hyde Park interior",
    inputs: { roadDb: 44, railDb: null, airportDb: null, nightlifeScore: 0 },
    min: 0,
    max: 25,
  },
];

let failed = 0;

console.log("Noise score calibration\n");

for (const anchor of anchors) {
  const result = scoreFromDbInputs(anchor.inputs);
  const pass =
    result.overall >= anchor.min && result.overall <= anchor.max;
  const status = pass ? "PASS" : "FAIL";

  if (!pass) failed += 1;

  const breakdown = Object.entries(result.scoreByKind)
    .map(([kind, score]) => `${kind}=${Math.round(score)}`)
    .join(", ");

  console.log(
    `${status} ${anchor.name}: ${result.overall}/100 (expected ${anchor.min}-${anchor.max})`
  );
  console.log(`      ${breakdown}`);
}

console.log(`\n${failed === 0 ? "All anchors passed." : `${failed} anchor(s) failed.`}`);
process.exit(failed === 0 ? 0 : 1);
