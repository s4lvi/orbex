export interface Poolable {
  active: boolean;
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private createFn: () => T;
  private maxSize: number;

  constructor(createFn: () => T, initialSize: number = 10, maxSize: number = 100) {
    this.createFn = createFn;
    this.maxSize = maxSize;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      const obj = this.createFn();
      obj.active = false;
      this.pool.push(obj);
    }
  }

  public get(): T {
    // Find an inactive object
    for (const obj of this.pool) {
      if (!obj.active) {
        obj.active = true;
        return obj;
      }
    }

    // If no inactive objects and pool isn't at max, create new one
    if (this.pool.length < this.maxSize) {
      const obj = this.createFn();
      obj.active = true;
      this.pool.push(obj);
      return obj;
    }

    // Pool is full, reuse oldest object (this shouldn't happen often)
    console.warn('ObjectPool: Pool exhausted, reusing active object');
    const obj = this.pool[0];
    obj.reset();
    obj.active = true;
    return obj;
  }

  public release(obj: T): void {
    obj.active = false;
    obj.reset();
  }

  public releaseAll(): void {
    for (const obj of this.pool) {
      obj.active = false;
      obj.reset();
    }
  }

  public getActiveCount(): number {
    return this.pool.filter(obj => obj.active).length;
  }

  public getPoolSize(): number {
    return this.pool.length;
  }

  public forEach(callback: (obj: T) => void): void {
    this.pool.forEach(obj => {
      if (obj.active) {
        callback(obj);
      }
    });
  }

  public filter(predicate: (obj: T) => boolean): T[] {
    return this.pool.filter(obj => obj.active && predicate(obj));
  }
}
