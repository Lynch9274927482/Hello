// Inclined & declined plane: a remote-controlled car on the decline pulls a crate up the incline.
const $ = id => document.getElementById(id);
const g = 9.8, H = 4, W = 3.2, MC = 1.5, RW = 0.28, PR = 0.35, PY = H + 0.8;
const S = { a: 25, b: 40, mk: 2, Fm: 18, rope: true };
let A, B, Li, Ld, D, dc, vc, dk, vk, thr = 0, dir = 0, brake = false, pRot = 0, accel = 0, tension = 0;

// ---------- scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe3ee);
scene.fog = new THREE.Fog(0xcfe3ee, 40, 90);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f78, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(10, 20, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: 1, far: 70 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0xd8d1bf }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(120, 60, 0xb9b09b, 0xc6bea9); grid.position.y = 0.01; scene.add(grid);

const mat = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b;
};
const cyl = (r, h, m, rx = 0) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m);
  c.rotation.x = rx; c.castShadow = true; return c;
};

// ---------- hill (rebuilt when angles change) ----------
let hill;
const sInc = (d, o) => new THREE.Vector3(-Math.cos(A) * d - Math.sin(A) * o, H - Math.sin(A) * d + Math.cos(A) * o, 0);
const sDec = (d, o) => new THREE.Vector3(Math.cos(B) * d + Math.sin(B) * o, H - Math.sin(B) * d + Math.cos(B) * o, 0);

function buildHill() {
  A = S.a * Math.PI / 180; B = S.b * Math.PI / 180;
  Li = H / Math.sin(A); Ld = H / Math.sin(B);
  if (hill) { scene.remove(hill); hill.traverse(o => o.geometry && o.geometry.dispose()); }
  hill = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-H / Math.tan(A), 0); sh.lineTo(H / Math.tan(B), 0); sh.lineTo(0, H); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false }); geo.translate(0, 0, -W / 2);
  const body = new THREE.Mesh(geo, mat(0xb9b2a4, 0.95)); body.castShadow = body.receiveShadow = true;
  hill.add(body);
  const r1 = box(Li, 0.08, W * 0.96, mat(0x8a6240, 0.8)); r1.position.copy(sInc(Li / 2, 0.04)); r1.rotation.z = A;
  const r2 = box(Ld, 0.08, W * 0.96, mat(0x8a6240, 0.8)); r2.position.copy(sDec(Ld / 2, 0.04)); r2.rotation.z = -B;
  hill.add(r1, r2);
  // plank lines on both ramps
  for (const [L, f, rot] of [[Li, sInc, A], [Ld, sDec, -B]])
    for (let d = 1; d < L; d += 1) {
      const s = box(0.03, 0.09, W * 0.96, mat(0x5e4129)); s.position.copy(f(d, 0.045)); s.rotation.z = rot; hill.add(s);
    }
  scene.add(hill);
}

// pulley on top of the hill
const steel = mat(0x8b9aa0, 0.35, 0.8);
const post = cyl(0.07, 0.8, mat(0x39464b), 0); post.position.set(0, H + 0.4, 0); scene.add(post);
for (const z of [-0.12, 0.12]) { const f = box(0.14, 0.14, 0.04, mat(0x39464b), 0, PY, z * 1.3); scene.add(f); }
const pulley = new THREE.Group(); pulley.position.set(0, PY, 0);
pulley.add(cyl(PR, 0.14, steel, Math.PI / 2), box(PR * 2, 0.06, 0.18, mat(0x39464b)), box(0.06, PR * 2, 0.18, mat(0x39464b)));
scene.add(pulley);

// ---------- car ----------
const car = new THREE.Group(), wheels = [];
car.add(box(1.8, 0.4, 1.1, mat(0xe8590c, 0.45, 0.2), 0, 0.3, 0));
car.add(box(0.9, 0.35, 0.9, mat(0xc94a08, 0.45, 0.2), -0.15, 0.68, 0));
car.add(box(0.5, 0.22, 0.92, mat(0x9fd3e6, 0.15, 0.4), 0.18, 0.7, 0));
car.add(box(0.06, 0.1, 0.25, mat(0xffe27a, 0.3), 0.91, 0.32, 0.35), box(0.06, 0.1, 0.25, mat(0xffe27a, 0.3), 0.91, 0.32, -0.35));
car.add(box(0.05, 0.5, 0.05, mat(0x222), -0.7, 0.95, 0.3));
for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) {
  const p = new THREE.Group(); p.position.set(x, RW, z);
  p.add(cyl(RW, 0.2, mat(0x1b1b1b, 0.9), Math.PI / 2), cyl(RW * 0.5, 0.22, mat(0xcfd6d9, 0.3, 0.7), Math.PI / 2), box(RW * 1.5, 0.05, 0.23, mat(0x777)));
  car.add(p); wheels.push(p);
}
scene.add(car);

