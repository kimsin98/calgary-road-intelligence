import { useState } from "react";
export function LocationPicker({ rows, selected, onSelect }: any) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const current = rows.find((r: any) => r.id === selected);
  const matches = rows
    .filter((r: any) =>
      `${r.name} ${r.id}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 30);
  return (
    <div className="location-picker">
      <div className="picker-heading">
        <div>
          <span>REVIEW LOCATION</span>
          <strong>{current?.name ?? "Choose a location"}</strong>
          <small>
            {current
              ? `${current.id} · ${current.count} events · Rank #${current.position}`
              : "No locations match this view"}
          </small>
        </div>
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Close search" : "Change location"}
        </button>
      </div>
      {open && (
        <div className="picker-search">
          <input
            autoFocus
            aria-label="Search review locations"
            placeholder="Search road name or segment ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="picker-results">
            {matches.map((r: any) => (
              <button
                key={r.id}
                className={selected === r.id ? "selected" : ""}
                onClick={() => {
                  onSelect(r.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="picker-rank">#{r.position}</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.id} · {r.count} events across {r.days} dates
                  </small>
                </div>
                <span>{selected === r.id ? "✓" : "→"}</span>
              </button>
            ))}
            {matches.length === 0 && (
              <p>No matching locations. Try a road name or segment number.</p>
            )}
          </div>
          <p className="hint">
            Showing up to 30 matches, ordered by current priority.
          </p>
        </div>
      )}
    </div>
  );
}
