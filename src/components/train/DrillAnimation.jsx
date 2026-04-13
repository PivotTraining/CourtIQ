"use client";

import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════
   COURT IQ — Premium Articulated Figure Drill Animations
   Canvas-based with bezier interpolation, secondary motion,
   anticipation/follow-through, and proper athletic poses
   ═══════════════════════════════════════════════════════════════════ */

// Full skeleton: 16 joints with natural proportions
// All coords in 0-100 normalized space
// Joints: hd, nk(neck), ch(chest), hp(hip),
//   ls(l-shoulder), le(l-elbow), lw(l-wrist), lh(l-hand)
//   rs, re, rw, rh
//   lp(l-hip), lk(l-knee), la(l-ankle), lt(l-toe)
//   rp, rk, ra, rt
//   ball (nullable)

function pose(hd,nk,ch,hp, ls,le,lw, rs,re,rw, lp,lk,la, rp,rk,ra, ball=null) {
  return { hd,nk,ch,hp, ls,le,lw, rs,re,rw, lp,lk,la, rp,rk,ra, ball };
}

const ANIMS = {
  shooting: [
    // Athletic stance with ball at chest
    pose([50,15],[50,21],[50,28],[50,40], [43,22],[38,30],[42,36], [57,22],[62,30],[58,36], [44,40],[42,52],[41,64], [56,40],[58,52],[59,64], [50,33]),
    // Gather — dip knees, bring ball up
    pose([50,17],[50,23],[50,30],[50,42], [43,24],[37,28],[40,22], [57,24],[63,24],[60,18], [44,42],[40,55],[39,66], [56,42],[60,55],[61,66], [58,16]),
    // Rise — extending legs, ball going up
    pose([50,12],[50,18],[50,25],[50,37], [43,19],[36,22],[38,16], [57,19],[65,14],[66,6], [45,37],[44,48],[43,60], [55,37],[56,48],[57,60], [66,4]),
    // Release — full extension, flick wrist
    pose([50,10],[50,16],[50,23],[50,35], [43,17],[35,20],[36,14], [57,17],[67,10],[72,4], [45,35],[44,46],[43,58], [55,35],[56,46],[57,58], [76,0]),
    // Follow through — wrist bent, watching ball
    pose([50,11],[50,17],[50,24],[50,36], [43,18],[36,22],[37,16], [57,18],[68,12],[73,8], [45,36],[44,48],[43,60], [55,36],[56,48],[57,60], [82,3]),
    // Settle back to stance
    pose([50,14],[50,20],[50,27],[50,39], [43,21],[37,28],[40,34], [57,21],[64,26],[62,32], [44,39],[42,51],[41,63], [56,39],[58,51],[59,63], [88,8]),
  ],

  dribbling: [
    // Low dribble right — ball high
    pose([48,20],[48,26],[48,33],[48,45], [42,27],[36,33],[34,40], [54,27],[60,35],[62,46], [42,45],[38,57],[36,67], [54,45],[58,57],[60,67], [62,52]),
    // Ball bouncing down
    pose([48,20],[48,26],[48,33],[48,45], [42,27],[36,33],[34,40], [54,27],[60,38],[62,50], [42,45],[38,57],[36,67], [54,45],[58,57],[60,67], [62,64]),
    // Ball at floor — fingers following
    pose([48,20],[48,26],[48,33],[48,45], [42,27],[36,33],[34,40], [54,27],[60,40],[62,54], [42,45],[38,57],[36,67], [54,45],[58,57],[60,67], [62,68]),
    // Ball bouncing back up
    pose([48,20],[48,26],[48,33],[48,45], [42,27],[36,33],[34,40], [54,27],[60,36],[62,48], [42,45],[38,57],[36,67], [54,45],[58,57],[60,67], [62,56]),
    // Crossover — ball moving left
    pose([50,20],[50,26],[50,33],[50,45], [44,27],[50,36],[52,46], [56,27],[50,33],[48,40], [44,45],[40,57],[38,67], [56,45],[60,57],[62,67], [50,50]),
    // Left hand dribble — ball high
    pose([52,20],[52,26],[52,33],[52,45], [46,27],[40,35],[38,46], [58,27],[52,33],[50,40], [46,45],[42,57],[40,67], [58,45],[62,57],[64,67], [38,52]),
    // Ball bouncing down left
    pose([52,20],[52,26],[52,33],[52,45], [46,27],[40,38],[38,50], [58,27],[52,33],[50,40], [46,45],[42,57],[40,67], [58,45],[62,57],[64,67], [38,64]),
    // Ball at floor left
    pose([52,20],[52,26],[52,33],[52,45], [46,27],[40,40],[38,54], [58,27],[52,33],[50,40], [46,45],[42,57],[40,67], [58,45],[62,57],[64,67], [38,68]),
    // Ball bouncing back up left
    pose([52,20],[52,26],[52,33],[52,45], [46,27],[40,36],[38,48], [58,27],[52,33],[50,40], [46,45],[42,57],[40,67], [58,45],[62,57],[64,67], [38,56]),
    // Crossover back right
    pose([50,20],[50,26],[50,33],[50,45], [44,27],[50,36],[52,46], [56,27],[50,33],[48,40], [44,45],[40,57],[38,67], [56,45],[60,57],[62,67], [50,50]),
  ],

  layup: [
    // Approach — running right
    pose([18,22],[18,28],[18,35],[19,47], [13,29],[8,34],[6,40], [23,29],[28,34],[30,28], [14,47],[10,56],[6,65], [24,47],[28,54],[32,62], [30,26]),
    // Gather step
    pose([32,20],[32,26],[32,33],[34,45], [27,27],[22,32],[20,38], [37,27],[42,30],[44,22], [28,45],[24,54],[20,64], [40,45],[44,52],[48,60], [44,20]),
    // Explode up — knee drive
    pose([46,12],[46,18],[46,25],[48,37], [40,19],[36,24],[34,30], [52,19],[56,14],[58,6], [42,37],[38,46],[34,54], [54,37],[58,42],[56,34], [58,4]),
    // Peak — full extension at rim
    pose([54,6],[54,12],[54,19],[56,31], [48,13],[44,18],[42,24], [60,13],[66,6],[68,0], [50,31],[46,40],[42,48], [62,31],[66,36],[64,28], [70,0]),
    // Release — finger roll
    pose([58,10],[58,16],[58,23],[60,35], [52,17],[48,22],[46,28], [64,17],[70,12],[74,6], [54,35],[50,44],[46,54], [66,35],[70,42],[68,34], [76,2]),
    // Landing
    pose([62,20],[62,26],[62,33],[64,45], [56,27],[52,32],[50,38], [68,27],[72,32],[70,38], [58,45],[54,56],[52,66], [70,45],[74,56],[76,66], [82,6]),
  ],

  defense: [
    // Wide stance left — active hands
    pose([32,24],[32,30],[32,37],[32,49], [26,31],[20,26],[16,22], [38,31],[44,26],[48,22], [26,49],[20,58],[16,67], [38,49],[44,58],[48,67], null),
    // Slide right — body shifting
    pose([40,24],[40,30],[40,37],[40,49], [34,31],[28,26],[24,22], [46,31],[52,26],[56,22], [34,49],[28,58],[24,67], [46,49],[52,58],[56,67], null),
    // Wide stance center
    pose([50,24],[50,30],[50,37],[50,49], [44,31],[38,26],[34,22], [56,31],[62,26],[66,22], [44,49],[38,58],[34,67], [56,49],[62,58],[66,67], null),
    // Slide right more
    pose([60,24],[60,30],[60,37],[60,49], [54,31],[48,26],[44,22], [66,31],[72,26],[76,22], [54,49],[48,58],[44,67], [66,49],[72,58],[76,67], null),
    // Wide stance right
    pose([68,24],[68,30],[68,37],[68,49], [62,31],[56,26],[52,22], [74,31],[80,26],[84,22], [62,49],[56,58],[52,67], [74,49],[80,58],[84,67], null),
    // Slide back left
    pose([60,24],[60,30],[60,37],[60,49], [54,31],[48,26],[44,22], [66,31],[72,26],[76,22], [54,49],[48,58],[44,67], [66,49],[72,58],[76,67], null),
    // Back to center
    pose([50,24],[50,30],[50,37],[50,49], [44,31],[38,26],[34,22], [56,31],[62,26],[66,22], [44,49],[38,58],[34,67], [56,49],[62,58],[66,67], null),
    // Slide left
    pose([40,24],[40,30],[40,37],[40,49], [34,31],[28,26],[24,22], [46,31],[52,26],[56,22], [34,49],[28,58],[24,67], [46,49],[52,58],[56,67], null),
  ],

  rebounding: [
    // Box out stance — wide, arms out
    pose([50,26],[50,32],[50,39],[50,51], [42,33],[36,36],[30,32], [58,33],[64,36],[70,32], [42,51],[36,60],[32,68], [58,51],[64,60],[68,68], [50,4]),
    // Load — deeper squat
    pose([50,28],[50,34],[50,41],[50,53], [42,35],[36,38],[30,34], [58,35],[64,38],[70,34], [42,53],[34,62],[30,68], [58,53],[66,62],[70,68], [50,6]),
    // Explode — jump up
    pose([50,16],[50,22],[50,29],[50,41], [42,23],[38,18],[42,12], [58,23],[62,18],[58,12], [44,41],[42,50],[40,58], [56,41],[58,50],[60,58], [50,8]),
    // Peak — arms high, grabbing ball
    pose([50,8],[50,14],[50,21],[50,33], [42,15],[40,8],[44,4], [58,15],[60,8],[56,4], [44,33],[42,44],[40,54], [56,33],[58,44],[60,54], [50,4]),
    // Snatch — ball secured
    pose([50,10],[50,16],[50,23],[50,35], [42,17],[40,12],[44,8], [58,17],[60,12],[56,8], [44,35],[42,46],[40,56], [56,35],[58,46],[60,56], [50,8]),
    // Coming down — chin ball
    pose([50,18],[50,24],[50,31],[50,43], [42,25],[38,28],[40,32], [58,25],[62,28],[60,32], [44,43],[40,54],[38,64], [56,43],[60,54],[62,64], [50,28]),
    // Land — protect ball
    pose([50,24],[50,30],[50,37],[50,49], [42,31],[36,34],[34,38], [58,31],[64,34],[66,38], [42,49],[36,60],[32,68], [58,49],[64,60],[68,68], [50,34]),
  ],

  passing: [
    // Ball at chest — ready position
    pose([42,18],[42,24],[42,31],[42,43], [36,25],[32,30],[36,34], [48,25],[52,30],[48,34], [36,43],[34,54],[32,66], [48,43],[50,54],[52,66], [42,31]),
    // Wind up — ball back slightly
    pose([44,18],[44,24],[44,31],[44,43], [38,25],[34,28],[36,24], [50,25],[54,28],[52,24], [38,43],[36,54],[34,66], [50,43],[52,54],[54,66], [44,24]),
    // Step + push — extending arms
    pose([48,18],[48,24],[48,31],[46,43], [42,25],[36,28],[30,30], [54,25],[60,28],[66,30], [40,43],[38,54],[36,66], [52,43],[56,54],[58,66], [66,28]),
    // Full extension — ball released
    pose([50,18],[50,24],[50,31],[48,43], [44,25],[38,30],[32,32], [56,25],[64,28],[72,28], [42,43],[40,54],[38,66], [54,43],[58,54],[60,66], [80,26]),
    // Follow through
    pose([50,18],[50,24],[50,31],[48,43], [44,25],[40,30],[36,34], [56,25],[62,28],[68,30], [42,43],[40,54],[38,66], [54,43],[56,54],[58,66], [90,24]),
    // Reset
    pose([44,18],[44,24],[44,31],[44,43], [38,25],[34,30],[38,34], [50,25],[54,30],[50,34], [38,43],[36,54],[34,66], [50,43],[52,54],[54,66], [44,31]),
  ],

  agility: [
    // Start left — low explosive stance
    pose([16,22],[16,28],[16,35],[17,47], [11,29],[6,34],[4,38], [21,29],[26,32],[28,36], [11,47],[8,56],[4,66], [23,47],[26,56],[30,64], null),
    // Sprint right — arm pump
    pose([30,20],[30,26],[30,33],[32,45], [24,27],[18,32],[16,38], [36,27],[42,30],[44,24], [26,45],[22,56],[18,66], [38,45],[42,54],[46,62], null),
    // Plant + cut — decelerate
    pose([44,24],[44,30],[44,37],[44,49], [38,31],[32,34],[28,38], [50,31],[56,32],[58,28], [38,49],[34,58],[30,68], [50,49],[56,56],[60,64], null),
    // Explode other direction
    pose([58,20],[58,26],[58,33],[56,45], [52,27],[58,30],[60,24], [64,27],[58,32],[56,38], [50,45],[46,56],[42,66], [62,45],[66,54],[70,62], null),
    // Sprint left
    pose([72,22],[72,28],[72,35],[70,47], [66,29],[72,32],[74,26], [78,29],[72,34],[70,40], [64,47],[60,56],[56,66], [76,47],[80,56],[84,64], null),
    // Plant + cut back
    pose([58,24],[58,30],[58,37],[58,49], [52,31],[56,32],[58,28], [64,31],[58,34],[56,38], [52,49],[48,58],[44,68], [64,49],[68,58],[72,68], null),
    // Return sprint
    pose([44,20],[44,26],[44,33],[46,45], [38,27],[32,30],[30,24], [50,27],[56,32],[58,38], [40,45],[36,56],[32,66], [52,45],[56,54],[60,62], null),
    // Back to start
    pose([30,24],[30,30],[30,37],[30,49], [24,31],[18,34],[14,38], [36,31],[42,32],[46,28], [24,49],[18,58],[14,68], [36,49],[42,58],[48,68], null),
  ],

  conditioning: [
    // Sprint pose 1 — right leg forward
    pose([22,16],[24,22],[26,29],[30,41], [18,23],[12,28],[10,34], [32,23],[38,26],[40,20], [24,41],[18,50],[12,60], [36,41],[40,48],[44,56], null),
    // Mid stride
    pose([34,14],[36,20],[38,27],[42,39], [30,21],[36,24],[38,18], [44,21],[38,26],[36,32], [36,39],[30,50],[24,62], [48,39],[52,46],[56,54], null),
    // Sprint pose 2 — left leg forward
    pose([46,16],[48,22],[50,29],[54,41], [42,23],[36,28],[34,34], [56,23],[62,26],[64,20], [48,41],[42,50],[36,60], [60,41],[64,48],[68,56], null),
    // Mid stride 2
    pose([58,14],[60,20],[62,27],[66,39], [54,21],[60,24],[62,18], [68,21],[62,26],[60,32], [60,39],[54,50],[48,62], [72,39],[76,46],[80,54], null),
    // Sprint pose 3
    pose([70,16],[72,22],[74,29],[78,41], [66,23],[60,28],[58,34], [80,23],[86,26],[88,20], [72,41],[66,50],[60,60], [84,41],[88,48],[90,56], null),
  ],
};

