# Noise MVP research report

## Executive summary

**Noise** is a strong hackathon concept for the **Live London** track because it tackles a concrete, everyday decision that Londoners regularly get wrong: whether a home that seems fine at a viewing will be noisy at the times they actually live in it. The problem is real at three levels. First, official public-health evidence shows transport noise is materially harmful, with established links to annoyance, sleep disturbance and broader health burdens; England-wide work by UKHSA estimated substantial disease burden from road, rail and aircraft noise, while the WHO’s regional guidance treats environmental noise as a serious health exposure rather than a minor inconvenience. Second, complaints data remain large in scale: CIEH’s 2026 briefing recorded more than **305,000** noise complaints across England and Wales, and the Housing Ombudsman describes noise as a significant driver of housing complaints. Third, property-search forums repeatedly show the exact failure mode you described: buyers and renters often report that railway or road noise was much less obvious during viewings than after moving in. citeturn7search0turn7search6turn22view4turn22view5turn8search4turn23search0turn23search4turn23search9

The idea is **not unique in the broadest sense**. There are already UK property-information products that expose road, rail and aircraft noise, including Homedata, Crystal Roof and HouseCheckup, and the benchmark that most clearly demonstrates product-category viability is Realtor.com’s former/ongoing property-level noise indicator. However, those products mostly emphasise static checks, broad area research or generic environmental reports. The most exploitable gap for a hackathon is a **London-specific, explanation-first, time-aware property noise risk tool** that tells a user not just “high/medium/low”, but **what is making the property noisy, when, how confident the system is, and what extra uncertainty comes from missing inputs like floor or exact unit direction**. That wedge is differentiated enough for a hackathon pitch, especially if you keep the MVP narrow and demonstrate obvious London relevance. citeturn15view5turn31view0turn31view1turn31view2turn32view0

The best one-day strategy is **not** full acoustic simulation. The winning move is to anchor the MVP on **official strategic noise surfaces** from DEFRA, then add a small number of London-specific proxy layers that make the output feel smarter than a generic postcode checker: nearby rail geometry and service frequency, road traffic intensity, nightlife density/opening hours, airport contours and overflight context, plus planning applications that may worsen future exposure. For the demo, your scoring should remain deterministic and explainable, with the LLM used only to render plain-English summaries and caveats. That combination is much more buildable in one day than image-to-floorplan reconstruction or physically realistic 3D propagation, while still sounding technically ambitious. citeturn29view0turn14view1turn29view2turn10view3turn12view1turn14view7turn21view2turn9view1

My recommendation is therefore straightforward: **build Noise, but as a London property noise risk explainer, not as a full urban acoustics engine**. If you are solo, build a postcode-plus-floor version with three source categories and one excellent output page. If you are two people, add time-of-day profiles, nightlife and planning overlays. If you are three, add polish: AG Grid evidence tables, an ElevenLabs voice readout, and a TRMNL “quietest time to visit” ambient display. That scope fits the spirit of the hackathon, the judging rubric you shared, and the sponsor stack unusually well. citeturn9view4turn9view5turn9view6turn9view7turn33view3turn33view4turn37search0

## Product positioning and recommended MVP

### Positioning

The clearest positioning is:

> **Noise** helps London renters and buyers avoid properties that look fine in a daytime viewing but become disruptive at night, during rush hour or under changing transport patterns.

That framing works because it is not merely “another area report”. It is a **decision aid for a specific point in the funnel**: “Should I view this flat?”, “Should I offer on it?”, or “What should I investigate before I sign?”. It also aligns with the hackathon’s “make London the best city to live” spirit, because it reduces avoidable mistakes in housing choice and makes a messy city legible rather than pretending to remove city noise entirely. The official evidence base supports the importance of transport noise, and existing products prove users will engage with property-level environmental checks. citeturn7search0turn7search6turn22view4turn15view5turn31view0turn31view2turn32view0

### Recommended user flows

For the hackathon, I would support **two entry paths**.

The first is a **postcode or address quick check**. The user pastes a postcode or address. The app geocodes it, resolves nearby source layers, and returns a **coarse score** with a conspicuous caveat that without floor and unit details the result is area-level only. Postcodes.io gives a fast, no-key geocoding layer for UK postcodes, while OS Places becomes the better address-grade option if you secure a key and want better geosearch. citeturn19search6turn19search4turn14view4

