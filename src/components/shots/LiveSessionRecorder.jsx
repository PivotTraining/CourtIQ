"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createDeviceVideoStore, MAX_CLIP_BYTES } from "@/lib/deviceVideo.mjs";
import "./tracker.css";

const STOP_AT_BYTES = Math.floor(MAX_CLIP_BYTES * 0.85);
const FORMATS = [
  "video/mp4;codecs=h264,aac", "video/mp4",
  "video/webm;codecs=vp8,opus", "video/webm",
];

function recordingMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return FORMATS.find(mime => MediaRecorder.isTypeSupported?.(mime)) || "";
}
const videoType = mime => mime.split(";")[0];
const messageForCamera = error => {
  if (["NotAllowedError", "PermissionDeniedError"].includes(error?.name)) return "Camera permission was denied. Allow camera access for CourtIQ in your browser settings, then try again.";
  if (["NotFoundError", "OverconstrainedError"].includes(error?.name)) return "No usable camera was found. You can keep tracking stats without video.";
  if (error?.name === "NotReadableError") return "Your camera is being used by another app. Close it and try again.";
  return "Unable to start the camera on this device. The stats tracker will continue working.";
};

/**
 * Foreground-only camera recording stays mounted in the active stat tracker.
 * Stats are saved separately by the tracker. Video is explicitly opt-in,
 * stored on this device only, and never sent to the backend.
 */
