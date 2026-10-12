import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length > 300)
    return NextResponse.json(
      { error: "Вкажи пошуковий запит." },
      { status: 400 },
    );
  const endpoint = process.env.YOUTUBE_SEARCH_URL;
  const key = process.env.YOUTUBE_SEARCH_KEY;
  if (!endpoint || !key)
    return NextResponse.json(
      {
        error:
          "Пошук відео ще не налаштовано. Відкрий YouTube або додай посилання на відео вручну.",
      },
      { status: 503 },
    );
  try {
    const url = new URL(endpoint);
    url.searchParams.set("q", query);
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("upstream");
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("response");
    return NextResponse.json({
      items: data.items.filter(
        (x: { videoId?: string }) =>
          typeof x.videoId === "string" && /^[\w-]{11}$/.test(x.videoId),
      ),
    });
  } catch {
    return NextResponse.json(
      { error: "Не вдалося знайти відео. Спробуй пізніше." },
      { status: 502 },
    );
  }
}
