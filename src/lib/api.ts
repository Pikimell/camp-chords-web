import type { Song, SearchResult, VideoResult } from "./library";
import { newSong, videoId } from "./library";
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(35000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Не вдалося виконати запит.");
  return data;
}
export const searchSongs = (title: string, page = 1, signal?: AbortSignal) =>
  request<SearchResult[]>("/api/chords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "search", title, page }),
    signal,
  });
export async function fetchSong(link: string, reupdate = false): Promise<Song> {
  const data = await request<{
    title: string;
    author: string;
    content: string;
    link: string;
    youtubeVideoId?: string;
  }>("/api/chords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "html", url: link, reupdate }),
  });
  return newSong({
    title: data.title,
    author: data.author,
    content: data.content,
    link: data.link,
    youtubeVideoID: videoId(data.youtubeVideoId ?? ""),
  });
}
export const searchVideos = (query: string) =>
  request<{ items: VideoResult[] }>(
    `/api/youtube?q=${encodeURIComponent(query)}`,
  );
