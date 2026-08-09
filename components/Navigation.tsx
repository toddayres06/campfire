export default function Navigation() {
  return (
    <header className="flex items-center justify-between px-5 py-5">
      <div>
        <p className="text-sm font-semibold tracking-[0.2em] text-stone-500 uppercase">
          Campfire
        </p>
      </div>

      <button
        type="button"
        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm"
      >
        Menu
      </button>
    </header>
  );
}