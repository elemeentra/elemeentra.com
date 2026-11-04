type Tone = "green" | "amber" | "red" | "gray" | "crimson";

// Every tone has an explicit dark variant so badges stay readable in dark mode.
const TONES: Record<Tone, string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300",
  crimson: "bg-crimson-light text-crimson",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
