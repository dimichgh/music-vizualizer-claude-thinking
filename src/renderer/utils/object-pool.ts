/**
 * Enhanced Object Pool System
 * 
 * Provides efficient reuse of frequently created/destroyed objects
 * to reduce garbage collection and improve performance.
 * 
 * Features:
 * - Automatic object lifecycle management
 * - Lazy initialization for better startup performance
 * - Memory usage monitoring
 * - Adaptive pool sizing based on usage patterns
 * - Performance metrics tracking
 * - Batched object allocation
 * - Memory pressure handling
 */

/**
 * Generic object pool interface
 */
export interface ObjectPool<T> {
  // Get an object from the pool (or create a new one if empty)
  get(): T;
  
  // Return an object to the pool for reuse
  release(obj: T): void;
  
  // Get the total number of objects managed by this pool
  size(): number;
  
  // Get number of available objects in the pool
  available(): number;
  
  // Get number of objects currently in use
  inUseCount(): number;
  
  // Clear all objects from the pool
  clear(): void;
  
  // Prewarm the pool with a specified number of objects
  prewarm(count: number): void;
  
  // Trim the pool to a specified size
  trim(maxSize: number): void;
  
  // Get the memory usage of this pool (approximate)
  getMemoryUsage(): number;
  
  // Get performance metrics for this pool
  getMetrics(): PoolMetrics;
  
  // Reserve a batch of objects (pre-allocate and return multiple objects at once)
  getBatch(count: number): T[];
  
  // Release a batch of objects back to the pool
  releaseBatch(objects: T[]): void;
  
  // Handle memory pressure (release unused objects when system is under memory pressure)
  handleMemoryPressure(): void;
}

/**
 * Function type for creating new objects
 */
export type ObjectFactory<T> = () => T;

/**
 * Function type for resetting objects before reuse
 */
export type ObjectReset<T> = (obj: T) => void;

/**
 * Generic object pool implementation
 */
/**
 * Pool performance metrics
 */
export interface PoolMetrics {
  totalCreated: number;      // Total number of objects created
  currentPoolSize: number;   // Current number of objects in the pool
  inUseCount: number;        // Number of objects currently in use
  maxUsage: number;          // Maximum number of objects in use at once
  avgUsage: number;          // Average number of objects in use
  hitRate: number;           // Pool hit rate (0-1, higher is better)
  creationTime: number;      // Total time spent creating objects (ms)
  resetTime: number;         // Total time spent resetting objects (ms)
  wastedObjects: number;     // Number of objects that were created but never used
  memoryUsage: number;       // Estimated memory usage in bytes
}

export class Pool<T> implements ObjectPool<T> {
  private pool: T[] = [];
  private createFn: ObjectFactory<T>;
  private resetFn: ObjectReset<T>;
  private inUse: Set<T> = new Set();
  private maxSize: number;
  private minSize: number = 0;
  private objectSize: number = 0; // Approximate memory size per object in bytes
  private creationTime: number = 0; // Total time spent creating objects (ms)
  private resetTime: number = 0; // Total time spent resetting objects (ms)
  private creationCount: number = 0; // Number of objects created
  private usageHistory: number[] = []; // History of usage counts for adaptive sizing
  
  // Additional metrics
  private poolHits: number = 0;       // Number of successful reuses from pool
  private poolMisses: number = 0;     // Number of times pool was empty and new object created
  private maxUsageCount: number = 0;  // Maximum number of objects in use at once
  private lastAdaptiveCheck: number = 0; // Last time we checked for adaptive sizing
  
  /**
   * Create a new object pool
   * @param createFn Function to create new objects
   * @param resetFn Function to reset objects before reuse
   * @param initialSize Initial pool size to pre-allocate
   * @param maxSize Maximum pool size (0 for unlimited)
   * @param minSize Minimum pool size to maintain
   * @param estimatedObjectSize Estimated memory size per object in bytes
   */
  constructor(
    createFn: ObjectFactory<T>,
    resetFn: ObjectReset<T> = () => {},
    initialSize: number = 0,
    maxSize: number = 0,
    minSize: number = 0,
    estimatedObjectSize: number = 1024 // Default estimate: 1KB per object
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.minSize = minSize;
    this.objectSize = estimatedObjectSize;
    
    // Pre-allocate initial objects if specified
    if (initialSize > 0) {
      this.prewarm(initialSize);
    }
  }
  
