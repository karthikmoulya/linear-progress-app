import { useEffect, useState } from "react";
import { useApi } from "./hooks/useApi";
import Header from "./components/Header";
import ErrorBanner from "./components/ErrorBanner";
import SignIn from "./components/SignIn";
import Connecting from "./components/Connecting";
import { Hero, KpiTiles } from "./components/Overview";
import TodayPlan from "./components/TodayPlan";
import ThisWeek from "./components/ThisWeek";
import { Roadmap, SubjectCards } from "./components/Tracks";
import { ComingUp, DailyLog } from "./components/DailyLog";
import MobileNav from "./components/MobileNav";

export default function App() {
  const [version, setVersion] = useState(0);
  const me = useApi("/api/me", version);
  const reload = () => setVersion((v) => v + 1);

  if (me.status === 401) return <SignIn onSignedIn={reload} />;
  if (me.loading && !me.data) return null;
  return <Dashboard user={me.data} version={version} reload={reload} />;
}

function Dashboard({ user, version, reload }) {
  const [refreshing, setRefreshing] = useState(false);

  const project = useApi("/api/project", version);
  const today = useApi("/api/today", version);
  const summary = useApi("/api/summary", version);
  const weeks = useApi("/api/weeks", version);
  const subjects = useApi("/api/subjects", version);
  const days = useApi("/api/days", version);
  const upcoming = useApi("/api/upcoming", version);
  const requests = [project, today, summary, weeks, subjects, days, upcoming];
  const error = requests.find((r) => r.error)?.error;

  // A session that expired mid-use: recheck /api/me, which then shows the sign-in screen.
  const signedOut = requests.some((r) => r.status === 401);
  useEffect(() => {
    if (signedOut) reload();
  }, [signedOut]);

  async function refresh() {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
    } catch {
      // The refetch below surfaces the error.
    } finally {
      setRefreshing(false);
      reload();
    }
  }

  async function selectProject(id) {
    await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    reload();
  }

  async function signOut() {
    await fetch("/auth/logout", { method: "POST" }).catch(() => {});
    reload();
  }

  // First sync after signing in: show progress instead of an empty dashboard.
  const firstLoad = !summary.data && !error;
  if (firstLoad) return <Connecting user={user} project={project.data} />;

  const currentWeek = weeks.data?.find((w) => w.is_current);

  return (
    <div className="min-h-screen bg-ground pb-24 md:pb-0">
      <Header
        user={user}
        project={project.data}
        summary={summary.data}
        refreshing={refreshing}
        onRefresh={refresh}
        onSelectProject={selectProject}
        onSignOut={signOut}
      />
      <main className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        {error && <ErrorBanner message={error} onRetry={reload} />}
        <Hero today={today.data} currentWeek={currentWeek} weekCount={weeks.data?.length ?? 0} project={project.data} />
        <KpiTiles summary={summary.data} today={today.data} project={project.data} upcoming={upcoming.data} />
        <section id="today" className="flex scroll-mt-4 flex-wrap items-stretch gap-6">
          <TodayPlan data={today.data} />
          <ThisWeek week={currentWeek} />
        </section>
        <SubjectCards subjects={subjects.data} weeks={weeks.data} summary={summary.data} today={today.data} />
        <Roadmap weeks={weeks.data} subjects={subjects.data} today={today.data} />
        <section className="flex flex-wrap items-stretch gap-6">
          <DailyLog log={days.data} />
          <ComingUp items={upcoming.data} today={today.data?.date} />
        </section>
      </main>
      <MobileNav />
    </div>
  );
}
