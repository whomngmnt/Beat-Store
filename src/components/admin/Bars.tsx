// The dashboard charts, drawn with plain CSS (no chart library). Each chart
// is one series, so there's one color (the theme's primary) and no legend:
// the heading names it. Values are always in text, never only in the bar.

// Columns, one per day. Hovering or focusing a column shows its value. The
// whole column is the hover target, not just the bar, so short bars are
// easy to hit.
export function DayBars({
  label,
  days,
  format,
}: {
  label: string;
  days: { day: string; value: number }[];
  format: (value: number) => string;
}) {
  const max = Math.max(...days.map((day) => day.value), 1);

  return (
    <figure className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`${label}, one bar per day. The table below has the numbers.`}
        className="flex h-40 items-end gap-0.5 border-b"
      >
        {days.map((day) => (
          <div
            key={day.day}
            tabIndex={0}
            className="group relative flex h-full flex-1 items-end outline-none"
          >
            <div
              className="w-full rounded-t-[4px] bg-primary group-hover:opacity-80 group-focus-visible:opacity-80"
              // Even a 0 day gets a hairline, so the baseline reads as days.
              style={{ height: `${Math.max((day.value / max) * 100, 0.5)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm group-hover:block group-focus-visible:block">
              {shortDay(day.day)}: {format(day.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{shortDay(days[0].day)}</span>
        <span>{shortDay(days[days.length - 1].day)}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Show as a table
        </summary>
        <table className="mt-2 w-full max-w-xs">
          <tbody className="divide-y">
            {days
              .filter((day) => day.value > 0)
              .map((day) => (
                <tr key={day.day}>
                  <td className="py-1">{shortDay(day.day)}</td>
                  <td className="py-1 text-right">{format(day.value)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {days.every((day) => day.value === 0) && (
          <p className="mt-2 text-muted-foreground">No sales in this time.</p>
        )}
      </details>
    </figure>
  );
}

// "2026-11-17" → "Nov 17", read as UTC like the rest of the admin.
function shortDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Horizontal bars for a top-5 list. The name and value are text beside the
// bar, so the list reads the same without the bars.
export function RankBars({
  rows,
  empty,
}: {
  rows: { id: string; label: string; value: number; text: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 text-muted-foreground">{row.text}</span>
          </div>
          <div className="h-2 rounded-r-[4px] bg-muted">
            <div
              className="h-full rounded-r-[4px] bg-primary"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
