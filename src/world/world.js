// Shared "physics world": ground height, water level, things to bump into
// and stand on, bouncy clouds and bouncy pinkies.
export class World {
  constructor({ terrain, waterLevel = 0, bounds = { x: 0, z: 0, r: 150 } }) {
    this.terrain = terrain;
    this.waterLevel = waterLevel;
    this.bounds = bounds;
    this.colliders = [];
    this.bouncers = []; // { x, z, r, top, power, onBounce }
    this.clouds = null;
  }

  terrainHeight(x, z) { return this.terrain.getHeight(x, z); }

  addColliders(list) { for (const c of list) this.colliders.push(c); }

  // Highest surface under (x,z) that is below yHint (so you can walk under arches)
  groundHeight(x, z, yHint = Infinity) {
    let h = this.terrain.getHeight(x, z);
    for (const c of this.colliders) {
      if (c.noStand) continue;
      if (c.top > yHint + 0.01 || c.top <= h) continue;
      if (c.type === 'cyl') {
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz < c.r * c.r) h = c.top;
      } else if (c.type === 'box') {
        const [lx, lz] = local(c, x, z);
        if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) h = c.top;
      }
    }
    return h;
  }

  // Push a body out of solid things it walks into
  collide(pos, radius, height) {
    for (const c of this.colliders) {
      if (pos.y >= c.top - 0.3 || pos.y + height < c.bottom) continue;
      if (c.type === 'cyl') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const rr = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = c.x + (dx / d) * rr;
          pos.z = c.z + (dz / d) * rr;
        }
      } else if (c.type === 'box') {
        const [lx, lz] = local(c, pos.x, pos.z);
        const ox = c.hw + radius - Math.abs(lx);
        const oz = c.hd + radius - Math.abs(lz);
        if (ox > 0 && oz > 0) {
          let nx = lx, nz = lz;
          if (ox < oz) nx = Math.sign(lx) * (c.hw + radius); else nz = Math.sign(lz) * (c.hd + radius);
          const cos = Math.cos(c.rot || 0), sin = Math.sin(c.rot || 0);
          pos.x = c.x + nx * cos + nz * sin;
          pos.z = c.z - nx * sin + nz * cos;
        }
      }
    }
  }

  // Is this point inside a solid box (like a house)? Used to keep the camera outside.
  pointBlocked(x, y, z) {
    for (const c of this.colliders) {
      if (c.type !== 'box' || c.hd < 1 || c.hw < 1 || y > c.top + 0.3 || y < c.bottom) continue;
      const [lx, lz] = local(c, x, z);
      if (Math.abs(lx) < c.hw + 0.3 && Math.abs(lz) < c.hd + 0.3 && c.hw < 50) return true;
    }
    return false;
  }

  bounceAt(pos, vy) {
    if (vy > 0) return null;
    for (const b of this.bouncers) {
      const dx = pos.x - b.x, dz = pos.z - b.z;
      if (dx * dx + dz * dz < b.r * b.r && pos.y <= b.top && pos.y > b.top - 1.2) {
        b.onBounce?.();
        return { top: b.top, power: b.power ?? 15, bouncer: b };
      }
    }
    if (this.clouds) {
      const c = this.clouds.bounceAt(pos, vy);
      if (c) return { top: c.top, power: 17, cloud: c.cloud };
    }
    return null;
  }
}

// convert world x,z into a rotated box's local frame
function local(c, x, z) {
  const dx = x - c.x, dz = z - c.z;
  const cos = Math.cos(c.rot || 0), sin = Math.sin(c.rot || 0);
  return [dx * cos - dz * sin, dx * sin + dz * cos];
}
