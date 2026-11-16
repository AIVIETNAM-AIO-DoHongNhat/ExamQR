"use client";

/**
 * "Bản đồ tác chiến an ninh mạng" – cảnh 3D kiểu CTF.
 * Bản đồ Việt Nam dạng voxel trên lưới mạng tối; mỗi học viên là một điểm trực.
 * Mỗi câu làm xong: một tia tấn công từ ngoài biên bị chặn tại điểm trực, cột trạm sáng thêm.
 * Nộp bài: trạm chuyển xanh ngọc, dựng lá chắn và cắm cờ.
 * Cờ Tổ quốc tại Hà Nội kéo lên và đường bờ sáng dần theo tiến độ chung của cả lớp.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BoardParticipant } from "@/lib/board-types";
import type { Pulse } from "./types";

type Props = {
  participants: BoardParticipant[];
  totalQuestions: number;
  pulses: Pulse[];
  classProgress: number;
};

/* ---------- Dữ liệu bản đồ ---------- */

// Mỗi hàng là một dải vĩ độ (từ 23,3°B xuống 8,6°B, bước 1/3°): [kinh độ tây, kinh độ đông] của đất liền.
const SPANS: [number, number][] = [
  [105.0, 105.5], [104.8, 106.8], [102.3, 106.8], [102.2, 106.8], [102.3, 107.0], [102.8, 107.8], [103.0, 107.9], [103.2, 107.5], [103.8, 106.8],
  [104.3, 106.6], [104.6, 106.2], [104.2, 105.9], [104.0, 105.8], [104.2, 105.7], [104.8, 105.9], [105.2, 106.2], [105.5, 106.5], [105.8, 106.6],
  [106.1, 107.0], [106.5, 107.2], [106.6, 107.6], [107.0, 108.0], [107.3, 108.3], [107.3, 108.6], [107.5, 108.9], [107.5, 109.0], [107.5, 109.1],
  [107.4, 109.2], [107.4, 109.3], [107.5, 109.3], [107.5, 109.3], [107.5, 109.4], [107.5, 109.4], [107.3, 109.3], [106.9, 109.2], [106.3, 109.1],
  [105.9, 108.8], [105.2, 108.3], [104.9, 107.6], [104.5, 107.1], [104.8, 106.8], [104.9, 106.5], [104.8, 106.2], [104.8, 105.6], [104.8, 105.2],
];
const LON0 = 102;
const STEP = 0.35; // độ kinh mỗi ô
// Đảo và quần đảo [cột, hàng]. Hoàng Sa, Trường Sa vẽ gần bờ hơn thực tế cho vừa khung hình.
const ISLANDS: [number, number][] = [
  [5, 39], [5, 40], // Phú Quốc
  [13, 44], // Côn Đảo
  [26, 20], [27, 20], [27, 21], [28, 19], // Hoàng Sa
  [28, 40], [30, 39], [29, 42], [31, 41], [30, 43], [28, 44], // Trường Sa
];
const CAPITAL = { c: 11, r: 7 }; // Hà Nội
const CX = 15;
const CZ = 22;

type Cell = { c: number; r: number; x: number; z: number; h: number; coast: boolean; island: boolean };

const cellHash = (c: number, r: number) => ((c * 73856093) ^ (r * 19349663)) >>> 0;

