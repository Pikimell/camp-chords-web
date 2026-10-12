import { NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";
import { safeURL } from "@/lib/library";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;
    if (!["search", "html"].includes(action))
      return NextResponse.json({ error: "Некоректна дія." }, { status: 400 });
    let payload: Record<string, unknown>;
    if (action === "search") {
      if (
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.length > 300 ||
        !Number.isInteger(body.page ?? 1) ||
        (body.page ?? 1) < 1 ||
        (body.page ?? 1) > 100
      )
        return NextResponse.json(
          { error: "Вкажи назву пісні та коректну сторінку." },
          { status: 400 },
        );
      payload = { title: body.title.trim(), page: body.page ?? 1 };
    } else {
      if (
        typeof body.url !== "string" ||
        !safeURL(body.url) ||
        body.url.length > 2048
      )
        return NextResponse.json(
          { error: "Некоректне посилання." },
          { status: 400 },
        );
      payload = {
        url: body.url,
        ...(body.reupdate === true ? { reupdate: true } : {}),
      };
    }
    const base =
      process.env.CHORDS_API_URL ||
      "https://87bkbiu1a7.execute-api.us-east-2.amazonaws.com/dev";
    const response = await fetch(`${base.replace(/\/$/, "")}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (!response.ok)
      return NextResponse.json(
        { error: "Сервіс акордів тимчасово недоступний. Спробуй пізніше." },
        { status: 502 },
      );
    const data = await response.json();
    if (action === "search") {
      if (
        !Array.isArray(data) ||
        data.some(
          (x) =>
            typeof x.title !== "string" ||
            typeof x.author !== "string" ||
            !safeURL(x.link),
        )
      )
        throw new Error("response");
    } else {
      if (
        typeof data.title !== "string" ||
        typeof data.content !== "string" ||
        typeof data.author !== "string" ||
        !safeURL(data.link)
      )
        throw new Error("response");
      data.content = sanitizeHtml(data.content, {
        allowedTags: [
          "span",
          "br",
          "div",
          "p",
          "pre",
          "b",
          "strong",
          "em",
          "i",
        ],
        allowedAttributes: { span: ["class"] },
      });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error: "Не вдалося отримати акорди. Перевір запит або спробуй пізніше.",
      },
      { status: 502 },
    );
  }
}