The second is a **property plus floor check**, which is where the MVP becomes genuinely differentiated. The user enters postcode or address, then optionally adds **floor number** and a simple toggle such as “street-facing / unknown / away from road”. From there, the app produces a **Noise Score**, a **source breakdown** by road, rail, aircraft and nightlife, a **day/evening/night profile**, a **confidence score**, and one or two recommended follow-up checks such as “visit after 22:00” or “check lift failure route if beside Overground line”. The confidence score matters because the official transport-noise datasets are strong, but floor, façade orientation and shielding are often unknown at search time. OSM has `building:levels` and `level` tags that help when present, but they are incomplete and should be treated as optional evidence, not ground truth. citeturn29view0turn14view1turn29view2turn33view0turn33view1

### MVP outputs that judges will understand instantly

The outputs should be visually simple and analytically strong:

- a **0–100 Noise Score** with banding such as *Low risk*, *Mixed*, *High night risk*, *Transport-dominated*;
- a **stacked contributor bar** showing road, rail, aircraft, nightlife and “future construction/planning” shares;
- a **time-of-day chart** with day, evening and night lines or bars;
- a **confidence badge** such as *High*, *Medium*, *Low*, driven by exact-address certainty, floor certainty and source coverage;
- a **plain-English summary** explaining the dominant contributors and telling the user what to verify in person.

This is exactly the kind of output judges can grasp in seconds. It also lets you show both analytical depth and great UX without needing a complex model that is impossible to explain under pressure. Comparable products prove that people respond well to property-level noise summaries and heatmaps, but the gap is that they often stop short of clearly exposing contributor weights, time-of-day differences and uncertainty. citeturn32view0turn15view5turn31view0turn31view2

### Candidate data sources

The table below prioritises sources by what is most realistic for a one-day London MVP. The first five rows are the core stack I would actually build around.

