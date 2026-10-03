const fs=require("fs"),path=require("path");const root=process.cwd(),changed=[];
function edit(rel,fn){const p=path.join(root,rel);if(!fs.existsSync(p))return;const a=fs.readFileSync(p,"utf8"),b=fn(a);if(a!==b){fs.writeFileSync(p,b,"utf8");changed.push(rel)}}
const pairs=[["#006B57","#1560BD"],["#004D40","#0D3D78"],["#E7F5F1","#EAF2FC"],["#CDECE3","#D7E7FB"],["#DDEBE7","#DCE8F7"],["#FBFCF8","#F4F8FD"],["#17201D","#172033"],["#17201d","#172033"],["rgba(0,77,64,.06)","rgba(21,96,189,.08)"]];
const repl=s=>{for(const [a,b] of pairs)s=s.split(a).join(b);return s};
["app/globals.css","app/manifest.ts","app/home/page.tsx","app/discover/page.tsx","app/me/page.tsx","app/onboarding/page.tsx","components/bottom-nav.tsx","components/page-header.tsx","components/ui/button.tsx","components/ui/input.tsx","components/ui/textarea.tsx","app/login/page.tsx","app/chats/page.tsx","app/chats/[id]/page.tsx","app/connections/page.tsx","app/people/[id]/page.tsx","app/settings/page.tsx","app/spaces/page.tsx","app/spaces/[id]/page.tsx"].forEach(rel=>edit(rel,repl));
edit("app/globals.css",s=>{s=repl(s).replace(/html\{direction:rtl;background:var\(--surface\)\}body\{margin:0;background:var\(--surface\);/,'html{direction:rtl;background:var(--surface);overflow-x:hidden}body{margin:0;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,#E8F2FF 0%,#F4F8FD 38%,#F8FAFD 100%);');if(!s.includes('input[type="date"]'))s+='\ninput[type="date"]{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none}input[type="date"]::-webkit-date-and-time-value{text-align:right}\n';return s});
edit("app/onboarding/page.tsx",s=>repl(s).replace('<Input type="date" value={birth} onChange={e=>setBirth(e.target.value)}/>','<Input type="date" value={birth} onChange={e=>setBirth(e.target.value)} className="block w-full min-w-0 max-w-full overflow-hidden [direction:ltr] text-right"/>'));
edit("components/page-header.tsx",s=>repl(s).replace('<CrowdMark size={17}/><p className="text-[12px] font-extrabold">لمتنا</p>','<span className="relative -top-0.5"><CrowdMark size={17}/></span><p className="text-[12px] font-extrabold">لمتنا</p>'));
const audit=`# Lammetna Frontend ↔ Backend Parity
Source of truth: latest master prompt + live Supabase schema.

## UI parity backlog
- Discovery: vibe ranking, swipe/rewind, mystery discovery, voice-first, attention ping, super interest, match moment.
- Social: interests, visitors/unlock, daily question, daily missions, profile prompts, social status.
- Chat: mutual consent, blurred media reveal, voice calls, duo challenge, smart restart, surprise prompt, private-photo mutual reveal, 60s intro.
- Lamma: public/private, password, quick rooms, stage/mic, star chair, challenges, pair spotlight, mystery guest, gifts/voice gifts, entry effects, after-Lamma/social chain.
- Economy: star packs, localized pricing, gifts, host earnings, withdrawal/convert, payout methods, debt/holds.
- Identity: KYC and payout eligibility states.
- Safety: block/report, moderation, legal acceptance.

## External production blockers
Apple/Google server IAP verification and webhooks; real KYC/liveness; real payout provider; TURN; auth leaked-password protection/OTP/email confirmation verification; legal counsel review.
`;
fs.writeFileSync(path.join(root,"FRONTEND_BACKEND_PARITY.md"),audit,"utf8");changed.push("FRONTEND_BACKEND_PARITY.md");
console.log("Lammetna phase-1 applied. Updated "+changed.length+" files.");changed.forEach(x=>console.log(" - "+x));console.log("\nNext: npm run build");
