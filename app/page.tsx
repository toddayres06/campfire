import Navigation from "@/components/Navigation";
import JourneyMap from "@/components/JourneyMap";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <Navigation />

      <section className="px-5 pb-12 pt-8">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-sm font-medium tracking-wide text-stone-500">
            OUR ADVENTURE
          </p>

          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
            The road is the story.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
            A place to remember where we&apos;ve been, what we&apos;ve seen,
            and the moments worth keeping.
          </p>
        </div>
      </section>

      <section className="px-5 pb-8">
        <div className="mx-auto max-w-5xl">
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl shadow-xl">
            <JourneyMap />
          </div>
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <p className="text-sm font-medium tracking-wide text-stone-500 uppercase">
              Currently
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              📍 Galveston, Texas
            </h2>

            <p className="mt-2 text-stone-600">
              Day 17 on the road · 1,284 miles traveled
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-sm font-medium tracking-wide text-stone-500 uppercase">
            Recent memory
          </p>

          <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
            <div className="aspect-[16/10] bg-stone-200" />

            <div className="p-6">
              <p className="text-sm text-stone-500">August 7, 2026</p>

              <h2 className="mt-2 text-2xl font-semibold">
                We finally made it.
              </h2>

              <p className="mt-3 leading-7 text-stone-600">
                After another long day on the road, we found a place to watch
                the sunset and decided this was exactly why we started.
              </p>

              <button
                type="button"
                className="mt-6 font-medium text-stone-900 underline underline-offset-4"
              >
                Read memory →
              </button>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}