| name | URL | key fields | key required | licence | spatial/temporal resolution | integration notes | sample query |
|---|---|---|---|---|---|---|---|
| DEFRA Road Noise Round 4 | `https://www.data.gov.uk/dataset/38b1444f-47a0-42ca-a358-0d145fcf7d5c/road-noise-all-metrics-england-round-4` | Lden, Lday, Leve, Lnight, LAeq, 10 m grid at 4 m receptor height | No | OGL v3.0 | 10 m grid; strategic model, not live | **Tier 1.** The best anchor dataset for road-noise exposure. Use as your baseline truth rather than trying to infer all road noise from first principles. WMS/WCS/download links are exposed on the dataset page. citeturn29view0 | WMS/WCS via dataset resource links on the page |
| DEFRA Rail Noise Round 4 | `https://environment.data.gov.uk/dataset/3fb3c2d7-292c-4e0a-bd5b-d8e4e1fe2947` | Lden, Lday, Leve, Lnight, LAeq,6h, LAeq,18h | No | OGL | 10 m grid; strategic model | **Tier 1.** This is the fastest way to make rail exposure credible. It already incorporates modelled exposure for railway sources. citeturn30search0turn30search6 | Dataset download / map service from the dataset page |
| DEFRA Airport Noise Round 4 | `https://environment.data.gov.uk/dataset/dac9cba4-abe7-43bd-b8e9-8a83da52edd8` | airport-source noise metrics including Lden, Lnight | No | OGL | 10 m grid; strategic model | **Tier 1 for Heathrow/Gatwick/Stansted effect.** Strong baseline, especially for west London. Use with Heathrow/DfT contour context if you want a richer story. citeturn29view2turn22view3 | Dataset download / WMS / WCS via dataset page |
| Postcodes.io | `https://api.postcodes.io/postcodes/{postcode}` | lat, lon, admin geographies, codes | No | Open-source API; GB postcode data under OS OpenData terms | Postcode centroid; updated from ONSPD | **Tier 1.** Dead simple geocoder for the hackathon. Very fast for a postcode-first flow. citeturn19search6turn19search4turn19search0 | `GET https://api.postcodes.io/postcodes/E83GT` |
| OpenStreetMap Overpass | `https://overpass-api.de/api/interpreter` | `railway=*`, `amenity=pub`, `amenity=bar`, `amenity=nightclub`, `building:levels`, `highway=*` | No | ODbL | Feature-level; near-live community data | **Tier 1.** Best no-key source for nightlife, rail geometry and some building metadata. Great for quick radius queries. citeturn17search0turn33view2turn33view0 | see Overpass example below |
| TfL Unified API | `https://api.tfl.gov.uk/` | route sequence, line arrivals, timetables, station/stop points, road disruptions | App ID / key recommended | TfL open data terms | Live and timetable feeds | **Tier 1.5.** Ideal for Tube, Overground, DLR and TfL roads. Use for London-specific time-of-day profiles and route geometry, not as your sole noise baseline. citeturn10view3turn12view1turn11search9 | `GET https://api.tfl.gov.uk/line/bakerloo/sequence/outbound` |
| DfT Road Traffic Statistics API | `https://roadtraffic.dft.gov.uk/api-documentation` | AADF, road name/category/type, count point lat/lon, vehicle classes | No | Open API | Count-point/link level; annual | Good supplement for broad road intensity and motorbike-heavy corridors. There is no obvious “nearest point” convenience endpoint, so cache relevant links or nearest-neighbour locally. citeturn9view1turn20view1turn20view2turn35view0 | `GET https://roadtraffic.dft.gov.uk/api/average-annual-daily-flow?page[size]=5` |
| Planning Data England API | `https://www.planning.data.gov.uk/docs` | planning applications, listed buildings, conservation areas, flood-risk zones, UPRN/geometries | No | Government planning data terms | Entity-level; varies by dataset | **Tier 1.5.** Useful for nearby future construction and constraints. Excellent official API, but planning-application coverage is still developing. citeturn21view1turn21view2turn21view3 | `GET /entity.json?dataset=planning-application&geometry=POLYGON(...)&geometry_relation=intersects&limit=100` |
| Planning London Datahub API | `https://planningdata.london.gov.uk/api-guest/` | London planning applications and nested data | Guest header needed | GLA terms | Application-level; London-wide | Valuable London-specific planning source, but slightly fiddlier because it wants the `X-API-AllowRequest` header and Elasticsearch-style queries. Still viable if one teammate handles data only. citeturn12view0turn13view0 | `POST https://planningdata.london.gov.uk/api-guest/applications/_search` with `X-API-AllowRequest` |
| National Rail developer feeds | `https://www.nationalrail.co.uk/developers/` | Darwin, Knowledgebase, journey planner feeds | Yes / formal licence for some feeds | Mixed, feed-specific | Real-time plus timetable feeds | Powerful, but **not hackathon-friendly** compared with TfL. National Rail explicitly describes some journey-planner feeds as SOAP APIs under formal licence. I would not make this a day-one dependency. citeturn15view3 | Developer-pack / feed access after signup |
| Network Rail open data feeds | `https://www.networkrail.co.uk/who-we-are/transparency-and-ethics/transparency/open-data-feeds/` | network status and operational feeds | Signup likely | Open-data programme terms | Operational feeds | Good future path, but still heavier than TfL for an MVP. Treat as future work unless someone already knows the feeds. citeturn15view4 | Access via Network Rail data feeds site |
| Heathrow WebTrak and DfT/CAA airport contours | `https://www.heathrow.com/company/local-community/noise/what-you-can-do/track-flights-on-maps` | overflights, heights, noise levels, route patterns; contour maps | No clear public API contract | Heathrow / DfT / CAA terms | Web visual tools; contour datasets periodic | Great for evidence and demonstration, but I would **not** build the MVP around undocumented flight-tracking endpoints. Prefer official contour datasets for reliability. citeturn14view7turn22view3turn13view2 | Use contour maps; treat WebTrak as manual evidence |
| London Air / LAQN API | `https://api.erg.ic.ac.uk/AirQuality/Help` | monitoring sites, species, hourly and daily pollution readings | No | OGL-compatible use terms on the site | Monitor/site level; hourly | Not a core noise signal, but useful as an adjacent “quality of life” layer and sponsor-demo enrichment. citeturn10view0turn27view0turn27view1 | `GET https://api.erg.ic.ac.uk/AirQuality/Information/MonitoringSites/GroupName=London/Json` |
| Breathe London API | `https://www.breathelondon.org/developers` | sensor metadata and air-quality observations | Yes | API terms | Hyperlocal sensor network; current and historical | Similar to LAQN: interesting enrichment, not core to the noise model. Good if you want a “quiet but polluted” nuance. citeturn15view0turn27view2 | `GET /ListSensors` with `X-API-KEY` |
| data.police.uk | `https://data.police.uk/docs/` | street-level crimes and outcomes by month, approximate locations | No | Open police data terms | Monthly; approximate locations | Use for neighbourhood context, not as a direct noise signal. Helpful if you want a broader “liveability” card. citeturn22view2turn16search3turn16search9 | `GET https://data.police.uk/api/crimes-street/all-crime?lat=51.54&lng=-0.07&date=2026-05` |
| HM Land Registry Price Paid Data | `https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads` | price, date, property type, tenure, address fields including postcode/PAON/SAON | No for CSV; API key for some land-property APIs | OGL v3.0 | Monthly updates; historic back to 1995 | Best for validation and storytelling rather than core scoring. For the hackathon, use monthly or yearly CSV extracts, not a live integration. citeturn22view0turn22view1 | Download current/monthly CSV from the page |
| Google Places API | `https://developers.google.com/maps/documentation/places/web-service/nearby-search` | nearby places by type, opening status data depending fields, ratings | Yes, billing enabled | Commercial | Place level; frequently updated | The strongest commercial option for nightlife density and opening-hours context, but it requires billing and careful field masks. OSM is a better zero-cost fallback. citeturn15view1turn17search8turn17search11 | Nearby search for `bar`, `night_club`, `restaurant` with field mask |
| London Datastore / GLA API | `https://data.london.gov.uk/guidance/datastore-api` | open London datasets in JSON documents | Varies | Open data, dataset-specific | Dataset-specific | Use for borough-level demographics, deprivation or London-specific context if you want supporting evidence panels. Not core to the noise engine. citeturn36search0turn36search1turn36search2 | CKAN/Datastore API against chosen dataset |