const LAND: Cell[] = (() => {
  const keys = new Set<string>();
  const raw: { c: number; r: number; island: boolean }[] = [];
  SPANS.forEach(([w, e], r) => {
    for (let c = Math.floor((w - LON0) / STEP); c <= Math.floor((e - LON0) / STEP); c++) raw.push({ c, r, island: false });
  });
  ISLANDS.forEach(([c, r]) => raw.push({ c, r, island: true }));
  raw.forEach((p) => keys.add(`${p.c},${p.r}`));
  const has = (c: number, r: number) => keys.has(`${c},${r}`);
  return raw.map(({ c, r, island }) => ({
    c,
    r,
    island,
    x: c - CX,
    z: r - CZ,
    h: island ? 0.3 : 0.35 + (cellHash(c, r) % 5) * 0.08,
    coast: island || !(has(c - 1, r) && has(c + 1, r) && has(c, r - 1) && has(c, r + 1)),
  }));
})();
const HANOI = LAND.find((p) => p.c === CAPITAL.c && p.r === CAPITAL.r)!;
// Ô đặt được điểm trực: đất liền, không sát trung tâm chỉ huy.
const SITES = LAND.filter((p) => !p.island && (Math.abs(p.c - CAPITAL.c) > 1 || Math.abs(p.r - CAPITAL.r) > 1));

/**
 * Rải n điểm trực đều trên đất liền theo khoảng cách (chọn lần lượt ô xa các điểm đã chọn nhất),
 * để miền Bắc nhiều ô không bị dồn cục. Cố định theo sĩ số; SBD gán theo thứ tự bắc → nam.
 */
function stationSites(n: number) {
  const m = Math.min(n, SITES.length);
  const dist = SITES.map(() => Infinity);
  const picked: Cell[] = [];
  let next = 0;
  for (let k = 0; k < m; k++) {
    const s = SITES[next];
    picked.push(s);
    let best = -1;
    SITES.forEach((p, i) => {
      dist[i] = Math.min(dist[i], (p.x - s.x) ** 2 + (p.z - s.z) ** 2);
      if (dist[i] > best) {
        best = dist[i];
        next = i;
      }
    });
  }
  picked.sort((a, b) => a.z - b.z || a.x - b.x);
  return Array.from({ length: n }, (_, i) => {
    const s = picked[i % Math.max(1, m)];
    return new THREE.Vector3(s.x, s.h, s.z);
  });
}

/* ---------- Màu và hình khối ---------- */

const C = {
  night: new THREE.Color("#080b26"),
  mid: new THREE.Color("#121850"),
  end: new THREE.Color("#222a80"),
  sea: "#0b0f33",
  grid: "#232c8a",
  land: new THREE.Color("#2a3499"),
  coast: new THREE.Color("#5b6bff"),
  safe: new THREE.Color("#2ff0b4"),
  dim: new THREE.Color("#1b2266"),
  lit: new THREE.Color("#ffcd1f"),
  attack: new THREE.Color("#ff4f8b"),
  spark: new THREE.Color("#ffe27a"),
};

/** Hộp có sẵn độ sáng từng mặt (trên sáng, bên tối dần): ra khối kiểu pixel mà không cần đèn. */
function shadedBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const shade = [0.72, 0.45, 1, 0.3, 0.56, 0.4]; // +x −x +y −y +z −z
  const col = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) col.fill(shade[f], f * 12, f * 12 + 12);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

const LEVELS = 5; // số nấc của cột trạm
const SEG_H = 0.62;
const ST_W = 0.92;
const ST_TOP = LEVELS * SEG_H;
const POLE_H = 10;

const LAND_GEO = shadedBox(0.94, 1, 0.94);
const SEG_GEO = shadedBox(ST_W, SEG_H * 0.78, ST_W);
const BIT_GEO = shadedBox(0.34, 0.34, 0.34);
const SMALL_POLE = shadedBox(0.08, 1.1, 0.08);
const SMALL_FLAG = shadedBox(0.6, 0.38, 0.06);
const SHIELD_R = 0.8;
const SHIELD_GEO = new THREE.SphereGeometry(SHIELD_R, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);

