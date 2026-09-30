import { useEffect, useRef, useState } from 'react';

// Voice input through the browser's Web Speech API. The browser's own
// speech service does the transcribing (in Chrome that is Google's servers;
// in Safari, Apple's), so nothing here reaches Gambit, but the audio does
// leave the device. Not every browser has it (Firefox doesn't), so callers
// check `dictationSupported()` and show nothing when it's missing.

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = () => recognitionCtor() !== null;

const MESSAGES: Record<string, string> = {
  'not-allowed': "The microphone is blocked for this page. Allow it in your browser's site settings to dictate.",
  'service-not-allowed': "This browser won't dictate here. Allow the microphone in its site settings, or type instead.",
  'audio-capture': 'No microphone found.',
  network: 'Dictation needs a connection in this browser.',
  'language-not-supported': "Dictation doesn't support your browser's language.",
};

/** Start and stop dictation into a piece of text. `onText` receives the
 * whole text each time the transcript moves: whatever was already there
 * when dictation started, then everything heard since, including words the
 * browser hasn't settled on yet. */
export function useDictation({ onText, onError }: { onText: (text: string) => void; onError: (message: string) => void }) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef({ onText, onError });
  cb.current = { onText, onError };

  function start(base: string) {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = navigator.language;
    r.continuous = true;
    r.interimResults = true;
    const prefix = base && !/\s$/.test(base) ? `${base} ` : base;
    r.onresult = (e) => {
      let heard = '';
      for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript;
      cb.current.onText(prefix + heard.replace(/\s+/g, ' ').trimStart());
    };
    r.onerror = (e) => {
      // Silence and our own abort end a session normally; say nothing.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      cb.current.onError(MESSAGES[e.error] ?? 'Dictation stopped unexpectedly.');
    };
    r.onend = () => { if (rec.current === r) rec.current = null; setListening(false); };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
    }
  }

  /** Stop listening, keeping what's been heard so far. */
  const stop = () => rec.current?.stop();
  /** Stop at once and drop anything not yet settled, so no late result
   * lands in the text after this. */
  const cancel = () => {
    const r = rec.current;
    rec.current = null;
    r?.abort();
    setListening(false);
  };

  useEffect(() => () => rec.current?.abort(), []);

  return { listening, start, stop, cancel };
}
