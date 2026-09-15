const CTX_METHODS =
  "beginPath|closePath|moveTo|lineTo|arc|arcTo|fill|stroke|clip|fillRect|strokeRect|clearRect|fillText|strokeText|save|restore|rect|translate|rotate|scale|setTransform|resetTransform|drawImage|quadraticCurveTo|bezierCurveTo|setLineDash|measureText|createLinearGradient|createRadialGradient";

const CTX_PROPS =
  "fillStyle|strokeStyle|lineWidth|font|textAlign|textBaseline|globalAlpha|lineCap|lineJoin|shadowBlur|shadowColor|shadowOffsetX|shadowOffsetY|globalCompositeOperation|imageSmoothingEnabled";

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
  return `<!doctype html><meta charset=utf-8><title>OCG</title><body style="margin:0;background:#041014;overflow:hidden"><canvas id=c></canvas><script>
const cv=document.getElementById('c'),_ctx=cv.getContext('2d');
function fit(){cv.width=innerWidth;cv.height=innerHeight}fit();addEventListener('resize',fit);
Object.defineProperty(window,'ctx',{value:_ctx,writable:false});
Object.defineProperty(window,'cv',{value:cv,writable:false});
window.c=cv;window.C=_ctx;
try{${script}}
catch(err){_ctx.fillStyle='#f07178';_ctx.font='16px sans-serif';_ctx.fillText(String(err&&err.message||err),12,32)}
</script>`;
}
