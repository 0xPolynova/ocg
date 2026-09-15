const HOST_CSS = `html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#041014;touch-action:none}canvas{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;display:block!important;background:#041014}body>*:not(canvas):not(script):not(style){position:relative;z-index:2}`;

const HOST_JS = `(function(){
function memStore(){const d=Object.create(null);const api={getItem(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem(k,v){d[k]=String(v)},removeItem(k){delete d[k]},clear(){for(const k of Object.keys(d))delete d[k]},key(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}};return new Proxy(api,{get(t,p,r){if(p in t)return Reflect.get(t,p,r);if(typeof p==='string'&&p in d)return d[p]},set(t,p,v){if(p in t&&p!=='length')return Reflect.set(t,p,v);d[String(p)]=String(v);return true},deleteProperty(_t,p){delete d[String(p)];return true}})}
function stubStore(name){try{Object.defineProperty(window,name,{configurable:true,enumerable:true,value:memStore()})}catch(e){}}
stubStore('localStorage');stubStore('sessionStorage');
try{Object.defineProperty(document,'cookie',{configurable:true,get(){return ''},set(){}})}catch(e){}
const ghosts=Object.create(null);
function ghost(id){if(ghosts[id])return ghosts[id];const n=document.createElement('div');n.id=id;n.style.cssText='position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';(document.body||document.documentElement).appendChild(n);return ghosts[id]=n}
function findCv(){return document.getElementsByTagName('canvas')[0]||null}
function ensureCv(){let c=findCv();if(c)return c;c=document.createElement('canvas');c.id='c';(document.body||document.documentElement).appendChild(c);return c}
try{Object.defineProperty(window,'cv',{configurable:true,get:findCv,set(){}})}catch(e){}
try{Object.defineProperty(window,'canvas',{configurable:true,get:findCv,set(){}})}catch(e){}
try{Object.defineProperty(window,'ctx',{configurable:true,get(){const c=findCv();return c?c.getContext('2d'):null}})}catch(e){}
const _gebi=Document.prototype.getElementById;
Document.prototype.getElementById=function(id){id=String(id);const el=_gebi.call(this,id);if(el)return el;if(id==='c'||id==='canvas'||id==='gameCanvas'||id==='cv'||id==='screen')return findCv()||ghost(id);return ghost(id)};
const _qs=Document.prototype.querySelector;
Document.prototype.querySelector=function(sel){sel=String(sel);if(sel==='canvas'||sel==='#c'||sel==='#canvas'||sel==='#gameCanvas'||sel==='#cv'||sel==='#screen')return findCv()||_qs.call(this,sel);const el=_qs.call(this,sel);if(el)return el;const id=/^#([A-Za-z_][\\w-]*)$/.exec(sel);return id?ghost(id[1]):el};
function box(){const e=document.documentElement;return{w:Math.max(1,e.clientWidth||innerWidth||640),h:Math.max(1,e.clientHeight||innerHeight||400)}}
function mapPtr(e){const c=findCv();if(!c||!c.width||!c.height)return;const t=(e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0]);const cx=t?t.clientX:e.clientX,cy=t?t.clientY:e.clientY;if(cx==null)return;const r=HTMLElement.prototype.getBoundingClientRect.call(c);if(!r.width||!r.height)return;const x=(cx-r.left)/r.width*c.width,y=(cy-r.top)/r.height*c.height;try{Object.defineProperty(e,'clientX',{value:r.left+x,configurable:true});Object.defineProperty(e,'clientY',{value:r.top+y,configurable:true});Object.defineProperty(e,'offsetX',{value:x,configurable:true});Object.defineProperty(e,'offsetY',{value:y,configurable:true})}catch(err){}}
for(const ev of ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','click','touchstart','touchmove','touchend'])addEventListener(ev,mapPtr,true);
let _ac,_sh=0,_bits=[];
function beep(f,d){d=d||.07;try{_ac=_ac||new AudioContext();if(_ac.state==='suspended')_ac.resume();const o=_ac.createOscillator(),g=_ac.createGain(),t=_ac.currentTime;o.type='square';o.frequency.value=f;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(_ac.destination);o.start(t);o.stop(t+d)}catch(e){}}
function burst(x,y,col,n){n=n||16;for(let i=0;i<n;i++){const a=Math.random()*6.28,_s=2+Math.random()*4;_bits.push({x,y,vx:Math.cos(a)*_s,vy:Math.sin(a)*_s,l:16+Math.random()*12,col:col||'#8fd4de'})}}
function shake(n){_sh=Math.max(_sh,n)}
if(typeof window.beep!=='function')window.beep=beep;
if(typeof window.burst!=='function')window.burst=burst;
if(typeof window.shake!=='function')window.shake=shake;
addEventListener('pointerdown',()=>{try{_ac&&_ac.resume()}catch(e){}});
const _raf=requestAnimationFrame.bind(window);
requestAnimationFrame=f=>_raf(t=>{if(typeof f==='function')f(t);const c=findCv(),g=c&&c.getContext&&c.getContext('2d');if(g){for(let i=_bits.length;i--;){const p=_bits[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.16;p.l--;g.globalAlpha=Math.max(0,p.l/20);g.fillStyle=p.col;g.fillRect(p.x,p.y,3,3);if(p.l<=0)_bits.splice(i,1)}g.globalAlpha=1}if(c){if(_sh>0.4){c.style.transform='translate('+((Math.random()-.5)*_sh)+'px,'+((Math.random()-.5)*_sh)+'px)'}else{c.style.transform='none'}_sh*=.84}});
function snapSoon(){let n=0;function tick(){n++;if(n<24){_raf(tick);return}try{const c=findCv();if(!c||c.width<16||c.height<16)return;const s=1000,out=document.createElement('canvas');out.width=s;out.height=s;const g=out.getContext('2d');if(!g)return;g.fillStyle='#041014';g.fillRect(0,0,s,s);const scale=Math.max(s/c.width,s/c.height);const dw=c.width*scale,dh=c.height*scale;g.imageSmoothingEnabled=false;g.drawImage(c,(s-dw)/2,(s-dh)/2,dw,dh);parent.postMessage({type:'ocg-shot',dataUrl:out.toDataURL('image/png')},'*')}catch(err){}}_raf(tick)}
function whenReady(fn){if(document.readyState==='complete'||document.readyState==='interactive')fn();else document.addEventListener('DOMContentLoaded',fn)}
whenReady(function(){const c=ensureCv(),b=box();if(b.w>=80&&(!c.width||c.width<16)){c.width=b.w;c.height=b.h}snapSoon()});
})();`;