export function City3D(props: Props) {
  const n = props.participants.length;
  const sites = useMemo(() => stationSites(n), [n]);
  const allDone = n > 0 && props.participants.every((p) => p.finished);

  return (
    <Canvas
      orthographic
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [80, 80, 80], near: 0.1, far: 500, zoom: 18 }}
      className="!absolute inset-0"
    >
      <Rig />
      <Sky progress={props.classProgress} />
      <Sea />
      <Land progress={allDone ? 1 : props.classProgress} />
      <IslandLabels />
      <Stations participants={props.participants} totalQuestions={props.totalQuestions} sites={sites} />
      <Labels participants={props.participants} sites={sites} />
      <Command progress={props.classProgress} />
      <Attacks pulses={props.pulses} participants={props.participants} sites={sites} />
      {allDone && <Fireworks />}
    </Canvas>
  );
}

/* ---------- Máy quay trực giao: nhìn từ phía nam để bắc luôn ở trên, lắc nhẹ qua lại ---------- */

const TARGET = new THREE.Vector3(0, 1.5, 0);
const ELEV = 0.82;
const RESERVED_TOP = 190; // px phía trên dành cho dải số liệu đè lên cảnh

function Rig() {
  const { camera, size } = useThree();
  const up = useMemo(() => new THREE.Vector3(), []);
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.zoom = Math.min(size.width / 40, (size.height - RESERVED_TOP) / 43);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  useFrame(({ clock }) => {
    const az = Math.sin(clock.elapsedTime * 0.12) * 0.22;
    const d = 140;
    camera.position.set(TARGET.x + d * Math.sin(az) * Math.cos(ELEV), TARGET.y + d * Math.sin(ELEV), TARGET.z + d * Math.cos(az) * Math.cos(ELEV));
    camera.lookAt(TARGET);
    // Đẩy khung nhìn lên để bản đồ nằm giữa phần màn hình dưới dải số liệu
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(up, RESERVED_TOP / 2 / camera.zoom);
  });
  return null;
}

/* ---------- Nền trời: chàm đêm sáng dần theo tiến độ chung ---------- */

function Sky({ progress }: { progress: number }) {
  const { scene } = useThree();
  const cur = useRef(0);
  useLayoutEffect(() => {
    scene.background = C.night.clone();
    return () => {
      scene.background = null;
    };
  }, [scene]);
  useFrame((_, dt) => {
    cur.current = THREE.MathUtils.damp(cur.current, progress, 1.5, dt);
    const t = cur.current;
    const bg = scene.background as THREE.Color;
    if (t < 0.6) bg.copy(C.night).lerp(C.mid, t / 0.6);
    else bg.copy(C.mid).lerp(C.end, (t - 0.6) / 0.4);
  });
  return null;
}

/* ---------- Mặt biển: lưới mạng ---------- */

