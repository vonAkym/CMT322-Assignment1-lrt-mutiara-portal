// Option C: a small low-poly LRT train going round an elevated loop, made with Three.js.
// Three.js is loaded only when this tile is shown. The animation pauses when the tile is off screen,
// becomes a still picture under reduced motion (also when that setting changes later), and every
// geometry and material is freed when the page is left. Without WebGL the SVG scene is shown instead.
import { useEffect, useRef, useState } from 'react';
import { TiltScene } from './TrainScene.jsx';

const R = 3.4;         // radius of the loop
const DECK = 1.05;     // height of the guideway deck
const CAR_GAP = 0.4;   // angle between cars

function build(THREE, el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // transparent: the tile's CSS gradient shows through
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6e9f8, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(6, 10, 4);
  scene.add(sun);

  // One material per colour, flat shaded for the low-poly look.
  const mats = {};
  const mat = (c) => (mats[c] ??= new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0 }));
  const mesh = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); return m; };

  const world = new THREE.Group();
  world.rotation.y = -0.5;
  scene.add(world);

  // Ground and a sky-blue plaza in the middle.
  world.add(mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.3, 40), 0xdcfce7, 0, -0.15, 0));
  world.add(mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.32, 32), 0xe0f2fe, 0, -0.14, 0));

  // Guideway: a white ring on pillars.
  const deck = mesh(new THREE.TorusGeometry(R, 0.2, 6, 80), 0xffffff, 0, DECK, 0);
  deck.rotation.x = Math.PI / 2;
  deck.scale.set(1, 1, 0.55);
  world.add(deck);
  const pillarGeo = new THREE.CylinderGeometry(0.09, 0.13, DECK, 6);
  const capGeo = new THREE.BoxGeometry(0.5, 0.08, 0.16);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    world.add(mesh(pillarGeo, 0xe2e8f0, Math.cos(a) * R, DECK / 2, Math.sin(a) * R));
    const cap = mesh(capGeo, 0xf1f5f9, Math.cos(a) * R, DECK - 0.12, Math.sin(a) * R);
    cap.rotation.y = -a;
    world.add(cap);
  }

  // A round tower in the middle (Komtar style) and pastel shophouses and trees around the loop.
  world.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 12), 0xbae6fd, 0, 1.6, 0));
  world.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 12), 0xffffff, 0, 3.2, 0));
  const pastel = [0xffd8c2, 0xfde68a, 0xa7f3d0, 0xddd6fe, 0xfbcfe8, 0xbae6fd];
  const houseGeo = new THREE.BoxGeometry(0.7, 1, 0.6);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2, r = i % 2 ? 4.6 : 1.6, h = 0.45 + ((i * 37) % 5) * 0.12;
    const house = mesh(houseGeo, pastel[i % pastel.length], Math.cos(a) * r, h / 2, Math.sin(a) * r);
    house.scale.y = h;
    house.rotation.y = -a;
    world.add(house);
  }
  const crownGeo = new THREE.ConeGeometry(0.28, 0.7, 6);
  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.25, 5);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.55, r = 5.05;
    world.add(mesh(trunkGeo, 0xd4b48c, Math.cos(a) * r, 0.12, Math.sin(a) * r));
    world.add(mesh(crownGeo, i % 2 ? 0x86efac : 0x6ee7b7, Math.cos(a) * r, 0.58, Math.sin(a) * r));
  }

  // The train: three rounded cars with windows, a teal stripe and a headlight on the front car.
  const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.78, 4, 10);
  const windowGeo = new THREE.BoxGeometry(0.84, 0.14, 0.54);
  const stripeGeo = new THREE.BoxGeometry(1.0, 0.06, 0.535);
  const cars = [0, 1, 2].map((i) => {
    const car = new THREE.Group();
    const body = mesh(bodyGeo, 0xffffff);
    body.rotation.z = Math.PI / 2;
    car.add(body, mesh(windowGeo, 0x335f8a, 0, 0.07, 0), mesh(stripeGeo, 0x14b8a6, 0, -0.08, 0));
    if (i === 0) car.add(mesh(new THREE.SphereGeometry(0.05, 6, 6), 0xfde68a, 0.64, -0.02, 0));
    world.add(car);
    return car;
  });
  const place = (t) => {
    const a0 = t * 0.32;
    cars.forEach((car, i) => {
      const a = a0 - i * CAR_GAP;
      car.position.set(Math.cos(a) * R, DECK + 0.4, Math.sin(a) * R);
      car.rotation.y = -(a + Math.PI / 2); // face along the loop
    });
  };

  // ---------- Size, animation and pausing ----------
  const fit = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const d = camera.aspect < 1.25 ? 1.25 / camera.aspect : 1; // step back in tall tiles so the loop fits
    camera.position.set(0, 6.4 * d, 10 * d);
    camera.lookAt(0, 0.9, 0);
    camera.updateProjectionMatrix();
  };
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let t = 2, last = 0, raf = 0, running = false, visible = true;
  const draw = () => { place(t); renderer.render(scene, camera); };
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    world.rotation.y -= dt * 0.08;
    draw();
    raf = requestAnimationFrame(frame);
  };
  const update = () => {
    const go = visible && !mq.matches;
    if (go && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!go && running) { running = false; cancelAnimationFrame(raf); }
    if (!go) draw(); // still picture
  };
  const ro = new ResizeObserver(() => { fit(); if (!running) draw(); });
  ro.observe(el);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); });
  io.observe(el);
  mq.addEventListener('change', update);
  fit();
  update();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    mq.removeEventListener('change', update);
    const geos = new Set();
    scene.traverse((o) => { if (o.geometry) geos.add(o.geometry); });
    geos.forEach((g) => g.dispose());
    Object.values(mats).forEach((m) => m.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}

export default function TrainThree() {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cleanup = null, gone = false;
    import('three')
      .then((THREE) => { if (!gone) cleanup = build(THREE, ref.current); })
      .catch((e) => { console.error(e); if (!gone) setFailed(true); });
    return () => { gone = true; if (cleanup) cleanup(); };
  }, []);

  if (failed) return <TiltScene />;
  return <div className="lp-three" ref={ref} role="img" aria-label="3D model of an LRT train going round an elevated loop past a tower and shophouses" />;
}
