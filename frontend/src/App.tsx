import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Maximize, MessageSquareText, Play, Square, ZoomIn, ZoomOut } from 'lucide-react';
import type { CarState, ChatMessage, Intent, Toast } from './types';
import { SCENES } from './scenes';
import { initialCar, runIntents } from './state/car';
import { parseCommand, type NluContext, type ParseResult } from './nlu/parser';
import { carAudio } from './lib/audio';
import { engine } from './lib/engine';
import { speak, useSpeechRecognition } from './lib/speech';
import { BACKEND_DOMAIN, backend, recordAudio, toIntent, type BackendHealth } from './lib/backend';
import { Cockpit } from './components/Cockpit';
import type { VoicePhase } from './components/Infotainment';
import { VoiceDock } from './components/VoiceDock';
import { Transcript } from './components/Transcript';

const DOCK_HEIGHT = 128;
const THINK_MS = 420;

const NEXT_SCENE = { live: 'night', night: 'day', day: 'live' } as const;
const SCENE_LABEL = { live: 'Live view', night: 'Night photo', day: 'Day photo' } as const;

const DEMO_SCRIPT = [
  'Namaste Verna',
  'Gaadi start karo',
  'AC 20 pe kar do',
  'Garmi lag rahi hai',
  'Romantic gaane chalao',
  'Light gulabi kar do',
  'Light ko music ke saath sync karo',
  'Volume thoda badhao',
  'Baarish ho rahi hai',
  'Ghar le chalo',
  'Gear D mein daalo aur right indicator do',
  'Sport mode on karo',
  'Cruise 60 pe set karo',
  'Tyre pressure kitna hai?',
  'Wiper band karo aur music band kar do',
  'Cruise band karo',
];

let nextId = 1;

interface Routed {
  intents: Intent[];
  /** Backend reply for turns that change nothing (questions, refusals, saved shortcuts). */
  say?: string;
  engine: 'backend' | 'local';
  awaitingConfirm?: boolean;
}

// Both sides read the command the same way: keep the local intent, which carries richer
// slots (genre, exact level, mute, "feeling hot").
function agrees(local: Intent, remote: Intent) {
  const sign = (i: Intent) => ('delta' in i && i.delta ? Math.sign(i.delta) : 0);
  const flag = (i: Intent) => ('on' in i ? i.on : 'dir' in i ? i.dir : undefined);
  return local.type === remote.type && (sign(local) === 0 || sign(local) === sign(remote)) && flag(local) === flag(remote);
}

/**
 * Compound commands and anything outside the backend's whitelist (lights, gears, windows,
 * questions...) stay on the local parser. Single climate / media / navigation commands, and
 * anything the local parser missed (confirmations, personal shortcuts), go to the backend,
 * which also blocks negated requests ("AC band mat karo").
 */
