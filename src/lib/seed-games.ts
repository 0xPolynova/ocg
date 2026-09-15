import type { OcgLaunch } from "@/lib/types";
import { compressGame, utf8Bytes } from "@/lib/game-codec";
import { pickMechanic } from "@/lib/game-plan";

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

const FLAPPY = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;px=W*.28;py=H/2;vy=0;s=0;best=0;st=0;g=1;pipes=[];t=0
function flap(){if(g){vy=-7.2;beep(620,.04)}}
onkeydown=e=>{if(e.key===' '||e.key==='ArrowUp')flap()}
function bird(x,y){ctx.shadowBlur=12;ctx.shadowColor='#8fd4de';ctx.fillStyle='#8fd4de';ctx.beginPath();ctx.ellipse(x,y,14,10,0,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x-18,y-8);ctx.lineTo(x-10,y+2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#f8d36a';ctx.beginPath();ctx.moveTo(x+12,y-2);ctx.lineTo(x+22,y);ctx.lineTo(x+12,y+2);ctx.fill();ctx.fillStyle='#041014';ctx.beginPath();ctx.arc(x+4,y-3,2,0,7);ctx.fill()}
function L(){t++;ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);ctx.fillStyle='#163033';for(i=0;i<40;i++)ctx.fillRect((i*97+t)%W,(i*53)%H,2,2)
if(!st){bird(W/2,H/2);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('PIPE BIRD',24,56);ctx.font='14px monospace';ctx.fillText('click / space to flap',24,82)}
else if(g){vy+=.38;py+=vy;if(t%90==0)pipes.push({x:W+20,gap:80+Math.random()*(H-220),h:90+Math.random()*40});for(const p of pipes){p.x-=3.2+s*.02;ctx.fillStyle='#3ddc8e';ctx.fillRect(p.x,0,36,p.gap);ctx.fillRect(p.x,p.gap+p.h,36,H);if(p.x+36<px&&!p.got){p.got=1;s++;beep(880,.05);burst(px,py,'#f8d36a',8)}if(px>p.x&&px<p.x+36&&(py<p.gap||py>p.gap+p.h)){g=0;best=Math.max(best,s);shake(12);burst(px,py,'#8fd4de',20);beep(90,.2)}}if(py<12||py>H-12){g=0;best=Math.max(best,s);shake(12);beep(90,.2)}bird(px,py);ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText(s+'  best '+best,16,28)}
else{bird(px,py);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('SPLAT  '+s,24,56);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,82)}
requestAnimationFrame(L)}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;py=H/2;vy=0;pipes=[];t=0;beep(520,.06);return}flap()}
L()
</script>`;

const SHIP = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;px=W/2;tx=px;s=0;best=0;t=0;st=0;g=1;bl=[];ast=[]
onmousemove=e=>tx=e.clientX
ontouchmove=e=>{tx=e.touches[0].clientX;e.preventDefault()}
onkeydown=e=>{if(e.key===' '||e.key==='ArrowUp')fire()}
function fire(){if(!g||!st)return;bl.push({x:px,y:H-50});beep(740,.03)}
function craft(x,y){ctx.shadowBlur=14;ctx.shadowColor='#8fd4de';ctx.fillStyle='#8fd4de';ctx.beginPath();ctx.moveTo(x,y-16);ctx.lineTo(x-14,y+14);ctx.lineTo(x,y+6);ctx.lineTo(x+14,y+14);ctx.fill();ctx.shadowBlur=0}
function L(){t++;px+=(tx-px)*.2;ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);ctx.fillStyle='#163033';for(i=0;i<50;i++)ctx.fillRect((i*97+t)%W,(i*53)%H,2,2)
if(!st){craft(W/2,H/2);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('BIT SHIP',24,56);ctx.font='14px monospace';ctx.fillText('move + click to fire',24,82)}
else if(g){if(t%28==0)ast.push({x:20+Math.random()*(W-40),y:-16,v:1.6+Math.random()*2+s/80,r:10+Math.random()*12});if(t%8==0)fire();
craft(px,H-36);bl.forEach(b=>{b.y-=9;ctx.fillStyle='#f8d36a';ctx.fillRect(b.x-2,b.y,4,10)});ast.forEach(a=>{a.y+=a.v;ctx.fillStyle='#f07178';ctx.beginPath();ctx.moveTo(a.x,a.y-a.r);ctx.lineTo(a.x+a.r,a.y);ctx.lineTo(a.x,a.y+a.r);ctx.lineTo(a.x-a.r,a.y);ctx.fill();if(Math.hypot(a.x-px,a.y-(H-36))<18+a.r*.5){g=0;best=Math.max(best,s);burst(px,H-36,'#8fd4de',22);shake(12);beep(90,.2)}});
for(const a of ast){for(const b of bl){if(Math.hypot(a.x-b.x,a.y-b.y)<a.r){s++;a.y=9e9;b.y=-9e9;burst(a.x,a.y,'#f8d36a',10);beep(920,.04)}}}bl=bl.filter(b=>b.y>-10);ast=ast.filter(a=>a.y<H+20);
ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText(s+'  best '+best,16,28)}
else{craft(px,H-36);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('WRECKED  '+s,24,56);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,82)}
requestAnimationFrame(L)}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;bl=[];ast=[];t=0;beep(520,.06);return}fire()}
L()
</script>`;