### Source prioritisation

If you only have time to integrate **five things**, the winning combination is:

**DEFRA road noise + DEFRA rail noise + DEFRA airport noise + Postcodes.io + OSM Overpass**. That gives you immediate property-area resolution, official noise baselines, and enough local features to make the product feel London-native. Then, if you have a sixth dataset, add **TfL** for route geometry and timetable flavour. If you have a seventh, add **Planning Data** for “future noise risk nearby”. Everything else is optional or future-facing. citeturn29view0turn14view1turn29view2turn19search4turn17search0turn12view1turn21view2

## Modelling approach and what is feasible in one day

### What the MVP model should actually do

For the hackathon, the model should be **semi-structured and deterministic**. In other words, use official strategic-noise layers where available, then supplement them with simple proxy features that improve explanatory power. This is both more credible and more buildable than trying to derive everything from service schedules alone. The DEFRA Round 4 datasets are especially valuable because they already capture modelled environmental exposure on a **10 metre grid at a 4 metre receptor height**, which is much closer to a plausible property-risk baseline than a naive “distance to A-road” heuristic. citeturn29view0turn14view1turn29view2

The correct MVP philosophy is therefore:

**official exposure surface first, contributor heuristics second, LLM narration last.**

That design gives you something judges can trust. It also lets you be honest about uncertainty: the baseline captures annual average noise exposure, while the add-on heuristics explain *why this place is probably worse at night* or *why floor 12 is likely less road-exposed than floor 2*. Strategic-noise methods in Europe are based on harmonised assessment approaches such as CNOSSOS-EU, while more advanced propagation modelling sits in methods like ISO 9613 and aviation-specific contour modelling such as ANCON. Those are useful future directions, but not what you should attempt to implement from scratch at a hackathon. citeturn38search0turn38search1turn13view2turn38search2

### Recommended hackathon scoring formula

A practical hackathon formula is:

```text
base_score =
  0.35 * normalise(road_noise_Lden) +
  0.25 * normalise(rail_noise_Lden_or_Lnight) +
  0.15 * normalise(airport_noise_Lden_or_Lnight) +
  0.15 * nightlife_proxy +
  0.10 * future_disruption_proxy

road_proxy =
  Σ near roads [ road_class_weight * log(1 + AADF) / (distance_m + 30)^1.15 ]

rail_proxy =
  Σ near rail corridors [ trains_per_hour * speed_weight * elevation_weight / (distance_m + 25)^1.10 ]

nightlife_proxy =
  Σ venues [ venue_weight * opening_hours_weight / (distance_m + 20)^1.25 ]

aircraft_proxy =
  contour_weight + overflight_context_bonus
```

Then apply **source-specific floor adjustments** rather than one blanket floor multiplier:

```text
road_floor_adj      = max(0.75, 1 - 0.03 * max(floor - 1, 0))
nightlife_floor_adj = max(0.70, 1 - 0.04 * max(floor - 1, 0))
rail_floor_adj      = depends on track elevation; default 0.95 if unknown
aircraft_floor_adj  = 1.00
```

And finally:

```text
noise_score = clamp(100 * weighted_sum, 0, 100)
```

This is not an acoustic decibel model, and you should say so. It is a **decision-support score** whose aim is relative risk ranking plus explanation. That is completely acceptable for a hackathon, provided you show the ingredients clearly and anchor them to public datasets. The key is that strategic-noise layers remain the baseline and proxies only refine interpretation. citeturn29view0turn14view1turn29view2turn9view1turn12view1