function Sea() {
  const N = 121; // số lẻ để đường lưới khớp mép ô bản đồ
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    g.fillStyle = C.sea;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = C.grid;
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    g.fillRect(0, 0, 3, 3);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(N, N);
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
      <planeGeometry args={[N * 2, N * 2]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/* ---------- Đất liền và hải đảo (InstancedMesh); đường bờ chuyển dần sang xanh ngọc ---------- */

function Land({ progress }: { progress: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const step = Math.round(progress * 20) / 20;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    LAND.forEach((p, i) => {
      d.position.set(p.x, p.h / 2, p.z);
      d.scale.set(1, p.h, 1);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (p.coast) col.copy(C.coast).lerp(C.safe, step);
      else col.copy(C.land).multiplyScalar(0.85 + (cellHash(p.r, p.c) % 4) * 0.07);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [step]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, LAND.length]} geometry={LAND_GEO} frustumCulled={false}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

function IslandLabels() {
  const items: [string, number, number][] = [
    ["HOÀNG SA", 27 - CX, 20 - CZ],
    ["TRƯỜNG SA", 29.5 - CX, 41.5 - CZ],
  ];
  return (
    <group>
      {items.map(([name, x, z]) => (
        <Billboard key={name} position={[x, 2.2, z]}>
          <Text fontSize={0.8} color="#b9beef" outlineWidth={0.06} outlineColor="#080b26" anchorX="center" anchorY="middle" letterSpacing={0.08}>
            {name}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

/* ---------- Điểm trực: cột 5 nấc, sáng dần theo tỉ lệ câu đã làm ---------- */

function Stations({ participants, totalQuestions, sites }: { participants: BoardParticipant[]; totalQuestions: number; sites: THREE.Vector3[] }) {
  const n = participants.length;
  const total = Math.max(1, totalQuestions);
  const ref = useRef<THREE.InstancedMesh>(null);
  const anim = useMemo(() => new Float32Array(n * LEVELS), [n]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const dirty = useRef(true);

  useLayoutEffect(() => {
    dirty.current = true;
  }, [participants, sites]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    let moving = dirty.current;
    for (let i = 0; i < n; i++) {
      const fill = (Math.min(total, participants[i].answered) / total) * LEVELS;
      for (let f = 0; f < LEVELS; f++) {
        const k = i * LEVELS + f;
        const target = THREE.MathUtils.clamp(fill - f, 0, 1);
        if (Math.abs(anim[k] - target) > 0.001) {
          anim[k] = THREE.MathUtils.damp(anim[k], target, 6, dt);
          moving = true;
        } else anim[k] = target;
      }
    }
    if (!moving) return;
    for (let i = 0; i < n; i++) {
      const s = sites[i];
      if (!s) continue;
      const bright = participants[i].finished ? C.safe : C.lit;
      for (let f = 0; f < LEVELS; f++) {
        const k = i * LEVELS + f;
        const v = anim[k];
        const w = 0.8 + 0.2 * v;
        dummy.position.set(s.x, s.y + (f + 0.5) * SEG_H, s.z);
        dummy.scale.set(w, 1, w);
        dummy.updateMatrix();
        m.setMatrixAt(k, dummy.matrix);
        m.setColorAt(k, tmp.copy(C.dim).lerp(bright, v));
      }
    }
    m.count = n * LEVELS;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    dirty.current = false;
  });

  const max = Math.max(1, n) * LEVELS;
  return (
    <group>
      <instancedMesh key={max} ref={ref} args={[undefined, undefined, max]} geometry={SEG_GEO} frustumCulled={false}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      {participants.map((p, i) => (p.finished && sites[i] ? <Shield key={p.id} site={sites[i]} /> : null))}
    </group>
  );
}

/** Lá chắn và cờ nhỏ trên điểm trực đã nộp bài. */
function Shield({ site }: { site: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (born.current == null) born.current = clock.elapsedTime;
    const age = clock.elapsedTime - born.current;
    g.scale.setScalar(Math.min(1, age * 3) * (1 + Math.max(0, 0.5 - age) * 0.9));
  });
  return (
    <group ref={ref} position={[site.x, site.y, site.z]}>
      <mesh geometry={SHIELD_GEO} scale={[1, (ST_TOP + 0.3) / SHIELD_R, 1]}>
        <meshBasicMaterial color="#2ff0b4" wireframe transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <group position-y={ST_TOP}>
        <mesh geometry={SMALL_POLE} position-y={0.55}>
          <meshBasicMaterial vertexColors color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh geometry={SMALL_FLAG} position={[0.33, 0.9, 0]}>
          <meshBasicMaterial vertexColors color="#ffcd1f" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- Số báo danh ---------- */

function Labels({ participants, sites }: { participants: BoardParticipant[]; sites: THREE.Vector3[] }) {
  const n = participants.length;
  const size = n <= 30 ? 0.9 : n <= 60 ? 0.72 : 0.58;
  return (
    <group>
      {participants.map((p, i) =>
        sites[i] ? (
          <Billboard key={p.id} position={[sites[i].x, sites[i].y + ST_TOP + (p.finished ? 1.9 : 0.75), sites[i].z]}>
            <Text fontSize={size} color={p.finished ? "#2ff0b4" : "#ffffff"} outlineWidth={0.08} outlineColor="#080b26" anchorX="center" anchorY="middle">
              {p.sbd}
            </Text>
          </Billboard>
        ) : null,
      )}
    </group>
  );
}

/* ---------- Trung tâm chỉ huy tại Hà Nội: bệ, cột cờ, cờ kéo lên theo tiến độ ---------- */

function flagTexture() {
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 200;
  const g = c.getContext("2d")!;
  g.fillStyle = "#da251d";
  g.fillRect(0, 0, 300, 200);
  g.fillStyle = "#ffcd00";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 60 : 23;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = 150 + Math.cos(a) * r;
    const y = 102 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FLAG_W = 4.5;
const FLAG_H = 3;

function Command({ progress }: { progress: number }) {
  const flag = useRef<THREE.Mesh>(null);
  const shown = useRef(0);
  const texture = useMemo(() => flagTexture(), []);
  const geo = useMemo(() => new THREE.PlaneGeometry(FLAG_W, FLAG_H, 16, 8), []);
  const rest = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const parts = useMemo(() => [shadedBox(2.6, 0.4, 2.6), shadedBox(1.7, 0.4, 1.7), shadedBox(0.16, POLE_H, 0.16)], []);

  useEffect(
    () => () => {
      texture.dispose();
      geo.dispose();
      parts.forEach((g) => g.dispose());
    },
    [texture, geo, parts],
  );

  useFrame(({ clock }, dt) => {
    shown.current = THREE.MathUtils.damp(shown.current, progress, 1.2, dt);
    const m = flag.current;
    if (!m) return;
    const low = 1.2 + FLAG_H / 2;
    m.position.y = low + (POLE_H + 0.6 - FLAG_H / 2 - low) * shown.current;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3] + FLAG_W / 2; // 0 tại cột
      pos.setZ(i, Math.sin(x * 2 - t * 4) * 0.14 * (x / FLAG_W));
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={[HANOI.x, HANOI.h, HANOI.z]}>
      <mesh geometry={parts[0]} position-y={0.2}>
        <meshBasicMaterial vertexColors color="#4255ff" toneMapped={false} />
      </mesh>
      <mesh geometry={parts[1]} position-y={0.6}>
        <meshBasicMaterial vertexColors color="#ffcd1f" toneMapped={false} />
      </mesh>
      <mesh geometry={parts[2]} position-y={0.8 + POLE_H / 2}>
        <meshBasicMaterial vertexColors color="#e8eaff" toneMapped={false} />
      </mesh>
      <mesh ref={flag} geometry={geo} position={[FLAG_W / 2 + 0.1, 2, 0]}>
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------- Tia tấn công bị chặn tại điểm trực mỗi khi một câu được trả lời ---------- */

const MAX_ATTACKS = 64;
const TRAIL = 3;
const SPARKS = 6;
const SLOTS = TRAIL + SPARKS;
const FLIGHT = 0.75; // giây
const BURST = 0.4;
const SPARK_DIRS = Array.from({ length: SPARKS }, (_, i) => {
  const a = (i / SPARKS) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)).normalize();
});

function Attacks({ pulses, participants, sites }: { pulses: Pulse[]; participants: BoardParticipant[]; sites: THREE.Vector3[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const live = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t0: number }[]>([]);
  const seen = useRef(new Set<number>());
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < MAX_ATTACKS * SLOTS; i++) m.setColorAt(i, i % SLOTS < TRAIL ? C.attack : C.spark);
    m.count = 0;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    for (const pu of pulses) {
      if (seen.current.has(pu.id)) continue;
      seen.current.add(pu.id);
      const s = sites[participants.findIndex((p) => p.id === pu.pid)];
      if (!s) continue;
      const a = Math.random() * Math.PI * 2;
      live.current.push({
        from: new THREE.Vector3(s.x + Math.cos(a) * 16, 9 + Math.random() * 4, s.z + Math.sin(a) * 16),
        to: new THREE.Vector3(s.x, s.y + ST_TOP + 0.2, s.z),
        t0: -1,
      });
      if (live.current.length > MAX_ATTACKS) live.current.shift();
    }
    if (seen.current.size > 400) seen.current = new Set(pulses.map((p) => p.id));
  }, [pulses, participants, sites]);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const now = clock.elapsedTime;
    live.current = live.current.filter((p) => p.t0 < 0 || now - p.t0 < FLIGHT + BURST);
    live.current.forEach((p, i) => {
      if (p.t0 < 0) p.t0 = now;
      const age = now - p.t0;
      for (let k = 0; k < SLOTS; k++) {
        if (k < TRAIL) {
          // Đầu tia và hai ô đuôi nhỏ dần
          const t = (age - k * 0.045) / FLIGHT;
          if (t < 0 || t >= 1) dummy.scale.setScalar(0);
          else {
            dummy.position.lerpVectors(p.from, p.to, t * t);
            dummy.scale.setScalar(1.5 - k * 0.4);
          }
        } else {
          // Chặn thành công: bung các ô sáng quanh nóc trạm
          const e = (age - FLIGHT) / BURST;
          if (e < 0) dummy.scale.setScalar(0);
          else {
            dummy.position.copy(p.to).addScaledVector(SPARK_DIRS[k - TRAIL], e * 1.8);
            dummy.scale.setScalar(1.3 * (1 - e));
          }
        }
        dummy.updateMatrix();
        m.setMatrixAt(i * SLOTS + k, dummy.matrix);
      }
    });
    m.count = live.current.length * SLOTS;
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_ATTACKS * SLOTS]} geometry={BIT_GEO} frustumCulled={false}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

/* ---------- Pháo hoa khi cả lớp hoàn thành ---------- */

function Fireworks() {
  const COUNT = 6;
  const PER = 90;
  const data = useMemo(
    () => ({
      pos: new Float32Array(COUNT * PER * 3),
      vel: new Float32Array(COUNT * PER * 3),
      col: new Float32Array(COUNT * PER * 3),
      born: new Float32Array(COUNT).fill(-10),
    }),
    [],
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(data.col, 3));
    return g;
  }, [data]);
  const palette = useMemo(() => [new THREE.Color("#ffcd1f"), new THREE.Color("#2ff0b4"), new THREE.Color("#ff4f8b")], []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    for (let b = 0; b < COUNT; b++) {
      if (t - data.born[b] > 2.2 + b * 0.15) {
        data.born[b] = t + Math.random() * 0.8;
        const cx = (Math.random() - 0.5) * 24;
        const cz = (Math.random() - 0.5) * 36;
        const cy = 12 + Math.random() * 6;
        const c = palette[b % palette.length];
        for (let i = 0; i < PER; i++) {
          const k = (b * PER + i) * 3;
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          const sp = 4 + Math.random() * 2;
          data.pos[k] = cx;
          data.pos[k + 1] = cy;
          data.pos[k + 2] = cz;
          data.vel[k] = Math.sin(ph) * Math.cos(th) * sp;
          data.vel[k + 1] = Math.cos(ph) * sp;
          data.vel[k + 2] = Math.sin(ph) * Math.sin(th) * sp;
          data.col[k] = c.r;
          data.col[k + 1] = c.g;
          data.col[k + 2] = c.b;
        }
      }
      if (t < data.born[b]) continue;
      for (let i = 0; i < PER; i++) {
        const k = (b * PER + i) * 3;
        data.vel[k + 1] -= 3.5 * dt;
        data.vel[k] *= 0.985;
        data.vel[k + 2] *= 0.985;
        data.pos[k] += data.vel[k] * dt;
        data.pos[k + 1] += data.vel[k + 1] * dt;
        data.pos[k + 2] += data.vel[k + 2] * dt;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial size={5} sizeAttenuation={false} vertexColors transparent opacity={0.95} depthWrite={false} toneMapped={false} />
    </points>
  );
}
