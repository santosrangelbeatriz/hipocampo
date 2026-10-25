// Shader leve: uma malha de tela inteira, duas texturas e nenhum objeto Three adicional.
const vertexShader = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShader = `
  precision highp float;

  uniform sampler2D uImage;
  uniform sampler2D uMask;
  uniform vec2 uResolution;
  uniform vec2 uImageResolution;
  uniform float uTime;
  uniform float uMotion;
  uniform float uReducedMotion;
  varying vec2 vUv;

  float random(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(random(cell), random(cell + vec2(1.0, 0.0)), local.x),
      mix(random(cell + vec2(0.0, 1.0)), random(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  vec2 coverUv(vec2 uv) {
    float canvasRatio = uResolution.x / max(uResolution.y, 1.0);
    float imageRatio = uImageResolution.x / max(uImageResolution.y, 1.0);
    vec2 scale = vec2(1.0);

    if (canvasRatio > imageRatio) {
      scale.y = imageRatio / canvasRatio;
    } else {
      scale.x = canvasRatio / imageRatio;
    }

    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv);
    float mask = texture2D(uMask, vUv).r;
    float motion = uMotion * (1.0 - uReducedMotion);
    float time = uTime * (1.0 - uReducedMotion);

    float displacement = (noise(uv * 5.5 + time * 0.055) - 0.5) * 0.008 * motion;
    float glitchClock = random(vec2(floor(time * 0.72), 4.17));
    float glitchBand = step(0.972, glitchClock)
      * step(0.012, abs(vUv.y - fract(glitchClock * 7.13)))
      * step(abs(vUv.y - fract(glitchClock * 7.13)), 0.052);
    vec2 displacedUv = uv + vec2(displacement + glitchBand * 0.018, displacement * 0.35);

    float chroma = mix(0.00045, 0.0022, mask) * motion;
    vec3 photograph = vec3(
      texture2D(uImage, displacedUv + vec2(chroma, 0.0)).r,
      texture2D(uImage, displacedUv).g,
      texture2D(uImage, displacedUv - vec2(chroma, 0.0)).b
    );

    float luminance = dot(photograph, vec3(0.299, 0.587, 0.114));
    vec3 forgotten = mix(vec3(luminance), vec3(0.965, 0.955, 0.91), 0.78);
    float stainNoise = noise(uv * 3.4 + vec2(1.3, -0.7));
    float stains = smoothstep(0.57, 0.78, stainNoise + noise(uv * 8.0) * 0.24);
    forgotten = mix(forgotten, vec3(1.0, 0.995, 0.96), stains * 0.82);

    float grain = random(vUv * uResolution + vec2(time * 51.0, -time * 37.0)) - 0.5;
    forgotten += grain * 0.085 * (1.0 - mask * 0.65) * motion;
    photograph += grain * 0.025 * motion;

    vec3 color = mix(forgotten, photograph, smoothstep(0.04, 0.92, mask));
    float vignette = 1.0 - smoothstep(0.24, 0.82, length(vUv - 0.5));
    color *= mix(0.72, 1.0, vignette);
    color = mix(color, vec3(1.0), glitchBand * (1.0 - mask) * 0.58);

    gl_FragColor = vec4(color, 1.0);
  }
`

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Falha ao compilar shader'
    gl.deleteShader(shader)
    throw new Error(message)
  }

  return shader
}

function createProgram(gl) {
  const program = gl.createProgram()
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader)

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Falha ao vincular shaders'
    gl.deleteProgram(program)
    throw new Error(message)
  }

  return program
}

function createTexture(gl, unit, width = 1, height = 1, pixels = null) {
  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  )
  return texture
}

