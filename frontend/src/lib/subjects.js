// One colour per subject, as in the design canvas.
export const SUBJECTS = {
  DSA: { short: "DSA", code: "DSA", color: "#2459D6", tint: "#E8EEFC" },
  "Agentic AI": { short: "Agentic AI", code: "AI", color: "#C2410C", tint: "#FBEDE4" },
  "System Design": { short: "System Design", code: "SD", color: "#0F766E", tint: "#E2F2EF" },
  "Portfolio Project": { short: "Project", code: "PRJ", color: "#6D28D9", tint: "#F0EAFD" },
};

const FALLBACK = { short: "Other", code: "•", color: "#535968", tint: "#ECEEF2" };

export function subjectStyle(name) {
  return SUBJECTS[name] ?? { ...FALLBACK, short: name };
}