### Confidence scoring

Confidence is one of the most underused product features in hackathon demos. It will immediately make your app look more rigorous.

A simple version is:

```text
confidence =
  0.35 * address_precision +
  0.25 * official_noise_coverage +
  0.20 * floor_certainty +
  0.10 * source_completeness +
  0.10 * recency_of_dynamic_layers
```

Translate that into visible labels:

- **High confidence**: exact address or resolved building, official road/rail/airport layers available, floor given.
- **Medium confidence**: postcode only, but official layers available.
- **Low confidence**: no exact address, no floor, heavy use of proxies, or missing source coverage.

This matters because Postcodes.io gives postcode centroids rather than exact flats, OSM building-level metadata are patchy, and some dynamic transport feeds are much easier to access for TfL than for national rail. Surfacing that uncertainty directly will score highly on judgement and maturity. citeturn19search4turn33view0turn15view3turn10view3

### One-day scope versus future work

**Feasible in one day** means: geocode the input, intersect it with DEFRA road/rail/airport layers or precomputed extracts, compute OSM nightlife density, optionally add TfL line context and nearby planning applications, then generate a deterministic result card with explanation. That is absolutely buildable.

**Not feasible in one day** means: photo-to-floorplan reconstruction, 3D street-canyon acoustics, façade-specific shielding, fully reconstructed aircraft trajectories, or standards-grade propagation modelling. Those are all good future directions, but they are traps for a hackathon unless one teammate already has the pipeline ready. If you want a 3D flourish, make it a **stylised cross-section mock-up** based on simple inputs rather than a real simulation. citeturn38search0turn38search1turn14view7turn15view3

## Validation, evidence of demand and competitor landscape

### Why the problem is credible

You need a tight evidence story for judges, and the strongest story is this:

Noise is not just “annoying”. The WHO’s environmental-noise guidance exists because transport noise affects health. UKHSA’s work on the health burden of transportation noise in England estimated large losses from road, rail and aircraft noise, particularly through annoyance and sleep disturbance. The Department for Transport and Civil Aviation Authority’s 2026 ANNE study also explicitly links night-time aviation noise to self-reported sleep disturbance and annoyance, with broader implications for wellbeing. citeturn7search0turn7search6turn22view4

On the complaints side, the 2026 CIEH briefing counted more than **305,000** noise complaints across England and Wales and described a dataset built with a **92% response rate** from local authorities, making it one of the most representative recent national pictures. Meanwhile, the Housing Ombudsman’s noise spotlight calls noise a significant driver of complaints and recommends more proactive neighbourhood management. This gives you hard evidence that the pain is widespread, costly and persistent. citeturn22view5turn8search4

Then use two or three short user-style anecdotes to make the problem vivid. Housing forums repeatedly contain posts from buyers whose viewings did not reveal later road or rail noise problems, including people who say railway, high-street or A-road noise felt much worse once they actually moved in and experienced evenings, nights or open-window summer conditions. That anecdotal layer is exactly the bridge between official evidence and product need. citeturn23search0turn23search4turn23search8turn23search9

### Competitor landscape

