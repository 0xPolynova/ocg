import type { OcgLaunch } from "@/lib/types";
import { compressGame, utf8Bytes } from "@/lib/game-codec";

const SNAKE = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;K=16;cols=W/K|0;rows=H/K|0;sn=[{x:5,y:6},{x:4,y:6}];d={x:1,y:0};fd={x:12,y:8};s=0;best=0;t=0;st=0;g=1
onkeydown=e=>{k=e.key;if((k==='ArrowLeft'||k==='a')&&d.x!==1)d={x:-1,y:0};if((k==='ArrowRight'||k==='d')&&d.x!==-1)d={x:1,y:0};if((k==='ArrowUp'||k==='w')&&d.y!==1)d={x:0,y:-1};if((k==='ArrowDown'||k==='s')&&d.y!==-1)d={x:0,y:1}}
function food(){fd={x:1+Math.random()*(cols-2)|0,y:1+Math.random()*(rows-2)|0}}
function L(){t++;ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);ctx.fillStyle='#163033';for(i=0;i<36;i++)ctx.fillRect((i*83)%W,(i*47)%H,2,2)
if(!st){ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('NEON SNAKE',24,56);ctx.font='14px monospace';ctx.fillText('arrows eat bits — click',24,82)}
else if(g){if(t%Math.max(4,11-(s/5|0))==0){h={x:sn[0].x+d.x,y:sn[0].y+d.y};if(h.x<0||h.y<0||h.x>=cols||h.y>=rows||sn.some(p=>p.x===h.x&&p.y===h.y)){g=0;best=Math.max(best,s);burst(h.x*K,h.y*K,'#8fd4de',18);shake(10);beep(90,.2)}else{sn.unshift(h);if(h.x===fd.x&&h.y===fd.y){s++;food();burst(fd.x*K,fd.y*K,'#f8d36a',12);beep(880,.05)}else sn.pop()}}
ctx.fillStyle='#f8d36a';ctx.beginPath();ctx.arc(fd.x*K+8,fd.y*K+8,6,0,7);ctx.fill();sn.forEach((p,i)=>{ctx.fillStyle=i?'#8fd4de':'#e8fbff';ctx.shadowBlur=i?0:12;ctx.shadowColor='#8fd4de';ctx.fillRect(p.x*K+1,p.y*K+1,K-2,K-2);ctx.shadowBlur=0});ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText(s+'  best '+best,16,28)}
else{ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('BITTEN  '+s,24,56);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,82)}
requestAnimationFrame(L)}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;sn=[{x:5,y:6},{x:4,y:6}];d={x:1,y:0};food();beep(520,.06)}}
L()
</script>`;

function launch(
  partial: Omit<OcgLaunch, "gameBytes" | "compressedBytes" | "storeSignatures" | "sparkline"> & {
    sparkline?: number[];
  },
): OcgLaunch {
  const slug = partial.slug ?? partial.symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return {
    ...partial,
    slug,
    playUrl: partial.playUrl ?? `https://launchocg.com/${slug}`,
    gameBytes: utf8Bytes(partial.gameHtml),
    compressedBytes: compressGame(partial.gameHtml).byteLength,
    storeSignatures: [],
    sparkline: partial.sparkline ?? [10, 12, 11, 14, 16, 15, 18, 21, 20, 24, 26, 29],
  };
}

export const SEED_LAUNCHES: OcgLaunch[] = [
  launch({
    id: "seed-snek",
    name: "Neon Snake",
    symbol: "SNEK",
    description: "Eat bits. Don't bite yourself.",
    prompt: "neon snake eat bits don't hit the tail",
    genre: "Arcade",
    gameHtml: SNAKE,
    demo: true,
    createdAt: Date.UTC(2026, 8, 10),
    marketCapUsd: 7_440_000,
    volumeUsd: 410_000,
    change24h: 8.4,
  }),
];

export function isSnakeLaunch(item: {
  name?: string;
  symbol?: string;
  slug?: string;
  prompt?: string;
}): boolean {
  const hay = `${item.name ?? ""} ${item.symbol ?? ""} ${item.slug ?? ""} ${item.prompt ?? ""}`.toLowerCase();
  return /\bsnake\b|\bsnek\b/.test(hay);
}

export function fallbackGame(_prompt: string): { html: string; name: string; symbol: string } {
  return { html: SNAKE, name: "Neon Snake", symbol: "SNEK" };
}
