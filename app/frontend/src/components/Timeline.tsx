import type { Step } from "../plain";

/** A short progress line: done steps filled, the current one highlighted, a stopped one in red. */
export function Timeline({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol className="timeline" aria-label={label}>
      {steps.map((s) => (
        <li key={s.label} className={s.state === "todo" ? undefined : s.state} aria-current={s.state === "current" ? "step" : undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}
