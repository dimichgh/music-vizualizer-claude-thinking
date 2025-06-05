uniform float time;
uniform float beat;
uniform float volume;
uniform vec3 colorPalette[5];

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

// Simplex noise function
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                      -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Function to interpolate between two colors
vec3 lerpColor(vec3 a, vec3 b, float t) {
  return a + (b - a) * t;
}

void main() {
  // Create dynamic noise value
  float noiseScale = 4.0 + sin(time * 0.1) * 0.5 + beat * 2.0;
  float noise = snoise(vUv * noiseScale + time * 0.1);
  
  // Add extra details with additional noise layers
  noise += snoise(vUv * noiseScale * 2.0 - time * 0.05) * 0.5;
  
  // Normalize noise to 0-1 range
  float normalizedNoise = noise * 0.5 + 0.5;
  
  // Choose colors from palette based on noise value
  int colorIndex = int(normalizedNoise * 4.0);
  vec3 color1 = colorPalette[colorIndex];
  vec3 color2 = colorPalette[min(colorIndex + 1, 4)];
  
  // Interpolate between the two colors
  float t = fract(normalizedNoise * 4.0);
  vec3 finalColor = lerpColor(color1, color2, t);
  
  // Add beat reactivity
  if (beat > 0.5) {
    finalColor += vec3(0.2, 0.1, 0.3) * beat;
  }
  
  // Add volume reactivity
  finalColor *= 1.0 + volume * 0.5;
  
  // Add subtle edge glow
  float edgeFactor = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
  finalColor += vec3(0.3, 0.2, 0.8) * edgeFactor * (0.5 + beat * 0.5);
  
  // Apply some subtle pulsing
  float pulse = 0.5 + 0.5 * sin(time * 0.5);
  finalColor *= 0.8 + pulse * 0.2;
  
  gl_FragColor = vec4(finalColor, 0.9);
}