// The local parser ignores negation, so a negated command must never reach it.
const NEGATION = /\b(?:don'?t|do not|never|mat|na karo|nahi?n? (?:karo|karna|chahiye))\b|मत|ना करो|नहीं करना/i;

async function route(text: string, parsed: ParseResult, online: boolean): Promise<Routed> {
  if (NEGATION.test(text)) {
    // The backend still sees it, e.g. "nahi chahiye" answering its pending question.
    const res = online ? await backend.text(text) : null;
    const refuse = parsed.lang === 'hi' ? 'Theek hai, nahi karunga.' : "Okay, I won't do that.";
    return { intents: [], say: res?.reason_code === 'cancelled_by_user' ? res.response_text : refuse, engine: res ? 'backend' : 'local' };
  }
  const local = parsed.intents;
  const localOnly = local.length > 1 || local.some((i) => !BACKEND_DOMAIN.has(i.type));
  if (!online || localOnly) return { intents: local, engine: 'local' };

  const res = await backend.text(text);
  if (res.decision === 'execute' && res.action) {
    const remote = toIntent(res.action);
    if (!remote) return { intents: local, engine: 'local' };
    const keepLocal = res.source === 'builtin' && local.length === 1 && agrees(local[0], remote);
    return { intents: [keepLocal ? local[0] : remote], engine: 'backend' };
  }
  if (res.decision === 'reject' && res.reason_code === 'unsupported_request' && local.length) {
    return { intents: local, engine: 'local' };
  }
  return {
    intents: [],
    say: res.response_text || "Sorry, I didn't catch that.",
    engine: 'backend',
    awaitingConfirm: res.decision === 'ask_confirmation',
  };
}

export default function App() {
  const [car, setCar] = useState<CarState>(initialCar);
  const carRef = useRef(car);
  const nlu = useRef<NluContext>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId++, role: 'car', text: 'Namaste! I am your Verna. Speak or type in English, Hindi or Hinglish.' },
  ]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [reply, setReply] = useState<{ text: string; intents: Intent[]; understood: boolean; engine?: Routed['engine'] } | null>(null);
  const [server, setServer] = useState<BackendHealth | null>(null);
  const serverRef = useRef(server);
  useEffect(() => { serverRef.current = server; }, [server]);
  const awaitingConfirm = useRef(false);
  // BhashaDrive's own recogniser when the backend has one; the browser's otherwise.
  const [asrMode, setAsrMode] = useState<'browser' | 'server'>('server');
  const [recording, setRecording] = useState<{ stop: () => Promise<Blob> } | null>(null);
  const [asrError, setAsrError] = useState<string | null>(null);
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [tts, setTts] = useState(true);
  const [showLog, setShowLog] = useState(() => window.innerWidth > 1100);
  const [demo, setDemo] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const ttsRef = useRef(tts);
  useEffect(() => { ttsRef.current = tts; }, [tts]);

  const commit = useCallback((next: CarState) => {
    carRef.current = next;
    setCar(next);
  }, []);

  const handleCommand = useCallback((text: string, via: ChatMessage['via']) => {
    carAudio.unlock();
    setMessages((m) => [...m, { id: nextId++, role: 'user', text, via }]);
    setPhase('thinking');
    const started = Date.now();
    const parsed = parseCommand(text, nlu.current);
    nlu.current = parsed.context;
    const online = serverRef.current !== null;

    const finish = ({ intents, say, engine: via, awaitingConfirm: awaiting }: Routed) => {
      awaitingConfirm.current = !!awaiting;
      const out = say
        ? { state: carRef.current, text: say, toast: undefined, understood: true }
        : runIntents(carRef.current, intents, parsed.lang, { speed: engine.speed });
      commit(out.state);
      if (out.state.ignition === 'on' && intents.some((i) => i.type === 'rev')) engine.blip(1300);
      if (out.toast) setToast({ ...out.toast, id: nextId++ });
      setMessages((m) => [...m, { id: nextId++, role: 'car', text: out.text, intents, engine: online ? via : undefined }]);
      setReply({ text: out.text, intents, understood: out.understood, engine: online ? via : undefined });
      carAudio.chime(out.understood ? 'ok' : 'error');
      if (ttsRef.current) {
        speak(out.text,
          () => { setPhase('speaking'); carAudio.duck(true); },
          () => { setPhase('idle'); carAudio.duck(false); });
        // Some browsers never fire onstart without voices; don't get stuck.
        window.setTimeout(() => setPhase((p) => (p === 'thinking' ? 'idle' : p)), 1500);
      } else {
        setPhase('idle');
      }
    };

    route(text, parsed, online)
      .catch((): Routed => {
        setServer(null); // backend went away: carry on with the local parser
        return { intents: parsed.intents, engine: 'local' };
      })
      // Typed commands get a short "thinking" beat; spoken ones already waited for speech recognition.
      .then((routed) => window.setTimeout(() => finish(routed), via === 'voice' ? 0 : Math.max(0, THINK_MS - (Date.now() - started))));
  }, [commit]);

  // Find the backend; recheck now and then so it can be started after the page.
  useEffect(() => {
    let first = true;
    const check = () => backend.health()
      .then((h) => {
        setServer(h);
        if (first) { first = false; void backend.reset().catch(() => {}); }
      })
      .catch(() => setServer(null));
    check();
    const t = window.setInterval(check, 15000);
    return () => window.clearInterval(t);
  }, []);

  // Touch controls on the virtual screen and dashboard skip the voice round-trip.
  const handleIntent = useCallback((intent: Intent) => {
    carAudio.unlock();
    const out = runIntents(carRef.current, [intent], 'en', { speed: engine.speed });
    commit(out.state);
    if (out.toast && intent.type !== 'screen') setToast({ ...out.toast, id: nextId++ });
  }, [commit]);

  const speechFailed = useRef<(code: string) => boolean>(() => false);
  const speech = useSpeechRecognition((text) => handleCommand(text, 'voice'), (code) => speechFailed.current(code));
  const serverAsr = !!server?.asr_ready;
  const useServerAsr = serverAsr && (asrMode === 'server' || !speech.supported);
  const micSupported = speech.supported || serverAsr;

  // Server speech recognition: record in the browser, transcribe on the backend (Whisper).
  const toggleServerMic = useCallback(async () => {
    if (recording) { void recording.stop(); return; } // the `done` handler below transcribes
    try {
      setAsrError(null);
      const r = await recordAudio();
      setRecording(r);
      // Ends on the mic button, on a pause after speech, or at the length limit.
      void r.done.then(async (audio) => {
        setRecording(null);
        setPhase('thinking');
        try {
          const t = await backend.transcribe(audio);
          if (t.text.trim()) handleCommand(t.text.trim(), 'voice');
          else { setPhase('idle'); setAsrError(t.error ?? 'No speech heard. Try again.'); }
        } catch {
          setPhase('idle');
          setAsrError('Server speech recognition failed');
        }
      });
    } catch {
      setAsrError('Microphone permission denied');
    }
  }, [recording, handleCommand]);

  // Chrome's recogniser streams audio to Google; when that fails ("network"), carry on with the
  // backend's Whisper for the rest of the session and keep listening, so the driver need not repeat the tap.
  useEffect(() => {
    speechFailed.current = (code) => {
      if ((code !== 'network' && code !== 'service-not-allowed') || !serverAsr) return false;
      setAsrMode('server');
      if (!recording) void toggleServerMic();
      return true;
    };
  }, [serverAsr, recording, toggleServerMic]);

  const toggleMic = useCallback(() => {
    carAudio.unlock();
    if (useServerAsr) {
      if (!recording) { window.speechSynthesis?.cancel(); carAudio.chime('listen'); }
      void toggleServerMic();
      return;
    }
    if (speech.listening) { speech.stop(); return; }
    window.speechSynthesis?.cancel();
    carAudio.chime('listen');
    speech.start(speechLang);
  }, [speech, speechLang, useServerAsr, recording, toggleServerMic]);

  // Engine and vehicle model follow the ignition, gear selector, drive mode, cruise and Auto Hold
  useEffect(() => { engine.setIgnition(car.ignition, car.driveMode === 'sport'); }, [car.ignition, car.driveMode]);
  useEffect(() => { engine.setDrive(car.gear, car.driveMode); }, [car.gear, car.driveMode]);
  useEffect(() => { engine.setCruise(car.adas.cruise); }, [car.adas.cruise]);
  useEffect(() => { engine.autoHold = car.autoHold; }, [car.autoHold]);
  // Touching the brake cancels Smart Cruise, as in the real car.
  useEffect(() => {
    engine.onCruiseCancel = () => handleIntent({ type: 'cruise', on: false });
    return () => { engine.onCruiseCancel = undefined; };
  }, [handleIntent]);

  // Hold ↑ or W to accelerate, ↓ or S to brake (when not typing)
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const isThrottle = (e: KeyboardEvent) => (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') && !typing(e);
    const isBrake = (e: KeyboardEvent) => (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') && !typing(e);
    const down = (e: KeyboardEvent) => {
      if (e.repeat || !(isThrottle(e) || isBrake(e))) return;
      e.preventDefault();
      carAudio.unlock();
      if (isBrake(e)) engine.setBrake(true);
      else engine.press();
    };
    const up = (e: KeyboardEvent) => {
      if (isThrottle(e)) engine.release();
      if (isBrake(e)) engine.setBrake(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Music engine follows the media state
  const m = car.media;
  useEffect(() => {
    if (m.playing) carAudio.play(m.genre, m.track, m.radio);
    else carAudio.stop();
  }, [m.playing, m.genre, m.track, m.radio]);
  useEffect(() => { carAudio.setVolume(m.muted ? 0 : m.volume / 30); }, [m.volume, m.muted]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Space = push to talk (when not typing)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.code === 'Space' && !typing && micSupported) { e.preventDefault(); toggleMic(); }
      if (e.key.toLowerCase() === 'z' && !typing) setFocused((f) => !f);
      if (e.key === '/' && !typing) { e.preventDefault(); document.querySelector<HTMLInputElement>('.bar input')?.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [toggleMic, micSupported]);

  // Guided demo: feed the next scripted line once the car has finished answering
  useEffect(() => {
    if (demo === null || phase !== 'idle') return;
    const done = demo >= DEMO_SCRIPT.length;
    const t = window.setTimeout(() => {
      if (done) { setDemo(null); return; }
      // The backend asks before acting on hints like "garmi lag rahi hai": say yes.
      if (awaitingConfirm.current) { handleCommand('Haan', 'chip'); return; }
      handleCommand(DEMO_SCRIPT[demo], 'chip');
      setDemo(demo + 1);
    }, done ? 0 : demo === 0 ? 300 : 1600);
    return () => window.clearTimeout(t);
  }, [demo, phase, handleCommand]);

  const scene = SCENES[car.scene];
  const livePhase: VoicePhase = speech.listening || recording ? 'listening' : phase;
  const nluBadge = server
    ? `BhashaDrive NLU${server.mock ? ' (mock)' : ''} · English · हिन्दी · Hinglish`
    : 'Offline NLU · English · हिन्दी · Hinglish';

  return (
    <div className={`app scene-${scene.id}`}>
      <Cockpit car={car} scene={scene} toast={toast} onIntent={handleIntent} reserveBottom={DOCK_HEIGHT}
        focused={focused} onToggleFocus={() => setFocused((f) => !f)} onMic={toggleMic}
        voice={{ phase: livePhase, interim: speech.interim, reply: reply?.text ?? '' }} />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">VERNA</span>
          <span className="brand-sub">Smart Cockpit <i>·</i> Voice AI</span>
        </div>
        <div className="top-actions">
          <span className={`badge ${server ? 'online' : ''}`}
            title={server ? `Backend connected: ${server.nlu} · ASR ${server.asr ?? 'none'}` : 'Backend not reachable: using the in-browser parser'}>{nluBadge}</span>
          <button className={demo !== null ? 'on' : ''} onClick={() => { carAudio.unlock(); setDemo(demo === null ? 0 : null); }}
            title="Run a guided demo">{demo !== null ? <Square /> : <Play />}<span>{demo !== null ? 'Stop demo' : 'Demo'}</span></button>
          <button onClick={() => handleIntent({ type: 'scene', scene: NEXT_SCENE[car.scene] })}
            title="Switch view: live drawn cockpit, night photo, day photo"><Layers /><span>{SCENE_LABEL[car.scene]}</span></button>
          <button className={focused ? 'on' : ''} onClick={() => setFocused(!focused)} title="Lean in to the screen (Z)">
            {focused ? <ZoomOut /> : <ZoomIn />}<span>{focused ? 'Cabin' : 'Screen'}</span></button>
          <button className={showLog ? 'on' : ''} onClick={() => setShowLog(!showLog)} title="Conversation log"><MessageSquareText /></button>
          <button onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())} title="Full screen"><Maximize /></button>
        </div>
      </header>

      {showLog && <Transcript messages={messages} onClose={() => setShowLog(false)} onClear={() => setMessages([])} />}

      <VoiceDock phase={livePhase} interim={speech.interim} reply={reply} supported={micSupported} error={speech.error ?? asrError}
        speechLang={speechLang} tts={tts} onLang={setSpeechLang} onTts={(v) => { setTts(v); if (!v) window.speechSynthesis?.cancel(); }}
        asr={serverAsr && speech.supported ? asrMode : undefined} onAsr={setAsrMode}
        onMic={toggleMic} onSend={handleCommand} />
    </div>
  );
}
