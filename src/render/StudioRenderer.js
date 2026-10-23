import * as THREE from 'three';
import { createFoamTextures } from './textures.js';
import { createScene } from './scene.js';

const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const aborted = () => new DOMException('渲染已取消', 'AbortError');

export class StudioRenderer {
  constructor(onContextLost) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.lost = false;
    this.handleLost = event => { event.preventDefault(); this.lost = true; onContextLost?.(); };
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleLost);
    this.textures = createFoamTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.generation = 0;
  }

  async render(config, canvas, width, height, samples, { signal, onProgress } = {}) {
    const generation = ++this.generation;
    const check = () => {
      if (signal?.aborted || generation !== this.generation) throw aborted();
      if (this.lost) throw new Error('显卡渲染上下文已丢失，请刷新页面后降低导出分辨率。');
    };
    check();
    const renderer = this.renderer;
    if (Math.max(width, height) > renderer.capabilities.maxTextureSize) throw new Error('分辨率超过当前显卡限制，请降低导出尺寸。');
    renderer.setSize(width, height, false);
    const bundle = createScene(config, this.textures, width, height);
    // Render linear premultiplied RGBA, then average on the GPU. A floating
    // target avoids Canvas2D's per-sample 8-bit rounding and alpha dark fringes.
    const sample = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples), depthBuffer: true });
    const accumulation = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, depthBuffer: false });
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    const average = new THREE.ShaderMaterial({
      vertexShader, fragmentShader: 'uniform sampler2D frame; varying vec2 vUv; void main(){gl_FragColor=texture2D(frame,vUv);}',
      uniforms: { frame: { value: sample.texture } }, depthTest: false, depthWrite: false,
      transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.ConstantAlphaFactor, blendDst: THREE.OneMinusConstantAlphaFactor,
      blendSrcAlpha: THREE.ConstantAlphaFactor, blendDstAlpha: THREE.OneMinusConstantAlphaFactor,
    });
    const output = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `uniform sampler2D frame; varying vec2 vUv;
        void main(){
          vec4 sampleColor=texture2D(frame,vUv);
          gl_FragColor=vec4(sampleColor.a>0.000001?sampleColor.rgb/sampleColor.a:vec3(0.),sampleColor.a);
          #include <colorspace_fragment>
          gl_FragColor.rgb*=gl_FragColor.a;
        }`,
      uniforms: { frame: { value: accumulation.texture } }, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(quadGeometry, average);
    const pass = new THREE.Scene(); pass.add(quad);
    const camera = new THREE.Camera();
    const base = bundle.key.position.clone();
    const context = canvas.getContext('2d');
    try {
      renderer.setRenderTarget(accumulation); renderer.clear();
      for (let i = 0; i < samples; i++) {
        check();
        const angle = i * 2.399963229728653;
        const radius = Math.sqrt((i + 0.5) / samples) * bundle.extent * config.shadowSoftness;
        bundle.key.position.copy(base).add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        renderer.setRenderTarget(sample); renderer.autoClear = true;
        renderer.render(bundle.scene, bundle.camera);
        quad.material = average; average.blendAlpha = 1 / (i + 1);
        renderer.setRenderTarget(accumulation); renderer.autoClear = false;
        renderer.render(pass, camera);
        if (i === samples - 1 || i % 4 === 3) {
          quad.material = output;
          renderer.setRenderTarget(null); renderer.autoClear = true;
          renderer.render(pass, camera);
          if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
          context.clearRect(0, 0, width, height);
          context.drawImage(renderer.domElement, 0, 0);
          onProgress?.((i + 1) / samples);
          await nextFrame();
        }
      }
      check();
      return canvas;
    } finally {
      renderer.setRenderTarget(null); renderer.autoClear = true;
      sample.dispose(); accumulation.dispose(); average.dispose(); output.dispose(); quadGeometry.dispose(); bundle.dispose();
    }
  }

  dispose() {
    ++this.generation;
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleLost);
    this.textures.map.dispose(); this.textures.normalMap.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
