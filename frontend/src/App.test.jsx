import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import TodayPlan, { nowLabel, timeline } from "./components/TodayPlan";
import ErrorBanner from "./components/ErrorBanner";
import SignIn from "./components/SignIn";
import { parseBlockTime } from "./lib/time";

const plan = {
  day: 1,
  date: "2026-11-02",
  title: "Day 1 · Mon 2 Nov",
  url: "https://linear.app/x/issue/KAR-131/day-1",
  done: false,
  raw_description: null,
  blocks: [
    { time: "12:30–2:00", subject: "DSA", topic: "Arrays & Hashing", items: [{ text: "Contains Duplicate", done: true }] },
    { time: "3:00–4:15", subject: "Agentic AI", topic: "LLM fundamentals", items: [{ text: "Learn: tokens", done: false }] },
  ],
};
const day = (extra) => ({ date: "2026-11-02", is_weekend: false, today: plan, catch_up: [], ...extra });

afterEach(() => vi.unstubAllGlobals());

describe("block times", () => {
  it("reads afternoon blocks as PM", () => {
    expect(parseBlockTime("12:30–2:00")).toEqual({ start: 750, end: 840 });
    expect(parseBlockTime("4:15–5:30")).toEqual({ start: 975, end: 1050 });
  });

  it("puts a break between blocks and labels now / next", () => {
    const rows = timeline(plan.blocks);
    expect(rows.map((r) => r.kind)).toEqual(["block", "break", "block"]);
    expect(nowLabel(rows, 14 * 60 + 43)).toEqual({ title: "Break", detail: "next: Agentic AI at 3:00 PM (17 min)" });
    expect(nowLabel(rows, 13 * 60).title).toBe("DSA");
    expect(nowLabel(rows, 18 * 60).title).toBe("Study blocks done");
  });
});

describe("TodayPlan", () => {
  it("renders the checklist read-only with done state", () => {
    render(<TodayPlan data={day()} />);
    expect(screen.getByText("Today's plan")).toBeInTheDocument();
    expect(screen.getByLabelText("Contains Duplicate")).toBeChecked();
    expect(screen.getByLabelText("Learn: tokens")).not.toBeChecked();
    expect(screen.getByText("KAR-131")).toBeInTheDocument();
  });

  it("shows a rest day when there is no issue and nothing to catch up on", () => {
    render(<TodayPlan data={day({ date: "2026-11-08", is_weekend: true, today: null })} />);
    expect(screen.getByText("Rest day")).toBeInTheDocument();
  });

  it("lists missed days on a weekend", () => {
    render(<TodayPlan data={day({ date: "2026-11-07", is_weekend: true, today: null, catch_up: [plan] })} />);
    expect(screen.getByText("Weekend catch-up")).toBeInTheDocument();
    expect(screen.getByText("1 items left")).toBeInTheDocument();
  });

  it("falls back to the raw description when blocks can't be parsed", () => {
    render(<TodayPlan data={day({ today: { ...plan, blocks: [], raw_description: "Free study day" } })} />);
    expect(screen.getByText("Free study day")).toBeInTheDocument();
  });
});

describe("error state", () => {
  it("Retry calls back", () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Linear: bad key" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("App shows the backend error instead of a blank page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the backend");
  });
});

describe("sign in", () => {
  it("shows Sign in with Linear when /api/me returns 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "Sign in with Linear" }) }));
    render(<App />);
    expect(await screen.findByText("Continue with Linear")).toHaveAttribute("href", "/auth/login");
  });

  it("signs in with a personal API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);
    const onSignedIn = vi.fn();
    render(<SignIn onSignedIn={onSignedIn} />);
    fireEvent.click(screen.getByText("Use a personal API key instead"));
    fireEvent.change(screen.getByLabelText("Personal API key"), { target: { value: "lin_api_abc" } });
    fireEvent.click(screen.getByText("Connect with key"));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/auth/key", expect.objectContaining({ method: "POST", body: JSON.stringify({ api_key: "lin_api_abc" }) }));
  });

  it("shows the reason when Linear rejects the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "Linear rejected that key" }) }));
    render(<SignIn onSignedIn={vi.fn()} />);
    fireEvent.click(screen.getByText("Use a personal API key instead"));
    fireEvent.change(screen.getByLabelText("Personal API key"), { target: { value: "lin_api_bad" } });
    fireEvent.click(screen.getByText("Connect with key"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Linear rejected that key");
  });
});