// ---------- crate ----------
const crate = new THREE.Group();
const wood = mat(0xb98a3e, 0.85);
crate.add(box(0.9, 0.9, 0.9, wood));
for (const [w, h, d, x, y, z] of [[0.95, 0.1, 0.95, 0, 0, 0], [0.1, 0.95, 0.95, 0.32, 0, 0], [0.1, 0.95, 0.95, -0.32, 0, 0]])
  crate.add(box(w, h, d, mat(0x7b5a24, 0.9), x, y, z));
scene.add(crate);

// ---------- rope ----------
const ropeMat = mat(0x2d2116, 0.9), up = new THREE.Vector3(0, 1, 0), ropes = [];
for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), ropeMat); scene.add(m); ropes.push(m); }
function setRope(pts) {
  for (let i = 0; i < ropes.length; i++) {
    const a = pts[i], b = pts[i + 1], d = b.clone().sub(a), m = ropes[i];
    m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.y = d.length();
    m.quaternion.setFromUnitVectors(up, d.normalize());
  }
}
const local = (obj, x, y) => { const c = Math.cos(obj.rotation.z), s = Math.sin(obj.rotation.z);
  return new THREE.Vector3(obj.position.x + c * x - s * y, obj.position.y + s * x + c * y, 0); };

// ---------- physics ----------
function stepV(m, F, v, fk, c, dt) {
  let nv = v + (F - c * v) / m * dt; const fd = fk / m * dt;
  return nv > fd ? nv - fd : nv < -fd ? nv + fd : 0;
}
function reset() {
  dc = 1.2; dk = Li - 1.2; vc = vk = 0; D = dc + dk; accel = tension = 0;
}
function sim(dt) {
  thr += (dir - thr) * Math.min(1, 6 * dt);
  const F = thr * S.Fm, sa = Math.sin(A), ca = Math.cos(A), sb = Math.sin(B), cb = Math.cos(B);
  const fb = brake ? 60 : 0, mk = S.mk, old = vc;
  if (S.rope) {
    const Fd = F + MC * g * sb - mk * g * sa;
    vc = stepV(MC + mk, Fd, vc, 0.3 * mk * g * ca + 0.03 * MC * g * cb + fb, 0.15, dt);
    dc += vc * dt;
    const lo = Math.max(0.9, D - (Li - 0.9)), hi = Math.min(Ld - 1.2, D - 0.9);
    if (dc < lo) { dc = lo; vc = 0; } else if (dc > hi) { dc = hi; vc = 0; }
    dk = D - dc; vk = -vc;
    accel = (vc - old) / dt;
    tension = mk * (-accel + g * sa) + Math.sign(vc) * 0.3 * mk * g * ca;
    pRot -= vc * dt / PR;
  } else {
    vc = stepV(MC, F + MC * g * sb, vc, 0.03 * MC * g * cb + fb, 0.15, dt);
    dc = Math.min(Ld - 1.2, Math.max(0.9, dc + vc * dt)); if (dc <= 0.9 || dc >= Ld - 1.2) vc = 0;
    vk = stepV(mk, mk * g * sa, vk, 0.3 * mk * g * ca, 0.1, dt);
    dk = Math.min(Li - 0.9, Math.max(0.9, dk + vk * dt)); if (dk <= 0.9 || dk >= Li - 0.9) vk = 0;
    accel = (vc - old) / dt; tension = 0;
  }
}

