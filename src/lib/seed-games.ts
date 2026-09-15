import type { OcgLaunch } from "@/lib/types";
import { compressGame, utf8Bytes } from "@/lib/game-codec";

const PONG = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;p=H/2-40;tx=p;b={x:W/2,y:H/2,vx:4,vy:3};s=0;best=0;st=0;g=1;tr=[]
onmousemove=e=>tx=Math.min(H-80,Math.max(0,e.clientY-40))
ontouchmove=e=>{tx=e.touches[0].clientY-40;e.preventDefault()}
onkeydown=e=>{if(e.key==='ArrowUp')tx-=40;if(e.key==='ArrowDown')tx+=40}
function L(){
 p+=(tx-p)*.25;ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#163033';for(i=0;i<36;i++)ctx.fillRect((i*83)%W,(i*47)%H,2,2);
 if(!st){ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('KNOT PONG',24,64);ctx.font='14px monospace';ctx.fillText('move to volley — click',24,90);ctx.fillStyle='#8fd4de';ctx.fillRect(16,H/2-40,10,80);ctx.fillStyle='#f8d36a';ctx.fillRect(W/2-6,H/2-6,12,12)}
 else if(g){b.x+=b.vx;b.y+=b.vy;if(b.y<8||b.y>H-8){b.vy*=-1;beep(520,.04)}if(b.x<30&&b.y>p&&b.y<p+80){b.vx=Math.abs(b.vx)+.18;b.vy+=(b.y-p-40)*.04;s++;burst(28,b.y,'#8fd4de',10);shake(5);beep(880,.05)}if(b.x>W-8)b.vx=-Math.abs(b.vx);if(b.x<0){g=0;best=Math.max(best,s);burst(20,b.y,'#f07178',18);shake(12);beep(90,.22)}
 tr.push({x:b.x,y:b.y});if(tr.length>12)tr.shift();for(let i=0;i<tr.length;i++){ctx.globalAlpha=i/14;ctx.fillStyle='#f8d36a';ctx.fillRect(tr[i].x-4,tr[i].y-4,8,8)}ctx.globalAlpha=1;
 ctx.shadowBlur=12;ctx.shadowColor='#8fd4de';ctx.fillStyle='#8fd4de';ctx.fillRect(16,p,10,80);ctx.shadowBlur=16;ctx.shadowColor='#f8d36a';ctx.fillStyle='#f8d36a';ctx.beginPath();ctx.arc(b.x,b.y,7,0,7);ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText(s+'  best '+best,16,28)}
 else{ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('SLIPPED  '+s,24,64);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,90)}
 requestAnimationFrame(L)}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;b={x:W/2,y:H/2,vx:4,vy:3};tr=[];beep(520,.06)}}
L()
</script>`;

const DODGE = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;px=W/2;py=H-56;tx=px;s=0;best=0;t=0;st=0;g=1;e=[]
onmousemove=e=>tx=e.clientX
ontouchmove=e=>{tx=e.touches[0].clientX;e.preventDefault()}
onkeydown=e=>{if(e.key==='ArrowLeft')tx-=50;if(e.key==='ArrowRight')tx+=50}
function cat(x,y){ctx.shadowBlur=14;ctx.shadowColor='#8fd4de';ctx.fillStyle='#8fd4de';ctx.beginPath();ctx.arc(x,y,14,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(x-12,y-4);ctx.lineTo(x-7,y-20);ctx.lineTo(x-2,y-6);ctx.fill();ctx.beginPath();ctx.moveTo(x+12,y-4);ctx.lineTo(x+7,y-20);ctx.lineTo(x+2,y-6);ctx.fill();ctx.strokeStyle='#8fd4de';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+11,y+2);ctx.quadraticCurveTo(x+28,y-14,x+22,y+12);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#041014';ctx.beginPath();ctx.arc(x-5,y-2,2.2,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+5,y-2,2.2,0,7);ctx.fill()}
function moon(o){ctx.fillStyle='#f8d36a';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,7);ctx.fill();ctx.fillStyle='#041014';ctx.beginPath();ctx.arc(o.x+o.r*.38,o.y-o.r*.2,o.r*.78,0,7);ctx.fill()}
function L(){t++;px+=(tx-px)*.22;ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);ctx.fillStyle='#163033';for(i=0;i<48;i++)ctx.fillRect((i*97+t*.4)%W,(i*53)%H,2,2)
if(!st){cat(W/2,H/2);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('ORBIT CAT',24,56);ctx.font='14px monospace';ctx.fillText('weave the moons — click',24,82)}
else if(g){if(t%Math.max(9,26-(s/90|0))==0)e.push({x:24+Math.random()*(W-48),y:-22,v:2.4+s/160+Math.random()*2.2,r:9+Math.random()*11});s++;cat(px,py);for(const o of e){o.y+=o.v;moon(o);if(Math.hypot(o.x-px,o.y-py)<13+o.r*.62){g=0;best=Math.max(best,s);burst(px,py,'#8fd4de',24);shake(14);beep(90,.22)}}e=e.filter(o=>o.y<H+28);if(s&&s%120==0)beep(740,.04);ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText(s+'  best '+best,16,28)}
else{cat(px,py);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('SPLAT  '+s,24,56);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,82)}
requestAnimationFrame(L)}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;e=[];t=0;beep(520,.06)}}
L()
</script>`;

