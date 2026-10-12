"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "./modal";
import { useLibrary } from "@/lib/store";
import { newSong, safeURL, videoId, type Song } from "@/lib/library";
import { contentToText, textToContent } from "@/lib/chords";
export function SongEditor({
  song,
  onClose,
  collectionID,
}: {
  song?: Song;
  onClose: () => void;
  collectionID?: string;
}) {
  const store = useLibrary();
  const [draft, setDraft] = useState<Song>(
    () => song ?? newSong({ collections: collectionID ? [collectionID] : [] }),
  );
  const [text, setText] = useState(() =>
    song ? contentToText(song.content) : "",
  );
  const [youtube, setYoutube] = useState(song?.youtubeVideoID ?? "");
  const [error, setError] = useState("");
  const update = (patch: Partial<Song>) =>
    setDraft((d) => ({ ...d, ...patch }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !text.trim())
      return setError("Додай назву і текст пісні.");
    if (youtube.trim() && !videoId(youtube))
      return setError("Вкажи коректне посилання на YouTube або ID відео.");
    if (draft.link?.trim() && !safeURL(draft.link.trim()))
      return setError("Посилання має починатися з https:// або http://.");
    store.saveSong({
      ...draft,
      title: draft.title.trim(),
      author: draft.author?.trim(),
      content:
        song && text === contentToText(song.content)
          ? song.content
          : textToContent(text),
      tags: [
        ...new Set(draft.tags.map((x) => x.trim()).filter(Boolean)),
      ].sort(),
      youtubeVideoID: videoId(youtube),
      link: draft.link?.trim() || undefined,
    });
    onClose();
  }
  return (
    <Modal
      title={song ? "Редагувати пісню" : "Нова пісня"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="editor">
        <div className="form-grid">
          <label>
            Назва
            <input
              required
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              autoFocus
            />
          </label>
          <label>
            Автор
            <input
              value={draft.author ?? ""}
              onChange={(e) => update({ author: e.target.value })}
            />
          </label>
        </div>
        <label>
          Текст та акорди
          <textarea
            required
            rows={11}
            placeholder={
              "[Am]Текст пісні [F]з акордами\n\nC  G  Am  F\nАбо акорди окремим рядком"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="hint">
          Акорди в квадратних дужках або окремим рядком зберігаються з
          підтримкою транспонування.
        </p>
        <div className="form-grid">
          <label>
            Теги через кому
            <input
              value={draft.tags.join(",")}
              onChange={(e) => update({ tags: e.target.value.split(",") })}
              placeholder="Біля вогнища, акустика"
            />
          </label>
          <label>
            YouTube: посилання або ID
            <input
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
            />
          </label>
          <label>
            Джерело
            <input
              type="url"
              value={draft.link ?? ""}
              onChange={(e) => update({ link: e.target.value })}
            />
          </label>
          <label>
            Номер пісні
            <input
              type="number"
              step="1"
              value={draft.number ?? ""}
              onChange={(e) =>
                update({
                  number: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </label>
        </div>
        <label>
          Нотатки
          <textarea
            rows={2}
            value={draft.descriptionText ?? ""}
            onChange={(e) => update({ descriptionText: e.target.value })}
          />
        </label>
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={draft.isFavorite}
              onChange={(e) => update({ isFavorite: e.target.checked })}
            />{" "}
            В обраному
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.isPrivate}
              onChange={(e) => update({ isPrivate: e.target.checked })}
            />{" "}
            Приватна
          </label>
        </div>
        {store.collections.length > 0 && (
          <fieldset>
            <legend>Колекції</legend>
            <div className="checks">
              {store.collections.map((c) => (
                <label key={c._id}>
                  <input
                    type="checkbox"
                    checked={draft.collections.includes(c._id)}
                    onChange={(e) =>
                      update({
                        collections: e.target.checked
                          ? [...draft.collections, c._id]
                          : draft.collections.filter((id) => id !== c._id),
                      })
                    }
                  />
                  {c.title}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="form-actions">
          <button type="button" onClick={onClose}>
            Скасувати
          </button>
          <button className="primary" type="submit">
            Зберегти пісню
          </button>
        </footer>
      </form>
    </Modal>
  );
}
