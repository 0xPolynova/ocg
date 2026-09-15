import type { OcgLaunch } from "@/lib/types";
import { compressGame, utf8Bytes } from "@/lib/game-codec";

const PONG = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
d=document;C=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;p=H/2-40;b={x:W/2,y:H/2,vx:3,vy:2};s=0;g=1
onmousemove=e=>p=Math.min(H-80,Math.max(0,e.clientY-40))
ontouchmove=e=>{p=e.touches[0].clientY-40;e.preventDefault()}
function L(){C.fillStyle='#041014';C.fillRect(0,0,W,H);C.fillStyle='#8fd4de';C.fillRect(16,p,8,80)
if(g){b.x+=b.vx;b.y+=b.vy;if(b.y<6||b.y>H-6)b.vy*=-1;if(b.x<28&&b.y>p&&b.y<p+80){b.vx=Math.abs(b.vx)+.15;s++}if(b.x>W)b.vx*=-1;if(b.x<0)g=0;C.fillRect(b.x-5,b.y-5,10,10);C.fillStyle='#3ddc8e';C.font='18px sans-serif';C.fillText(s,W/2,28)}
else{C.fillStyle='#fff';C.fillText('score '+s+'  click',W/2-54,H/2)}
requestAnimationFrame(L)}
onclick=()=>{if(!g){g=1;s=0;b={x:W/2,y:H/2,vx:3,vy:2}}}
L()
</script>`;

const DODGE = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
C=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;x=W/2;y=H-36;s=0;t=0;g=1;e=[]
onmousemove=e=>x=e.clientX
ontouchmove=e=>{x=e.touches[0].clientX;e.preventDefault()}
function A(){e.push({x:Math.random()*W,y:-12,v:2+Math.random()*3,r:7+Math.random()*9})}
function L(){t++;if(g&&t%22==0)A();C.fillStyle='#041014';C.fillRect(0,0,W,H);C.fillStyle='#8fd4de';C.beginPath();C.arc(x,y,12,0,7);C.fill()
if(g){s++;for(const o of e){o.y+=o.v;C.fillStyle='#f07178';C.beginPath();C.arc(o.x,o.y,o.r,0,7);C.fill();if(Math.hypot(o.x-x,o.y-y)<12+o.r)g=0}e=e.filter(o=>o.y<H+20);C.fillStyle='#3ddc8e';C.font='18px sans-serif';C.fillText(s,12,26)}
else{C.fillStyle='#fff';C.fillText('score '+s+'  click',W/2-54,H/2)}
requestAnimationFrame(L)}
onclick=()=>{if(!g){g=1;s=0;e=[];t=0}}
L()
</script>`;

const CATCH = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
C=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;x=W/2;s=0;g=1;t=0;d=[]
onmousemove=e=>x=e.clientX
ontouchmove=e=>{x=e.touches[0].clientX;e.preventDefault()}
function L(){t++;if(g&&t%18==0)d.push({x:40+Math.random()*(W-80),y:-10,v:2+Math.random()*2,k:Math.random()>.2})
C.fillStyle='#041014';C.fillRect(0,0,W,H);C.fillStyle='#8fd4de';C.fillRect(x-28,H-18,56,10)
if(g){for(const o of d){o.y+=o.v;C.fillStyle=o.k?'#3ddc8e':'#f07178';C.fillRect(o.x-6,o.y-6,12,12);if(o.y>H-24&&Math.abs(o.x-x)<34){if(o.k)s++;else g=0;o.y=9e9}if(o.k&&o.y>H)g=0}d=d.filter(o=>o.y<H+20);C.fillStyle='#fff';C.font='18px sans-serif';C.fillText(s,12,26)}
else{C.fillStyle='#fff';C.fillText('score '+s+'  click',W/2-54,H/2)}
requestAnimationFrame(L)}
onclick=()=>{if(!g){g=1;s=0;d=[];t=0}}
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
    description: "Catch the green drips. Skip the red ones.",
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
    return { html: PONG, name: "Paddle", symbol: "PADL" };
  }
  if (lower.includes("catch") || lower.includes("coin") || lower.includes("collect")) {
    return { html: CATCH, name: "Catch", symbol: "CTCH" };
  }
  return { html: DODGE, name: "Dodge", symbol: "DDGE" };
}
