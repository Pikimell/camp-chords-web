"use client";
import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";
import {
  type Song,
  type Collection,
  type Library,
  mergeLibrary,
  parseLibrary,
} from "./library";
export interface Settings {
  performer: boolean;
  fontSize: number;
  sort: string;
  collectionSort: string;
}
interface State extends Library {
  settings: Settings;
  recentQueries: string[];
  saveSong: (song: Song) => void;
  deleteSong: (id: string) => void;
  saveCollection: (collection: Collection) => void;
  deleteCollection: (id: string) => void;
  reorderCollections: (ids: string[]) => void;
  importLibrary: (library: Library) => { songs: number; collections: number };
  setSettings: (settings: Partial<Settings>) => void;
  rememberQuery: (query: string) => void;
  clearRecent: () => void;
  clearSongs: () => void;
  clearCollections: () => void;
}
const defaults: Settings = {
  performer: true,
  fontSize: 18,
  sort: "titleAsc",
  collectionSort: "custom",
};
export const useStorageError = create<{
  error: string;
  set: (error: string) => void;
}>((set) => ({ error: "", set: (error) => set({ error }) }));
const storage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      useStorageError.getState().set("");
    } catch {
      useStorageError
        .getState()
        .set(
          "Не вдалося зберегти дані у браузері. Експортуй бібліотеку, перш ніж закривати сторінку.",
        );
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};
export const useLibrary = create<State>()(
  persist(
    (set, get) => ({
      songs: [],
      collections: [],
      settings: defaults,
      recentQueries: [],
      saveSong: (song) =>
        set((s) => ({
          songs: s.songs.some((x) => x._id === song._id)
            ? s.songs.map((x) =>
                x._id === song._id
                  ? { ...song, updatedAt: new Date().toISOString() }
                  : x,
              )
            : [...s.songs, song],
        })),
      deleteSong: (id) =>
        set((s) => ({ songs: s.songs.filter((x) => x._id !== id) })),
      saveCollection: (collection) =>
        set((s) => ({
          collections: s.collections.some((x) => x._id === collection._id)
            ? s.collections.map((x) =>
                x._id === collection._id
                  ? { ...collection, updatedAt: new Date().toISOString() }
                  : x,
              )
            : [...s.collections, collection],
        })),
      deleteCollection: (id) =>
        set((s) => ({
          collections: s.collections.filter((x) => x._id !== id),
          songs: s.songs.map((x) =>
            x.collections.includes(id)
              ? {
                  ...x,
                  collections: x.collections.filter((c) => c !== id),
                  updatedAt: new Date().toISOString(),
                }
              : x,
          ),
        })),
      reorderCollections: (ids) =>
        set((s) => ({
          collections: s.collections.map((c) => ({
            ...c,
            sortOrder: ids.indexOf(c._id),
            updatedAt: new Date().toISOString(),
          })),
        })),
      importLibrary: (input) => {
        const incoming = parseLibrary(input);
        const before = get();
        const merged = mergeLibrary(before, incoming);
        set(merged);
        return {
          songs: merged.songs.length - before.songs.length,
          collections: merged.collections.length - before.collections.length,
        };
      },
      setSettings: (settings) =>
        set((s) => ({ settings: { ...s.settings, ...settings } })),
      rememberQuery: (query) =>
        set((s) => ({
          recentQueries: [
            query,
            ...s.recentQueries.filter(
              (x) => x.toLowerCase() !== query.toLowerCase(),
            ),
          ].slice(0, 8),
        })),
      clearRecent: () => set({ recentQueries: [] }),
      clearSongs: () => set({ songs: [] }),
      clearCollections: () =>
        set((s) => ({
          collections: [],
          songs: s.songs.map((x) => ({
            ...x,
            collections: [],
            updatedAt: new Date().toISOString(),
          })),
        })),
    }),
    {
      name: "campchords-library-v1",
      storage: createJSONStorage(() => storage),
      skipHydration: true,
      partialize: (s) => ({
        songs: s.songs,
        collections: s.collections,
        settings: s.settings,
        recentQueries: s.recentQueries,
      }),
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const saved = persisted as Partial<State>;
        const library = parseLibrary(saved);
        const settings = saved.settings;
        return {
          ...current,
          ...library,
          settings: {
            ...defaults,
            performer:
              typeof settings?.performer === "boolean"
                ? settings.performer
                : defaults.performer,
            fontSize: Number.isFinite(settings?.fontSize)
              ? Math.max(12, Math.min(32, settings!.fontSize))
              : 18,
            sort: settings?.sort ?? defaults.sort,
            collectionSort: settings?.collectionSort ?? "custom",
          },
          recentQueries: Array.isArray(saved.recentQueries)
            ? saved.recentQueries
                .filter((x) => typeof x === "string")
                .slice(0, 8)
            : [],
        };
      },
      onRehydrateStorage: () => (_, error) => {
        if (error)
          useStorageError
            .getState()
            .set(
              "Не вдалося прочитати бібліотеку. Дані у сховищі залишено без змін; зроби резервну копію перед редагуванням.",
            );
      },
    },
  ),
);
