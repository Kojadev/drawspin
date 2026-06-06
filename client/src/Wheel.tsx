import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Segment } from "./types";
import { tick as playTick, land as playLand } from "./sfx";

interface WheelProps {
  segments: Segment[];
  phase: string;
  winningIndex: number | null;
  spinSeed: number | null;
  prevIndex: number | null;
  phaseEndsAt: number;
  clockOffset: number;
  drawingMs?: number;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const TWO_PI = Math.PI * 2;
const GREEN = "#44f08c";

function restAngle(idx: number, n: number): number {
  const seg = TWO_PI / n;
  const center = (idx + 0.5) * seg;
  let a = (Math.PI / 2 - center) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

function makeBadgeTexture(text: string, color: string): THREE.CanvasTexture {
  const size = 128;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, TWO_PI);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  const label = text.toUpperCase();
  ctx.font = `900 ${label.length > 2 ? 42 : 54}px "JetBrains Mono", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2 + 3);
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  return tex;
}

function makeSpinTexture(): THREE.CanvasTexture {
  const size = 256;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 10, 0, TWO_PI);
  ctx.fillStyle = "#0c1018";
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = GREEN;
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = GREEN;
  ctx.font = "900 66px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SPIN", size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 4;
  return tex;
}

export default function Wheel({
  segments,
  phase,
  winningIndex,
  spinSeed,
  prevIndex,
  phaseEndsAt,
  clockOffset,
  drawingMs = 6000,
}: WheelProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const wheelRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef(0);
  const spinRef = useRef<{ from: number; to: number; startServer: number; dur: number } | null>(null);
  const lastSpinKey = useRef("");
  const clockOffsetRef = useRef(clockOffset);
  const phaseRef = useRef(phase);
  const winIdxRef = useRef<number | null>(winningIndex);
  const flashStartRef = useRef(0);
  const pointerKickRef = useRef(0);
  const lastTopRef = useRef(-1);

  useEffect(() => {
    clockOffsetRef.current = clockOffset;
  }, [clockOffset]);

  useEffect(() => {
    phaseRef.current = phase;
    winIdxRef.current = winningIndex;
    if (phase === "result") flashStartRef.current = performance.now();
  }, [phase, winningIndex]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || segments.length === 0) return;

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const disposables: { dispose?: () => void }[] = [];

    const wheel = new THREE.Group();
    scene.add(wheel);
    wheelRef.current = wheel;

    const radius = 2.4;
    const innerRadius = 0.62;
    const n = segments.length;
    const seg = TWO_PI / n;
    const badgeRadius = (radius + innerRadius) / 2;
    const badges: THREE.Mesh[] = [];

    segments.forEach((s, i) => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, radius, i * seg, (i + 1) * seg, false);
      shape.absarc(0, 0, innerRadius, (i + 1) * seg, i * seg, true);
      const geo = new THREE.ShapeGeometry(shape, 32);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color) });
      wheel.add(new THREE.Mesh(geo, mat));
      disposables.push(geo, mat);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(i * seg) * innerRadius, Math.sin(i * seg) * innerRadius, 0.02),
        new THREE.Vector3(Math.cos(i * seg) * radius, Math.sin(i * seg) * radius, 0.02),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x070b0e });
      wheel.add(new THREE.Line(lineGeo, lineMat));
      disposables.push(lineGeo, lineMat);

      const angle = (i + 0.5) * seg;
      const tex = makeBadgeTexture(s.label, s.color);
      const badgeGeo = new THREE.PlaneGeometry(0.6, 0.6);
      const badgeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const badge = new THREE.Mesh(badgeGeo, badgeMat);
      badge.position.set(Math.cos(angle) * badgeRadius, Math.sin(angle) * badgeRadius, 0.05);
      wheel.add(badge);
      badges.push(badge);
      disposables.push(badgeGeo, badgeMat, tex);
    });

    const rimGeo = new THREE.RingGeometry(radius, radius + 0.28, 96);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x0c1116 });
    scene.add(new THREE.Mesh(rimGeo, rimMat));
    disposables.push(rimGeo, rimMat);
    const accGeo = new THREE.RingGeometry(radius + 0.2, radius + 0.24, 96);
    const accMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(GREEN) });
    scene.add(new THREE.Mesh(accGeo, accMat));
    disposables.push(accGeo, accMat);

    const hubGeo = new THREE.CircleGeometry(innerRadius + 0.04, 64);
    const hubMat = new THREE.MeshBasicMaterial({ color: 0x070b0e });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.z = 0.03;
    scene.add(hub);
    disposables.push(hubGeo, hubMat);

    const spinTex = makeSpinTexture();
    const spinGeo = new THREE.PlaneGeometry(innerRadius * 1.7, innerRadius * 1.7);
    const spinMat = new THREE.MeshBasicMaterial({ map: spinTex, transparent: true });
    const spinDisc = new THREE.Mesh(spinGeo, spinMat);
    spinDisc.position.z = 0.07;
    scene.add(spinDisc);
    disposables.push(spinGeo, spinMat, spinTex);

    const ptr = new THREE.Shape();
    ptr.moveTo(-0.22, radius + 0.5);
    ptr.lineTo(0.22, radius + 0.5);
    ptr.lineTo(0, radius - 0.02);
    ptr.lineTo(-0.22, radius + 0.5);
    const ptrGeo = new THREE.ShapeGeometry(ptr);
    const ptrMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(GREEN) });
    const pointer = new THREE.Mesh(ptrGeo, ptrMat);
    pointer.position.set(0, 0, 0.08);
    const pointerPivot = new THREE.Group();
    pointerPivot.position.set(0, 0, 0);
    pointerPivot.add(pointer);
    scene.add(pointerPivot);
    disposables.push(ptrGeo, ptrMat);

    const flashGeo = new THREE.CircleGeometry(radius + 0.3, 64);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.z = 0.09;
    scene.add(flash);
    disposables.push(flashGeo, flashMat);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const spin = spinRef.current;
      let t = 1;
      if (spin) {
        const elapsed = Date.now() + clockOffsetRef.current - spin.startServer;
        t = Math.min(1, Math.max(0, elapsed / spin.dur));
        rotationRef.current = spin.from + (spin.to - spin.from) * easeOutCubic(t);
        if (t >= 1) {
          rotationRef.current = spin.to;
          spinRef.current = null;
          playLand();
        }
      }
      wheel.rotation.z = rotationRef.current;
      for (const b of badges) b.rotation.z = -rotationRef.current;

      const topAngle = ((Math.PI / 2 - rotationRef.current) % TWO_PI + TWO_PI) % TWO_PI;
      const topIdx = Math.floor(topAngle / seg);
      if (spin && topIdx !== lastTopRef.current) {
        if (lastTopRef.current !== -1) {
          playTick(t);
          pointerKickRef.current = 0.4;
        }
        lastTopRef.current = topIdx;
      }
      pointerKickRef.current *= 0.82;
      pointerPivot.rotation.z = -pointerKickRef.current;

      const now = performance.now();
      const flashEl = now - flashStartRef.current;
      flashMat.opacity = flashEl < 480 ? 0.32 * (1 - flashEl / 480) : 0;
      const wi = winIdxRef.current;
      if (phaseRef.current === "result" && wi != null && badges[wi]) {
        const p = 1 + 0.16 * Math.max(0, Math.sin(now * 0.007));
        badges[wi].scale.setScalar(p);
      } else {
        for (const b of badges) b.scale.setScalar(1);
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      width = mountRef.current.clientWidth;
      height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      wheelRef.current = null;
    };
  }, [segments]);

  useEffect(() => {
    if (phase !== "drawing" || winningIndex == null || spinSeed == null) return;

    const key = `${spinSeed}:${winningIndex}`;
    if (lastSpinKey.current === key) return;
    lastSpinKey.current = key;

    const n = segments.length || 8;
    const from = prevIndex != null ? restAngle(prevIndex, n) : rotationRef.current % TWO_PI;
    const extraSpins = 5 + (spinSeed % 3);

    let to = restAngle(winningIndex, n);
    while (to < from) to += TWO_PI;
    to += extraSpins * TWO_PI;

    spinRef.current = {
      from,
      to,
      startServer: phaseEndsAt - drawingMs,
      dur: Math.max(2500, drawingMs - 300),
    };
  }, [phase, winningIndex, spinSeed, prevIndex, segments.length, drawingMs, phaseEndsAt]);

  useEffect(() => {
    if (phase !== "result" || winningIndex == null) return;
    spinRef.current = null;
    lastSpinKey.current = "";
    const n = segments.length || 8;
    rotationRef.current = restAngle(winningIndex, n);
  }, [phase, winningIndex, segments.length]);

  return <div ref={mountRef} className="h-72 w-full sm:h-80" />;
}
