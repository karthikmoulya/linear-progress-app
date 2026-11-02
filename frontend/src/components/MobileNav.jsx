const ICONS = {
  today: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  week: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  roadmap: <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />,
};

// Bottom tabs on phones, as in the mobile artboard; they jump to sections of the one page.
export default function MobileNav() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 grid h-[76px] grid-cols-3 border-t border-line bg-white pb-3 md:hidden">
      {[
        ["#today", "Today", "today"],
        ["#week", "Week", "week"],
        ["#roadmap", "Roadmap", "roadmap"],
      ].map(([href, label, icon]) => (
        <a key={href} href={href} className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-ink no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[icon]}
          </svg>
          {label}
        </a>
      ))}
    </nav>
  );
}
