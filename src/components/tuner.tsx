"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
export function detectPitch(
  samples: Float32Array,
  rate: number,
): number | undefined {
  let rms = 0;
  for (const v of samples) rms += v * v;
  if (Math.sqrt(rms / samples.length) < 0.008) return;
  // Normalized autocorrelation: select the first strong local maximum to avoid octave errors.
  const min = Math.floor(rate / 1200),
    max = Math.min(Math.floor(rate / 60), samples.length / 2);
  const correlations: number[] = [];
  for (let lag = min; lag <= max; lag++) {
    let sum = 0,
      a = 0,
      b = 0;
    for (let i = 0; i < samples.length - max; i++) {
      sum += samples[i] * samples[i + lag];
      a += samples[i] ** 2;
      b += samples[i + lag] ** 2;
    }
    correlations[lag] = sum / Math.sqrt(a * b || 1);
  }
  for (let lag = min + 1; lag < max; lag++)
    if (
      correlations[lag] > 0.9 &&
      correlations[lag] > correlations[lag - 1] &&
      correlations[lag] >= correlations[lag + 1]
    ) {
      const a = correlations[lag - 1],
        b = correlations[lag],
        c = correlations[lag + 1];
      const offset = (a - c) / (2 * (a - 2 * b + c) || 1);
      return rate / (lag + offset);
    }
}
export function Tuner() {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [frequency, setFrequency] = useState<number>();
  const [error, setError] = useState("");
  const resources = useRef<{
    context?: AudioContext;
    stream?: MediaStream;
    frame?: number;
    cancelled: boolean;
  }>({ cancelled: false });
  const stop = () => {
    resources.current.cancelled = true;
    if (resources.current.frame) cancelAnimationFrame(resources.current.frame);
    resources.current.stream?.getTracks().forEach((t) => t.stop());
    void resources.current.context?.close();
    resources.current = { cancelled: true };
    setActive(false);
    setFrequency(undefined);
  };
  useEffect(
    () => () => {
      resources.current.cancelled = true;
      if (resources.current.frame)
        cancelAnimationFrame(resources.current.frame);
      resources.current.stream?.getTracks().forEach((t) => t.stop());
      void resources.current.context?.close();
    },
    [],
  );
  async function start() {
    setError("");
    setStarting(true);
    resources.current.cancelled = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Мікрофон доступний на localhost або через HTTPS.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (resources.current.cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const context = new AudioContext();
      resources.current.context = context;
      resources.current.stream = stream;
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      context.createMediaStreamSource(stream).connect(analyser);
      await context.resume();
      setActive(true);
      const samples = new Float32Array(analyser.fftSize);
      let last = 0;
      const tick = (time: number) => {
        if (resources.current.cancelled) return;
        if (time - last > 100) {
          analyser.getFloatTimeDomainData(samples);
          setFrequency(detectPitch(samples, context.sampleRate));
          last = time;
        }
        resources.current.frame = requestAnimationFrame(tick);
      };
      resources.current.frame = requestAnimationFrame(tick);
    } catch (e) {
      stop();
      setError(
        e instanceof Error && e.name !== "NotAllowedError"
          ? e.message
          : "Дозволь доступ до мікрофона для налаштування гітари.",
      );
    } finally {
      setStarting(false);
    }
  }
  const midi = frequency ? 69 + 12 * Math.log2(frequency / 440) : undefined;
  const cents =
    midi === undefined ? 0 : Math.round((midi - Math.round(midi)) * 100);
  const note =
    midi === undefined
      ? "—"
      : ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][
          ((Math.round(midi) % 12) + 12) % 12
        ];
  return (
    <section className="tuner-panel">
      <p className="eyebrow">ЗНАЙДИ СВОЄ ЗВУЧАННЯ</p>
      <h2>Гітарний тюнер</h2>
      <p className="muted">
        Зіграй одну відкриту струну. Стандартний стрій: E · A · D · G · B · E.
      </p>
      <div
        className={`tuner-note ${frequency && Math.abs(cents) <= 5 ? "in-tune" : ""}`}
      >
        {note}
        <small>
          {frequency
            ? `${frequency.toFixed(1)} Hz`
            : active
              ? "Слухаю…"
              : "Мікрофон вимкнений"}
        </small>
      </div>
      <div className="tuner-scale">
        <span>♭</span>
        <div>
          <i style={{ left: `${50 + cents}%` }} />
        </div>
        <span>♯</span>
      </div>
      <p>
        {frequency
          ? Math.abs(cents) <= 5
            ? "✓ Струна налаштована"
            : `${cents > 0 ? "Послаб струну" : "Натягни струну"} · ${cents > 0 ? "+" : ""}${cents} центів`
          : "Еталон: A4 = 440 Hz"}
      </p>
      <button
        className="primary"
        disabled={starting}
        onClick={active ? stop : start}
      >
        {active ? <Square size={18} /> : <Mic size={18} />}
        {active ? "Зупинити" : starting ? "Підключаю…" : "Увімкнути мікрофон"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="strings">
        {[
          "E2 · 82.41",
          "A2 · 110",
          "D3 · 146.83",
          "G3 · 196",
          "B3 · 246.94",
          "E4 · 329.63",
        ].map((s) => (
          <span key={s}>
            {s}
            <small>Hz</small>
          </span>
        ))}
      </div>
    </section>
  );
}
