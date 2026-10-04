# Pitch and Demo Guide

Source: [Industry Hackathon slides](https://canva.link/f4u4rlrgfjq2fky), Pitch section, slides 17–24 and 28–36. Slide 17 specifies introduction **5–10 seconds**, problem **1 minute**, software demo **1–2 minutes**, and wrap-up **1–2 minutes**. This guide targets **4 minutes 40 seconds**; confirm the final event time limit with organizers.

## Speech map

**Main statement:** Calgary Road Intelligence helps road analysts turn traffic reports into an evidence-backed inspection shortlist, then look ahead to the next month.

| Section | Three key ideas |
|---|---|
| Problem | Limited review capacity; reports need location/context interpretation; recent frequency alone is an incomplete planning signal |
| Solution and demo | Review historical evidence; estimate monthly activity; record and export an analyst decision |
| Closing and next steps | Measured report-coverage comparison; bounded pilot use; verified data and operational feedback |

Memorize these ideas and transitions rather than every sentence. Lead with the problem and solution; keep algorithm details for questions.

## 1. Introduction — 0:00–0:10

**Say:** “We’re [team name]. Calgary Road Intelligence helps road analysts decide which locations to review first—and which may need attention next month.”

Show the project title and team. Replace the team-name placeholder before rehearsal.

## 2. Problem statement — 0:10–1:10

Cover the slide 22 checklist explicitly:

- **Customer:** municipal road-operations and transportation analysts. This is the proposed customer, not an existing customer relationship.
- **Context:** analysts have limited review capacity and many traffic reports spread over time and locations. Our reactive snapshot contains 27,805 reports; the annual research uses a longer archive. Reports include disruptions, not only confirmed crashes.
- **Root cause:** a report list does not by itself establish a consistent site, explain nearby infrastructure, or turn evidence into a documented inspection decision.
- **Alternative and shortcoming:** recent-frequency ranking is a useful transparent baseline, but depends on recent reports and cannot establish treatment suitability. Do not claim commercial tools lack features we have not compared.
- **Quantifiable impact:** with a fixed 20-location budget, our six exploratory monthly windows captured an average **36.8 subsequent reports using EB versus 33.0 using recent frequency**, about **12% more**. This is a measured coverage proxy, not avoided crashes, money saved or analyst time saved. No verified business-impact estimate is available yet.

**Transition:** “We connect three steps: understand the history, look ahead, and document what an analyst would actually review.”

## 3. Software demo and solution — 1:10–3:00

This 1 minute 50 second demo follows slide 24: value proposition, comparison with an alternative, measurable win.

| Time | Action | Message |
|---|---|---|
| 1:10–1:35 | Historical priorities: use a preselected scope, open one location and its reports. | “The shortlist is backed by inspectable source evidence.” |
| 1:35–2:10 | Forward outlook → next30 → **2026-06-30** → generate → reveal outcomes. | “At the same 20-location budget, EB captures **46** later reports versus **36** for the recent-rate baseline in this replay. EB blends own history with similar-site characteristics.” |
| 2:10–2:40 | Future forecast → generate → select **DEERFOOT TR SE & MEMORIAL DR SE** (rank 15 in this snapshot). Show mapped facilities and source evidence. | “A forecast is a review candidate. Facilities and treatment studies give context; they do not prove a treatment is appropriate.” |
| 2:40–3:00 | Check one inspection item, select Worth inspecting, add a short note, save, filter Worth inspecting, export inspection shortlist. | “The output is a documented analyst review plan—not just a map.” |

Keep map preview loaded before presenting if needed. Show only one source report and one checklist item. Do not spend the main demo touring seven-day/annual modes, formulas or all controls.

## 4. Wrap-up — 3:00–4:40

**3:00–3:30 — Measured value and honest boundary.** Restate the fixed-budget six-window average comparison. Mention the counterexample: **2026-08-31 EB captures 35, baseline 43**. Do not navigate to another replay unless time remains. These windows are repeatedly inspected, exploratory evaluations; EB does not win uniformly.

**3:30–4:10 — Industry adoption and next steps.** Propose a small analyst pilot using the exported Top20. Measure review time, relevance of candidates and whether recommended investigation is useful. Verify road/intersection and facility associations; obtain confirmed crash/severity and better exposure data; freeze the protocol for prospective validation. A paid municipal analytics/maintenance integration is a commercialization hypothesis, not validated demand or a priced offering.

**4:10–4:40 — Impact closer and ask.** “We turn historical reports into a reviewable shortlist, add a monthly outlook, and preserve the analyst’s decision. Our next step is a pilot with road analysts to test whether this improves real inspection planning. We’re looking for domain feedback and a pilot partner.”

Explicit limits: forecasts estimate report activity, not crash probabilities; CMFs describe external crash studies, not predicted reductions in reports. Review storage is local to the device and exports are the sharing mechanism. No verified safety or financial benefit is claimed.

## Rehearsal and judging alignment

Slide 10 rubric: autonomous reasoning/data-driven decisions 30%, industrial relevance 20%, execution/architecture 20%, commercialization 15%, presentation/demo 15%.

- Demonstrate an automated, explainable ranking and baseline comparison. The app is statistical decision support with human review; do not imply autonomous field action or an LLM agent.
- Explain the analyst workflow and pilot hypothesis. Keep a backup architecture answer: official data → offline EB fitting/gzip snapshots → dashboard evidence/review → export; seven-day Poisson runs separately in a browser worker.
- Rehearse the full 4:40 handoff and export. Freeze the dataset and preselect the example; use a separate browser profile with no old demo reviews. Keep the source and export available if map tiles fail.
- The first optional cut is the live map, then the CMF detail. Preserve the problem, one measured comparison, analyst decision and closing ask.

## Backup evidence and Q&A

`reports/demo-location-review.json` records the latest future Top10. All 30 source examples match dashboard source IDs and fall within fitted history. This checks shared records/date bounds, not correct road assignment. Many Top20 sites are freeway interchanges: proximity to derived nodes does not establish ramp geometry or control of every approach. No field or imagery verification was performed; zero mapped signals does not prove absence.

For model questions: next30 uses pure EB with fixed three-year history; next7 retains ridge Poisson; annual EB uses a backtest-selected five-year history. Monthly and annual full-inventory units differ from reactive dashboard locations. Current/undated facilities and unknown removal dates limit historical validity.

For treatment questions: present CMF suggestions as expert-review research candidates. Verify the linked study population, exact treatment and local engineering applicability. Checked review items record reviewer feedback, not certified findings.
