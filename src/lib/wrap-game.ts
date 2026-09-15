const CTX_METHODS =
  "beginPath|closePath|moveTo|lineTo|arc|arcTo|ellipse|fill|stroke|clip|fillRect|strokeRect|clearRect|fillText|strokeText|save|restore|rect|translate|rotate|scale|setTransform|resetTransform|drawImage|quadraticCurveTo|bezierCurveTo|setLineDash|measureText|createLinearGradient|createRadialGradient";

const CTX_PROPS =
  "fillStyle|strokeStyle|lineWidth|font|textAlign|textBaseline|globalAlpha|lineCap|lineJoin|shadowBlur|shadowColor|shadowOffsetX|shadowOffsetY|globalCompositeOperation|imageSmoothingEnabled";

const VIEWPORT_KIT = `const css=document.createElement('style');
css.textContent='html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#041014;touch-action:none}canvas{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;display:block!important;background:#041014}';
document.head.appendChild(css);
function canvases(){return Array.from(document.getElementsByTagName('canvas'))}
function active(){return canvases()[0]||cv}
function box(){const e=document.documentElement;return{w:Math.max(1,e.clientWidth||innerWidth||640),h:Math.max(1,e.clientHeight||innerHeight||400)}}
function mapPtr(e){const c=active();if(!c||!c.width||!c.height)return;const t=(e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0]);const cx=t?t.clientX:e.clientX,cy=t?t.clientY:e.clientY;if(cx==null)return;const r=HTMLElement.prototype.getBoundingClientRect.call(c);if(!r.width||!r.height)return;const x=(cx-r.left)/r.width*c.width,y=(cy-r.top)/r.height*c.height;try{Object.defineProperty(e,'clientX',{value:r.left+x,configurable:true});Object.defineProperty(e,'clientY',{value:r.top+y,configurable:true});Object.defineProperty(e,'offsetX',{value:x,configurable:true});Object.defineProperty(e,'offsetY',{value:y,configurable:true})}catch(err){}}
for(const ev of ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','click','touchstart','touchmove','touchend'])addEventListener(ev,mapPtr,true);
let _ac,_sh=0,_bits=[];
function beep(f,d){d=d||.07;try{_ac=_ac||new AudioContext();if(_ac.state==='suspended')_ac.resume();const o=_ac.createOscillator(),g=_ac.createGain(),t=_ac.currentTime;o.type='square';o.frequency.value=f;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(_ac.destination);o.start(t);o.stop(t+d)}catch(e){}}
function burst(x,y,col,n){n=n||16;for(let i=0;i<n;i++){const a=Math.random()*6.28,_s=2+Math.random()*4;_bits.push({x,y,vx:Math.cos(a)*_s,vy:Math.sin(a)*_s,l:16+Math.random()*12,col:col||'#8fd4de'})}}
function shake(n){_sh=Math.max(_sh,n)}
window.beep=beep;window.burst=burst;window.shake=shake;
addEventListener('pointerdown',()=>{try{_ac&&_ac.resume()}catch(e){}});
const _raf=requestAnimationFrame.bind(window);
requestAnimationFrame=f=>_raf(t=>{f(t);const c=active(),g=c&&c.getContext&&c.getContext('2d');if(g){for(let i=_bits.length;i--;){const p=_bits[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.16;p.l--;g.globalAlpha=Math.max(0,p.l/20);g.fillStyle=p.col;g.fillRect(p.x,p.y,3,3);if(p.l<=0)_bits.splice(i,1)}g.globalAlpha=1}if(c){if(_sh>0.4){c.style.transform='translate('+((Math.random()-.5)*_sh)+'px,'+((Math.random()-.5)*_sh)+'px)'}else{c.style.transform='none'}_sh*=.84}});
`;

export function extractGameScript(html: string): string {
  const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  if (blocks.length > 0) {
    return blocks.map((match) => match[1] ?? "").join("\n");
  }
  if (!/<canvas[\s>]/i.test(html) && !/<html[\s>]/i.test(html)) return html;
  return html.replace(/<[^>]+>/g, " ").trim();
}

export function rewriteCanvasContext(script: string): string {
  let next = script.replace(
    new RegExp(`\\b(?!ctx\\b)(?!this\\b)[A-Za-z_$][\\w$]*\\.(${CTX_METHODS})\\s*\\(`, "g"),
    "ctx.$1(",
  );
  next = next.replace(
    new RegExp(`\\b(?!ctx\\b)(?!this\\b)[A-Za-z_$][\\w$]*\\.(${CTX_PROPS})\\s*=`, "g"),
    "ctx.$1=",
  );
  return next;
}

export function wrapGameHtml(html: string): string {
  const script = rewriteCanvasContext(extractGameScript(html));
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,user-scalable=no"><title>OCG</title>
<style>html,body{margin:0;width:100%;height:100%;background:#041014;overflow:hidden;touch-action:none}#c{position:fixed;inset:0;display:block;width:100%;height:100%;background:#041014}#v{position:fixed;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(0,0,0,.13) 2px 3px),radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.42) 100%)}</style>
<canvas id=c></canvas><div id=v></div><script>
const cv=document.getElementById('c'),_ctx=cv.getContext('2d');
Object.defineProperty(window,'ctx',{value:_ctx,writable:true,configurable:true});
Object.defineProperty(window,'cv',{value:cv,writable:true,configurable:true});
window.c=cv;window.C=_ctx;
${VIEWPORT_KIT}
function boot(){const b=box();if(b.w<80||b.h<80){_raf(boot);return}
try{${script}}
catch(err){_ctx.fillStyle='#f07178';_ctx.font='16px monospace';_ctx.fillText(String(err&&err.message||err),12,32)}
}
boot();
</script>`;
}
