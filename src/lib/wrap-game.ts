const CTX_METHODS =
  "beginPath|closePath|moveTo|lineTo|arc|arcTo|fill|stroke|clip|fillRect|strokeRect|clearRect|fillText|strokeText|save|restore|rect|translate|rotate|scale|setTransform|resetTransform|drawImage|quadraticCurveTo|bezierCurveTo|setLineDash|measureText|createLinearGradient|createRadialGradient";

const CTX_PROPS =
  "fillStyle|strokeStyle|lineWidth|font|textAlign|textBaseline|globalAlpha|lineCap|lineJoin|shadowBlur|shadowColor|shadowOffsetX|shadowOffsetY|globalCompositeOperation|imageSmoothingEnabled";

const ARCADE_KIT = `let _ac,_sh=0,_bits=[];
_ctx.imageSmoothingEnabled=false;
function beep(f,d){d=d||.07;try{_ac=_ac||new AudioContext();if(_ac.state==='suspended')_ac.resume();const o=_ac.createOscillator(),g=_ac.createGain(),t=_ac.currentTime;o.type='square';o.frequency.value=f;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(_ac.destination);o.start(t);o.stop(t+d)}catch(e){}}
function burst(x,y,col,n){n=n||16;for(let i=0;i<n;i++){const a=Math.random()*6.28,_s=2+Math.random()*4;_bits.push({x,y,vx:Math.cos(a)*_s,vy:Math.sin(a)*_s,l:16+Math.random()*12,col:col||'#8fd4de'})}}
function shake(n){_sh=Math.max(_sh,n)}
window.beep=beep;window.burst=burst;window.shake=shake;
addEventListener('pointerdown',()=>{try{_ac&&_ac.resume()}catch(e){}});
const _raf=requestAnimationFrame.bind(window);
requestAnimationFrame=f=>_raf(t=>{f(t);for(let i=_bits.length;i--;){const p=_bits[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.16;p.l--;_ctx.globalAlpha=Math.max(0,p.l/20);_ctx.fillStyle=p.col;_ctx.fillRect(p.x,p.y,3,3);if(p.l<=0)_bits.splice(i,1)}_ctx.globalAlpha=1;if(_sh>0.4){cv.style.transform='translate('+((Math.random()-0.5)*_sh)+'px,'+((Math.random()-0.5)*_sh)+'px)';_sh*=.84}else{cv.style.transform='none';_sh=0}});`;

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
  return `<!doctype html><meta charset=utf-8><title>OCG</title>
<style>html,body{margin:0;height:100%;background:#041014;overflow:hidden}#c{display:block;width:100%;height:100%}#v{position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 2px,rgba(0,0,0,.13) 2px 3px),radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.42) 100%)}</style>
<canvas id=c></canvas><div id=v></div><script>
const cv=document.getElementById('c'),_ctx=cv.getContext('2d');
function fit(){cv.width=innerWidth;cv.height=innerHeight}fit();addEventListener('resize',fit);
Object.defineProperty(window,'ctx',{value:_ctx,writable:false});
Object.defineProperty(window,'cv',{value:cv,writable:false});
window.c=cv;window.C=_ctx;
${ARCADE_KIT}
try{${script}}
catch(err){_ctx.fillStyle='#f07178';_ctx.font='16px monospace';_ctx.fillText(String(err&&err.message||err),12,32)}
</script>`;
}