  /**
   * Get an object from the pool
   */
  get(): T {
    let obj: T;
    
    // Record usage for adaptive sizing
    this.recordUsage();
    
    if (this.pool.length > 0) {
      // Reuse an existing object
      obj = this.pool.pop()!;
      this.poolHits++;
    } else {
      // Create a new object if pool is empty
      const startTime = performance.now();
      obj = this.createFn();
      this.creationTime += performance.now() - startTime;
      this.creationCount++;
      this.poolMisses++;
    }
    
    // Track the object as in use
    this.inUse.add(obj);
    
    // Update max usage count
    if (this.inUse.size > this.maxUsageCount) {
      this.maxUsageCount = this.inUse.size;
    }
    
    return obj;
  }
  
  /**
   * Return an object to the pool
   * @param obj Object to return to the pool
   */
  release(obj: T): void {
    // Check if this object is from this pool
    if (!this.inUse.has(obj)) {
      console.warn('Trying to release an object not managed by this pool');
      return;
    }
    
    // Remove from in-use set
    this.inUse.delete(obj);
    
    // Reset the object for reuse
    const startTime = performance.now();
    this.resetFn(obj);
    this.resetTime += performance.now() - startTime;
    
    // Check if we're at maximum capacity
    if (this.maxSize > 0 && this.pool.length >= this.maxSize) {
      // Discard the object if we're at capacity
      // (Let garbage collector handle it)
      return;
    }
    
    // Add back to the available pool
    this.pool.push(obj);
    
    // Consider adaptive sizing
    this.checkAdaptiveSize();
  }
  
  /**
   * Get total number of objects managed by this pool
   */
  size(): number {
    return this.pool.length + this.inUse.size;
  }
  
  /**
   * Get number of available objects in the pool
   */
  available(): number {
    return this.pool.length;
  }
  
  /**
   * Get number of objects currently in use
   */
  inUseCount(): number {
    return this.inUse.size;
  }
  
  /**
   * Prewarm the pool by creating objects in advance
   * @param count Number of objects to prewarm
   */
  prewarm(count: number): void {
    const toCreate = Math.max(0, count - this.pool.length);
    
    if (toCreate <= 0) return;
    
    console.log(`Prewarming pool with ${toCreate} objects`);
    
    // Create objects in batches to avoid blocking the main thread
    const batchSize = 10;
    let created = 0;
    
    const createBatch = () => {
      const batchEnd = Math.min(created + batchSize, toCreate);
      const startTime = performance.now();
      
      for (let i = created; i < batchEnd; i++) {
        this.pool.push(this.createFn());
        this.creationCount++;
      }
      
      this.creationTime += performance.now() - startTime;
      created = batchEnd;
      
      if (created < toCreate) {
        // Schedule next batch with a small delay to not block the main thread
        setTimeout(createBatch, 0);
      }
    };
    
    createBatch();
  }
  
  /**
   * Trim the pool to a specified size by removing excess objects
   * @param maxSize Maximum number of objects to keep in the pool
   */
  trim(maxSize: number): void {
    if (this.pool.length <= maxSize) return;
    
    const removeCount = this.pool.length - maxSize;
    console.log(`Trimming pool by removing ${removeCount} objects`);
    
    // Remove excess objects from the pool
    this.pool.splice(0, removeCount);
  }
  
  /**
   * Record current usage for adaptive sizing
   */
  private recordUsage(): void {
    // Record current in-use count for adaptive sizing
    this.usageHistory.push(this.inUse.size);
    
    // Keep history to last 100 usages
    if (this.usageHistory.length > 100) {
      this.usageHistory.shift();
    }
  }
  
