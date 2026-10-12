"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Star,
  Pencil,
  Trash2,
  RefreshCw,
  Minus,
  Plus,
  FolderPlus,
  Video,
  Printer,
} from "lucide-react";
import { useLibrary } from "@/lib/store";
import { safeURL, videoId, type Song, type VideoResult } from "@/lib/library";
import { renderContent } from "@/lib/chords";
import { fetchSong, searchVideos } from "@/lib/api";
import { Modal } from "./modal";
export function SongDetail({
  song,
  songs,
  preview,
  onBack,
  onSelect,
  onEdit,
  onSave,
  notify,
}: {
  song: Song;
  songs: Song[];
  preview?: boolean;
  onBack: () => void;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onSave?: () => void;
  notify: (message: string) => void;
}) {
  const store = useLibrary();
  const [previewTon, setPreviewTon] = useState(0);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"collections" | "youtube" | "delete">();
  const [videoQuery, setVideoQuery] = useState(
    `${song.title} ${song.author ?? ""}`,
  );
  const [videoLink, setVideoLink] = useState(song.youtubeVideoID ?? "");
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [videoError, setVideoError] = useState("");
  const ton = preview ? previewTon : (song.ton ?? 0);
  const html = useMemo(
    () => renderContent(song.content, ton),
    [song.content, ton],
  );
  const setTon = (value: number) =>
    preview ? setPreviewTon(value) : store.saveSong({ ...song, ton: value });
  const index = songs.findIndex((s) => s._id === song._id);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (
        modal ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(t.tagName) ||
        t.isContentEditable
      )
        return;
      if (e.key === "ArrowRight" && songs[index + 1]) {
        e.preventDefault();
        onSelect(songs[index + 1]._id);
      }
      if (e.key === "ArrowLeft" && songs[index - 1]) {
        e.preventDefault();
        onSelect(songs[index - 1]._id);
      }
      if (e.shiftKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        setTon(ton + (e.key === "ArrowUp" ? 1 : -1));
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function refresh() {
    if (!song.link) return;
    setBusy(true);
    try {
      const updated = await fetchSong(song.link, true);
      store.saveSong({
        ...song,
        title: updated.title,
        author: updated.author,
        content: updated.content,
        link: updated.link,
        youtubeVideoID: updated.youtubeVideoID ?? song.youtubeVideoID,
      });
      notify("Акорди оновлено з джерела.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function findVideos() {
    setBusy(true);
    setVideoError("");
    try {
      setVideos((await searchVideos(videoQuery)).items);
    } catch (e) {
      setVideoError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function saveVideo(value: string) {
    const id = videoId(value);
    if (!id) return setVideoError("Некоректне посилання або ID відео.");
    store.saveSong({ ...song, youtubeVideoID: id });
    setModal(undefined);
    notify("Відео додано.");
  }
  return (
    <article className="song-detail">
      <div className="detail-toolbar">
        <button onClick={onBack}>
          <ArrowLeft size={18} />
          Назад
        </button>
        <div className="toolbar-actions">
          {!preview && (
            <>
              <button
                className="icon-button"
                onClick={onEdit}
                aria-label="Редагувати пісню"
              >
                <Pencil size={18} />
              </button>
              {song.link && (
                <button
                  className="icon-button"
                  onClick={refresh}
                  disabled={busy}
                  aria-label="Оновити з джерела"
                >
                  <RefreshCw size={18} className={busy ? "spin" : ""} />
                </button>
              )}
              <button
                className="icon-button"
                onClick={() => setModal("delete")}
                aria-label="Видалити пісню"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
          <button
            className="icon-button"
            onClick={() => window.print()}
            aria-label="Друкувати пісню"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>
      <p className="eyebrow">
        {preview ? "ЗНАЙДЕНО ДЛЯ ТЕБЕ" : "ТВІЙ ПІСЕННИК"}
        {song.number !== undefined ? ` / № ${song.number}` : ""}
      </p>
      <h1>{song.title}</h1>
      <p className="song-author">{song.author || "Без автора"}</p>
      <div className="detail-actions">
        {preview ? (
          <button className="primary" onClick={onSave} disabled={busy}>
            <Plus size={18} />
            Зберегти в бібліотеку
          </button>
        ) : (
          <>
            <button
              className={song.isFavorite ? "selected" : ""}
              onClick={() =>
                store.saveSong({ ...song, isFavorite: !song.isFavorite })
              }
            >
              <Star
                size={17}
                fill={song.isFavorite ? "currentColor" : "none"}
              />
              {song.isFavorite ? "В обраному" : "В обране"}
            </button>
            <button onClick={() => setModal("collections")}>
              <FolderPlus size={18} />
              Колекції
            </button>
            <button onClick={() => setModal("youtube")}>
              <Video size={18} />
              YouTube
            </button>
          </>
        )}
      </div>
      {store.settings.performer && (
        <div className="performer-controls">
          <div className="stepper">
            <button
              aria-label="Транспонувати вниз"
              onClick={() => setTon(ton - 1)}
            >
              <Minus size={16} />
            </button>
            <span>
              <small>Тональність</small>
              {ton > 0 ? "+" : ""}
              {ton}
            </span>
            <button
              aria-label="Транспонувати вгору"
              onClick={() => setTon(ton + 1)}
            >
              <Plus size={16} />
            </button>
          </div>
          <button onClick={() => setTon(0)} disabled={ton === 0}>
            Оригінал
          </button>
          <div className="stepper">
            <button
              aria-label="Зменшити текст"
              disabled={store.settings.fontSize <= 12}
              onClick={() =>
                store.setSettings({ fontSize: store.settings.fontSize - 1 })
              }
            >
              A−
            </button>
            <span>
              <small>Розмір тексту</small>
              {store.settings.fontSize}
            </span>
            <button
              aria-label="Збільшити текст"
              disabled={store.settings.fontSize >= 32}
              onClick={() =>
                store.setSettings({ fontSize: store.settings.fontSize + 1 })
              }
            >
              A+
            </button>
          </div>
        </div>
      )}
      <div
        className="lyrics"
        style={{ fontSize: store.settings.fontSize }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {song.descriptionText && (
        <section className="notes">
          <h3>Нотатки</h3>
          <p>{song.descriptionText}</p>
        </section>
      )}
      <div className="tags">
        {song.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      {videoId(song.youtubeVideoID ?? "") && (
        <iframe
          className="video-player"
          src={`https://www.youtube-nocookie.com/embed/${videoId(song.youtubeVideoID!)}`}
          title={`Відео: ${song.title}`}
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      )}
      <footer className="song-footer">
        {safeURL(song.link) && (
          <a href={safeURL(song.link)} target="_blank" rel="noreferrer">
            Відкрити джерело ↗
          </a>
        )}
        <span>
          Додано {new Date(song.createdAt).toLocaleDateString("uk-UA")}
        </span>
      </footer>
      {songs.length > 1 && (
        <div className="song-pagination">
          <button
            disabled={index <= 0}
            onClick={() => onSelect(songs[index - 1]._id)}
          >
            <ChevronLeft size={18} />
            Попередня
          </button>
          <span>
            {index + 1} / {songs.length}
          </span>
          <button
            disabled={index >= songs.length - 1}
            onClick={() => onSelect(songs[index + 1]._id)}
          >
            Наступна
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      {modal === "delete" && (
        <Modal title="Видалити пісню?" onClose={() => setModal(undefined)}>
          <p>«{song.title}» буде видалено з бібліотеки та всіх колекцій.</p>
          <div className="form-actions">
            <button onClick={() => setModal(undefined)}>Скасувати</button>
            <button
              className="danger"
              onClick={() => {
                store.deleteSong(song._id);
                onBack();
              }}
            >
              Видалити
            </button>
          </div>
        </Modal>
      )}
      {modal === "collections" && (
        <Modal title="Колекції пісні" onClose={() => setModal(undefined)}>
          {store.collections.length === 0 ? (
            <p className="muted">
              Спочатку створи колекцію у розділі «Колекції».
            </p>
          ) : (
            <div className="collection-checks">
              {store.collections.map((c) => (
                <label key={c._id}>
                  <input
                    type="checkbox"
                    checked={song.collections.includes(c._id)}
                    onChange={(e) =>
                      store.saveSong({
                        ...song,
                        collections: e.target.checked
                          ? [...song.collections, c._id]
                          : song.collections.filter((id) => id !== c._id),
                      })
                    }
                  />
                  {c.title}
                </label>
              ))}
            </div>
          )}
          <button className="primary" onClick={() => setModal(undefined)}>
            Готово
          </button>
        </Modal>
      )}
      {modal === "youtube" && (
        <Modal title="Відео до пісні" onClose={() => setModal(undefined)}>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              void findVideos();
            }}
          >
            <input
              aria-label="Пошук відео"
              value={videoQuery}
              onChange={(e) => setVideoQuery(e.target.value)}
            />
            <button disabled={busy || !videoQuery.trim()}>Знайти</button>
          </form>
          <a
            className="external-link"
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoQuery)}`}
            target="_blank"
            rel="noreferrer"
          >
            Відкрити пошук на YouTube ↗
          </a>
          {videos.map((v) => (
            <button
              className="video-result"
              key={v.videoId}
              onClick={() => saveVideo(v.videoId)}
            >
              <Video size={24} />
              <span>
                {v.title}
                <small>{v.channelTitle}</small>
              </span>
              <Plus size={18} />
            </button>
          ))}
          <form
            className="editor"
            onSubmit={(e) => {
              e.preventDefault();
              saveVideo(videoLink);
            }}
          >
            <label>
              Посилання або ID відео
              <input
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                placeholder="https://youtu.be/…"
              />
            </label>
            {videoError && (
              <p className="error" role="alert">
                {videoError}
              </p>
            )}
            <div className="form-actions">
              {song.youtubeVideoID && (
                <button
                  type="button"
                  onClick={() => {
                    store.saveSong({ ...song, youtubeVideoID: undefined });
                    setModal(undefined);
                  }}
                >
                  Прибрати відео
                </button>
              )}
              <button className="primary" type="submit">
                Зберегти відео
              </button>
            </div>
          </form>
        </Modal>
      )}
    </article>
  );
}
