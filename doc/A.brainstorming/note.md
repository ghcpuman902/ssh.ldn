ssh.ldn

Working Notes, Narrative, and Product Direction

Hackathon preparation notes · July 2026

⸻

Project

ssh.ldn aims to help people understand the soundscape of a home before they move in.

The core hypothesis is simple:

People can estimate commute times, crime rates, school quality, and house prices, but they have almost no tools for estimating whether a place will actually sound comfortable to live in.

Noise is not merely an annoyance. It affects sleep, stress, concentration, mental health, social behaviour, and long-term wellbeing. Yet housing decisions are often made using incomplete or misleading proxies.

⸻

Why this matters

London is simultaneously:

* one of the world’s most diverse cities,
* one of Europe’s loudest urban environments,
* and one of the world’s most expensive rental markets.

Renters regularly discover important acoustic problems only after moving:

* train vibration,
* Underground rumble,
* aircraft noise,
* nightlife spillover,
* football crowds,
* emergency services,
* construction,
* schools,
* pub gardens,
* loading bays,
* waste collection,
* seasonal events.

These factors are difficult to discover because:

* they are distributed across many datasets,
* they operate at different timescales,
* they have different spatial resolutions,
* and many are only experienced subjectively.

The challenge is therefore not measuring sound itself.

The challenge is making invisible sound risks legible before someone signs a tenancy agreement.

⸻

Personal framing

The strongest narrative may not be:

“We built a noise prediction tool.”

Instead:

“Everyone remembers moving into a place and discovering something nobody warned them about.”

Examples:

* the train that starts at 5am,
* the pub garden below the window,
* the football crowd every Saturday,
* the aircraft path overhead,
* the neighbour’s construction project,
* the nightclub that only opens on Fridays.

People do not remember decibel numbers.

They remember broken sleep.

⸻

Accessibility insight

One unexpected insight emerged during planning:

The system should not only visualise sound.

It should also be able to describe sound.

If the underlying data layer is designed cleanly, an interface layer can be built on top using conversational voice systems such as ElevenLabs.

This creates two advantages:

Speed

Voice interaction can often be faster than visual exploration.

Example:

“How noisy is this address after 10pm?”

“Compare this flat to one in Greenwich.”

“What is the biggest source of noise here?”

⸻

Accessibility

This may be substantially more important for people with visual impairments.

People who rely primarily on hearing to understand and navigate the world experience sound differently:

* sound quality affects independence,
* sound pollution affects wellbeing,
* hearing environments become part of accessibility itself.

Therefore:

Accessibility here is not merely making a visual product usable.

Accessibility is making an acoustic environment understandable.

This is particularly relevant in London because of its large and diverse disabled population.

Potential supporting evidence:

* census data,
* disability prevalence statistics,
* visual impairment demographics,
* accessibility initiatives in London.

⸻

Key product insight

Most existing products answer:

“How loud is it?”

The more interesting question is:

“How likely am I to regret living here?”

This reframes the product from:

Environmental measurement

to

Human experience prediction

Possible dimensions:

Dimension	Examples
Constant noise	Roads, railways, HVAC
Intermittent noise	Aircraft, sirens
Temporal noise	Nightlife, football, events
Seasonal noise	Construction, festivals
Vibrational noise	Underground, freight
Subjective annoyance	Sleep disruption, unpredictability

⸻

Narrative hook ideas

Potential opening hooks:

Personal

“Have you ever moved somewhere and realised, one week later, why the previous tenant left?”

⸻

Data

“Londoners spend hundreds of thousands of pounds choosing where to live, yet most still discover noise problems only after moving.”

⸻

Temporal

The hackathon occurs during an unusually noisy weekend:

* US Independence celebrations,
* London Pride,
* major sporting events,
* pub gatherings,
* outdoor drinking areas.

This demonstrates that:

Urban noise is dynamic, contextual, and difficult to predict.

⸻

Important distinctions

The model should explicitly distinguish between:

Rail

* National Rail
* Freight
* Overground

Underground

* Deep tube
* Subsurface tube
* Vibration
* Rumble propagation

These behave acoustically very differently.

Similarly:

Road traffic

* continuous
* peak hour
* nighttime freight

Aviation

* frequency
* altitude
* flight corridor
* event clustering

⸻

Data philosophy

There are two categories of data:

Build-time data

Slow-changing datasets:

* rail infrastructure,
* Underground routes,
* airports,
* pubs,
* planning applications,
* sports venues,
* demographics,
* land use,
* terrain,
* historical complaints.

These should be preprocessed.

⸻

Execution-time data

User-specific calculations:

* address lookup,
* spatial joins,
* local weighting,
* temporal filtering,
* event adjustments,
* confidence estimation.

These should execute live.

⸻

Technical principle

The architecture should prioritise:

Data layer first.

Interface layer second.

This enables:

* web UI,
* mobile UI,
* voice UI,
* accessibility UI,
* API access,
* future agents.

The interface should be replaceable.

The knowledge graph should not.

⸻

Demo philosophy

Avoid:

* PowerPoint presentation,
* static screenshots,
* switching between slides and product.

Instead:

The product itself should be the presentation.

Possible layout:

┌──────────────────────┐
│ Search address       │
├──────────────────────┤
│ Interactive map      │
├──────────────────────┤
│ Noise score          │
│ Confidence           │
│ Timeline             │
├──────────────────────┤
│ Source breakdown     │
├──────────────────────┤
│ Did you know?        │
│ rotating fact card   │
└──────────────────────┘

⸻

“Did you know?” panel

Examples:

* “Aircraft noise exposure is associated with poorer sleep quality.”
* “Noise complaints increase significantly around major sporting events.”
* “Underground vibration can travel through building structures.”
* “Many renters discover noise issues only after signing leases.”
* “Noise sensitivity varies substantially between individuals.”

Purpose:

* educate,
* create emotional resonance,
* reduce presenter workload,
* reinforce societal importance.

⸻

Demo checklist

Before presenting:

* GitHub repository visible
* Live demo URL visible
* QR code visible
* LinkedIn QR visible
* Team information visible
* Data sources visible
* Architecture visible
* Accessibility story visible
* Personal motivation visible

⸻

Hackathon strategy

Today

Goal:

Validate data.

Questions:

* Can we access it?
* Can we geocode it?
* Can we spatially join it?
* Can we normalise resolutions?
* Can we compute scores quickly?

⸻

Tomorrow

Goal:

Build experience.

Priorities:

1. live search
2. map
3. scoring
4. explanation
5. voice interaction
6. storytelling

⸻

Core message

The project is not about measuring sound.

The project is about answering a much more human question:

“Will I be happy living here?”