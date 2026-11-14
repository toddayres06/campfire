"use client";

/* Photos are resized browser-local data URLs; a server image optimizer cannot read them. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import JourneyMap from "./JourneyMap";
import {
  initialTrip,
  readTrip,
  writeTrip,
  validateTrip,
  photoData,
  states,
  type TripData,
  type Memory,
  type Shift,
} from "@/lib/trip-store";
import type { Weather } from "@/lib/weather";
import type { Destination, Coordinate } from "@/lib/journeyData";

type Tab = "Journey" | "Companion" | "Journal" | "States" | "Road work";
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
};
const tabs: { name: Tab; icon: string }[] = [
  { name: "Journey", icon: "↗" },
  { name: "Companion", icon: "✦" },
  { name: "Journal", icon: "▤" },
  { name: "States", icon: "◈" },
  { name: "Road work", icon: "☷" },
];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const destinationsOf = (d: TripData) => [
  ...new Map(
    d.journey.legs.flatMap((l) => l.destinations).map((p) => [p.id, p]),
  ).values(),
];

export default function Campfire() {
  const [data, setData] = useState<TripData>(initialTrip);
  const dataRef = useRef(data);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("Journey");
  const [status, setStatus] = useState("Opening your trip…");
  const [notice, setNotice] = useState("");
  const [focus, setFocus] = useState<string>();
  const [modal, setModal] = useState<
    "memory" | "stop" | "settings" | "shift" | null
  >(null);
  const [editMemory, setEditMemory] = useState<Memory>();
  const [editStop, setEditStop] = useState<Destination>();
  const [weather, setWeather] = useState<Weather>();
  const [weatherStatus, setWeatherStatus] = useState("");
  const [weatherKey, setWeatherKey] = useState(0);
  const [ai, setAi] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [search, setSearch] = useState("");
  const queue = useRef(Promise.resolve());
  const importRef = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const destinations = destinationsOf(data);
  const current =
    destinations.find((p) => p.id === data.currentId) ?? destinations[0];
  const selected = destinations.find((p) => p.id === focus) ?? current;
  const next =
    destinations[destinations.findIndex((p) => p.id === current?.id) + 1];

  useEffect(() => {
    let active = true;
    readTrip()
      .then((d) => {
        if (active) {
          dataRef.current = d;
          setData(d);
          setLoaded(true);
          setStatus("Saved on this device");
        }
      })
      .catch((e) => {
        if (active) {
          setStatus("Storage unavailable");
          setNotice(e.message);
        }
      });
    fetch("/api/companion")
      .then((r) => r.json())
      .then((d) => {
        if (active) setAi(d.ai);
      })
      .catch(() => {});
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/weather?lng=${selected.coordinates[0]}&lat=${selected.coordinates[1]}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const w = await r.json();
        if (!r.ok) throw new Error(w.error);
        return w;
      })
      .then((w) => {
        setWeather(w);
        setWeatherStatus("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setWeather(undefined);
          setWeatherStatus(e.message);
        }
      });
    return () => controller.abort();
  }, [selected.coordinates, weatherKey]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, thinking]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (modal && dialog && !dialog.open) dialog.showModal();
    if (!modal && dialog?.open) dialog.close();
  }, [modal]);

  function update(fn: (d: TripData) => TripData) {
    if (!loaded) {
      setNotice(
        "Local storage is unavailable. Enable browser storage before editing.",
      );
      return;
    }
    const nextData = fn(dataRef.current);
    dataRef.current = nextData;
    setData(nextData);
    setStatus("Saving…");
    queue.current = queue.current
      .then(() => writeTrip(nextData))
      .then(() => setStatus("Saved on this device"))
      .catch((e) => {
        setStatus("Not saved");
        setNotice(e.message);
      });
  }
  function explore(id: string) {
    setFocus(id);
    setWeather(undefined);
    setWeatherStatus("");
  }
  function openMemory(memory?: Memory) {
    setEditMemory(memory);
    setModal("memory");
  }
  function exportTrip() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(dataRef.current, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `campfire-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importTrip(file?: File) {
    if (!file) return;
    try {
      if (file.size > 50000000) throw new Error("Choose a backup under 50 MB.");
      const imported = validateTrip(JSON.parse(await file.text()));
      if (
        confirm(
          "Replace this device’s trip with this backup? Export your current trip first if you want to keep it.",
        )
      ) {
        await queue.current;
        await writeTrip(imported);
        dataRef.current = imported;
        setData(imported);
        setLoaded(true);
        setStatus('Saved on this device');
        setFocus(undefined);
        setNotice("Backup restored.");
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not import backup.");
    }
    if (importRef.current) importRef.current.value = "";
  }
  async function ask(text = question) {
    if (!text.trim() || thinking) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setQuestion("");
    setThinking(true);
    try {
      const response = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          context: {
            place: `${current.name}, ${current.state}`,
            coordinates: current.coordinates,
            nextStop: next?.name,
            preferences: data.preferences,
            route: destinations.map((d) => d.name),
            collected: data.collected,
            recentMemories: data.memories
              .slice(0, 5)
              .map((m) => ({ title: m.title, place: m.place, note: m.note })),
            shifts: data.shifts.slice(0, 20),
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: result.answer, sources: result.sources },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            e instanceof Error
              ? e.message
              : "Connection unavailable. Try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setNotice("Location is unavailable in this browser.");
      return;
    }
    setNotice("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: Coordinate = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        const id = crypto.randomUUID();
        const end = destinations.at(-1)!;
        const place: Destination = {
          id,
          name: "GPS stop",
          state: "",
          coordinates,
          date: today(),
          description: "Saved from your location.",
        };
        update((d) => ({
          ...d,
          currentId: id,
          journey: {
            ...d.journey,
            legs: [
              ...d.journey.legs,
              {
                id: `leg-${id}`,
                title: `${end.name} → GPS stop`,
                destinations: [end, place],
                moments: [],
                route: {
                  type: "LineString",
                  coordinates: [end.coordinates, coordinates],
                },
              },
            ],
          },
        }));
        explore(id);
        setNotice(
          "GPS stop saved. Location is checked only when you request it.",
        );
      },
      () =>
        setNotice(
          "Could not get your location. Allow location access or add a stop manually.",
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  const mapsLink = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} near ${selected.name}, ${selected.state || selected.coordinates.join(",")}`)}`;
  const shiftCities = [...new Set(data.shifts.map((s) => s.city))]
    .map((city) => {
      const shifts = data.shifts.filter((s) => s.city === city);
      const net = shifts.reduce((n, s) => n + s.earned - s.fuel, 0);
      const hours = shifts.reduce((n, s) => n + s.hours, 0);
      return { city, net, hours, count: shifts.length };
    })
    .sort((a, b) => b.net / b.hours - a.net / a.hours);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Journey");
          }}
        >
          <span className="brand-mark">♨</span>
          <span>
            campfire
            <span className="brand-sub">A LITTLE FURTHER, TOGETHER.</span>
          </span>
        </a>
        <div className="sidebar-caption">YOUR ROAD COMPANION</div>
        <nav aria-label="Main navigation">
          {tabs.map((t) => (
            <button
              key={t.name}
              onClick={() => {
                setTab(t.name);
                setSearch("");
              }}
              className={tab === t.name ? "nav-item active" : "nav-item"}
              aria-current={tab === t.name ? "page" : undefined}
            >
              <span>{t.icon}</span>
              {t.name}
              {t.name === "Companion" && <span className="new-pill">ASK</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trip-mini">
            <span className="live-dot" />
            <div>
              <b>Our open road</b>
              <small>
                {destinations.length} stops · {data.collected.length} states
                collected
              </small>
            </div>
          </div>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <span>⚙</span>Settings & backup
          </button>
          <small className="storage-status" role="status">
            {status}
          </small>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>
            OUR OPEN ROAD <span className="slash">/</span> <b>{tab}</b>
          </span>
          <div className="top-actions">
            <span className="local-badge">
              <span className="live-dot" /> Personal trip
            </span>
            <button
              className="avatar"
              onClick={() => setModal("settings")}
              aria-label="Open settings"
            >
              US
            </button>
          </div>
        </header>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {tab === "Journey"
                  ? "LESS SCROLLING. MORE WANDERING."
                  : tab === "Journal"
                    ? "THE GOOD STUFF, KEPT CLOSE."
                    : tab === "States"
                      ? "FIFTY STATES. A THOUSAND STORIES."
                      : tab === "Road work"
                        ? "MAKE ROOM FOR THE NEXT MILE."
                        : "A LITTLE HELP ALONG THE WAY."}
              </p>
              <h1>
                {tab === "Journey"
                  ? "The road is the story."
                  : tab === "Journal"
                    ? "Moments worth keeping."
                    : tab === "States"
                      ? "Collect the country."
                      : tab === "Road work"
                        ? "Work a little. Wander more."
                        : "Hey, where to next?"}
              </h1>
              <p className="subtitle">
                {tab === "Journey"
                  ? "Your places, your people, and everything in between."
                  : tab === "Journal"
                    ? "Photos, small discoveries, and the days you’ll talk about later."
                    : tab === "States"
                      ? "Welcome signs, favorite places, and a memory from every state."
                      : tab === "Road work"
                        ? "Find your rhythm with a simple record of what each city brings."
                        : `Your travel companion, with ${current.name} and the road ahead in mind.`}
              </p>
            </div>
            <button
              className="primary"
              onClick={() =>
                tab === "Road work" ? setModal("shift") : openMemory()
              }
            >
              <span>＋</span>
              {tab === "Road work" ? "Log a shift" : "Add a memory"}
            </button>
          </div>

          {tab === "Journey" && (
            <>
              <div className="journey-layout">
                <section className="map-card" aria-label="Journey map">
                  <JourneyMap
                    key={data.journey.legs.map((l) => l.id).join("|")}
                    trip={data.journey}
                    focusId={focus}
                    onDestination={explore}
                  />
                </section>
                <aside className="journey-side">
                  <div className="current-card">
                    <span className="eyebrow">
                      <span className="live-dot" />{" "}
                      {focus ? "EXPLORING" : "CURRENT STOP"}
                    </span>
                    <h2>
                      {selected.name}
                      <span>{selected.state || "Your saved location"}</span>
                    </h2>
                    <p>
                      {selected.id === current.id
                        ? "This is where your story is right now."
                        : "A little further down the road."}
                    </p>
                    <div className="current-actions">
                      {selected.id !== current.id ? (
                        <button
                          onClick={() =>
                            update((d) => ({ ...d, currentId: selected.id }))
                          }
                        >
                          Make current stop ↗
                        </button>
                      ) : (
                        <button onClick={locate}>⌖ Use my location</button>
                      )}
                      <button onClick={() => openMemory()}>＋ Memory</button>
                    </div>
                    <div className="stop-tools">
                      <button
                        onClick={() => {
                          setEditStop(selected);
                          setModal("stop");
                        }}
                      >
                        Edit stop
                      </button>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selected.coordinates[1]},${selected.coordinates[0]}`}
                      >
                        Directions ↗
                      </a>
                    </div>
                  </div>
                  <WeatherCard
                    weather={weather}
                    status={weatherStatus}
                    onRefresh={() => {
                      setWeather(undefined);
                      setWeatherStatus("");
                      setWeatherKey((k) => k + 1);
                    }}
                  />
                  <div className="companion-teaser">
                    <span className="companion-star">✦</span>
                    <h3>A good co-pilot changes everything.</h3>
                    <p>
                      Weather, worthwhile detours, or just figuring out what
                      comes next.
                    </p>
                    <button onClick={() => setTab("Companion")}>
                      Ask Campfire <span>↗</span>
                    </button>
                  </div>
                </aside>
              </div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">ONE STOP AT A TIME</p>
                  <h2>
                    Your itinerary{" "}
                    <span className="count">{destinations.length}</span>
                  </h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditStop(undefined);
                    setModal("stop");
                  }}
                >
                  ＋ Add a stop
                </button>
              </div>
              <div className="stop-strip">
                {destinations.map((p, i) => (
                  <button
                    key={p.id}
                    className={`stop-card ${selected.id === p.id ? "selected" : ""}`}
                    onClick={() => explore(p.id)}
                  >
                    <span className="stop-number">
                      {String(i + 1).padStart(2, "0")}
                      {p.id === current.id && (
                        <span className="stop-now">YOU ARE HERE</span>
                      )}
                    </span>
                    <b>{p.name}</b>
                    <span>{p.state || "GPS stop"}</span>
                    <small>
                      {p.id === current.id ? "Current stop" : "Planned stop"}{" "}
                      <span>↗</span>
                    </small>
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h2>Around {selected.name}</h2>
              </div>
              <div className="quick-links">
                {[
                  {
                    icon: "⛽",
                    title: "Find gas",
                    query: "gas stations",
                    note: "Compare nearby stations",
                  },
                  {
                    icon: "☕",
                    title: "A good little stop",
                    query: "affordable cafes",
                    note: "Coffee & something local",
                  },
                  {
                    icon: "↟",
                    title: "Get outside",
                    query: "parks and scenic viewpoints",
                    note: "Make time for a detour",
                  },
                ].map((item) => (
                  <a
                    key={item.title}
                    href={mapsLink(item.query)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{item.icon}</span>
                    <div>
                      <b>{item.title}</b>
                      <small>{item.note}</small>
                    </div>
                    <span>↗</span>
                  </a>
                ))}
              </div>
              <p className="footnote">
                Nearby searches open Google Maps. Station prices, deals, and
                opening hours need verification.
              </p>
            </>
          )}

          {tab === "Companion" && (
            <div className="companion-layout">
              <section className="chat-panel">
                <div className="chat-header">
                  <span className="companion-star">✦</span>
                  <div>
                    <b>Campfire</b>
                    <small>
                      {ai
                        ? "AI companion · web research enabled"
                        : "Trip tools · AI not configured"}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setMessages([])}
                    disabled={thinking}
                  >
                    Clear chat
                  </button>
                </div>
                <div className="chat-messages" aria-live="polite">
                  {!messages.length && (
                    <div className="chat-welcome">
                      <span>✦</span>
                      <h2>Let’s make a day of it.</h2>
                      <p>
                        Tell me what you’re in the mood for. I’ll keep your trip
                        and your budget in mind.
                      </p>
                      <div className="prompts">
                        {[
                          "What’s the weather at our current stop?",
                          "Find a scenic stop along our route",
                          "Help us compare cities for gig work",
                          "Find affordable food near us",
                        ].map((p) => (
                          <button onClick={() => ask(p)} key={p}>
                            {p} ↗
                          </button>
                        ))}
                      </div>
                      {!ai && (
                        <p className="tools-note">
                          Weather and trip tools work now. Connect an API key
                          and model in your server environment for full AI
                          conversation.
                        </p>
                      )}
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`chat-message ${m.role}`}>
                      <small>{m.role === "user" ? "YOU" : "✦ CAMPFIRE"}</small>
                      <div>{m.content}</div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="sources">
                          {[
                            ...new Map(
                              m.sources.map((s) => [s.url, s]),
                            ).values(),
                          ].map((s) => (
                            <a
                              key={s.url}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {s.title} ↗
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {thinking && (
                    <p className="thinking">✦ Checking the road ahead…</p>
                  )}
                  <div ref={chatEnd} />
                </div>
                <form
                  className="chat-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask();
                  }}
                >
                  <label className="sr-only" htmlFor="question">
                    Ask Campfire
                  </label>
                  <input
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={2000}
                    placeholder="What’s on your mind?"
                    autoComplete="off"
                  />
                  <button
                    className="primary"
                    disabled={thinking || !question.trim()}
                    aria-label="Send question"
                  >
                    ↑
                  </button>
                </form>
                <p className="chat-disclaimer">
                  Check linked sources and local conditions before you set off.
                  Chat is kept for this session.
                </p>
              </section>
              <aside className="context-panel">
                <p className="eyebrow">PACKED FOR THE CONVERSATION</p>
                <h3>Your trip, in mind.</h3>
                <dl>
                  <dt>Current stop</dt>
                  <dd>
                    {current.name}, {current.state}
                  </dd>
                  <dt>Up next</dt>
                  <dd>{next?.name || "An open road"}</dd>
                  <dt>Your travel style</dt>
                  <dd>{data.preferences}</dd>
                  <dt>Stories so far</dt>
                  <dd>
                    {data.memories.length} memories · {data.collected.length}{" "}
                    states
                  </dd>
                </dl>
                <button
                  className="text-button"
                  onClick={() => setModal("settings")}
                >
                  Edit trip preferences ↗
                </button>
                <p className="footnote">
                  Questions send this context, recent memory notes, and work
                  records to the configured AI provider. Photos stay on this
                  device.
                </p>
              </aside>
            </div>
          )}

          {tab === "Journal" && (
            <>
              <div className="journal-toolbar">
                <span>{data.memories.length} memories, all yours.</span>
                <input
                  aria-label="Search memories"
                  placeholder="Search your memories…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {!data.memories.length ? (
                <div className="empty-state">
                  <span>▤</span>
                  <h2>The best souvenirs aren’t things.</h2>
                  <p>
                    Save a photo, a place, or a few words. Your first memory
                    starts here.
                  </p>
                  <button className="primary" onClick={() => openMemory()}>
                    ＋ Add your first memory
                  </button>
                </div>
              ) : (
                <div className="memory-grid">
                  {data.memories
                    .filter((m) =>
                      `${m.title} ${m.note} ${m.place} ${m.state}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((m) => (
                      <article className="memory-card" key={m.id}>
                        {m.photo ? (
                          <img src={m.photo} alt={m.title} />
                        ) : (
                          <div className="memory-placeholder">
                            ↟<span>{m.place}</span>
                          </div>
                        )}
                        <div className="memory-body">
                          <small>
                            {m.date} <span>· {m.state}</span>
                          </small>
                          <h2>{m.title}</h2>
                          <p>{m.note}</p>
                          <footer>
                            <span>⌖ {m.place}</span>
                            <button
                              className="text-button"
                              onClick={() => openMemory(m)}
                            >
                              Edit ↗
                            </button>
                          </footer>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </>
          )}

          {tab === "States" && (
            <>
              <div className="collection-banner">
                <div>
                  <span className="eyebrow">THE FIFTY-STATE CLUB</span>
                  <h2>
                    {data.collected.length}
                    <span> / 50</span>
                  </h2>
                  <p>Every state has a story. Go find yours.</p>
                </div>
                <div className="collection-progress">
                  <div>
                    <span style={{ width: `${data.collected.length * 2}%` }} />
                  </div>
                  <p>
                    {50 - data.collected.length} more reasons to hit the road.
                  </p>
                  <small>
                    Tap a state to collect it. Add a photo in Journal to keep
                    the memory.
                  </small>
                </div>
              </div>
              <div className="journal-toolbar">
                <span>
                  Collect a welcome sign, landmark, or favorite moment.
                </span>
                <input
                  aria-label="Search states"
                  placeholder="Find a state…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="state-grid">
                {states
                  .filter((s) => s.toLowerCase().includes(search.toLowerCase()))
                  .map((s) => (
                    <button
                      key={s}
                      aria-pressed={data.collected.includes(s)}
                      className={
                        data.collected.includes(s)
                          ? "state-card collected"
                          : "state-card"
                      }
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          collected: d.collected.includes(s)
                            ? d.collected.filter((v) => v !== s)
                            : [...d.collected, s],
                        }))
                      }
                    >
                      <span>{data.collected.includes(s) ? "✓" : "◇"}</span>
                      <b>{s}</b>
                      <small>
                        {data.collected.includes(s)
                          ? "Collected"
                          : "Still out there"}
                      </small>
                    </button>
                  ))}
              </div>
            </>
          )}

          {tab === "Road work" && (
            <>
              <div className="work-stats">
                <Stat
                  label="EARNED"
                  value={money(data.shifts.reduce((n, s) => n + s.earned, 0))}
                />
                <Stat
                  label="AFTER FUEL"
                  value={money(
                    data.shifts.reduce((n, s) => n + s.earned - s.fuel, 0),
                  )}
                />
                <Stat
                  label="HOURS ON THE CLOCK"
                  value={`${data.shifts.reduce((n, s) => n + s.hours, 0).toFixed(1)} h`}
                />
              </div>
              <p className="footnote">
                After fuel excludes taxes, maintenance, insurance, and other
                costs. These are your recorded results, not predictions.
              </p>
              {!data.shifts.length ? (
                <div className="empty-state">
                  <span>☷</span>
                  <h2>Make your own road report.</h2>
                  <p>Log a shift to see where your time goes furthest.</p>
                  <button className="primary" onClick={() => setModal("shift")}>
                    ＋ Log your first shift
                  </button>
                </div>
              ) : (
                <>
                  <div className="section-heading">
                    <h2>Your cities, compared</h2>
                  </div>
                  <div className="city-comparison">
                    {shiftCities.map((s) => (
                      <div key={s.city}>
                        <h3>{s.city}</h3>
                        <b>
                          {money(s.net / s.hours)}
                          <small> / hour after fuel</small>
                        </b>
                        <p>
                          {s.count} shifts · {s.hours.toFixed(1)} hours
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="section-heading">
                    <h2>Shift log</h2>
                  </div>
                  <div className="shift-list">
                    {data.shifts.map((s) => (
                      <div key={s.id}>
                        <div>
                          <b>
                            {s.city} <span>· {s.platform}</span>
                          </b>
                          <small>
                            {s.date} · {s.hours} hours · {money(s.fuel)} fuel
                          </small>
                        </div>
                        <b>{money(s.earned)}</b>
                        <button
                          className="text-button"
                          aria-label={`Delete shift in ${s.city}`}
                          onClick={() => {
                            if (confirm("Delete this shift?"))
                              update((d) => ({
                                ...d,
                                shifts: d.shifts.filter((v) => v.id !== s.id),
                              }));
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>♨ campfire</span>
            <span>A little further, together.</span>
            <button onClick={exportTrip}>Export trip ↗</button>
          </footer>
        </div>
      </main>
      <dialog
        ref={dialogRef}
        className="modal"
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="modal-heading">
          <h2>
            {modal === "memory"
              ? editMemory
                ? "Keep the story going."
                : "Keep this moment."
              : modal === "stop"
                ? "Somewhere new."
                : modal === "shift"
                  ? "A day on the road."
                  : "Make Campfire yours."}
          </h2>
          <button onClick={() => setModal(null)} aria-label="Close dialog">
            ×
          </button>
        </div>
        {modal === "memory" && (
          <MemoryForm
            memory={editMemory}
            place={selected}
            onSave={(memory) => {
              update((d) => ({
                ...d,
                memories: [
                  memory,
                  ...d.memories.filter((m) => m.id !== memory.id),
                ],
              }));
              setModal(null);
            }}
            onDelete={
              editMemory
                ? () => {
                    if (confirm("Delete this memory and its photo?")) {
                      update((d) => ({
                        ...d,
                        memories: d.memories.filter(
                          (m) => m.id !== editMemory.id,
                        ),
                      }));
                      setModal(null);
                    }
                  }
                : undefined
            }
          />
        )}
        {modal === "stop" && (
          <StopForm
            place={editStop}
            onSave={(p) => {
              if (editStop) {
                update((d) => ({
                  ...d,
                  journey: {
                    ...d.journey,
                    legs: d.journey.legs.map((l) => {
                      const ds = l.destinations.map((v) =>
                        v.id === p.id ? p : v,
                      );
                      return {
                        ...l,
                        title: ds.map((v) => v.name).join(" → "),
                        destinations: ds,
                        route: {
                          type: "LineString",
                          coordinates: [
                            ds[0].coordinates,
                            ds[ds.length - 1].coordinates,
                          ],
                        },
                      };
                    }),
                  },
                }));
              } else {
                const end = destinations.at(-1)!;
                update((d) => ({
                  ...d,
                  journey: {
                    ...d.journey,
                    legs: [
                      ...d.journey.legs,
                      {
                        id: "leg-" + p.id,
                        title: end.name + " → " + p.name,
                        destinations: [end, p],
                        moments: [],
                        route: {
                          type: "LineString",
                          coordinates: [end.coordinates, p.coordinates],
                        },
                      },
                    ],
                  },
                }));
              }
              setModal(null);
              explore(p.id);
            }}
            onDelete={
              editStop && destinations.length > 2
                ? () => {
                    if (
                      !confirm(
                        "Remove this stop from the itinerary? Your journal memories will stay.",
                      )
                    )
                      return;
                    const remaining = destinations.filter(
                      (p) => p.id !== editStop.id,
                    );
                    update((d) => ({
                      ...d,
                      currentId:
                        d.currentId === editStop.id
                          ? remaining[0].id
                          : d.currentId,
                      journey: {
                        ...d.journey,
                        legs: remaining.slice(0, -1).map((a, i) => {
                          const b = remaining[i + 1];
                          const old = d.journey.legs.find(
                            (l) =>
                              l.destinations[0].id === a.id &&
                              l.destinations[l.destinations.length - 1].id ===
                                b.id,
                          );
                          return (
                            old ?? {
                              id: "leg-" + a.id + "-" + b.id,
                              title: a.name + " → " + b.name,
                              destinations: [a, b],
                              moments: [],
                              route: {
                                type: "LineString",
                                coordinates: [a.coordinates, b.coordinates],
                              },
                            }
                          );
                        }),
                      },
                    }));
                    setFocus(undefined);
                    setModal(null);
                  }
                : undefined
            }
          />
        )}
        {modal === "shift" && (
          <ShiftForm
            city={current.name}
            onSave={(s) => {
              update((d) => ({ ...d, shifts: [s, ...d.shifts] }));
              setModal(null);
            }}
          />
        )}
        {modal === "settings" && (
          <div className="settings">
            <p className="form-help">
              Your trip is saved on this browser and device. Export backups to
              keep it safe or transfer it to another phone. Devices do not sync
              automatically.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                update((d) => ({
                  ...d,
                  preferences: String(f.get("preferences")).trim(),
                }));
                setNotice("Travel preferences saved.");
              }}
            >
              <label>
                Our travel style
                <textarea
                  name="preferences"
                  defaultValue={data.preferences}
                  maxLength={1500}
                  rows={3}
                  required
                />
              </label>
              <button className="primary">Save preferences</button>
            </form>
            <div className="settings-block">
              <h3>Keep your trip close</h3>
              <div className="button-row">
                <button className="secondary" onClick={exportTrip}>
                  Export backup
                </button>
                <button
                  className="secondary"
                  onClick={() => importRef.current?.click()}
                >
                  Import backup
                </button>
              </div>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => importTrip(e.target.files?.[0])}
              />
            </div>
            <div className="settings-block">
              <h3>Companion connection</h3>
              <p>
                {ai
                  ? "AI is configured on this server."
                  : "Trip tools are available. AI is not configured."}
              </p>
              <p className="form-help">
                For full AI, set OPENAI_API_KEY and OPENAI_MODEL in the server’s
                .env.local file and restart it. Keep the key on the server.
                Nearby links and live NWS weather work without AI.
              </p>
            </div>
            <div className="settings-block">
              <h3>Take us along</h3>
              <p className="form-help">
                On an HTTPS deployment, open Campfire in Safari and choose Share
                → Add to Home Screen. On Android, use Install app in your
                browser menu. Saved trip data stays available when offline;
                maps, weather, and AI need a connection.
              </p>
            </div>
            <div className="settings-block">
              <h3>About this itinerary</h3>
              <p className="form-help">
                The original Texas-to-Virginia route is included as a starter
                plan. Stops are planned until you make one current. Map lines
                connect stops and are not road navigation. Use your navigation
                app for driving.
              </p>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <b>{value}</b>
    </div>
  );
}
function WeatherCard({
  weather,
  status,
  onRefresh,
}: {
  weather?: Weather;
  status: string;
  onRefresh: () => void;
}) {
  return (
    <div className="weather-card">
      <div className="card-top">
        <span className="eyebrow">A LOOK OUTSIDE</span>
        <button
          className="text-button"
          onClick={onRefresh}
          aria-label="Refresh weather"
        >
          ↻
        </button>
      </div>
      {weather ? (
        <>
          <div className="weather-main">
            <span>☀</span>
            <b>
              {weather.periods[0]?.temperature}°
              <small>{weather.periods[0]?.temperatureUnit}</small>
            </b>
          </div>
          <p>{weather.periods[0]?.shortForecast}</p>
          <small>{weather.periods[0]?.name} · NWS forecast</small>
          {weather.alerts.length > 0 && (
            <div className="weather-alert">
              {weather.alerts.map((a) => (
                <p key={a.headline}>{a.headline}</p>
              ))}
            </div>
          )}
          <small>
            {weather.alertsAvailable
              ? weather.alerts.length
                ? "Active alerts · check details below"
                : "No active alerts returned for this location"
              : "Alert check unavailable"}
          </small>
          <a href={weather.source} target="_blank" rel="noreferrer">
            Forecast & alerts ↗
          </a>
          <small>
            Checked{" "}
            {new Date(weather.checkedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </small>
        </>
      ) : (
        <p className="weather-loading">
          {status || "Checking the forecast…"}
          {status && (
            <a href="https://www.weather.gov" target="_blank" rel="noreferrer">
              Check NWS ↗
            </a>
          )}
        </p>
      )}
    </div>
  );
}
function MemoryForm({
  memory,
  place,
  onSave,
  onDelete,
}: {
  memory?: Memory;
  place: Destination;
  onSave: (m: Memory) => void;
  onDelete?: () => void;
}) {
  const [photo, setPhoto] = useState(memory?.photo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      id: memory?.id ?? crypto.randomUUID(),
      title: String(f.get("title")).trim(),
      note: String(f.get("note")).trim(),
      place: String(f.get("place")).trim(),
      state: String(f.get("state")),
      date: String(f.get("date")),
      photo,
    });
  }
  return (
    <form className="editor-form" onSubmit={submit}>
      <label className="photo-upload">
        {photo ? (
          <img src={photo} alt="Memory preview" />
        ) : (
          <>
            <span>＋</span>Take a photo or choose one
          </>
        )}
        <input
          type="file"
          accept="image/*"
          aria-label="Choose memory photo"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              setPhoto(await photoData(file));
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not read this photo.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {photo && (
        <button
          className="text-button"
          type="button"
          onClick={() => setPhoto(undefined)}
        >
          Remove photo
        </button>
      )}
      <label>
        A name for this moment
        <input
          name="title"
          defaultValue={memory?.title}
          placeholder="The sunset we almost missed"
          maxLength={150}
          required
        />
      </label>
      <div className="form-row">
        <label>
          Place
          <input
            name="place"
            defaultValue={memory?.place ?? place.name}
            maxLength={150}
            required
          />
        </label>
        <label>
          State
          <select
            name="state"
            defaultValue={memory?.state ?? place.state ?? ""}
          >
            <option value="">Choose state</option>
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Date
        <input
          name="date"
          type="date"
          defaultValue={memory?.date ?? today()}
          required
        />
      </label>
      <label>
        The story
        <textarea
          name="note"
          defaultValue={memory?.note}
          placeholder="What do you want to remember?"
          rows={4}
          maxLength={10000}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="button-row">
        <button className="primary" disabled={busy}>
          {busy ? "Preparing photo…" : "Save memory"}
        </button>
        {onDelete && (
          <button className="danger" type="button" onClick={onDelete}>
            Delete memory
          </button>
        )}
      </div>
    </form>
  );
}
function StopForm({
  place,
  onSave,
  onDelete,
}: {
  place?: Destination;
  onSave: (d: Destination) => void;
  onDelete?: () => void;
}) {
  return (
    <form
      className="editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          id: place?.id ?? crypto.randomUUID(),
          name: String(f.get("name")).trim(),
          state: String(f.get("state")),
          date: String(f.get("date")),
          coordinates: [Number(f.get("lng")), Number(f.get("lat"))],
        });
      }}
    >
      <p className="form-help">
        Add or edit a place in your itinerary. Copy its latitude and longitude
        from your map app.
      </p>
      <label>
        Place name
        <input
          name="name"
          defaultValue={place?.name}
          placeholder="Somewhere worth stopping"
          required
          maxLength={150}
        />
      </label>
      <label>
        State
        <select name="state" defaultValue={place?.state || "Texas"} required>
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          Latitude
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            name="lat"
            defaultValue={place?.coordinates[1]}
            placeholder="35.5951"
            required
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            name="lng"
            defaultValue={place?.coordinates[0]}
            placeholder="-82.5515"
            required
          />
        </label>
      </div>
      <label>
        Planned date
        <input type="date" name="date" defaultValue={today()} required />
      </label>
      <div className="button-row">
        <button className="primary">
          {place ? "Save stop" : "Add to our journey"}
        </button>
        {onDelete && (
          <button className="danger" type="button" onClick={onDelete}>
            Remove stop
          </button>
        )}
      </div>
    </form>
  );
}
function ShiftForm({
  city,
  onSave,
}: {
  city: string;
  onSave: (s: Shift) => void;
}) {
  return (
    <form
      className="editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          id: crypto.randomUUID(),
          city: String(f.get("city")).trim(),
          platform: String(f.get("platform")).trim(),
          date: String(f.get("date")),
          hours: Number(f.get("hours")),
          earned: Number(f.get("earned")),
          fuel: Number(f.get("fuel")),
        });
      }}
    >
      <label>
        City
        <input name="city" defaultValue={city} required maxLength={150} />
      </label>
      <div className="form-row">
        <label>
          Platform
          <input
            name="platform"
            placeholder="DoorDash"
            required
            maxLength={100}
          />
        </label>
        <label>
          Date
          <input type="date" name="date" defaultValue={today()} required />
        </label>
      </div>
      <div className="form-row">
        <label>
          Hours
          <input
            name="hours"
            type="number"
            min="0.1"
            max="24"
            step="0.1"
            required
          />
        </label>
        <label>
          Earned ($)
          <input
            name="earned"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
          />
        </label>
      </div>
      <label>
        Fuel spent ($)
        <input
          name="fuel"
          type="number"
          min="0"
          max="10000"
          step="0.01"
          defaultValue="0"
          required
        />
      </label>
      <button className="primary">Save shift</button>
    </form>
  );
}