// ---------- pose + HUD ----------
function pose() {
  car.position.copy(sDec(dc, 0.09)); car.rotation.z = -B;
  wheels.forEach(w => w.rotation.z = -dc / RW);
  crate.position.copy(sInc(dk, 0.54)); crate.rotation.z = A;
  pulley.rotation.z = pRot;
  ropes.forEach(r => r.visible = S.rope);
  if (S.rope) {
    const arc = [-1, -0.7, 0, 0.7, 1].map(t => new THREE.Vector3(PR * (t === 0 ? 0 : Math.sign(t) * (Math.abs(t) === 1 ? 1 : 0.7)), PY + (t === 0 ? PR : Math.abs(t) === 1 ? 0 : PR * 0.7), 0));
    setRope([local(crate, 0.4, 0.55), ...arc, local(car, -0.9, 0.5)]);
  }
}
function hud() {
  const v = Math.abs(vc);
  $('state').textContent = v < 0.02 ? 'At rest' : (vc > 0 ? 'Car rolling down the decline' : 'Car climbing the decline') + (S.rope && vc > 0 ? ' · crate rising' : '');
  $('vel').textContent = v.toFixed(2) + ' m/s';
  $('acc').textContent = accel.toFixed(2) + ' m/s²';
  $('mom').textContent = (MC * vc).toFixed(2) + ' kg·m/s';
  $('ten').textContent = S.rope ? Math.max(0, tension).toFixed(1) + ' N' : 'rope off';
  $('hgt').textContent = (H - Math.sin(A) * dk).toFixed(2) + ' m';
  $('lift').textContent = (S.mk * g * Math.sin(A)).toFixed(1) + ' N';
  $('note').textContent = `Lifting the crate straight up needs ${(S.mk * g).toFixed(1)} N. On the ${S.a}° incline it needs only ${(S.mk * g * Math.sin(A)).toFixed(1)} N (${(1 / Math.sin(A)).toFixed(1)}× easier). The ${S.b}° decline gives the car ${(MC * g * Math.sin(B)).toFixed(1)} N of free pull from gravity.`;
}

// ---------- controls ----------
function bindHold(id, on, off) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('active'); on(); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, () => { el.classList.remove('active'); off(); });
}
bindHold('fwd', () => dir = 1, () => dir === 1 && (dir = 0));
bindHold('rev', () => dir = -1, () => dir === -1 && (dir = 0));
bindHold('brk', () => brake = true, () => brake = false);
const keyMap = { ArrowRight: 'fwd', d: 'fwd', D: 'fwd', ArrowLeft: 'rev', a: 'rev', A: 'rev', ' ': 'brk' };
addEventListener('keydown', e => {
  const k = keyMap[e.key]; if (e.key === 'r' || e.key === 'R') reset();
  if (!k) return; e.preventDefault();
  if (k === 'fwd') dir = 1; if (k === 'rev') dir = -1; if (k === 'brk') brake = true; $(k).classList.add('active');
});
addEventListener('keyup', e => {
  const k = keyMap[e.key]; if (!k) return;
  if (k === 'brk') brake = false; else dir = 0; $(k).classList.remove('active');
});
$('reset').onclick = reset;
$('rope').onclick = () => {
  S.rope = !S.rope; $('rope').textContent = 'Rope: ' + (S.rope ? 'attached' : 'cut');
  $('rope').classList.toggle('on', S.rope); if (S.rope) { D = dc + dk; vk = -vc; }
};
function bindSlider(id, key, fmt, rebuild) {
  $(id).oninput = e => { S[key] = +e.target.value; $(id + 'V').textContent = fmt(S[key]);
    if (rebuild) { buildHill(); reset(); } };
}
bindSlider('a', 'a', v => v + '°', true); bindSlider('b', 'b', v => v + '°', true);
bindSlider('m', 'mk', v => v + ' kg'); bindSlider('f', 'Fm', v => v + ' N');

// orbit camera: drag to rotate, scroll / pinch / buttons to zoom (limited range)
const ZMIN = 9, ZMAX = 40;
const clampZ = v => Math.min(ZMAX, Math.max(ZMIN, v));
let az = 0.35, el = 0.32, rad = innerWidth < innerHeight ? 30 : 20; const target = new THREE.Vector3(0, 2.2, 0);
const ptrs = new Map(); let pinch = 0;
const pdist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
canvas.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId); if (ptrs.size === 2) pinch = pdist(); });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) { const d = pdist(); rad = clampZ(rad * pinch / d); pinch = d; }
  else { az -= dx * 0.006; el = Math.min(1.4, Math.max(0.03, el + dy * 0.005)); }
});
for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, e => { ptrs.delete(e.pointerId); pinch = 0; });
canvas.addEventListener('wheel', e => { e.preventDefault(); rad = clampZ(rad * (1 + e.deltaY * 0.001)); }, { passive: false });
$('zin').onclick = () => rad = clampZ(rad * 0.85);
$('zout').onclick = () => rad = clampZ(rad / 0.85);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------- loop ----------
buildHill(); reset(); resize();
let last = performance.now();
(function loop(t) {
  const dt = Math.min(0.033, (t - last) / 1000); last = t;
  for (let i = 0; i < 4; i++) sim(dt / 4);
  pose(); hud();
  camera.position.set(target.x + rad * Math.sin(az) * Math.cos(el), target.y + rad * Math.sin(el), target.z + rad * Math.cos(az) * Math.cos(el));
  camera.lookAt(target);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})(last);
