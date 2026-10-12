import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseLibrary,
  mergeLibrary,
  serializeLibrary,
  newSong,
  videoId,
} from "../src/lib/library";
import { transpose, renderContent } from "../src/lib/chords";
import { JSDOM } from "jsdom";
import { detectPitch } from "../src/components/tuner";
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/ios-library.json", import.meta.url), "utf8"),
);
test("real iOS fixture roundtrip preserves all fields and memberships", () => {
  const library = parseLibrary(fixture);
  assert.ok(library.songs.length > 0);
  assert.deepEqual(
    parseLibrary(JSON.parse(serializeLibrary(library))),
    library,
  );
  const ids = new Set(library.collections.map((c) => c._id));
  assert.ok(library.songs.every((s) => s.collections.every((c) => ids.has(c))));
});
test("additive import skips existing IDs without overwriting edits", () => {
  const library = parseLibrary(fixture);
  const edited = { ...library.songs[0], title: "Local edit" };
  const merged = mergeLibrary(
    { songs: [edited], collections: library.collections },
    library,
  );
  assert.equal(merged.songs.length, library.songs.length);
  assert.equal(merged.songs[0].title, "Local edit");
  assert.equal(merged.collections.length, library.collections.length);
});
test("invalid later record rejects the entire import", () => {
  const bad = structuredClone(fixture);
  bad.songs[bad.songs.length - 1]._id = "uuid-not-an-objectid";
  assert.throws(() => parseLibrary(bad), /ObjectId/);
});
test("legacy defaults match iOS and new IDs are Realm-compatible", () => {
  const s = newSong({ title: "Test", content: "C" });
  assert.match(s._id, /^[a-f0-9]{24}$/);
  const library = parseLibrary({
    songs: [
      {
        _id: s._id,
        title: s.title,
        content: s.content,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      },
    ],
    collections: [],
  });
  assert.equal(library.songs[0].userId, "anonymous");
  assert.equal(library.songs[0].isPrivate, true);
  assert.deepEqual(library.songs[0].tags, []);
});
test("slash bass, enharmonics, large positive and negative transposition", () => {
  assert.equal(transpose("Bbmaj7/D", 2), "Cmaj7/E");
  assert.equal(transpose("C", -25), "B");
  assert.equal(transpose("F#m", 24), "F#m");
});
test("unsafe HTML is removed while chords and whitespace survive", () => {
  const dom = new JSDOM();
  Object.assign(globalThis, {
    DOMParser: dom.window.DOMParser,
    Node: dom.window.Node,
    Element: dom.window.Element,
  });
  const html = renderContent(
    '<script>alert(1)</script><img onerror="alert(1)"><span onclick="alert(1)" class="podbor__chord">Am</span>  text<br>G/B',
    2,
  );
  assert.equal(
    html,
    '<span class="chord">Bm</span>  text\n<span class="chord">A/C#</span>',
  );
});
test("YouTube parsing rejects unrelated hosts and handles shorts", () => {
  assert.equal(videoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(
    videoId("https://youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(videoId("https://evil.test/?v=dQw4w9WgXcQ"), undefined);
});
test("tuner detects guitar strings and ignores silence", () => {
  const rate = 48000;
  for (const hz of [82.41, 110, 146.83, 196, 246.94, 329.63]) {
    const wave = Float32Array.from(
      { length: 4096 },
      (_, i) => 0.4 * Math.sin((2 * Math.PI * hz * i) / rate),
    );
    const result = detectPitch(wave, rate);
    assert.ok(
      result && Math.abs(result - hz) < 1,
      `expected ${hz}, got ${result}`,
    );
  }
  assert.equal(detectPitch(new Float32Array(4096), rate), undefined);
});