  /**
   * Check if the pool size should be adjusted based on usage patterns
   */
  private checkAdaptiveSize(): void {
    // Skip if we don't have enough usage history
    if (this.usageHistory.length < 50) return;
    
    // Calculate average and maximum usage
    const sum = this.usageHistory.reduce((a, b) => a + b, 0);
    const avgUsage = sum / this.usageHistory.length;
    const maxUsage = Math.max(...this.usageHistory);
    
    // If average usage is significantly less than pool size, trim the pool
    // but maintain a buffer for peak usage
    const idealPoolSize = Math.max(
      this.minSize,
      Math.ceil(maxUsage * 1.2) // Keep 20% more than max usage
    );
    
    // If the pool is significantly larger than needed, trim it
    if (this.pool.length > idealPoolSize * 1.5) {
      this.trim(idealPoolSize);
    }
    // If the pool is smaller than ideal and below max size, grow it
    else if (this.pool.length < idealPoolSize && 
             (this.maxSize === 0 || this.pool.length + this.inUse.size < this.maxSize)) {
      const toCreate = idealPoolSize - this.pool.length;
      this.prewarm(toCreate);
    }
  }
  
  /**
   * Get a batch of objects from the pool (for better performance when many objects are needed)
   * @param count Number of objects to get
   * @returns Array of objects from the pool
   */
  getBatch(count: number): T[] {
    const result: T[] = [];
    
    // Record usage for adaptive sizing (one record for the batch)
    this.recordUsage();
    
    // Determine how many objects we can get from the pool vs. need to create
    const fromPool = Math.min(count, this.pool.length);
    const toCreate = count - fromPool;
    
    // Get objects from pool
    if (fromPool > 0) {
      for (let i = 0; i < fromPool; i++) {
        const obj = this.pool.pop()!;
        this.inUse.add(obj);
        result.push(obj);
      }
      this.poolHits += fromPool;
    }
    
    // Create new objects if needed
    if (toCreate > 0) {
      const startTime = performance.now();
      for (let i = 0; i < toCreate; i++) {
        const obj = this.createFn();
        this.inUse.add(obj);
        result.push(obj);
      }
      this.creationTime += performance.now() - startTime;
      this.creationCount += toCreate;
      this.poolMisses += toCreate;
    }
    
    // Update max usage count
    if (this.inUse.size > this.maxUsageCount) {
      this.maxUsageCount = this.inUse.size;
    }
    
    return result;
  }
  
  /**
   * Release a batch of objects back to the pool
   * @param objects Array of objects to release
   */
  releaseBatch(objects: T[]): void {
    if (!objects || objects.length === 0) return;
    
    const startTime = performance.now();
    
    // Process objects in batches to avoid blocking the main thread
    for (const obj of objects) {
      // Check if this object is from this pool
      if (!this.inUse.has(obj)) {
        console.warn('Trying to release an object not managed by this pool');
        continue;
      }
      
      // Remove from in-use set
      this.inUse.delete(obj);
      
      // Reset the object for reuse
      this.resetFn(obj);
      
      // Check if we're at maximum capacity
      if (this.maxSize > 0 && this.pool.length >= this.maxSize) {
        // Discard the object if we're at capacity
        continue;
      }
      
      // Add back to the available pool
      this.pool.push(obj);
    }
    
    this.resetTime += performance.now() - startTime;
    
    // Consider adaptive sizing after a batch release
    const now = performance.now();
    if (now - this.lastAdaptiveCheck > 5000) { // Check every 5 seconds
      this.checkAdaptiveSize();
      this.lastAdaptiveCheck = now;
    }
  }
  
  /**
   * Handle memory pressure by releasing unused objects
   * Call this when the system is under memory pressure
   */
  handleMemoryPressure(): void {
    // Keep only the minimum required objects
    if (this.pool.length > this.minSize) {
      const removeCount = this.pool.length - this.minSize;
      console.log(`Memory pressure: trimming pool by removing ${removeCount} objects`);
      this.pool.splice(0, removeCount);
    }
  }
  
