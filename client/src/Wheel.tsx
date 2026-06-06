import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Segment } from "./types";

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

function restAngle(idx: number, n: number): number {
  const seg = TWO_PI / n;
  const center = (idx + 0.5) * seg;
  let a = (Math.PI / 2 - center) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
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

  useEffect(() => {
    clockOffsetRef.current = clockOffset;
  }, [clockOffset]);

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

    const wheel = new THREE.Group();
    scene.add(wheel);
    wheelRef.current = wheel;

    const radius = 2.4;
    const n = segments.length;
    const seg = TWO_PI / n;

    segments.forEach((s, i) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, radius, i * seg, (i + 1) * seg, false);
      shape.lineTo(0, 0);
      const wedge = new THREE.Mesh(
        new THREE.ShapeGeometry(shape, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color) }),
      );
      wheel.add(wedge);

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0.02),
          new THREE.Vector3(Math.cos(i * seg) * radius, Math.sin(i * seg) * radius, 0.02),
        ]),
        new THREE.LineBasicMaterial({ color: 0xffffff }),
      );
      wheel.add(line);
    });

    scene.add(
      new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.18, 96),
        new THREE.MeshBasicMaterial({ color: 0x0f172a }),
      ),
    );

    const hub = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 48),
      new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    );
    hub.position.z = 0.03;
    scene.add(hub);

    const ptr = new THREE.Shape();
    ptr.moveTo(-0.2, radius + 0.42);
    ptr.lineTo(0.2, radius + 0.42);
    ptr.lineTo(0, radius - 0.05);
    ptr.lineTo(-0.2, radius + 0.42);
    const pointer = new THREE.Mesh(new THREE.ShapeGeometry(ptr), new THREE.MeshBasicMaterial({ color: 0x7c3aed }));
    pointer.position.z = 0.06;
    scene.add(pointer);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const spin = spinRef.current;
      if (spin) {
        const elapsed = Date.now() + clockOffsetRef.current - spin.startServer;
        const t = Math.min(1, Math.max(0, elapsed / spin.dur));
        rotationRef.current = spin.from + (spin.to - spin.from) * easeOutCubic(t);
        if (t >= 1) {
          rotationRef.current = spin.to;
          spinRef.current = null;
        }
      }
      wheel.rotation.z = rotationRef.current;
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
      scene.traverse((obj) => {
        const any = obj as any;
        any.geometry?.dispose?.();
        if (Array.isArray(any.material)) any.material.forEach((m: any) => m.dispose?.());
        else any.material?.dispose?.();
      });
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