export default function LiveSessionRecorder({ accountId, sessionId, onBusyChange = () => {} }) {
  const store = useMemo(() => createDeviceVideoStore(), []);
  const [status, setStatus] = useState("idle"); // idle | starting | recording | saving | unsaved
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [existing, setExisting] = useState(false);
  const [retryBlob, setRetryBlob] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef(null);
  const activeRef = useRef(null); // recorder, stream, chunks, mime, bytes
  const mounted = useRef(false);
  const secondsStart = useRef(null);
  const busy = status === "starting" || status === "recording" || status === "saving" || status === "unsaved";

  useEffect(() => {
    mounted.current = true;
    store.get(accountId, sessionId).then(record => {
      if (mounted.current) setExisting(!!record);
    }).catch(() => {/* Lack of IndexedDB will surface at save. */});
    return () => {
      mounted.current = false;
      const active = activeRef.current;
      if (active?.recorder?.state === "recording") {
        // The browser stays alive for onstop during in-app navigation.
        // Abrupt OS termination cannot guarantee delivery of recorded data.
        active.recorder.stop();
      }
      active?.stream?.getTracks().forEach(track => track.stop());
    };
  }, [accountId, sessionId, store]);

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    if (status !== "recording") return;
    const ticker = window.setInterval(() => setSeconds(Math.floor((Date.now() - secondsStart.current) / 1000)), 500);
    return () => window.clearInterval(ticker);
  }, [status]);
  useEffect(() => {
    if (!busy) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  useEffect(() => {
    const preview = previewRef.current;
    if (status === "recording" && preview && activeRef.current?.stream) {
      preview.srcObject = activeRef.current.stream;
      preview.play().catch(() => {});
    }
    return () => { if (preview) preview.srcObject = null; };
  }, [status, showPreview]);

  const safeState = (fn, ...args) => { if (mounted.current) fn(...args); };
  const releaseCamera = active => {
    active?.stream?.getTracks().forEach(track => track.stop());
    if (previewRef.current) previewRef.current.srcObject = null;
  };

  async function saveBlob(blob) {
    if (blob.size < 1) throw new Error("The recording did not contain any video.");
    if (blob.size > MAX_CLIP_BYTES) throw new Error("The video exceeded the 100 MB local clip limit.");
    await store.put(accountId, sessionId, blob);
    safeState(setExisting, true);
    safeState(setRetryBlob, null);
    safeState(setStatus, "idle");
    safeState(setMessage, "Video saved to this device with this session. Download a backup from your session report.");
  }

  async function finalize(active) {
    if (activeRef.current !== active) return;
    releaseCamera(active);
    safeState(setStatus, "saving");
    const blob = new Blob(active.chunks, { type: videoType(active.mime) });
    activeRef.current = null;
    if (!blob.size) {
      safeState(setError, "No video was recorded. Stats are unaffected.");
      safeState(setStatus, "idle");
      return;
    }
    try {
      await saveBlob(blob);
    } catch (err) {
      safeState(setRetryBlob, blob);
      safeState(setError, (err.message || "Device video save failed.") + " Download your video or retry saving before leaving.");
      safeState(setStatus, "unsaved");
    }
  }

  async function start() {
    if (status !== "idle" || !accountId || !sessionId) return;
    setError(""); setMessage("");
    if (existing && !window.confirm("Recording a new clip will replace this session's previous on-device video. Download your previous clip from the session report first if you want to keep it. Continue?")) return;
    const mime = recordingMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setError("Live recording is not supported in this browser. You can still track stats or add video after your session.");
      return;
    }
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 720 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
      });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const active = { stream, mime, chunks: [], bytes: 0, recorder: null, closing: false };
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 700000 });
      active.recorder = recorder;
      activeRef.current = active;
      recorder.ondataavailable = event => {
        if (event.data?.size) {
          active.chunks.push(event.data);
          active.bytes += event.data.size;
        }
        if (active.bytes >= STOP_AT_BYTES && recorder.state === "recording" && !active.closing) {
          active.closing = true;
          safeState(setMessage, "Local clip limit reached. Stopping and saving video; stats tracking continues.");
          recorder.stop();
        }
      };
      recorder.onerror = () => {
        safeState(setError, "The camera recording stopped unexpectedly. CourtIQ will try to save the footage collected so far.");
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorder.onstop = () => { void finalize(active); };
      for (const track of stream.getVideoTracks()) {
        track.onended = () => { if (recorder.state !== "inactive") recorder.stop(); };
      }
      recorder.start(1000);
      secondsStart.current = Date.now();
      setSeconds(0);
      setShowPreview(true);
      setStatus("recording");
      setMessage("Camera recording on this device. Keep CourtIQ open and use the stat buttons below.");
    } catch (err) {
      releaseCamera(activeRef.current);
      activeRef.current = null;
      setError(messageForCamera(err));
      setStatus("idle");
    }
  }

  function stop() {
    const active = activeRef.current;
    if (status !== "recording" || !active || active.closing) return;
    active.closing = true;
    setStatus("saving");
    setMessage("Stopping camera and saving video…");
    if (active.recorder.state !== "inactive") active.recorder.stop();
  }

  async function retrySave() {
    if (status !== "unsaved" || !retryBlob) return;
    setStatus("saving"); setError("");
    try { await saveBlob(retryBlob); }
    catch (err) { setError((err.message || "Could not save video.") + " Download a copy before leaving."); setStatus("unsaved"); }
  }
  function downloadUnsaved() {
    if (!retryBlob) return;
    const url = URL.createObjectURL(retryBlob);
    const link = document.createElement("a");
    link.href = url; link.download = `courtiq-session-${sessionId}.${retryBlob.type === "video/mp4" ? "mp4" : "webm"}`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    setMessage("Video download requested. Verify it is saved before leaving CourtIQ.");
  }
  function discardUnsaved() {
    if (!window.confirm("Discard the unsaved video? Your game stats will not be affected.")) return;
    setRetryBlob(null); setError(""); setStatus("idle");
  }
  const labelTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return <section className="tracker-live-video" aria-label="Record video while tracking stats">
    <div className="tracker-video-topline">
      <div><strong>Camera + Stats</strong><span>Record while using the shot chart and box score</span></div>
      {status === "recording" && <span className="tracker-record-indicator" role="status">● REC {labelTime}</span>}
    </div>
    {showPreview && status === "recording" && <video className="tracker-video-preview" ref={previewRef} autoPlay playsInline muted aria-label="Live court camera preview"/>}
    <div className="tracker-video-actions">
      {status === "idle" && <button type="button" onClick={start}>● Record video</button>}
      {status === "recording" && <button type="button" onClick={stop}>■ Stop & save video</button>}
      {(status === "starting" || status === "saving") && <span role="status"> {status === "starting" ? "Opening camera…" : "Saving video…"}</span>}
      {status === "unsaved" && <>
        <button type="button" onClick={retrySave}>Retry save</button>
        <button type="button" onClick={downloadUnsaved}>Download video</button>
        <button type="button" onClick={discardUnsaved}>Discard</button>
      </>}
      {existing && status === "idle" && <span className="tracker-video-saved">✓ Previous clip saved on this device</span>}
    </div>
    <p className="tracker-video-note">Optional · foreground only · camera access requires your permission. Stored on this phone, not uploaded. Limit: 100 MB per clip; recordings cannot continue with screen locked.</p>
    {message && <p role="status" className="tracker-video-note">{message}</p>}
    {error && <p role="alert" className="tracker-video-error">{error}</p>}
  </section>;
}