const CATCH = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;px=W/2;tx=px;s=0;best=0;t=0;st=0;g=1;d=[]
onmousemove=e=>tx=e.clientX
ontouchmove=e=>{tx=e.touches[0].clientX;e.preventDefault()}
onkeydown=e=>{if(e.key==='ArrowLeft')tx-=50;if(e.key==='ArrowRight')tx+=50}
function basket(x){ctx.shadowBlur=12;ctx.shadowColor='#8fd4de';ctx.fillStyle='#8fd4de';ctx.fillRect(x-32,H-22,64,12);ctx.fillRect(x-28,H-34,6,14);ctx.fillRect(x+22,H-34,6,14);ctx.shadowBlur=0}
function bit(o){if(o.k){ctx.fillStyle='#f8d36a';ctx.beginPath();ctx.arc(o.x,o.y,8,0,7);ctx.fill();ctx.strokeStyle='#041014';ctx.lineWidth=2;ctx.beginPath();ctx.arc(o.x,o.y,4,0,7);ctx.stroke()}else{ctx.fillStyle='#f07178';ctx.beginPath();ctx.arc(o.x,o.y,9,0,7);ctx.fill();ctx.fillStyle='#041014';ctx.font='bold 12px monospace';ctx.fillText('x',o.x-4,o.y+4)}}
function L(){t++;px+=(tx-px)*.22;ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);ctx.fillStyle='#163033';for(i=0;i<40;i++)ctx.fillRect((i*91+t*.3)%W,(i*59)%H,2,2)
if(!st){basket(W/2);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('DRIP CATCH',24,56);ctx.font='14px monospace';ctx.fillText('gold in, red out — click',24,82)}
else if(g){if(t%Math.max(10,22-(s/8|0))==0)d.push({x:36+Math.random()*(W-72),y:-12,v:2.2+Math.random()*2+s/40,k:Math.random()>.22});basket(px);for(const o of d){o.y+=o.v;bit(o);if(o.y>H-28&&Math.abs(o.x-px)<36){if(o.k){s++;burst(o.x,H-28,'#f8d36a',12);beep(880,.05)}else{g=0;best=Math.max(best,s);burst(px,H-24,'#f07178',20);shake(12);beep(90,.2)}o.y=9e9}if(o.k&&o.y>H){g=0;best=Math.max(best,s);shake(8);beep(110,.16);o.y=9e9}}d=d.filter(o=>o.y<H+20);ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText(s+'  best '+best,16,28)}
else{basket(px);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('SPILL  '+s,24,56);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,82)}
requestAnimationFrame(L)}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;d=[];t=0;beep(520,.06)}}
L()
</script>`;

function launch(
  partial: Omit<OcgLaunch, "gameBytes" | "compressedBytes" | "storeSignatures" | "sparkline"> & {
    sparkline?: number[];
  },
): OcgLaunch {
  return {
    ...partial,
    gameBytes: utf8Bytes(partial.gameHtml),
    compressedBytes: compressGame(partial.gameHtml).byteLength,
    storeSignatures: [],
    sparkline: partial.sparkline ?? [12, 14, 13, 18, 22, 19, 28, 26, 31, 29, 34, 40],
  };
}

export const SEED_LAUNCHES: OcgLaunch[] = [
  launch({
    id: "seed-zcat",
    name: "Orbit Cat",
    symbol: "ZCAT",
    description: "Dodge the falling moons. A tiny on-chain arcade.",
    prompt: "a cat dodging falling moons",
    genre: "Reflex",
    gameHtml: DODGE,
    image: undefined,
    demo: true,
    createdAt: Date.UTC(2026, 8, 1),
    marketCapUsd: 105_250_000,
    volumeUsd: 1_390_000,
    change24h: -2.1,
    sparkline: [40, 38, 36, 39, 33, 30, 28, 24, 22, 20, 18, 16],
  }),
  launch({
    id: "seed-knots",
    name: "KNOTS",
    symbol: "KNOTS",
    description: "Paddle the knot. Don't let it slip.",
    prompt: "minimal pong with a knot paddle",
    genre: "Arcade",
    gameHtml: PONG,
    demo: true,
    createdAt: Date.UTC(2026, 8, 4),
    marketCapUsd: 18_180_000,
    volumeUsd: 1_200_000,
    change24h: 15.2,
    sparkline: [8, 9, 11, 10, 14, 18, 17, 21, 24, 23, 27, 32],
  }),
  launch({
    id: "seed-divi",
    name: "DividendCoin",
    symbol: "DIVI",
    description: "Catch the gold drips. Skip the red ones.",
    prompt: "catch falling coins, avoid red",
    genre: "Arcade",
    gameHtml: CATCH,
    demo: true,
    createdAt: Date.UTC(2026, 8, 8),
    marketCapUsd: 10_420_000,
    volumeUsd: 285_600,
    change24h: 1.9,
    sparkline: [16, 17, 16, 18, 19, 18, 20, 22, 21, 23, 24, 25],
  }),
];

export function fallbackGame(prompt: string): { html: string; name: string; symbol: string } {
  const lower = prompt.toLowerCase();
  if (lower.includes("pong") || lower.includes("paddle") || lower.includes("ball")) {
    return { html: PONG, name: "Knot Pong", symbol: "KNOTS" };
  }
  if (lower.includes("catch") || lower.includes("coin") || lower.includes("collect")) {
    return { html: CATCH, name: "Drip Catch", symbol: "DRIP" };
  }
  return { html: DODGE, name: "Orbit Cat", symbol: "ZCAT" };
}
