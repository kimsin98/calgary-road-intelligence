export function MatchQuality({ row }: any) {
  const records = row.records.filter((e: any) => e.matchQuality);
  if (!records.length) return null;
  const review = records.filter(
    (e: any) => e.matchQuality.status !== "isolated proximity",
  );
  return (
    <div className="match-review">
      <h3>Road association review</h3>
      <p>
        {review.length} / {records.length} selected records have competing-road
        or boundary flags. Geometric proximity is a screening signal, not
        confirmed road identity.
      </p>
      {review.slice(0, 3).map((e: any) => (
        <details key={e.id}>
          <summary>
            {e.date} · {e.matchQuality.status} ·{" "}
            {e.matchQuality.distance ?? "—"} m from assigned road
          </summary>
          <p>Reported location: {e.reportedLocation}</p>
          <p>{e.matchQuality.reason}</p>
          <ul>
            {e.matchQuality.alternatives.map((a: any) => (
              <li key={a.id}>
                {a.name} · {a.id} · {a.distance} m
              </li>
            ))}
          </ul>
        </details>
      ))}
      {!review.length && (
        <p>
          No competitive match was flagged by these distance/direction rules.
          This does not certify the association.
        </p>
      )}
    </div>
  );
}