  /**
   * Get performance metrics for this pool
   */
  getMetrics(): PoolMetrics {
    // Calculate average usage from history
    const sum = this.usageHistory.reduce((a, b) => a + b, 0);
    const avgUsage = this.usageHistory.length > 0 ? sum / this.usageHistory.length : 0;
    
    // Calculate hit rate (0-1, higher is better)
    const totalRequests = this.poolHits + this.poolMisses;
    const hitRate = totalRequests > 0 ? this.poolHits / totalRequests : 0;
    
    // Calculate wasted objects (created but never used)
    const wastedObjects = Math.max(0, this.pool.length - this.maxUsageCount);
    
    return {
      totalCreated: this.creationCount,
      currentPoolSize: this.pool.length,
      inUseCount: this.inUse.size,
      maxUsage: this.maxUsageCount,
      avgUsage,
      hitRate,
      creationTime: this.creationTime,
      resetTime: this.resetTime,
      wastedObjects,
      memoryUsage: this.getMemoryUsage()
    };
  }
  
  /**
   * Get the approximate memory usage of this pool in bytes
   */
  getMemoryUsage(): number {
    return (this.pool.length + this.inUse.size) * this.objectSize;
  }
  
  /**
   * Clear all objects from the pool
   */
  clear(): void {
    this.pool = [];
    this.inUse.clear();
    this.usageHistory = [];
    // Reset metrics but keep creation count for reference
    this.poolHits = 0;
    this.poolMisses = 0;
    this.maxUsageCount = 0;
    this.lastAdaptiveCheck = 0;
  }
}

/**
 * THREE.js specific object pools
 */
import * as THREE from 'three';

/**
 * Create a pool for Three.js geometries
 */
export function createGeometryPool<T extends THREE.BufferGeometry>(
  factory: ObjectFactory<T>,
  resetFn?: ObjectReset<T>,
  initialSize: number = 0,
  maxSize: number = 0,
  minSize: number = 0
): Pool<T> {
  // Default reset function for geometries
  const defaultReset = (geometry: T) => {
    // Reset any attributes that need updating
    if (geometry.attributes.position) {
      geometry.attributes.position.needsUpdate = false;
    }
    // Could add more geometry-specific reset logic here
  };
  
  // Estimate memory size based on a typical geometry
  const estimatedSize = 5 * 1024; // 5KB per geometry (approximate)
  
  return new Pool<T>(
    factory,
    resetFn || defaultReset,
    initialSize,
    maxSize,
    minSize,
    estimatedSize
  );
}

/**
 * Create a pool for Three.js materials
 */
export function createMaterialPool<T extends THREE.Material>(
  factory: ObjectFactory<T>,
  resetFn?: ObjectReset<T>,
  initialSize: number = 0,
  maxSize: number = 0,
  minSize: number = 0
): Pool<T> {
  // Default reset function for materials
  const defaultReset = (material: T) => {
    // Reset common material properties
    material.opacity = 1.0;
    if ('color' in material) {
      (material as any).color.set(0xffffff);
    }
    // Could add more material-specific reset logic here
  };
  
  // Estimate memory size based on a typical material
  const estimatedSize = 2 * 1024; // 2KB per material (approximate)
  
  return new Pool<T>(
    factory,
    resetFn || defaultReset,
    initialSize,
    maxSize,
    minSize,
    estimatedSize
  );
}

/**
 * Create a pool for Three.js meshes
 */
export function createMeshPool(
  geometryFactory: ObjectFactory<THREE.BufferGeometry>,
  materialFactory: ObjectFactory<THREE.Material>,
  resetFn?: ObjectReset<THREE.Mesh>,
  initialSize: number = 0,
  maxSize: number = 0,
  minSize: number = 0
): Pool<THREE.Mesh> {
  // Factory function to create a new mesh
  const factory = () => new THREE.Mesh(geometryFactory(), materialFactory());
  
  // Default reset function for meshes
  const defaultReset = (mesh: THREE.Mesh) => {
    // Reset transform
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    
    // Reset visibility
    mesh.visible = true;
    
    // Reset userData
    mesh.userData = {};
  };
  
  // Estimate memory size based on typical mesh (geometry + material + overhead)
  const estimatedSize = 8 * 1024; // 8KB per mesh (approximate)
  
  return new Pool<THREE.Mesh>(
    factory,
    resetFn || defaultReset,
    initialSize,
    maxSize,
    minSize,
    estimatedSize
  );
}

