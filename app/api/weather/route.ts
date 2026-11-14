import { getWeather } from "@/lib/weather";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get("lat")),
    lng = Number(p.get("lng"));
  if (
    !p.has("lat") ||
    !p.has("lng") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return Response.json({ error: "Invalid location." }, { status: 400 });
  try {
    return Response.json(await getWeather(lng, lat));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Weather unavailable." },
      { status: 503 },
    );
  }
}
