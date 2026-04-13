"use client";
import { useEffect, useRef, useState } from "react";

export default function DrillCamera({ drill, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | active | error
  const [detector, setDetector] = useState(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);

  // Load TensorFlow.js + MoveNet lazily
  useEffect(() => {
    let cancelled = false;
    async function loadPose() {
      try {
        await import("@tensorflow/tfjs");
        await import("@tensorflow/tfjs-backend-webgl");
        const poseDetection = await import("@tensorflow-models/pose-detection");
        const model = poseDetection.SupportedModels.MoveNet;
        const det = await poseDetection.createDetector(model, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        if (!cancelled) {
          detectorRef.current = det;
          setDetector(det);
        }
      } catch (e) {
        console.error("Failed to load PoseNet:", e);
        if (!cancelled) setStatus("error");
      }
    }
    loadPose();
    return () => { cancelled = true; };
  }, []);

  // Start camera after detector is ready
  useEffect(() => {
    if (!detector) return;
    let stream;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("active");
          requestAnimationFrame(detectLoop);
        }
      } catch (e) {
        console.error("Camera error:", e);
        setStatus("error");
      }
    }
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [detector]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const detectLoop = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const det = detectorRef.current;

    if (!video || !canvas || !det || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");

    try {
      const poses = await det.estimatePoses(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (poses.length > 0) {
        const keypoints = poses[0].keypoints;

        // Skeleton connections (MoveNet keypoint indices)
        const connections = [
          [5, 7], [7, 9],           // left arm
          [6, 8], [8, 10],          // right arm
          [5, 6],                   // shoulders
          [5, 11], [6, 12],         // torso sides
          [11, 12],                 // hips
          [11, 13], [13, 15],       // left leg
          [12, 14], [14, 16],       // right leg
        ];

        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        connections.forEach(([a, b]) => {
          const kpA = keypoints[a];
          const kpB = keypoints[b];
          if (kpA && kpB && kpA.score > 0.3 && kpB.score > 0.3) {
            ctx.globalAlpha = Math.min(kpA.score, kpB.score);
            ctx.beginPath();
            ctx.moveTo(kpA.x, kpA.y);
            ctx.lineTo(kpB.x, kpB.y);
            ctx.stroke();
          }
        });

        // Draw keypoints
        ctx.globalAlpha = 1;
        keypoints.forEach((kp) => {
          if (kp.score > 0.3) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "#FF6B35";
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      }
    } catch (e) {
      // silently skip failed frames
    }

    animFrameRef.current = requestAnimationFrame(detectLoop);
  };

  const handleClose = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    onClose();
  };

  // Get a coaching cue from the drill
  const coachingCue = drill.videoTip || drill.description?.split(".")[0] || "Focus on your form and technique.";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "#000",
      display: "flex", flexDirection: "column",
    }}>
      {/* Video + Canvas Layer */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Top bar overlay */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          paddingTop: "max(16px, env(safe-area-inset-top, 16px))",
          paddingLeft: 20, paddingRight: 20, paddingBottom: 12,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{drill.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              Camera Mode
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: "rgba(255,255,255,0.2)", border: "none",
              cursor: "pointer", color: "white", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            ✕
          </button>
        </div>

        {/* Loading State */}
        {status === "loading" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            gap: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 24,
              border: "3px solid rgba(34,197,94,0.3)",
              borderTopColor: "#22C55E",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
              Loading movement tracking...
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", maxWidth: 240, textAlign: "center", lineHeight: 1.5 }}>
              This may take a moment while TensorFlow loads
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.9)",
            gap: 16, padding: "0 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40 }}>📵</div>
            <div style={{ fontSize: 17, color: "white", fontWeight: 700 }}>Camera Not Available</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              Camera access is required for movement tracking. Please allow camera permissions and try again.
            </div>
            <button onClick={handleClose} style={{
              marginTop: 8, padding: "12px 28px", borderRadius: 14,
              background: "#FF6B35", color: "white", border: "none",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              Close
            </button>
          </div>
        )}

        {/* Active — skeleton tracking badge */}
        {status === "active" && (
          <div style={{
            position: "absolute", top: 80, left: 20,
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)",
            borderRadius: 20, padding: "4px 12px",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: 3,
              background: "#22C55E",
              animation: "pulse-dot 1.5s ease infinite",
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#22C55E" }}>TRACKING</span>
            <style>{`@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
          </div>
        )}
      </div>

      {/* Bottom Coaching Bar */}
      <div style={{
        background: "rgba(0,0,0,0.9)",
        paddingTop: 16, paddingLeft: 20, paddingRight: 20,
        paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Coaching Focus
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, fontStyle: "italic" }}>
          "{coachingCue}"
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[
            { label: `${drill.reps} reps`, icon: "🔄" },
            { label: `~${drill.duration}min`, icon: "⏱" },
            { label: drill.difficulty, icon: "⚡" },
          ].map((tag) => (
            <span key={tag.label} style={{
              fontSize: 11, fontWeight: 600,
              color: "rgba(255,255,255,0.5)",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "4px 10px",
            }}>
              {tag.icon} {tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
