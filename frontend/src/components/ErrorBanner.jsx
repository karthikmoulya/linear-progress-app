export default function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-[10px] bg-[#FDECEA] px-4 py-3 text-[13px] text-[#7F1D1D]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="flex-none">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <span className="flex-1">{message}</span>
      <button onClick={onRetry} className="h-9 cursor-pointer rounded-lg bg-[#7F1D1D] px-3 font-semibold text-white">
        Retry
      </button>
    </div>
  );
}
