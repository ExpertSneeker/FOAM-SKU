import * as THREE from 'three';

function seededRandom(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createFoamTextures(maxAnisotropy) {
  const size = 1024, tileCm = 8, random = seededRandom(420231);
  const height = new Float32Array(size * size);
  // Rounded, uneven depressions create the fine open-cell surface. Their
  // physical scale remains unchanged across all SKU dimensions.
  for (let i=0;i<height.length;i++) height[i] = 0.76 + (random()-0.5)*0.035;
  for (let i=0;i<13000;i++) {
    const cx=random()*size, cy=random()*size;
    const radius=1.25+Math.pow(random(),1.6)*4.8;
    const rx=radius*(0.8+random()*0.4), ry=radius*(0.8+random()*0.4);
    const depth=0.10+random()*0.27;
    for(let y=Math.floor(cy-ry*1.5);y<=Math.ceil(cy+ry*1.5);y++) {
      for(let x=Math.floor(cx-rx*1.5);x<=Math.ceil(cx+rx*1.5);x++) {
        const d=((x-cx)/rx)**2+((y-cy)/ry)**2;
        if(d>2.25) continue;
        const ix=((x%size)+size)%size, iy=((y%size)+size)%size;
        height[iy*size+ix] -= depth*Math.exp(-d*2.2);
      }
    }
  }
  const albedo = document.createElement('canvas'), normal = document.createElement('canvas');
  albedo.width=normal.width=size; albedo.height=normal.height=size;
  const ac=albedo.getContext('2d'), nc=normal.getContext('2d');
  const color=ac.createImageData(size,size), normals=nc.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=y*size+x, j=i*4;
    const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size];
    const dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
    const nx=-dx*4.0, ny=dy*4.0, nz=1, norm=Math.hypot(nx,ny,nz);
    normals.data[j]=Math.round((nx/norm*0.5+0.5)*255);
    normals.data[j+1]=Math.round((ny/norm*0.5+0.5)*255);
    normals.data[j+2]=Math.round((nz/norm*0.5+0.5)*255);
    normals.data[j+3]=255;
    const pore=Math.max(0,0.73-height[i]);
    const c=248-pore*60+(random()-0.5)*1.5;
    color.data[j]=c; color.data[j+1]=c; color.data[j+2]=c; color.data[j+3]=255;
  }
  ac.putImageData(color,0,0); nc.putImageData(normals,0,0);
  const map=new THREE.CanvasTexture(albedo), normalMap=new THREE.CanvasTexture(normal);
  map.colorSpace=THREE.SRGBColorSpace;
  normalMap.colorSpace=THREE.NoColorSpace;
  for(const t of [map,normalMap]) {
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.anisotropy=maxAnisotropy;
  }
  return {map,normalMap,tileCm};
}