| name | URL | scope | strengths | weaknesses | gap to exploit |
|---|---|---|---|---|---|
| Homedata Noise Pollution Check | `https://homedata.co.uk/tools/noise-pollution` | UK property-level road and rail noise | Clear property-level positioning; explicit decibel outputs; API available; fast benchmark for what users already understand. citeturn15view5 | Mostly road/rail-centric, with less emphasis on London-specific temporal interpretation and confidence/explanation. citeturn15view5 | Beat it on **London specificity**, **time-of-day profiles**, **source explanations**, and a more decision-oriented UX. |
| Crystal Roof | `https://crystalroof.co.uk/report/country/uk/noise` | UK postcode/area research tool | Broad scope, includes road, rail, aircraft, emergency services, bells, pubs and clubs; strong area-research framing. citeturn31view0turn31view1 | Feels more like a general neighbourhood-research platform than a focused “should I sign this lease?” tool. citeturn31view0turn31view1 | Beat it on **property workflow**, **floor-aware interpretation**, and **specific London transport-nightlife trade-offs**. |
| HouseCheckup | `https://housecheckup.co.uk/how-it-works` | UK property-intelligence report | Strong “full report” proposition; uses 70+ official sources; noise already included as one factor. citeturn24search4turn31view2 | Noise is only one small factor in a broad composite report; likely less memorable as a dedicated product. citeturn31view2 | Beat it on **single-problem obsession**, transparency of scoring, and live exploratory experience instead of PDF-style reporting. |
| The Noise App | `https://thenoiseapp.com/` | Complaint reporting and investigation | Huge operational scale in neighbourhood reporting; proves that noise management matters to councils and landlords. citeturn15view6 | Different job-to-be-done: reporting nuisance after it happens, not evaluating a property before moving in. citeturn15view6 | Position Noise as **pre-commitment avoidance**, not post-hoc complaint handling. |
| HomeViews | `https://business.homeviews.com/location-ratings-report/` | Resident-review and location sentiment | Strong social proof from verified resident reviews at scale. citeturn15view7 | Review-led, not source-modelled; limited analytical explanation of specific noise drivers. citeturn15view7 | Blend data + explanation + eventual resident feedback loop. |
| Realtor.com Noise Indicator | `https://www.realtor.com/homemade/our-noise-indicator-answers-can-i-hear-it-from-the-house/` | US property-level benchmark | Excellent product precedent: property-level rating, heatmap, multiple noise-source categories, obvious consumer value. citeturn32view0 | US-focused and not London-specific; article describes a broad combined rating more than transparent contributor confidence. citeturn32view0 | Use it as proof of category fit, then differentiate with **London data**, **confidence**, **night profiles**, and **planning/future risk**. |

### Novelty verdict

The honest verdict is:

**The category is proven. Your wedge can still be novel enough.**

That is usually a stronger hackathon position than pretending nobody has touched the space. You can say: *“Other products tell you whether an area is noisy. Noise tells you whether this specific London flat is likely to be noisy when you actually live there, why, and how certain we are.”* That is crisp, credible and defensible. citeturn15view5turn31view0turn31view2turn32view0

### MVP backlog

| feature | priority | effort 1–5 | demo-critical Y/N |
|---|---:|---:|---:|
| Postcode/address lookup via Postcodes.io | P0 | 1 | Y |
| DEFRA road/rail/airport baseline score | P0 | 3 | Y |
| Simple result card with overall Noise Score and band | P0 | 2 | Y |
| Contributor bar for road/rail/air/nightlife | P0 | 2 | Y |
| Time-of-day profile using DEFRA metrics plus venue/schedule heuristics | P1 | 3 | Y |
| OSM nightlife density within 300–500 m | P1 | 2 | Y |
| Optional floor input with confidence adjustment | P1 | 2 | Y |
| Nearby planning applications / new-build risk flags | P2 | 3 | N |
| TfL line and route context for Tube/Overground/DLR | P2 | 3 | N |
| AG Grid “evidence table” showing all detected contributors | P2 | 2 | N |
| LLM-generated natural-language explanation via OpenRouter | P2 | 2 | N |
| ElevenLabs voice readout | P3 | 2 | N |
| 3D cross-section mock-up | P3 | 3 | N |
| TRMNL ambient dashboard | P3 | 2 | N |

## Demo, design and engineering plan

### Recommended demo structure

The most persuasive live demo is not “watch me type and hope the APIs work”. It is a **controlled two-property comparison**.

Start with a property that appears desirable but is likely noisy for recognisable London reasons, such as being near an Overground corridor, A-road or nightlife cluster. Then switch to a contrast property that is similar in area price bracket or attractiveness but materially quieter. The reveal should be visual and immediate: same city, very different lived experience. That is what sells the idea. Existing property-noise tools and area-research products prove the value of this kind of comparison, but you can make the contrast sharper by showing contributor bars and time-of-day change, not just a static label. citeturn32view0turn31view0turn15view5

I would keep the live flow to four screens:

1. **Search screen** with postcode/address and optional floor.
2. **Map/result screen** with score, heat halo and main contributors.
3. **Time profile** showing day/evening/night difference.
4. **Evidence screen** with AG Grid rows for source layers, distances, counts and caveats.

If a live lookup fails, immediately flip to **precomputed sample properties** shipped in a JSON file. The judges do not care whether the exact HTTP call happened in real time. They care that the product feels coherent and real. Cloudflare Pages is well suited to this kind of fast static-plus-edge deployment. citeturn9view6turn33view3

### Suggested visualisations

The best visual package is a **map heat overlay** for immediate intuition, a **time-of-day line or bar chart** for rhythm, a **stacked contributor bar** for explanation, and a **stylised cross-section** to create memorability. The cross-section should not pretend to be a full simulation. Think of it as a diagram: road here, track there, building here, user floor highlighted, dominant source arrows shown. That is enough to make the product feel spatially rich without burning the day on 3D engineering.