export class MemoryPhotoRenderer {
  constructor(canvas, { imageUrl, reducedMotion = false, onReady, onUnavailable } = {}) {
    this.canvas = canvas
    this.imageUrl = imageUrl
    this.reducedMotion = reducedMotion
    this.onReady = onReady
    this.onUnavailable = onUnavailable
    this.pointer = { x: 0.5, y: 0.5, active: false, strength: 0 }
    this.maskSize = 96
    // O filme e a máscara rodam em 24 fps; cursor, tilt e marquees seguem no ticker da tela.
    this.frameInterval = 1000 / 24
    this.lastRenderTime = Number.NEGATIVE_INFINITY
    this.accumulatedDelta = 0
    this.forceRender = true
    this.imageSize = { width: 1, height: 1 }
    this.ready = false
    this.destroyed = false
    this.resizeObserver = null

    this.maskCanvas = document.createElement('canvas')
    this.maskCanvas.width = this.maskSize
    this.maskCanvas.height = this.maskSize
    this.maskContext = this.maskCanvas.getContext('2d', { alpha: false })
    this.maskContext.fillStyle = '#000'
    this.maskContext.fillRect(0, 0, this.maskSize, this.maskSize)

    try {
      this.gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      })
      if (!this.gl) throw new Error('WebGL indisponível')
      this.initializeGl()
      this.loadImage()
    } catch (error) {
      console.warn('[Hipocampo] A fotografia usará o fallback sem WebGL.', error)
      this.onUnavailable?.()
    }
  }

  initializeGl() {
    const gl = this.gl
    this.program = createProgram(gl)
    gl.useProgram(this.program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const position = gl.getAttribLocation(this.program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    this.uniforms = {
      image: gl.getUniformLocation(this.program, 'uImage'),
      mask: gl.getUniformLocation(this.program, 'uMask'),
      resolution: gl.getUniformLocation(this.program, 'uResolution'),
      imageResolution: gl.getUniformLocation(this.program, 'uImageResolution'),
      time: gl.getUniformLocation(this.program, 'uTime'),
      motion: gl.getUniformLocation(this.program, 'uMotion'),
      reducedMotion: gl.getUniformLocation(this.program, 'uReducedMotion'),
    }

    this.imageTexture = createTexture(gl, 0, 1, 1, new Uint8Array([245, 240, 225, 255]))
    this.maskTexture = createTexture(gl, 1, this.maskSize, this.maskSize)
    gl.uniform1i(this.uniforms.image, 0)
    gl.uniform1i(this.uniforms.mask, 1)

    this.onContextLost = (event) => {
      event.preventDefault()
      this.ready = false
      this.onUnavailable?.()
    }
    this.canvas.addEventListener('webglcontextlost', this.onContextLost)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.canvas)
    this.resize()
  }

  loadImage() {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      if (this.destroyed || !this.gl) return
      const gl = this.gl
      this.imageSize.width = image.naturalWidth || 1
      this.imageSize.height = image.naturalHeight || 1
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      this.seedMask()
      this.ready = true
      this.onReady?.()
      this.render(0, 16.67, 0)
    }
    image.onerror = () => this.onUnavailable?.()
    image.src = this.imageUrl
  }

  seedMask() {
    const context = this.maskContext
    const center = this.maskSize * 0.5
    const radius = this.maskSize * 0.22
    const gradient = context.createRadialGradient(center, center, 0, center, center, radius)
    gradient.addColorStop(0, 'rgba(255,255,255,0.62)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.22)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(center - radius, center - radius, radius * 2, radius * 2)
  }

  resize() {
    if (!this.gl) return
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.gl.viewport(0, 0, width, height)
      this.forceRender = true
    }
  }

  setReducedMotion(value) {
    this.reducedMotion = value
    this.forceRender = true
  }

  setPointer(clientX, clientY, active = true, strength = 1, bounds = null) {
    const rect = bounds || this.canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return false
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height
    const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
    this.pointer.x = Math.min(1, Math.max(0, x))
    this.pointer.y = Math.min(1, Math.max(0, y))
    this.pointer.active = active && inside
    this.pointer.strength = strength
    if (this.reducedMotion) this.forceRender = true
    return inside
  }

  clearPointer() {
    this.pointer.active = false
  }

  updateMask(deltaMs) {
    // A máscara de baixa resolução guarda o rastro da lembrança e o apaga aos poucos.
    const context = this.maskContext
    const fade = this.reducedMotion ? 0 : Math.min(0.045, deltaMs * 0.00042)
    if (fade > 0) {
      context.fillStyle = `rgba(0,0,0,${fade.toFixed(4)})`
      context.fillRect(0, 0, this.maskSize, this.maskSize)
    }

    if (this.pointer.active) {
      const x = this.pointer.x * this.maskSize
      const y = this.pointer.y * this.maskSize
      const radius = this.maskSize * (0.25 + this.pointer.strength * 0.09)
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(255,255,255,0.98)')
      gradient.addColorStop(0.42, 'rgba(255,255,255,0.72)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = gradient
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }

    const gl = this.gl
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.maskCanvas)
  }

  render(timeMs, deltaMs = 16.67, motion = 1) {
    if (!this.ready || !this.gl || this.destroyed) return
    this.accumulatedDelta += deltaMs
    const elapsed = timeMs - this.lastRenderTime
    if (
      !this.forceRender
      && (this.reducedMotion || elapsed < this.frameInterval)
    ) {
      return
    }

    const gl = this.gl
    this.updateMask(this.accumulatedDelta)
    this.accumulatedDelta = 0
    this.lastRenderTime = timeMs
    this.forceRender = false
    gl.useProgram(this.program)
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height)
    gl.uniform2f(this.uniforms.imageResolution, this.imageSize.width, this.imageSize.height)
    gl.uniform1f(this.uniforms.time, timeMs * 0.001)
    gl.uniform1f(this.uniforms.motion, motion)
    gl.uniform1f(this.uniforms.reducedMotion, this.reducedMotion ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  destroy() {
    this.destroyed = true
    this.ready = false
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    if (!this.gl) return
    this.gl.deleteTexture(this.imageTexture)
    this.gl.deleteTexture(this.maskTexture)
    this.gl.deleteProgram(this.program)
  }
}
