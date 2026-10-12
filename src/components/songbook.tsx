"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  BookOpen,
  Search,
  Star,
  Folder,
  SlidersHorizontal,
  Guitar,
  Plus,
  Music2,
  ChevronRight,
  Download,
  Upload,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Flame,
  Check,
  X,
} from "lucide-react";
import { useLibrary, useStorageError } from "@/lib/store";
import {
  type Song,
  type Collection,
  type SearchResult,
  objectId,
  parseLibrary,
  serializeLibrary,
  isDuplicate,
} from "@/lib/library";
import { fetchSong, searchSongs, searchVideos } from "@/lib/api";
import { SongEditor } from "./song-editor";
import { SongDetail } from "./song-detail";
import { Tuner } from "./tuner";
import { Modal } from "./modal";
type Tab =
  "library" | "search" | "favorites" | "collections" | "tuner" | "settings";
const navigation = [
  { id: "library", title: "Мої пісні", icon: BookOpen },
  { id: "search", title: "Знайти акорди", icon: Search },
  { id: "favorites", title: "Обране", icon: Star },
  { id: "collections", title: "Колекції", icon: Folder },
  { id: "tuner", title: "Тюнер", icon: Guitar },
  { id: "settings", title: "Налаштування", icon: SlidersHorizontal },
] as const;
const sortOptions: Record<string, string> = {
  titleAsc: "Назва: А → Я",
  titleDesc: "Назва: Я → А",
  authorAsc: "Автор: А → Я",
  authorDesc: "Автор: Я → А",
  dateCreatedDesc: "Спочатку нові",
  dateCreatedAsc: "Спочатку давні",
  favoriteFirst: "Спочатку обране",
};
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Songbook() {
  const store = useLibrary();
  const storageError = useStorageError((s) => s.error);
  const [ready, setReady] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("library");
  const [selected, setSelected] = useState<string>();
  const [collection, setCollection] = useState<string>();
  const [filter, setFilter] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<Song | "new">();
  const [collectionEdit, setCollectionEdit] = useState<Collection | "new">();
  const [collectionName, setCollectionName] = useState("");
  const [collectionDelete, setCollectionDelete] = useState<Collection>();
  const [manageMembers, setManageMembers] = useState(false);
  const [confirmClear, setConfirmClear] = useState<"songs" | "collections">();
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLink, setBusyLink] = useState("");
  const [searchError, setSearchError] = useState("");
  const [preview, setPreview] = useState<Song>();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const searchController = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const remoteLock = useRef(false);
  const bulkCancelled = useRef(false);
  useEffect(() => {
    void Promise.resolve(useLibrary.persist.rehydrate()).then(() => {
      setReadFailed(Boolean(useStorageError.getState().error));
      setReady(true);
    });
    const handler = (e: StorageEvent) => {
      if (e.key === "campchords-library-v1")
        void useLibrary.persist.rehydrate();
    };
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("storage", handler);
      searchController.current?.abort();
      bulkCancelled.current = true;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab, selected, preview?._id, collection]);
  function navigate(next: Tab) {
    setTab(next);
    setSelected(undefined);
    setPreview(undefined);
    setCollection(undefined);
    setFilter("");
    setTag("");
  }
  const currentCollection = store.collections.find((c) => c._id === collection);
  const tags = useMemo(
    () => [...new Set(store.songs.flatMap((s) => s.tags))].sort(),
    [store.songs],
  );
  const songs = useMemo(
    () =>
      store.songs
        .filter(
          (s) =>
            (tab !== "favorites" || s.isFavorite) &&
            (!collection || s.collections.includes(collection)) &&
            (!tag || s.tags.includes(tag)) &&
            `${s.title} ${s.author ?? ""} ${s.tags.join(" ")} ${s.number ?? ""}`
              .toLocaleLowerCase()
              .includes(filter.toLocaleLowerCase()),
        )
        .sort((a, b) => {
          switch (store.settings.sort) {
            case "titleDesc":
              return b.title.localeCompare(a.title, "uk");
            case "authorAsc":
              return (a.author ?? "").localeCompare(b.author ?? "", "uk");
            case "authorDesc":
              return (b.author ?? "").localeCompare(a.author ?? "", "uk");
            case "dateCreatedDesc":
              return Date.parse(b.createdAt) - Date.parse(a.createdAt);
            case "dateCreatedAsc":
              return Date.parse(a.createdAt) - Date.parse(b.createdAt);
            case "favoriteFirst":
              return (
                Number(b.isFavorite) - Number(a.isFavorite) ||
                a.title.localeCompare(b.title, "uk")
              );
            default:
              return a.title.localeCompare(b.title, "uk");
          }
        }),
    [store.songs, store.settings.sort, tab, collection, filter, tag],
  );
  const collections = [...store.collections]
    .filter((c) => c.title.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) =>
      store.settings.collectionSort === "alphabetical"
        ? a.title.localeCompare(b.title, "uk")
        : store.settings.collectionSort === "songCount"
          ? store.songs.filter((s) => s.collections.includes(b._id)).length -
            store.songs.filter((s) => s.collections.includes(a._id)).length
          : a.sortOrder - b.sortOrder,
    );
  const activeSong = preview ?? store.songs.find((s) => s._id === selected);
  async function runSearch(text: string, nextPage = 1) {
    if (!text.trim()) return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const id = ++requestId.current;
    setBusy(true);
    setSearchError("");
    if (nextPage === 1) {
      setResults([]);
      setMore(false);
      setSubmittedQuery(text.trim());
    }
    try {
      const data = await searchSongs(text.trim(), nextPage, controller.signal);
      if (id !== requestId.current) return;
      setResults((old) =>
        nextPage === 1
          ? data
          : [
              ...old,
              ...data.filter((x) => !old.some((y) => y.link === x.link)),
            ],
      );
      setPage(nextPage);
      setMore(data.length > 0);
      store.rememberQuery(text.trim());
    } catch (e) {
      if (id === requestId.current && !controller.signal.aborted)
        setSearchError((e as Error).message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  async function openRemote(result: SearchResult, save: boolean) {
    if (remoteLock.current) return;
    remoteLock.current = true;
    setBusyLink(result.link);
    try {
      const song = await fetchSong(result.link);
      if (save) {
        if (isDuplicate(useLibrary.getState().songs, song as SearchResult))
          setNotice("Ця пісня вже є у бібліотеці.");
        else {
          store.saveSong(song);
          setNotice("Пісню збережено у бібліотеці.");
        }
      } else setPreview(song);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      remoteLock.current = false;
      setBusyLink("");
    }
  }
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024)
        throw new Error("Файл перевищує 15 МБ.");
      const library = parseLibrary(JSON.parse(await file.text()));
      const count = store.importLibrary(library);
      setNotice(
        `Імпортовано ${count.songs} пісень і ${count.collections} колекцій. Наявні ID пропущено.`,
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function editCollection(c: Collection | "new") {
    setCollectionEdit(c);
    setCollectionName(c === "new" ? "" : c.title);
  }
  function saveCollection() {
    if (!collectionName.trim()) return;
    const now = new Date().toISOString();
    store.saveCollection(
      collectionEdit === "new"
        ? {
            _id: objectId(),
            userId: "anonymous",
            title: collectionName.trim(),
            createdAt: now,
            updatedAt: now,
            isPrivate: true,
            sortOrder:
              Math.max(-1, ...store.collections.map((c) => c.sortOrder)) + 1,
          }
        : { ...collectionEdit!, title: collectionName.trim() },
    );
    setCollectionEdit(undefined);
  }
  function reorder(c: Collection, direction: number) {
    const ordered = [...store.collections].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const index = ordered.findIndex((x) => x._id === c._id);
    const next = index + direction;
    if (next < 0 || next >= ordered.length) return;
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    store.reorderCollections(ordered.map((x) => x._id));
  }
  async function matchVideos() {
    bulkCancelled.current = false;
    setBulkBusy(true);
    const candidates = store.songs.filter((s) => !s.youtubeVideoID);
    let matched = 0;
    try {
      for (let i = 0; i < candidates.length && !bulkCancelled.current; i++) {
        setBulkProgress(`${i + 1} / ${candidates.length}`);
        const song = candidates[i];
        const data = await searchVideos(`${song.title} ${song.author ?? ""}`);
        const live = useLibrary
          .getState()
          .songs.find((s) => s._id === song._id);
        if (
          !bulkCancelled.current &&
          live &&
          !live.youtubeVideoID &&
          data.items[0]
        ) {
          store.saveSong({ ...live, youtubeVideoID: data.items[0].videoId });
          matched++;
        }
      }
      setNotice(`Додано відео до ${matched} пісень.`);
    } catch (e) {
      setNotice(`${(e as Error).message} Додано: ${matched}.`);
    } finally {
      setBulkBusy(false);
      setBulkProgress("");
    }
  }
  if (!ready)
    return (
      <div className="loading">
        <Flame size={36} />
        <p>Відкриваю твій пісенник…</p>
      </div>
    );
  if (readFailed)
    return (
      <main className="recovery">
        <h1>Бібліотеку не вдалося прочитати</h1>
        <p>{storageError}</p>
        <button
          className="primary"
          onClick={() =>
            download(
              localStorage.getItem("campchords-library-v1") ?? "{}",
              "CampChords_Storage_Backup.json",
            )
          }
        >
          Завантажити резервну копію сховища
        </button>
        <p>
          Після виправлення файлу віднови ключ campchords-library-v1 через
          інструменти браузера й перезавантаж сторінку.
        </p>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="CampChords">
          <span className="brand-icon">
            <Flame size={26} />
          </span>
          <span>
            CampChords<small>ПІСНІ, ЩО ОБ’ЄДНУЮТЬ</small>
          </span>
        </a>
        <nav aria-label="Основна навігація">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={20} />
              <span>{n.title}</span>
              {n.id === "library" && <small>{store.songs.length}</small>}
              {n.id === "favorites" && (
                <small>{store.songs.filter((s) => s.isFavorite).length}</small>
              )}
            </button>
          ))}
        </nav>
        <section className="sidebar-note">
          <Guitar size={28} />
          <p>
            Твоя музика.
            <br />
            Завжди поруч.
          </p>
          <span>
            Зберігай пісні, збирай друзів
            <br />і просто грай.
          </span>
        </section>
        <footer>
          <span className="local-dot" />
          Збережено в цьому браузері
        </footer>
      </aside>
      <main className="main">
        <div className="topbar">
          <span>ТВОЄ МІСЦЕ ДЛЯ МУЗИКИ</span>
          <button
            onClick={() => {
              setTab("settings");
              setSelected(undefined);
              setPreview(undefined);
            }}
          >
            <Upload size={16} />
            Імпорт / експорт
          </button>
        </div>
        {storageError && (
          <div className="error storage-error" role="alert">
            {storageError}
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <button
              className="icon-button"
              onClick={() => setNotice("")}
              aria-label="Закрити повідомлення"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {activeSong ? (
          <SongDetail
            key={activeSong._id}
            song={activeSong}
            songs={preview ? [] : songs}
            preview={Boolean(preview)}
            onBack={() => {
              setSelected(undefined);
              setPreview(undefined);
            }}
            onSelect={setSelected}
            onEdit={() => setEditing(activeSong)}
            onSave={() => {
              if (isDuplicate(store.songs, activeSong as SearchResult))
                setNotice("Ця пісня вже є у бібліотеці.");
              else {
                store.saveSong(activeSong);
                setPreview(undefined);
                setSelected(activeSong._id);
                setNotice("Пісню збережено.");
              }
            }}
            notify={setNotice}
          />
        ) : (
          <>
            {tab === "tuner" ? (
              <Tuner />
            ) : tab === "settings" ? (
              <section>
                <p className="eyebrow">НАЛАШТУЙ ПІД СЕБЕ</p>
                <h1>Твій пісенник</h1>
                <p className="intro">
                  Зручність під час гри та резервна копія твоєї музики.
                </p>
                <div className="settings-card">
                  <h2>Режим виконавця</h2>
                  <label className="setting-row">
                    <span>
                      Транспонування та розмір тексту
                      <small>Зміни тональність під свій голос.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={store.settings.performer}
                      onChange={(e) =>
                        store.setSettings({ performer: e.target.checked })
                      }
                    />
                  </label>
                </div>
                <div className="settings-card">
                  <h2>Імпорт та експорт</h2>
                  <p className="muted">
                    Той самий JSON, що й у CampChords для iOS. Імпорт додає
                    записи, пропускаючи наявні ID.
                  </p>
                  <div className="detail-actions">
                    <button
                      className="primary"
                      onClick={() =>
                        download(
                          serializeLibrary(store),
                          `CampChords_Library_${new Date().toISOString()}.json`,
                        )
                      }
                    >
                      <Download size={18} />
                      Експортувати JSON
                    </button>
                    <button onClick={() => input.current?.click()}>
                      <Upload size={18} />
                      Імпортувати JSON
                    </button>
                  </div>
                  <p className="hint">
                    {store.songs.length} пісень · {store.collections.length}{" "}
                    колекцій. Дані зберігаються лише в цьому браузері. Регулярно
                    роби резервну копію.
                  </p>
                </div>
                <div className="settings-card">
                  <h2>Відео до пісень</h2>
                  <p className="muted">
                    Автоматичний підбір першого результату YouTube для пісень
                    без відео. Результати можна змінити в пісні.
                  </p>
                  <button
                    disabled={
                      bulkBusy || store.songs.every((s) => s.youtubeVideoID)
                    }
                    onClick={matchVideos}
                  >
                    Підібрати відео {bulkProgress}
                  </button>
                  {bulkBusy && (
                    <button
                      onClick={() => {
                        bulkCancelled.current = true;
                      }}
                    >
                      Зупинити
                    </button>
                  )}
                </div>
                <div className="settings-card">
                  <h2>Керування бібліотекою</h2>
                  <div className="detail-actions">
                    <button
                      className="danger-outline"
                      disabled={!store.songs.length}
                      onClick={() => setConfirmClear("songs")}
                    >
                      Видалити всі пісні
                    </button>
                    <button
                      className="danger-outline"
                      disabled={!store.collections.length}
                      onClick={() => setConfirmClear("collections")}
                    >
                      Видалити всі колекції
                    </button>
                  </div>
                </div>
              </section>
            ) : tab === "search" ? (
              <section>
                <p className="eyebrow">НАСТУПНА ПІСНЯ ВЖЕ ЧЕКАЄ</p>
                <h1>Знайди свої акорди</h1>
                <p className="intro">
                  Шукай пісню, переглядай акорди й додавай у свій пісенник.
                </p>
                <form
                  className="online-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runSearch(query);
                  }}
                >
                  <Search size={22} />
                  <input
                    aria-label="Пошук акордів онлайн"
                    placeholder="Назва пісні або виконавець"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button className="primary" disabled={busy || !query.trim()}>
                    {busy ? "Шукаю…" : "Знайти акорди"}
                  </button>
                </form>
                {store.recentQueries.length > 0 && (
                  <div className="recent">
                    <span>Нещодавно:</span>
                    {store.recentQueries.map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setQuery(q);
                          void runSearch(q);
                        }}
                      >
                        {q}
                      </button>
                    ))}
                    <button
                      className="icon-button"
                      aria-label="Очистити історію пошуку"
                      onClick={store.clearRecent}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {searchError && (
                  <p className="error" role="alert">
                    {searchError}
                  </p>
                )}
                {submittedQuery && (
                  <div className="list-label">
                    РЕЗУЛЬТАТИ ПОШУКУ <span>{results.length}</span>
                  </div>
                )}
                <div className="song-list">
                  {results.map((r) => {
                    const saved = isDuplicate(store.songs, r);
                    return (
                      <div className="song-row" key={r.link}>
                        <span className="song-icon">
                          <Music2 size={21} />
                        </span>
                        <button
                          className="song-title"
                          disabled={Boolean(busyLink)}
                          onClick={() => openRemote(r, false)}
                        >
                          <strong>{r.title}</strong>
                          <small>{r.author}</small>
                        </button>
                        <button
                          className={saved ? "selected" : ""}
                          disabled={saved || Boolean(busyLink)}
                          onClick={() => openRemote(r, true)}
                        >
                          {saved ? <Check size={18} /> : <Plus size={18} />}
                          {saved
                            ? "Збережено"
                            : busyLink === r.link
                              ? "Завантажую…"
                              : "Зберегти"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {more && (
                  <button
                    className="load-more"
                    disabled={busy}
                    onClick={() => runSearch(submittedQuery, page + 1)}
                  >
                    {busy ? "Завантажую…" : "Показати ще"}
                  </button>
                )}
                {submittedQuery && !busy && !results.length && !searchError && (
                  <Empty
                    title="Поки нічого не знайдено"
                    text="Спробуй іншу назву або ім’я виконавця."
                  />
                )}
                {!submittedQuery && (
                  <Empty
                    title="Кожна зустріч починається з пісні"
                    text="Знайди акорди улюбленої пісні — і нехай вона завжди буде під рукою."
                  />
                )}
              </section>
            ) : (
              <section>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">
                      {collection
                        ? "ТВОЯ КОЛЕКЦІЯ"
                        : tab === "favorites"
                          ? "НАЙБЛИЖЧЕ ДО СЕРЦЯ"
                          : tab === "collections"
                            ? "ДЛЯ КОЖНОГО МОМЕНТУ"
                            : "ЗБИРАЙ. ЗБЕРІГАЙ. ГРАЙ."}
                    </p>
                    <h1>
                      {currentCollection?.title ??
                        (tab === "favorites"
                          ? "Улюблені пісні"
                          : tab === "collections"
                            ? "Твої колекції"
                            : "Твоя музика, поруч.")}
                    </h1>
                    <p className="intro">
                      {collection
                        ? "Пісні, які звучать разом."
                        : tab === "collections"
                          ? "Для вечора біля вогнища, репетиції чи наступного виступу."
                          : "Усі твої акорди в одному затишному місці."}
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      tab === "collections" && !collection
                        ? editCollection("new")
                        : setEditing("new")
                    }
                  >
                    <Plus size={19} />
                    {tab === "collections" && !collection
                      ? "Нова колекція"
                      : "Додати пісню"}
                  </button>
                </div>
                {collection && (
                  <div className="detail-actions">
                    <button
                      onClick={() => {
                        setCollection(undefined);
                        setFilter("");
                      }}
                    >
                      ← Усі колекції
                    </button>
                    <button onClick={() => setManageMembers(true)}>
                      <Folder size={17} />
                      Додати / прибрати пісні
                    </button>
                  </div>
                )}
                {tab === "library" && !filter && !tag && (
                  <div className="welcome-card">
                    <div>
                      <span className="eyebrow">МУЗИКА СТАЄ БЛИЖЧОЮ</span>
                      <h2>Що зіграємо сьогодні?</h2>
                      <p>Знайди нову пісню або повернись до улюбленої.</p>
                      <button onClick={() => navigate("search")}>
                        Знайти акорди <ChevronRight size={18} />
                      </button>
                    </div>
                    <div className="welcome-art" aria-hidden="true">
                      <Guitar size={110} strokeWidth={1} />
                      <span>♪</span>
                      <i>♫</i>
                    </div>
                  </div>
                )}
                <div className="library-controls">
                  <div className="filter-input">
                    <Search size={18} />
                    <input
                      aria-label="Пошук у бібліотеці"
                      placeholder={
                        tab === "collections" && !collection
                          ? "Знайти колекцію…"
                          : "Знайти у своїх піснях…"
                      }
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                    {filter && (
                      <button
                        className="icon-button"
                        aria-label="Очистити пошук"
                        onClick={() => setFilter("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  {tab === "collections" && !collection ? (
                    <select
                      aria-label="Сортування колекцій"
                      value={store.settings.collectionSort}
                      onChange={(e) =>
                        store.setSettings({ collectionSort: e.target.value })
                      }
                    >
                      <option value="custom">Власний порядок</option>
                      <option value="alphabetical">За назвою</option>
                      <option value="songCount">За кількістю пісень</option>
                    </select>
                  ) : (
                    <>
                      <select
                        aria-label="Фільтр тегів"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                      >
                        <option value="">Усі теги</option>
                        {tags.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Сортування пісень"
                        value={store.settings.sort}
                        onChange={(e) =>
                          store.setSettings({ sort: e.target.value })
                        }
                      >
                        {Object.entries(sortOptions).map(([value, title]) => (
                          <option key={value} value={value}>
                            {title}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                {tab === "collections" && !collection ? (
                  <>
                    <div className="list-label">
                      КОЛЕКЦІЇ <span>{collections.length}</span>
                    </div>
                    <div className="collection-grid">
                      {collections.map((c, i) => (
                        <div className="collection-card" key={c._id}>
                          <button
                            className="collection-main"
                            onClick={() => {
                              setCollection(c._id);
                              setFilter("");
                            }}
                          >
                            <span className="folder-icon">
                              <Folder size={26} />
                            </span>
                            <h2>{c.title}</h2>
                            <p>
                              {
                                store.songs.filter((s) =>
                                  s.collections.includes(c._id),
                                ).length
                              }{" "}
                              пісень
                            </p>
                          </button>
                          <div className="collection-actions">
                            <button
                              className="icon-button"
                              aria-label={`Перейменувати ${c.title}`}
                              onClick={() => editCollection(c)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Видалити ${c.title}`}
                              onClick={() => setCollectionDelete(c)}
                            >
                              <Trash2 size={16} />
                            </button>
                            {store.settings.collectionSort === "custom" &&
                              !filter && (
                                <>
                                  <button
                                    className="icon-button"
                                    disabled={i === 0}
                                    aria-label={`Перемістити ${c.title} вгору`}
                                    onClick={() => reorder(c, -1)}
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                  <button
                                    className="icon-button"
                                    disabled={i === collections.length - 1}
                                    aria-label={`Перемістити ${c.title} вниз`}
                                    onClick={() => reorder(c, 1)}
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                </>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!collections.length && (
                      <Empty
                        title={
                          filter
                            ? "Колекцій не знайдено"
                            : "Збери пісні для особливого моменту"
                        }
                        text="Створи колекцію та додай до неї пісні зі своєї бібліотеки."
                      />
                    )}
                  </>
                ) : (
                  <>
                    <div className="list-label">
                      {tab === "favorites" ? "ОБРАНЕ" : "ПІСНІ"}{" "}
                      <span>{songs.length}</span>
                    </div>
                    <div className="song-list">
                      {songs.map((s, i) => (
                        <div className="song-row" key={s._id}>
                          <span className="row-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="song-icon">
                            <Music2 size={21} />
                          </span>
                          <button
                            className="song-title"
                            onClick={() => setSelected(s._id)}
                          >
                            <strong>{s.title}</strong>
                            <small>{s.author || "Без автора"}</small>
                          </button>
                          <div className="row-tags">
                            {s.tags.slice(0, 2).map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <button
                            className={`icon-button favorite ${s.isFavorite ? "selected" : ""}`}
                            aria-label={
                              s.isFavorite
                                ? `Прибрати ${s.title} з обраного`
                                : `Додати ${s.title} в обране`
                            }
                            onClick={() =>
                              store.saveSong({
                                ...s,
                                isFavorite: !s.isFavorite,
                              })
                            }
                          >
                            <Star
                              size={19}
                              fill={s.isFavorite ? "currentColor" : "none"}
                            />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Відкрити ${s.title}`}
                            onClick={() => setSelected(s._id)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {!songs.length && (
                      <Empty
                        title={
                          filter || tag
                            ? "Пісень не знайдено"
                            : tab === "favorites"
                              ? "Тут житимуть твої улюблені"
                              : collection
                                ? "Додай першу пісню до колекції"
                                : "Твій пісенник починається тут"
                        }
                        text={
                          tab === "favorites"
                            ? "Натисни зірочку біля пісні, щоб додати її в обране."
                            : "Знайди акорди онлайн, додай власну пісню або імпортуй бібліотеку з iOS."
                        }
                      >
                        {tab === "library" && (
                          <div className="detail-actions">
                            <button
                              className="primary"
                              onClick={() => navigate("search")}
                            >
                              <Search size={18} />
                              Знайти акорди
                            </button>
                            <button onClick={() => input.current?.click()}>
                              <Upload size={18} />
                              Імпорт з iOS
                            </button>
                          </div>
                        )}
                      </Empty>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
        <footer className="main-footer">
          <span>CampChords · Музика для теплих моментів</span>
          <span>Зроблено для тих, хто грає ♡</span>
        </footer>
        <input
          hidden
          ref={input}
          type="file"
          accept=".json,application/json"
          onChange={importFile}
        />
      </main>
      {editing && (
        <SongEditor
          song={editing === "new" ? undefined : editing}
          collectionID={collection}
          onClose={() => setEditing(undefined)}
        />
      )}
      {collectionEdit && (
        <Modal
          title={
            collectionEdit === "new"
              ? "Нова колекція"
              : "Перейменувати колекцію"
          }
          onClose={() => setCollectionEdit(undefined)}
        >
          <form
            className="editor"
            onSubmit={(e) => {
              e.preventDefault();
              saveCollection();
            }}
          >
            <label>
              Назва
              <input
                required
                autoFocus
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Наприклад, Біля вогнища"
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => setCollectionEdit(undefined)}
              >
                Скасувати
              </button>
              <button className="primary" disabled={!collectionName.trim()}>
                Зберегти
              </button>
            </div>
          </form>
        </Modal>
      )}
      {collectionDelete && (
        <Modal
          title="Видалити колекцію?"
          onClose={() => setCollectionDelete(undefined)}
        >
          <p>
            «{collectionDelete.title}» буде видалено. Пісні залишаться у
            бібліотеці.
          </p>
          <div className="form-actions">
            <button onClick={() => setCollectionDelete(undefined)}>
              Скасувати
            </button>
            <button
              className="danger"
              onClick={() => {
                store.deleteCollection(collectionDelete._id);
                setCollectionDelete(undefined);
              }}
            >
              Видалити
            </button>
          </div>
        </Modal>
      )}
      {manageMembers && currentCollection && (
        <Modal
          title={`Пісні: ${currentCollection.title}`}
          onClose={() => setManageMembers(false)}
        >
          <div className="collection-checks">
            {store.songs.length === 0 && (
              <p>Спочатку додай пісні в бібліотеку.</p>
            )}
            {store.songs.map((s) => (
              <label key={s._id}>
                <input
                  type="checkbox"
                  checked={s.collections.includes(currentCollection._id)}
                  onChange={(e) =>
                    store.saveSong({
                      ...s,
                      collections: e.target.checked
                        ? [...s.collections, currentCollection._id]
                        : s.collections.filter(
                            (id) => id !== currentCollection._id,
                          ),
                    })
                  }
                />
                <span>
                  {s.title}
                  <small>{s.author}</small>
                </span>
              </label>
            ))}
          </div>
          <button className="primary" onClick={() => setManageMembers(false)}>
            Готово
          </button>
        </Modal>
      )}
      {confirmClear && (
        <Modal
          title={
            confirmClear === "songs"
              ? "Видалити всі пісні?"
              : "Видалити всі колекції?"
          }
          onClose={() => setConfirmClear(undefined)}
        >
          <p>
            {confirmClear === "songs"
              ? `Буде видалено ${store.songs.length} пісень з усієї бібліотеки.`
              : `Буде видалено ${store.collections.length} колекцій. Пісні залишаться.`}{" "}
            Спочатку збережи JSON, якщо потрібна резервна копія.
          </p>
          <div className="form-actions">
            <button
              onClick={() =>
                download(serializeLibrary(store), "CampChords_Backup.json")
              }
            >
              Експортувати копію
            </button>
            <button onClick={() => setConfirmClear(undefined)}>
              Скасувати
            </button>
            <button
              className="danger"
              onClick={() => {
                if (confirmClear === "songs") store.clearSongs();
                else store.clearCollections();
                setConfirmClear(undefined);
              }}
            >
              Видалити
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Music2 size={32} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
