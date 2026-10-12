export interface Song {
  _id: string;
  remoteID?: string;
  userId: string;
  title: string;
  author?: string;
  content: string;
  descriptionText?: string;
  link?: string;
  youtubeVideoID?: string;
  number?: number;
  ton?: number;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  isPrivate: boolean;
  tags: string[];
  collections: string[];
}
export interface Collection {
  _id: string;
  remoteID?: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
  sortOrder: number;
}
export interface Library {
  songs: Song[];
  collections: Collection[];
}
export interface SearchResult {
  title: string;
  author: string;
  link: string;
}
export interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailURL?: string;
}
export function objectId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export function newSong(values: Partial<Song> = {}): Song {
  const now = new Date().toISOString();
  return {
    _id: objectId(),
    userId: "anonymous",
    title: "",
    content: "",
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    isPrivate: true,
    tags: [],
    collections: [],
    ...values,
  };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Некоректний запис у JSON.");
  return value as Record<string, unknown>;
}
function string(
  r: Record<string, unknown>,
  key: string,
  required = false,
): string | undefined {
  const v = r[key];
  if (v == null && !required) return undefined;
  if (typeof v !== "string") throw new Error(`Поле ${key} має бути рядком.`);
  return v;
}
function id(r: Record<string, unknown>): string {
  const v = string(r, "_id", true)!;
  if (!/^[a-f0-9]{24}$/i.test(v)) throw new Error(`Некоректний ObjectId: ${v}`);
  return v.toLowerCase();
}
function date(
  r: Record<string, unknown>,
  key: string,
  fallback?: string,
): string {
  if (r[key] == null && fallback) return fallback;
  const v = string(r, key, true)!;
  // The iOS importer falls back to the current date for unparseable ISO8601 strings.
  return Number.isNaN(Date.parse(v)) ? new Date().toISOString() : v;
}
function bool(
  r: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const v = r[key];
  if (v == null) return fallback;
  if (typeof v !== "boolean") throw new Error(`Поле ${key} має бути boolean.`);
  return v;
}
function integer(r: Record<string, unknown>, key: string): number | undefined {
  const v = r[key];
  if (v == null) return undefined;
  if (typeof v !== "number" || !Number.isSafeInteger(v))
    throw new Error(`Поле ${key} має бути цілим числом.`);
  return v;
}
function strings(r: Record<string, unknown>, key: string): string[] {
  const v = r[key];
  if (v == null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
    throw new Error(`Поле ${key} має бути масивом рядків.`);
  return v;
}
export function parseLibrary(input: unknown): Library {
  const root = record(input);
  if (!Array.isArray(root.songs) || !Array.isArray(root.collections))
    throw new Error(
      "Очікується бібліотека iOS з масивами songs і collections.",
    );
  const songs = root.songs.map((value) => {
    const r = record(value);
    return {
      _id: id(r),
      remoteID: string(r, "remoteID"),
      userId: string(r, "userId") ?? "anonymous",
      title: string(r, "title", true)!,
      author: string(r, "author"),
      content: string(r, "content", true)!,
      descriptionText: string(r, "descriptionText"),
      link: string(r, "link"),
      youtubeVideoID: string(r, "youtubeVideoID"),
      number: integer(r, "number"),
      ton: integer(r, "ton"),
      createdAt: date(r, "createdAt"),
      updatedAt: date(r, "updatedAt"),
      isFavorite: bool(r, "isFavorite", false),
      isPrivate: bool(r, "isPrivate", true),
      tags: strings(r, "tags"),
      collections: strings(r, "collections")
        .filter((x) => /^[a-f0-9]{24}$/i.test(x))
        .map((x) => x.toLowerCase()),
    };
  });
  const collections = root.collections.map((value) => {
    const r = record(value);
    const createdAt = date(r, "createdAt");
    return {
      _id: id(r),
      remoteID: string(r, "remoteID"),
      userId: string(r, "userId") ?? "anonymous",
      title: string(r, "title", true)!,
      createdAt,
      updatedAt: date(r, "updatedAt", createdAt),
      isPrivate: bool(r, "isPrivate", true),
      sortOrder: integer(r, "sortOrder") ?? 0,
    };
  });
  for (const items of [songs, collections]) {
    if (new Set(items.map((x) => x._id)).size !== items.length)
      throw new Error("Файл містить повторювані ID.");
  }
  return { songs, collections };
}
export function mergeLibrary(current: Library, incoming: Library): Library {
  return {
    songs: [
      ...current.songs,
      ...incoming.songs.filter(
        (s) => !current.songs.some((x) => x._id === s._id),
      ),
    ],
    collections: [
      ...current.collections,
      ...incoming.collections.filter(
        (c) => !current.collections.some((x) => x._id === c._id),
      ),
    ],
  };
}
export function serializeLibrary(library: Library): string {
  return JSON.stringify(
    { songs: library.songs, collections: library.collections },
    null,
    2,
  );
}
export function isDuplicate(songs: Song[], candidate: SearchResult) {
  return songs.some(
    (s) =>
      (s.link && s.link.toLowerCase() === candidate.link.toLowerCase()) ||
      (s.title.toLowerCase() === candidate.title.toLowerCase() &&
        (s.author ?? "").toLowerCase() === candidate.author.toLowerCase()),
  );
}
export function safeURL(value?: string) {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function videoId(value: string): string | undefined {
  const text = value.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const u = new URL(text);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let v: string | null | undefined;
    if (host === "youtu.be") v = u.pathname.split("/")[1];
    else if (["youtube.com", "youtube-nocookie.com"].includes(host))
      v =
        u.searchParams.get("v") ??
        (/^\/(shorts|embed|live)\//.test(u.pathname)
          ? u.pathname.split("/")[2]
          : undefined);
    return v && /^[\w-]{11}$/.test(v) ? v : undefined;
  } catch {
    return undefined;
  }
}