### Suggested sponsor usage

The sponsor stack can genuinely help rather than feeling bolted on.

**Cloudflare Pages** should host the front end and any light serverless functions, because it is designed for instantly deployed full-stack applications on the Cloudflare network. citeturn9view6

**OpenRouter** should power the explanation layer, not the score. Its value is a unified API for many LLMs behind one endpoint, which is perfect for quickly testing a “summarise the evidence into one paragraph” feature. citeturn9view4turn6search5

**Arize Phoenix** should trace and evaluate the explanation layer. You can log a handful of traces and show that you checked whether explanations match the numeric source data, which is a very grown-up touch for a hackathon. citeturn9view5turn6search14

**Zed** is a sensible collaboration story if you are more than one person, because it supports real-time multiplayer editing. That is an authentic productivity angle rather than a gimmick. citeturn33view4

**AG Grid** is a very good fit for the “evidence table” or “source audit” screen, where you show each contributor row, weight, distance and confidence. It is fast, React-friendly and easy to stand up. citeturn33view3

**TRMNL** is best used only if the core app is already working. A great version would be a small ambient display showing “Best viewing time: 22:30”, “Night risk elevated”, or “Top quiet postcodes this week”. TRMNL’s plugin/documentation model is compatible with pulling a simple API endpoint into an ePaper display. citeturn9view7turn34search2

**ElevenLabs** is optional polish. A short spoken summary such as “This flat is transport-dominated, with elevated night risk from rail and nightlife within 250 metres” could land well in a demo, but only after the core product works. ElevenLabs’ TTS stack is production-grade and fast enough for that use. citeturn37search0turn37search1

### Small code snippets for a postcode-first MVP

```bash
curl "https://api.postcodes.io/postcodes/E83GT"
```

This is the fastest possible geocoding start for a London postcode-first flow. citeturn19search3turn19search4

```bash
curl -G "https://api.tfl.gov.uk/line/bakerloo/sequence/outbound"
```

This is useful for turning TfL lines into route geometry and stop sequences for explanation or a local proximity layer. citeturn12view1

```bash
curl --data '[out:json][timeout:25];
(
  node(around:400,51.5456,-0.0756)["amenity"="pub"];
  node(around:400,51.5456,-0.0756)["amenity"="bar"];
  node(around:400,51.5456,-0.0756)["amenity"="nightclub"];
  way(around:400,51.5456,-0.0756)["amenity"="pub"];
  way(around:400,51.5456,-0.0756)["amenity"="bar"];
  way(around:400,51.5456,-0.0756)["amenity"="nightclub"];
);
out center;' \
"https://overpass-api.de/api/interpreter"
```

This is a practical nightlife-density query using Overpass QL’s radius syntax. citeturn17search0turn17search12

```bash
curl "https://data.police.uk/api/crimes-street/all-crime?lat=51.5456&lng=-0.0756&date=2026-05"
```

This is not a direct noise input, but it is an easy contextual enrichment layer if you want a broader liveability card. citeturn16search3turn16search9

```bash
curl --location --request POST "https://planningdata.london.gov.uk/api-guest/applications/_search" \
  --header "X-API-AllowRequest: be2rmRnt&" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "query": {
      "bool": {
        "must": [
          { "term": { "lpa_name.raw": "Hackney" } }
        ]
      }
    },
    "_source": ["lpa_name","lpa_app_no","valid_date","application_type"]
  }'
```

This is the London-specific planning feed version if you want to surface possible nearby future disruption. citeturn12view0turn13view0