const CAT_MAP = {
  "ball-handling": "dribbling", shooting: "shooting", finishing: "layup",
  defense: "defense", rebounding: "rebounding", passing: "passing",
  conditioning: "conditioning", agility: "agility", "free-throws": "shooting",
};

// Smooth cubic bezier interpolation
function lerp(a, b, t) { return a + (b - a) * t; }
function lp(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
function ease(t) {
  // Custom spring-like easing for athletic motion
  if (t < 0.4) return 2.5 * t * t; // Fast start (explosive)
  return 1 - Math.pow(1 - t, 3) * 0.6 - 0.4 * Math.pow(1 - t, 2); // Smooth settle
}

// Secondary motion — slight wobble for organic feel
function wobble(t, freq, amp) {
  return Math.sin(t * Math.PI * 2 * freq) * amp;
}

export default function DrillAnimation({ category = "shooting", size = 200, playing = true }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const animType = CAT_MAP[category] || "shooting";

  const draw = useCallback((ctx, sz, frames, time) => {
    const n = frames.length;
    const progress = (time % n);
    const fi = Math.floor(progress) % n;
    const ni = (fi + 1) % n;
    const raw = progress - fi;
    const t = ease(raw);

    const c = frames[fi];
    const nx = frames[ni];
    const s = sz / 100;

    // Interpolate all joints
    const joints = {};
    for (const key of Object.keys(c)) {
      if (key === "ball") {
        joints.ball = c.ball && nx.ball ? lp(c.ball, nx.ball, t) : c.ball;
      } else {
        const p = lp(c[key], nx[key], t);
        // Add secondary wobble for organic movement
        const w = wobble(time * 3 + key.charCodeAt(0), 0.5, 0.3);
        joints[key] = [p[0] + w, p[1] + w * 0.5];
      }
    }

    ctx.clearRect(0, 0, sz, sz);

    // ── Background court floor hint
    const floorY = 72 * s;
    ctx.beginPath();
    ctx.moveTo(8, floorY);
    ctx.lineTo(sz - 8, floorY);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Shadow
    const sx = joints.hp[0] * s;
    const jumpHeight = Math.max(0, (50 - joints.hp[1]) / 50);
    const shadowSize = (1 - jumpHeight * 0.5) * 14 * s;
    const shadowAlpha = 0.12 - jumpHeight * 0.06;
    if (shadowAlpha > 0) {
      const sg = ctx.createRadialGradient(sx, floorY, 0, sx, floorY, shadowSize);
      sg.addColorStop(0, `rgba(0,0,0,${shadowAlpha})`);
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(sx - shadowSize, floorY - 2, shadowSize * 2, 6);
    }

    // ── Draw limbs
    const limb = (from, to, w, alpha = 0.92) => {
      ctx.beginPath();
      ctx.moveTo(from[0] * s, from[1] * s);
      ctx.lineTo(to[0] * s, to[1] * s);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.stroke();
    };

    // Back leg (slightly darker)
    limb(joints.lp, joints.lk, 4.0, 0.7);
    limb(joints.lk, joints.la, 3.5, 0.7);

    // Front leg
    limb(joints.rp, joints.rk, 4.0, 0.9);
    limb(joints.rk, joints.ra, 3.5, 0.9);

    // Torso — neck to chest to hip (thicker)
    limb(joints.nk, joints.ch, 4.5, 0.95);
    limb(joints.ch, joints.hp, 4.5, 0.95);

    // Back arm
    limb(joints.ls, joints.le, 3.2, 0.75);
    limb(joints.le, joints.lw, 2.8, 0.75);

    // Front arm
    limb(joints.rs, joints.re, 3.2, 0.9);
    limb(joints.re, joints.rw, 2.8, 0.9);

    // ── Joints — small circles at bends
    const dot = (p, r, alpha = 0.5) => {
      ctx.beginPath();
      ctx.arc(p[0] * s, p[1] * s, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    };

    [joints.le, joints.re, joints.lk, joints.rk].forEach(j => dot(j, 2.5, 0.4));
    [joints.lw, joints.rw, joints.la, joints.ra].forEach(j => dot(j, 2, 0.35));
    dot(joints.nk, 2, 0.3); // shoulder center

    // ── Head — slightly oval
    const hx = joints.hd[0] * s, hy = joints.hd[1] * s;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 5.5 * s / 11, 6 * s / 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();

    // ── Basketball
    if (joints.ball) {
      const bx = joints.ball[0] * s, by = joints.ball[1] * s;
      const br = 5.5 * s / 12;

      // Glow
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, br * 3);
      glow.addColorStop(0, "rgba(255,107,53,0.25)");
      glow.addColorStop(1, "rgba(255,107,53,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, br * 3, 0, Math.PI * 2);
      ctx.fill();

      // Ball body
      const ballGrad = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br);
      ballGrad.addColorStop(0, "#FF8C5A");
      ballGrad.addColorStop(1, "#E04E12");
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Ball seams
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(bx - br, by);
      ctx.quadraticCurveTo(bx, by - br * 0.3, bx + br, by);
      ctx.moveTo(bx, by - br);
      ctx.quadraticCurveTo(bx + br * 0.3, by, bx, by + br);
      ctx.strokeStyle = "rgba(180,60,10,0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 2, 3);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const frames = ANIMS[animType] || ANIMS.shooting;
    const speed = 0.0025; // smooth, athletic pace
    let last = performance.now();

    function loop(ts) {
      if (playing) {
        timeRef.current += (ts - last) * speed;
      }
      last = ts;
      draw(ctx, size, frames, timeRef.current);
      animRef.current = requestAnimationFrame(loop);
    }

    timeRef.current = 0;
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [size, playing, animType, draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size, height: size, borderRadius: 16,
        background: "linear-gradient(180deg, rgba(20,22,36,0.95) 0%, rgba(12,14,20,0.98) 100%)",
      }}
    />
  );
}
