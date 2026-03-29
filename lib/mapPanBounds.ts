/** Where the map image is drawn inside the `mapW × mapH` box (`resizeMode="contain"`). */
export function getContainedImageRect(
  vw: number,
  vh: number,
  mapScale: number,
  srcW: number,
  srcH: number,
) {
  const mw = vw * mapScale;
  const mh = vh * mapScale;
  const s = Math.min(mw / srcW, mh / srcH);
  const rw = srcW * s;
  const rh = srcH * s;
  const ox = (mw - rw) / 2;
  const oy = (mh - rh) / 2;
  return { mw, mh, ox, oy, rw, rh, scale: s };
}

/** Pan limits for `resizeMode="contain"` so the viewport never enters letterboxed (empty) bands */
export function containPanBounds(
  vw: number,
  vh: number,
  mapScale: number,
  srcW: number,
  srcH: number,
) {
  const { ox, oy, rw, rh, mw, mh } = getContainedImageRect(
    vw,
    vh,
    mapScale,
    srcW,
    srcH,
  );

  let minX: number;
  let maxX: number;
  if (rw >= vw) {
    minX = -(ox + rw - vw);
    maxX = -ox;
  } else {
    const cx = -ox + (vw - rw) / 2;
    minX = maxX = cx;
  }

  let minY: number;
  let maxY: number;
  if (rh >= vh) {
    minY = -(oy + rh - vh);
    maxY = -oy;
  } else {
    const cy = -oy + (vh - rh) / 2;
    minY = maxY = cy;
  }

  return { minX, maxX, minY, maxY };
}
