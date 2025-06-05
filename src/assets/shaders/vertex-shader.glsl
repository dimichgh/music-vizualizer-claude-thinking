uniform float time;
uniform float beat;
uniform float volume;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normal;
  
  // Apply some subtle movement based on time and audio
  float displacement = sin(position.x * 10.0 + time) * cos(position.z * 10.0 + time) * 0.05;
  
  // Add beat reactivity
  displacement *= 1.0 + beat * 0.3;
  
  // Add volume reactivity
  displacement *= 1.0 + volume * 2.0;
  
  // Apply displacement along normal
  vec3 newPosition = position + normal * displacement;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}