```js
async function scorePostcode(postcode) {
  const geo = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`).then(r => r.json());
  const { latitude, longitude } = geo.result;

  // Example placeholder: fetch your preprocessed London source tiles / JSON
  const res = await fetch(`/api/score?lat=${latitude}&lng=${longitude}&floor=6`);
  return res.json();
}
```

This is the right architecture shape for the hackathon: a very thin input layer, with scoring logic hidden behind one endpoint. The endpoint may read from precomputed files rather than live geospatial intersections during the demo. citeturn19search4turn9view6

### A sixty-second live demo script

“London viewings lie by omission. You visit in daylight, the estate agent talks the whole time, and you only discover the real soundscape after moving in. **Noise** fixes that. I type a postcode, add floor six, and instantly get a London property noise risk score. This place looks attractive, but the result shows high night risk driven by rail plus nightlife within 300 metres. The contributor bars show exactly where the risk comes from. The evening line spikes, and the confidence is medium because we only know the floor, not the façade direction. Now I compare that with a second property nearby. Similar area, much lower transport exposure, lower night activity, and the score drops sharply. Under the hood, we combine official DEFRA road, rail and airport-noise maps with London transport and local-place data. So this is not a vibes app. It is a decision tool to help Londoners avoid signing for the wrong home.” citeturn29view0turn14view1turn29view2turn12view1turn17search0

## Team shape, hackathon timeline and judging alignment

### Team size and roles

If you are **solo**, the viable version is: postcode lookup, deterministic score, contributor bars, one time-of-day chart, one great demo story. Do **not** attempt 3D simulation, National Rail ingestion or a perfectly interactive citywide map.

If you are **two people**, the ideal split is one person on **data/model/back end** and one on **front end/UX/demo narrative**. That is the strongest configuration.

If you are **three people**, use the third person for **polish and reliability**: AG Grid evidence view, OpenRouter explanation layer, ElevenLabs voice, precomputed demo data, and pitch preparation. Zed’s multiplayer collaboration features make the 2–3 person setup especially natural if you want to code in parallel in one project. citeturn33view4

### Hackathon-day timeline

```mermaid
timeline
    title Noise hackathon day plan
    09:00 : Arrive early
          : Confirm scope
          : Create demo property list
    10:00 : Lock MVP
          : Wireframe result page
          : Assign roles
    10:30 : Build input flow
          : Postcodes.io + base UI
    11:30 : Integrate DEFRA baseline
          : Road + rail + airport scoring
    13:00 : Lunch
          : Review what must demo
    14:00 : Add OSM nightlife
          : Add floor/confidence logic
    15:00 : Add explanation layer
          : Precompute fallback JSON
    16:00 : Freeze features
          : Polish charts and evidence table
    16:30 : Rehearse pitch
          : Test fallback path
    17:00 : Deliver final demo build
```

The crucial management rule is: **freeze the scope by 10:30** and **freeze features by 16:00**. After that, only polish, bug fixes and pitch rehearsal.

### Judging alignment

For **Idea Validation**, open your pitch with the problem evidence rather than the product. Cite health burden, complaint volume and the repeated “viewing did not reveal the real noise” user pattern. That directly answers the rubric’s “is the problem real?” question. citeturn7search0turn22view4turn22view5turn23search0turn23search9

For **Technical Approach**, the winning argument is that you are combining **official environmental-noise surfaces** with **London-specific dynamic source layers** and exposing uncertainty rather than hiding it. That sounds serious because it is serious. Use the phrase “official baseline, transparent heuristics, confidence scoring” somewhere in the pitch. citeturn29view0turn14view1turn29view2turn12view1

For **Project Readiness**, show a working search flow, a precomputed fallback path, and a fully demoable result page. Cloudflare Pages plus static JSON snapshots will help you look stable even if one live data source misbehaves. citeturn9view6

For **UX / Design**, keep the product opinionated. Do not drown the user in GIS jargon. Give them a headline score, a time profile, and a short explanation telling them what to verify before they commit. The benchmark products that feel strongest are the ones that make noise legible at a glance. citeturn32view0turn31view0turn15view5

## Open questions and limitations

Some things are still inherently uncertain, and it is better to state them cleanly.

The DEFRA datasets are strategically powerful, but they are **modelled annual exposures**, not minute-by-minute real-time sound levels. That means the MVP can confidently estimate **risk**, but not promise exact acoustic conditions on a specific Tuesday night. citeturn29view0turn14view1turn29view2

National Rail and wider heavy-rail timetable data are available through industry feeds, but compared with TfL they are less convenient for a one-day build and may require formal licence arrangements or more complex feed handling. citeturn15view3turn15view4

Floor matters, but exact unit orientation, glazing quality, courtyard shielding and neighbouring structures matter too. OSM’s building-level metadata can help when present, but you should treat missing façade information as a confidence penalty rather than pretend you know it. citeturn33view0turn33view1

Google Places is attractive for nightlife signals, but it is a commercial dependency with billing requirements. If you do not already have a key and billing set up, OSM is the safer default for the hackathon. citeturn15view1turn17search8turn17search11

My main assumptions in this report are that you are comfortable shipping a small React app, can preprocess some JSON/GeoJSON locally before the demo, and do not need a production-grade acoustics engine to satisfy the judges. Under those assumptions, **Noise is one of the better hackathon ideas you could bring**: constrained, city-specific, easy to explain, evidence-backed, and highly demoable.