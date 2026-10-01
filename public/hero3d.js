/**
 * Dental Door - Three.js 3D Hero Animation
 * Features: 3D Gold Tooth, Opening Door Hinge, Particle Light Stream, & Parallax Mouse Physics
 */

(function () {
  'use strict';

  let container, canvas;
  let scene, camera, renderer;
  let toothGroup, doorPivot, doorMesh, doorLight, particlesMesh;
  let particlePositions, particleVelocities;
  let targetRotationX = 0, targetRotationY = 0;
  let mouseX = 0, mouseY = 0;
  let doorAngle = 0;
  let targetDoorAngle = -1.85; // Door opens to ~ -106 degrees
  let isOpening = true;
  let clock = new THREE.Clock();

  function init() {
    container = document.getElementById('hero-canvas-container');
    if (!container) return;

    // 1. Scene setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07070a, 0.04);

    // 2. Camera setup
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0, 8.5);

    // 3. Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    canvas = renderer.domElement;
    container.appendChild(canvas);

    // 4. Lighting setup
    const ambientLight = new THREE.AmbientLight(0x221a0f, 1.5);
    scene.add(ambientLight);

    const mainGoldLight = new THREE.DirectionalLight(0xffeaad, 2.8);
    mainGoldLight.position.set(5, 8, 6);
    mainGoldLight.castShadow = true;
    mainGoldLight.shadow.mapSize.width = 1024;
    mainGoldLight.shadow.mapSize.height = 1024;
    scene.add(mainGoldLight);

    const fillLight = new THREE.DirectionalLight(0xb5802a, 1.2);
    fillLight.position.set(-6, -4, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffdf88, 3, 12);
    rimLight.position.set(0, 4, -2);
    scene.add(rimLight);

    // Point light inside/behind the doorway for glowing effect
    doorLight = new THREE.PointLight(0xffcd56, 0, 15);
    doorLight.position.set(0, -0.2, -0.6);
    scene.add(doorLight);

    // 5. Create 3D Objects
    create3DToothAndDoor();
    createLightParticles();

    // 6. Listeners
    window.addEventListener('resize', onWindowResize, false);
    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('click', toggleDoor, false);

    // 7. Start animation loop
    animate();

    // 8. Trigger text emergence animation synchronized with door opening
    setTimeout(() => {
      const heroEl = document.getElementById('home');
      if (heroEl && isOpening) {
        heroEl.classList.add('door-opened');
      }
    }, 350);
  }

  function create3DToothAndDoor() {
    toothGroup = new THREE.Group();
    scene.add(toothGroup);

    // Ultra-polished metallic gold material
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xe6b84c,
      metalness: 0.95,
      roughness: 0.16,
      envMapIntensity: 2.2,
    });

    const doorGoldMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0c55f,
      metalness: 0.92,
      roughness: 0.18,
    });

    // ----------------------------------------------------
    // 1. Outer Tooth Hollow Ribbon Frame (Matches Logo)
    // ----------------------------------------------------
    const toothShape = new THREE.Shape();
    
    // Outer curve path of the tooth outline
    toothShape.moveTo(0, 1.5);
    toothShape.bezierCurveTo(0.6, 2.1, 1.5, 2.25, 2.0, 1.55);
    toothShape.bezierCurveTo(2.45, 0.8, 2.35, -0.3, 2.1, -1.1);
    toothShape.bezierCurveTo(1.85, -1.9, 1.3, -2.45, 0.8, -2.6);
    toothShape.bezierCurveTo(0.35, -2.7, 0.1, -2.1, 0, -1.85);
    toothShape.bezierCurveTo(-0.1, -2.1, -0.35, -2.7, -0.8, -2.6);
    toothShape.bezierCurveTo(-1.3, -2.45, -1.85, -1.9, -2.1, -1.1);
    toothShape.bezierCurveTo(-2.35, -0.3, -2.45, 0.8, -2.0, 1.55);
    toothShape.bezierCurveTo(-1.5, 2.25, -0.6, 2.1, 0, 1.5);

    // Inner curve path (Hole) creating the hollow ribbon frame
    const innerToothHole = new THREE.Path();
    innerToothHole.moveTo(0, 1.25);
    innerToothHole.bezierCurveTo(-0.45, 1.7, -1.2, 1.8, -1.6, 1.25);
    innerToothHole.bezierCurveTo(-1.95, 0.65, -1.85, -0.25, -1.65, -0.9);
    innerToothHole.bezierCurveTo(-1.45, -1.55, -1.0, -2.0, -0.6, -2.15);
    innerToothHole.bezierCurveTo(-0.25, -2.25, -0.08, -1.75, 0, -1.5);
    innerToothHole.bezierCurveTo(0.08, -1.75, 0.25, -2.25, 0.6, -2.15);
    innerToothHole.bezierCurveTo(1.0, -2.0, 1.45, -1.55, 1.65, -0.9);
    innerToothHole.bezierCurveTo(1.85, -0.25, 1.95, 0.65, 1.6, 1.25);
    innerToothHole.bezierCurveTo(1.2, 1.8, 0.45, 1.7, 0, 1.25);

    toothShape.holes.push(innerToothHole);

    // Extrude 3D Tooth Ribbon
    const extrudeSettings = {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 2,
      bevelSize: 0.06,
      bevelThickness: 0.08,
    };

    const toothGeo = new THREE.ExtrudeGeometry(toothShape, extrudeSettings);
    toothGeo.center();

    const toothMesh = new THREE.Mesh(toothGeo, goldMaterial);
    toothMesh.castShadow = true;
    toothMesh.receiveShadow = true;
    toothGroup.add(toothMesh);

    // ----------------------------------------------------
    // 2. Overlapping Top Crown Swoosh Ribbons (Logo Detail)
    // ----------------------------------------------------
    const leftSwooshCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.9, 1.7, 0.1),
      new THREE.Vector3(-0.2, 2.3, 0.15),
      new THREE.Vector3(0.5, 2.1, 0.12),
      new THREE.Vector3(1.1, 1.75, 0.08)
    );
    const leftSwooshGeo = new THREE.TubeGeometry(leftSwooshCurve, 32, 0.09, 12, false);
    const leftSwooshMesh = new THREE.Mesh(leftSwooshGeo, goldMaterial);
    leftSwooshMesh.position.set(0, 0, 0);
    toothGroup.add(leftSwooshMesh);

    const rightSwooshCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.9, 1.7, 0.0),
      new THREE.Vector3(0.1, 2.15, -0.05),
      new THREE.Vector3(-0.5, 1.85, -0.02),
      new THREE.Vector3(-1.0, 1.6, 0.02)
    );
    const rightSwooshGeo = new THREE.TubeGeometry(rightSwooshCurve, 32, 0.08, 12, false);
    const rightSwooshMesh = new THREE.Mesh(rightSwooshGeo, goldMaterial);
    toothGroup.add(rightSwooshMesh);

    // ----------------------------------------------------
    // 3. Inner Arched Doorway Frame (Centrally Positioned)
    // ----------------------------------------------------
    const doorWidth = 1.15;
    const doorHeight = 1.8;
    const archRadius = doorWidth / 2;

    const frameShape = new THREE.Shape();
    const frameW = doorWidth + 0.22;
    const frameH = doorHeight + 0.12;
    const frameR = frameW / 2;

    frameShape.moveTo(-frameR, -1.35);
    frameShape.lineTo(-frameR, -1.35 + frameH - frameR);
    frameShape.absarc(0, -1.35 + frameH - frameR, frameR, Math.PI, 0, true);
    frameShape.lineTo(frameR, -1.35);
    frameShape.lineTo(-frameR, -1.35);

    const frameHole = new THREE.Path();
    frameHole.moveTo(-archRadius, -1.3);
    frameHole.lineTo(-archRadius, -1.3 + doorHeight - archRadius);
    frameHole.absarc(0, -1.3 + doorHeight - archRadius, archRadius, Math.PI, 0, true);
    frameHole.lineTo(archRadius, -1.3);
    frameHole.lineTo(-archRadius, -1.3);
    frameShape.holes.push(frameHole);

    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.04,
      bevelThickness: 0.05,
    });
    frameGeo.center();
    const frameMesh = new THREE.Mesh(frameGeo, goldMaterial);
    frameMesh.position.set(0, -0.2, 0.02);
    frameMesh.castShadow = true;
    toothGroup.add(frameMesh);

    // ----------------------------------------------------
    // 4. 3D Hinged Door & Knob
    // ----------------------------------------------------
    doorPivot = new THREE.Group();
    doorPivot.position.set(-archRadius + 0.03, -0.55, 0.12);
    toothGroup.add(doorPivot);

    const doorShape = new THREE.Shape();
    const dW = doorWidth - 0.05;
    const dH = doorHeight - 0.04;
    const dR = dW / 2;

    doorShape.moveTo(0, 0);
    doorShape.lineTo(dW, 0);
    doorShape.lineTo(dW, dH - dR);
    doorShape.absarc(dR, dH - dR, dR, 0, Math.PI, false);
    doorShape.lineTo(0, 0);

    const doorGeo = new THREE.ExtrudeGeometry(doorShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });

    doorMesh = new THREE.Mesh(doorGeo, doorGoldMaterial);
    doorMesh.position.set(0, -dH / 2 + 0.35, 0);
    doorMesh.castShadow = true;
    doorPivot.add(doorMesh);

    // Golden Spherical Doorknob
    const knobGeo = new THREE.SphereGeometry(0.065, 20, 20);
    const knobMesh = new THREE.Mesh(knobGeo, goldMaterial);
    knobMesh.position.set(dW * 0.8, 0.0, 0.12);
    doorMesh.add(knobMesh);

    // Position of complete toothGroup in hero scene (Left Side)
    toothGroup.position.set(-1.6, 0.1, 0);
  }

  function createLightParticles() {
    const particleCount = 180;
    const geometry = new THREE.BufferGeometry();
    particlePositions = new Float32Array(particleCount * 3);
    particleVelocities = [];

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 1.2;
      const y = (Math.random() - 0.5) * 1.8 - 0.2;
      const z = -0.3 + Math.random() * 0.5;

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      particleVelocities.push({
        x: (Math.random() - 0.5) * 0.008,
        y: Math.random() * 0.012 + 0.004,
        z: Math.random() * 0.025 + 0.01,
        life: Math.random(),
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    // Custom circle canvas texture for soft glowing particles
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const ctx = pCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 235, 170, 1)');
    grad.addColorStop(0.4, 'rgba(235, 175, 60, 0.6)');
    grad.addColorStop(1, 'rgba(235, 175, 60, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const pTexture = new THREE.CanvasTexture(pCanvas);

    const material = new THREE.PointsMaterial({
      color: 0xffd573,
      size: 0.18,
      map: pTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    particlesMesh = new THREE.Points(geometry, material);
    particlesMesh.position.set(-1.6, 0, 0.2);
    scene.add(particlesMesh);
  }

  function onMouseMove(event) {
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    mouseX = (x / container.clientWidth) * 2 - 1;
    mouseY = -(y / container.clientHeight) * 2 + 1;
  }

  function toggleDoor() {
    isOpening = !isOpening;
    targetDoorAngle = isOpening ? -1.85 : 0;
    const heroEl = document.getElementById('home');
    if (heroEl) {
      heroEl.classList.toggle('door-opened', isOpening);
    }
  }

  function onWindowResize() {
    if (!container || !renderer || !camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    // Adjust 3D Tooth position based on screen width
    if (width < 768) {
      toothGroup.position.set(0, 0.9, 0);
      particlesMesh.position.set(0, 0.9, 0.2);
      camera.position.z = 9.8;
    } else {
      toothGroup.position.set(-1.6, 0.1, 0);
      particlesMesh.position.set(-1.6, 0.1, 0.2);
      camera.position.z = 8.5;
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // 1. Smooth Door Opening Hinge Animation
    doorAngle += (targetDoorAngle - doorAngle) * 0.04;
    if (doorPivot) {
      doorPivot.rotation.y = doorAngle;
    }

    // 2. Door Glow Light intensity based on openness
    const doorOpenRatio = Math.abs(doorAngle) / 1.85;
    if (doorLight) {
      doorLight.intensity = doorOpenRatio * 6.5;
    }

    // 3. Floating Idle & Parallax Physics
    targetRotationY = mouseX * 0.35;
    targetRotationX = -mouseY * 0.25;

    if (toothGroup) {
      toothGroup.rotation.y += (targetRotationY - toothGroup.rotation.y) * 0.05;
      toothGroup.rotation.x += (targetRotationX - toothGroup.rotation.x) * 0.05;
      toothGroup.position.y = (window.innerWidth < 768 ? 0.9 : 0.1) + Math.sin(time * 1.5) * 0.12;
    }

    // 4. Update Particles
    if (particlePositions && particlesMesh) {
      const positions = particlesMesh.geometry.attributes.position.array;
      const pCount = particleVelocities.length;

      for (let i = 0; i < pCount; i++) {
        const vel = particleVelocities[i];
        
        // Move particle forward and upward proportionally to door opening ratio
        positions[i * 3 + 2] += vel.z * (0.2 + doorOpenRatio * 1.2);
        positions[i * 3 + 1] += vel.y;
        positions[i * 3] += vel.x;

        // Reset particle if out of bounds
        if (positions[i * 3 + 2] > 3.0 || positions[i * 3 + 1] > 2.0) {
          positions[i * 3] = (Math.random() - 0.5) * 1.0;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 1.4 - 0.4;
          positions[i * 3 + 2] = -0.2;
        }
      }

      particlesMesh.geometry.attributes.position.needsUpdate = true;
      particlesMesh.material.opacity = 0.3 + doorOpenRatio * 0.7;
    }

    renderer.render(scene, camera);
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      onWindowResize();
    });
  } else {
    init();
    onWindowResize();
  }
})();
