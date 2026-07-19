import { FONT_DATA } from './hitzfont_data.js';

// Disc-ripped Arial_16 bitmap font from NHL Hitz 2003 Xbox
// Atlas: assets/hitzfont_atlas.png  256×512 px
const TEX_W = 256, TEX_H = 512;

class BitmapFont {
  constructor() {
    this.img   = new Image();
    this.img.src = 'assets/hitzfont_atlas.png';
    this.ready = false;
    this.chars = {};
    this.img.onload = () => { this.ready = true; };

    for (const [code, u1, v1, u2, v2, xbear, advance] of FONT_DATA) {
      this.chars[code] = { u1, v1, u2, v2, xbear, advance };
    }
  }

  // Draw text onto a 2D canvas context at (x, y) with pixel scale
  draw(ctx, text, x, y, scale = 1, color = null) {
    if (!this.ready) return;
    if (color) {
      // Tint: draw to offscreen canvas, then colorize
      this._drawTinted(ctx, text, x, y, scale, color);
      return;
    }
    let cx = x;
    for (const ch of text) {
      const g = this.chars[ch.charCodeAt(0)];
      if (!g) { cx += 8 * scale; continue; }
      const sw = (g.u2 - g.u1) * TEX_W;
      const sh = (g.v2 - g.v1) * TEX_H;
      if (sw > 0 && sh > 0) {
        ctx.drawImage(
          this.img,
          g.u1 * TEX_W, g.v1 * TEX_H, sw, sh,
          cx + g.xbear * scale, y, sw * scale, sh * scale
        );
      }
      cx += g.advance * scale;
    }
  }

  _drawTinted(ctx, text, x, y, scale, color) {
    const tmp = document.createElement('canvas');
    const tw  = Math.ceil(this.measure(text, scale)) + 4;
    const th  = Math.ceil(TEX_H * (25 / 512) * scale) + 4;
    tmp.width  = tw;
    tmp.height = th;
    const tc = tmp.getContext('2d');
    this.draw(tc, text, 2, 2, scale, null);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = color;
    tc.fillRect(0, 0, tw, th);
    ctx.drawImage(tmp, x - 2, y - 2);
  }

  measure(text, scale = 1) {
    let w = 0;
    for (const ch of text) {
      const g = this.chars[ch.charCodeAt(0)];
      w += g ? g.advance * scale : 8 * scale;
    }
    return w;
  }

  // Center-align draw
  drawCentered(ctx, text, cx, y, scale = 1, color = null) {
    const w = this.measure(text, scale);
    this.draw(ctx, text, cx - w / 2, y, scale, color);
  }
}

export const discFont = new BitmapFont();