export function extractGameScript(html: string): string {
  const blocks = [...html.matchAll(/<script(\b[^>]*)>([\s\S]*?)<\/script>/gi)];
  const code = blocks
    .filter((match) => {
      const attrs = match[1] ?? "";
      if (/\bsrc\s*=/.test(attrs)) return false;
      if (/\btype\s*=/.test(attrs) && !/javascript|ecmascript|module/i.test(attrs)) return false;
      return true;
    })
    .map((match) => match[2] ?? "")
    .join("\n")
    .trim();
  if (code) return code;
  if (!/<canvas[\s>]/i.test(html) && !/<html[\s>]/i.test(html)) return html;
  return html.replace(/<[^>]+>/g, " ").trim();
}

function asDocument(html: string): string {
  const trimmed = html.trim();
  if (/<!doctype/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) return trimmed;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${trimmed}</body></html>`;
}

export function wrapGameHtml(html: string): string {
  let doc = asDocument(html);
  if (!/<canvas[\s>]/i.test(doc)) {
    if (/<body[\s>]/i.test(doc)) {
      doc = doc.replace(/<body([^>]*)>/i, `<body$1><canvas id="c"></canvas>`);
    } else {
      doc += `<canvas id="c"></canvas>`;
    }
  }
  const host = `<style>${HOST_CSS}</style><script>${HOST_JS}</script>`;
  if (/<body[\s>]/i.test(doc)) {
    return doc.replace(/<body([^>]*)>/i, `<body$1>${host}`);
  }
  return host + doc;
}