/**
 * Create a pool for Three.js particle systems
 */
export function createParticleSystemPool(
  particleCount: number,
  materialFactory: ObjectFactory<THREE.PointsMaterial>,
  resetFn?: ObjectReset<THREE.Points>,
  initialSize: number = 0,
  maxSize: number = 0,
  minSize: number = 0
): Pool<THREE.Points> {
  // Factory function to create particle system
  const factory = () => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const velocity = new Float32Array(particleCount * 3);
    const alive = new Float32Array(particleCount); // 1.0 = alive, 0.0 = inactive
    
    // Initialize with zero values
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;
      sizes[i] = 1.0;
      colors[i3] = 1.0;
      colors[i3 + 1] = 1.0;
      colors[i3 + 2] = 1.0;
      velocity[i3] = 0;
      velocity[i3 + 1] = 0;
      velocity[i3 + 2] = 0;
      alive[i] = 0.0; // Start as inactive
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocity, 3));
    geometry.setAttribute('alive', new THREE.BufferAttribute(alive, 1));
    
    // Store additional data in userData for easy access during updates
    const points = new THREE.Points(geometry, materialFactory());
    points.userData.positions = positions;
    points.userData.sizes = sizes;
    points.userData.colors = colors;
    points.userData.velocity = velocity;
    points.userData.alive = alive;
    points.userData.aliveCount = 0;
    points.userData.capacity = particleCount;
    
    return points;
  };
  
  // Default reset function for particle systems
  const defaultReset = (particles: THREE.Points) => {
    // Reset transform
    particles.position.set(0, 0, 0);
    particles.rotation.set(0, 0, 0);
    particles.scale.set(1, 1, 1);
    
    // Reset visibility
    particles.visible = true;
    
    // Reset geometry data
    const positions = (particles.geometry.attributes.position as THREE.BufferAttribute).array;
    const sizes = (particles.geometry.attributes.size as THREE.BufferAttribute).array;
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;
      sizes[i] = 1.0;
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.size.needsUpdate = true;
    
    // Reset userData
    particles.userData = {};
  };
  
  // Estimate memory size based on particle count (positions, colors, sizes, etc.)
  // Each particle typically uses ~40 bytes (3 floats for position, 3 for color, 1 for size, etc.)
  const estimatedSize = (particleCount * 40) + 2048; // particles + overhead
  
  return new Pool<THREE.Points>(
    factory,
    resetFn || defaultReset,
    initialSize,
    maxSize,
    minSize,
    estimatedSize
  );
}

/**
 * Create a pool for instanced meshes
 */
export function createInstancedMeshPool(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  maxInstances: number,
  resetFn?: ObjectReset<THREE.InstancedMesh>,
  initialSize: number = 0,
  maxSize: number = 0,
  minSize: number = 0
): Pool<THREE.InstancedMesh> {
  // Factory function to create instanced mesh
  const factory = () => new THREE.InstancedMesh(geometry, material, maxInstances);
  
  // Default reset function for instanced meshes
  const defaultReset = (mesh: THREE.InstancedMesh) => {
    // Reset count to 0
    mesh.count = 0;
    
    // Reset transform
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    
    // Reset visibility
    mesh.visible = true;
    
    // Reset userData
    mesh.userData = {};
  };
  
  // Estimate memory size based on instance count
  const estimatedSize = (maxInstances * 80) + 4096; // instances + overhead
  
  return new Pool<THREE.InstancedMesh>(
    factory,
    resetFn || defaultReset,
    initialSize,
    maxSize,
    minSize,
    estimatedSize
  );
}