const FROG = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight;row=0;px=W/2;s=0;best=0;st=0;g=1;t=0;lanes=[{v:2,w:70,c:'#8fd4de'},{v:-2.4,w:90,c:'#3ddc8e'},{v:1.7,w:60,c:'#8fd4de'},{v:-3,w:80,c:'#3ddc8e'}];logs=lanes.map((ln,i)=>[{x:(i*90)%W,y:H-90-i*70,w:ln.w,v:ln.v,c:ln.c},{x:(i*90+220)%W,y:H-90-i*70,w:ln.w,v:ln.v,c:ln.c}])
onkeydown=e=>{if(!g||!st)return;if(e.key==='ArrowUp'||e.key==='w')hop()}
function hop(){row++;px+=0;beep(700,.04);if(row>=lanes.length){s++;row=0;px=W/2;burst(px,80,'#f8d36a',12);beep(980,.06);if(s%3==0)lanes.forEach(l=>l.v*=1.08)}}
function frog(x,y){ctx.shadowBlur=12;ctx.shadowColor='#3ddc8e';ctx.fillStyle='#3ddc8e';ctx.beginPath();ctx.arc(x,y,12,0,7);ctx.fill();ctx.beginPath();ctx.arc(x-10,y+8,5,0,7);ctx.arc(x+10,y+8,5,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#041014';ctx.beginPath();ctx.arc(x-4,y-3,2,0,7);ctx.arc(x+4,y-3,2,0,7);ctx.fill()}
function L(){t++;ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H);ctx.fillStyle='#0a2a32';ctx.fillRect(0,H-40,W,40);ctx.fillRect(0,0,W,50)
if(!st){frog(W/2,H/2);ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('CANAL FROG',24,56);ctx.font='14px monospace';ctx.fillText('up / click hops logs',24,82)}
else if(g){let ride=row===0;const fy=H-28-row*70;logs.forEach((ln,i)=>ln.forEach(o=>{o.x+=o.v;if(o.x>W)o.x=-o.w;if(o.x+o.w<0)o.x=W;ctx.fillStyle=o.c;ctx.fillRect(o.x,o.y,o.w,22);if(i===row-1&&px>o.x-8&&px<o.x+o.w+8){ride=1;px+=o.v}}));if(row>0&&!ride){g=0;best=Math.max(best,s);burst(px,fy,'#f07178',16);shake(10);beep(90,.2)}if(px<8||px>W-8){g=0;best=Math.max(best,s);beep(90,.2)}frog(px,fy);ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText(s+'  best '+best,16,28)}
else{ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('SPLASH  '+s,24,56);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,82)}
requestAnimationFrame(L)}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;row=0;px=W/2;beep(520,.06);return}hop()}
L()
</script>`;

const DOOM = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
ctx=c.getContext('2d');W=c.width=innerWidth;H=c.height=innerHeight
S='1111111110000001101111011010000110111101100000011011110111111111';mw=8;px=1.5;py=1.5;pa=0;s=0;best=0;st=0;g=1;hp=100;en=[{x:4.5,y:4.5,l:1},{x:6.2,y:2.4,l:1}]
K={};onkeydown=e=>K[e.key]=1;onkeyup=e=>K[e.key]=0
function wall(x,y){return S[(y|0)*mw+(x|0)]==='1'}
function go(nx,ny){if(!wall(nx,py))px=nx;if(!wall(px,ny))py=ny}
function L(){
if(st&&g){let sp=.055;if(K.w||K.ArrowUp)go(px+Math.cos(pa)*sp,py+Math.sin(pa)*sp);if(K.s||K.ArrowDown)go(px-Math.cos(pa)*sp,py-Math.sin(pa)*sp);if(K.a)go(px+Math.cos(pa-1.57)*sp,py+Math.sin(pa-1.57)*sp);if(K.d)go(px+Math.cos(pa+1.57)*sp,py+Math.sin(pa+1.57)*sp);if(K.ArrowLeft)pa-=.05;if(K.ArrowRight)pa+=.05}
ctx.fillStyle='#041014';ctx.fillRect(0,0,W,H/2);ctx.fillStyle='#1c1010';ctx.fillRect(0,H/2,W,H/2)
if(!st){ctx.fillStyle='#e8fbff';ctx.font='bold 28px monospace';ctx.fillText('DOOM',24,56);ctx.font='14px monospace';ctx.fillText('WASD move · arrows turn · click shoot',24,82)}
else{for(let col=0;col<W;col+=3){let ra=pa-0.55+col/W*1.1,d=0,hit=0,cx=Math.cos(ra),cy=Math.sin(ra);while(d<14&&!hit){d+=.06;if(wall(px+cx*d,py+cy*d))hit=1}let h=Math.min(H,(H*0.9)/(d*.85));ctx.fillStyle=d<3?'#8fd4de':d<7?'#3d6a70':'#163033';ctx.fillRect(col,(H-h)/2,3,h)}
if(g){en.forEach(o=>{if(!o.l)return;let dx=o.x-px,dy=o.y-py,dist=Math.hypot(dx,dy),ang=Math.atan2(dy,dx)-pa;while(ang>Math.PI)ang-=6.28;while(ang<-Math.PI)ang+=6.28;if(Math.abs(ang)<0.7&&dist>0.35){let sz=Math.min(220,280/dist),sx=W/2+ang*W;ctx.fillStyle='#f07178';ctx.fillRect(sx-sz/4,(H-sz)/2,sz/2,sz);if(dist<0.7){hp--;shake(5);if(hp<=0){g=0;best=Math.max(best,s);beep(90,.2)}}}})
ctx.fillStyle='#8fd4de';ctx.beginPath();ctx.moveTo(W*.42,H);ctx.lineTo(W/2,H-88);ctx.lineTo(W*.58,H);ctx.fill();ctx.fillStyle='#3ddc8e';ctx.font='bold 18px monospace';ctx.fillText('HP '+hp+'  KILLS '+s+'  best '+best,16,28)}
else{ctx.fillStyle='#e8fbff';ctx.font='bold 26px monospace';ctx.fillText('RIP  '+s,24,56);ctx.font='14px monospace';ctx.fillText('best '+best+'  click',24,82)}}
requestAnimationFrame(L)}
function shoot(){if(!g||!st)return;beep(160,.08);shake(4);en.forEach(o=>{if(!o.l)return;let ang=Math.atan2(o.y-py,o.x-px)-pa;while(ang>Math.PI)ang-=6.28;while(ang<-Math.PI)ang+=6.28;if(Math.abs(ang)<.14&&Math.hypot(o.x-px,o.y-py)<9){o.l=0;s++;burst(W/2,H/2,'#f07178',16);beep(880,.05)}})}
onclick=()=>{if(!st){st=1;beep(660,.08);return}if(!g){g=1;s=0;hp=100;px=1.5;py=1.5;pa=0;en=[{x:4.5,y:4.5,l:1},{x:6.2,y:2.4,l:1}];beep(520,.06);return}shoot()}
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
    sparkline: [10, 12, 11, 14, 16, 15, 18, 21, 20, 24, 26, 29],
  }),
  launch({
    id: "seed-ship",
    name: "Bit Ship",
    symbol: "SHIP",
    description: "Blast the rocks. Don't get clipped.",
    prompt: "tiny spaceship blasting incoming asteroids",
    genre: "Action",
    gameHtml: SHIP,
    demo: true,
    createdAt: Date.UTC(2026, 8, 11),
    marketCapUsd: 5_210_000,
    volumeUsd: 188_000,
    change24h: 4.2,
    sparkline: [6, 7, 7, 9, 8, 11, 13, 12, 14, 16, 15, 18],
  }),
  launch({
    id: "seed-frog",
    name: "Canal Frog",
    symbol: "FROG",
    description: "Hop the logs. Don't splash.",
    prompt: "frog hopping logs across a toxic canal",
    genre: "Arcade",
    gameHtml: FROG,
    demo: true,
    createdAt: Date.UTC(2026, 8, 12),
    marketCapUsd: 3_880_000,
    volumeUsd: 96_000,
    change24h: -1.4,
    sparkline: [9, 9, 10, 9, 11, 10, 12, 11, 13, 12, 14, 13],
  }),
  launch({
    id: "seed-doom",
    name: "Doom",
    symbol: "DOOM",
    description: "First-person corridors. Shotgun the demons.",
    prompt: "Doom first person corridors shotgun demons",
    genre: "Action",
    gameHtml: DOOM,
    demo: true,
    createdAt: Date.UTC(2026, 8, 14),
    marketCapUsd: 12_400_000,
    volumeUsd: 640_000,
    change24h: 22.1,
    sparkline: [4, 5, 6, 8, 7, 10, 12, 11, 14, 18, 17, 21],
  }),
];

export function fallbackGame(prompt: string): { html: string; name: string; symbol: string } {
  switch (pickMechanic(prompt)) {
    case "fps":
      return { html: DOOM, name: "Doom", symbol: "DOOM" };
    case "snake":
      return { html: SNAKE, name: "Neon Snake", symbol: "SNEK" };
    case "flappy":
      return { html: FLAPPY, name: "Pipe Bird", symbol: "PIPE" };
    case "shooter":
      return { html: SHIP, name: "Bit Ship", symbol: "SHIP" };
    case "frogger":
    case "platformer":
      return { html: FROG, name: "Canal Frog", symbol: "FROG" };
    case "pong":
    case "breakout":
      return { html: PONG, name: "Knot Pong", symbol: "KNOTS" };
    case "collector":
      return { html: CATCH, name: "Drip Catch", symbol: "DRIP" };
    default:
      return { html: DODGE, name: "Orbit Cat", symbol: "ZCAT" };
  }
}
