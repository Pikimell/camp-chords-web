import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { newSong, objectId } from "../src/lib/library";
const dom = new JSDOM("", { url: "http://localhost" });
Object.assign(globalThis, { localStorage: dom.window.localStorage });
const storeModule = import("../src/lib/store");
test("first launch works with absent storage, persistence restores data and deleting a collection cleans relationships", async () => {
  const { useLibrary, useStorageError } = await storeModule;
  await useLibrary.persist.rehydrate();
  assert.equal(useStorageError.getState().error, "");
  const id = objectId(),
    now = new Date().toISOString();
  useLibrary.getState().saveCollection({
    _id: id,
    title: "Test",
    userId: "anonymous",
    createdAt: now,
    updatedAt: now,
    isPrivate: true,
    sortOrder: 0,
  });
  const song = newSong({
    title: "Persistence",
    content: "Am",
    collections: [id],
    ton: -2,
  });
  useLibrary.getState().saveSong(song);
  const saved = JSON.parse(localStorage.getItem("campchords-library-v1")!);
  assert.equal(saved.state.songs[0].ton, -2);
  await useLibrary.persist.rehydrate();
  assert.equal(useLibrary.getState().songs[0]._id, song._id);
  useLibrary.getState().deleteCollection(id);
  assert.deepEqual(useLibrary.getState().songs[0].collections, []);
});
test("corrupt storage is reported without overwriting original bytes", async () => {
  const { useLibrary, useStorageError } = await storeModule;
  localStorage.setItem("campchords-library-v1", "{broken");
  await useLibrary.persist.rehydrate();
  assert.ok(useStorageError.getState().error);
  assert.equal(localStorage.getItem("campchords-library-v1"), "{broken");
});
