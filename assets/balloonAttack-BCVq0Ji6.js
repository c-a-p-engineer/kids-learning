import"./modulepreload-polyfill-B5Qt9EMX.js";const X=30,le=3,g=160,b=120,de=34,me=.075,ue=4,fe=780,L=document.querySelector("#camera"),H=document.querySelector("#motion-canvas"),v=H.getContext("2d",{willReadFrequently:!0}),P=document.querySelector("#stage"),he=document.querySelector("#balloon-layer"),Z=document.querySelector("#effects"),ee=document.querySelector("#score"),z=document.querySelector("#time"),te=document.querySelector(".timer"),pe=document.querySelector("#start-panel"),ne=document.querySelector("#countdown-panel"),j=document.querySelector("#countdown-number"),oe=document.querySelector("#result-panel"),ge=document.querySelector("#result-score"),re=document.querySelector("#error-panel"),we=document.querySelector("#error-message"),N=document.querySelector("#start-button"),D=document.querySelector("#retry-button"),F=document.querySelector("#retry-camera-button");H.width=g;H.height=b;let u=null,x=null,I=0,G=0,$=0,R=0,q=!1,J=null;const A=[];function k(e){[pe,ne,oe,re].forEach(t=>t.classList.toggle("hidden",t!==e))}function V(){return J??(J=new AudioContext),J}function ye(){const e=V(),t=e.createOscillator(),n=e.createGain();t.type="sine",t.frequency.setValueAtTime(520,e.currentTime),t.frequency.exponentialRampToValueAtTime(120,e.currentTime+.12),n.gain.setValueAtTime(.18,e.currentTime),n.gain.exponentialRampToValueAtTime(.001,e.currentTime+.14),t.connect(n).connect(e.destination),t.start(),t.stop(e.currentTime+.15)}function Me(){const e=V();[523,659,784].forEach((t,n)=>{const a=e.createOscillator(),r=e.createGain();a.type="triangle",a.frequency.value=t,r.gain.setValueAtTime(.001,e.currentTime+n*.12),r.gain.linearRampToValueAtTime(.15,e.currentTime+n*.12+.02),r.gain.exponentialRampToValueAtTime(.001,e.currentTime+n*.12+.25),a.connect(r).connect(e.destination),a.start(e.currentTime+n*.12),a.stop(e.currentTime+n*.12+.27)})}async function xe(){var e;if(!u){if(!((e=navigator.mediaDevices)!=null&&e.getUserMedia))throw new Error("このブラウザはカメラ機能に対応していません。");u=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:!1}),L.srcObject=u,await L.play()}}function ae(){A.splice(0).forEach(({element:e})=>e.remove()),Z.replaceChildren()}function B(){if(!q||A.length>=ue)return;const e=P.getBoundingClientRect(),t=Math.min(Math.max(e.width*(e.width<500?.24:.17),86),150),n=18,a=62,r=Math.random()*Math.max(1,e.width-t-16)+8,w=Math.random()*Math.max(1,e.height-t-n-a)+n,c=["red","blue","yellow","green","purple"],i=document.createElement("div");i.className=`balloon ${c[Math.floor(Math.random()*c.length)]}`,i.style.left=`${r}px`,i.style.top=`${w}px`,i.style.animationDelay=`${Math.random()*-2}s`,i.textContent="✨",he.append(i),A.push({element:i,bornAt:performance.now()})}function be(e){const t=A.indexOf(e);if(t<0)return;A.splice(t,1);const n=e.element.getBoundingClientRect(),a=P.getBoundingClientRect();e.element.remove(),R+=1,ee.textContent=String(R);const r=document.createElement("div");r.className="pop",r.style.left=`${n.left-a.left+n.width/2}px`,r.style.top=`${n.top-a.top+n.height/2}px`,r.textContent=R%10===0?"🎉":"💥",Z.append(r),window.setTimeout(()=>r.remove(),650),ye(),window.setTimeout(B,130)}function Ae(e,t){if(!x)return 0;const n=P.getBoundingClientRect(),a=e.element.getBoundingClientRect(),r=n.right-a.right,w=Math.max(0,Math.floor(r/n.width*g)),c=Math.min(g-1,Math.ceil((r+a.width)/n.width*g)),i=Math.max(0,Math.floor((a.top-n.top)/n.height*b)),E=Math.min(b-1,Math.ceil((a.bottom-n.top)/n.height*b));let T=0,f=0;for(let o=i;o<=E;o+=2)for(let s=w;s<=c;s+=2){const d=(o*g+s)*4;Math.abs(t[d]-x[d])+Math.abs(t[d+1]-x[d+1])+Math.abs(t[d+2]-x[d+2])>de*3&&(T+=1),f+=1}return f>0?T/f:0}function ie(){if(!q)return;v.save(),v.scale(-1,1),v.drawImage(L,-g,0,g,b),v.restore();const e=v.getImageData(0,0,g,b).data,t=performance.now();for(const n of[...A])t-n.bornAt>380&&Ae(n,e)>=me&&be(n);x=new Uint8ClampedArray(e),I=requestAnimationFrame(ie)}function Ee(){q=!1,cancelAnimationFrame(I),window.clearInterval(G),window.clearInterval($),te.classList.remove("is-ending"),ae(),ge.textContent=String(R),k(oe),Me()}async function Te(){k(ne);for(let e=le;e>=1;e-=1)j.textContent=String(e),await new Promise(t=>window.setTimeout(t,700));j.textContent="GO!",await new Promise(e=>window.setTimeout(e,500))}async function U(){N.disabled=!0,D.disabled=!0,F.disabled=!0;try{V(),await xe(),await Te(),k(null),ae(),R=0,ee.textContent="0",z.textContent=String(X),x=null,q=!0;for(let t=0;t<3;t+=1)B();G=window.setInterval(B,fe);let e=X;$=window.setInterval(()=>{e-=1,z.textContent=String(e),te.classList.toggle("is-ending",e<=5),e<=0&&Ee()},1e3),I=requestAnimationFrame(ie)}catch(e){const t=e instanceof DOMException&&e.name==="NotAllowedError"?"カメラが許可されていません。ブラウザの設定でカメラを許可してください。":e instanceof Error?e.message:"カメラを開始できませんでした。";we.textContent=t,k(re)}finally{N.disabled=!1,D.disabled=!1,F.disabled=!1}}N.addEventListener("click",()=>void U());D.addEventListener("click",()=>void U());F.addEventListener("click",()=>{u==null||u.getTracks().forEach(e=>e.stop()),u=null,U()});window.addEventListener("pagehide",()=>{q=!1,cancelAnimationFrame(I),window.clearInterval(G),window.clearInterval($),u==null||u.getTracks().forEach(e=>e.stop())});const y=96,S=72,p=4,C=3,Q=5,ve=92,Se=.055,Y=document.querySelector("#stage"),_=document.querySelector("#camera"),Ce=Array.from(document.querySelectorAll("#start-panel, #countdown-panel, #result-panel, #error-panel"));if(Y&&_){let e=function(){return Ce.every(o=>o.classList.contains("hidden"))&&_.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA},t=function(){E.forEach(o=>{o.hidden=!0})},n=function(o,s){const d=y/p,h=S/C,W=new Array(p*C).fill(0),O=new Array(p*C).fill(0);for(let m=0;m<S;m+=2)for(let l=0;l<y;l+=2){const M=(m*y+l)*4,se=Math.abs(o[M]-s[M])+Math.abs(o[M+1]-s[M+1])+Math.abs(o[M+2]-s[M+2]),ce=Math.min(p-1,Math.floor(l/d)),K=Math.min(C-1,Math.floor(m/h))*p+ce;O[K]+=1,se>=ve&&(W[K]+=1)}return W.map((m,l)=>({column:l%p,row:Math.floor(l/p),ratio:O[l]>0?m/O[l]:0})).filter(m=>m.ratio>=Se).sort((m,l)=>l.ratio-m.ratio).slice(0,Q)},a=function(o){o.forEach((s,d)=>{const h=E[d];h.hidden=!1,h.style.left=`${(s.column+.5)/p*100}%`,h.style.top=`${(s.row+.5)/C*100}%`,h.style.setProperty("--marker-strength",String(Math.min(1,s.ratio/.32))),h.classList.toggle("is-strong",s.ratio>=.18)}),E.slice(o.length).forEach(s=>{s.hidden=!0})},r=function(){if(!c||!e()){f=null,t(),requestAnimationFrame(r);return}c.save(),c.scale(-1,1),c.drawImage(_,-y,0,y,S),c.restore();const o=c.getImageData(0,0,y,S).data;f&&a(n(o,f)),f=new Uint8ClampedArray(o),requestAnimationFrame(r)};const w=document.createElement("canvas");w.width=y,w.height=S;const c=w.getContext("2d",{willReadFrequently:!0}),i=document.createElement("div");i.className="hit-marker-layer",i.setAttribute("aria-hidden","true"),Y.append(i);const E=Array.from({length:Q},()=>{const o=document.createElement("div");return o.className="hit-marker",o.innerHTML='<span class="hit-marker-dot"></span>',i.append(o),o}),T=document.createElement("style");T.textContent=`
    .hit-marker-layer {
      position: absolute;
      inset: 0;
      z-index: 7;
      pointer-events: none;
      overflow: hidden;
    }
    .hit-marker {
      --marker-strength: 0;
      position: absolute;
      width: clamp(72px, 16vw, 118px);
      aspect-ratio: 1;
      border: clamp(4px, .8vw, 7px) solid rgba(255, 255, 255, .94);
      border-radius: 50%;
      transform: translate(-50%, -50%) scale(calc(.88 + var(--marker-strength) * .14));
      opacity: calc(.42 + var(--marker-strength) * .5);
      box-shadow:
        0 0 0 5px rgba(0, 181, 255, .72),
        0 0 24px 8px rgba(0, 181, 255, .48),
        inset 0 0 15px rgba(255, 255, 255, .8);
      transition: left 80ms linear, top 80ms linear, opacity 100ms ease, transform 100ms ease;
    }
    .hit-marker::before,
    .hit-marker::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      background: rgba(255, 255, 255, .96);
      transform: translate(-50%, -50%);
      border-radius: 999px;
    }
    .hit-marker::before { width: 42%; height: 5px; }
    .hit-marker::after { width: 5px; height: 42%; }
    .hit-marker-dot {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 15%;
      aspect-ratio: 1;
      border-radius: 50%;
      background: #ffe34e;
      border: 3px solid #fff;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 12px rgba(255, 213, 0, .9);
    }
    .hit-marker.is-strong {
      box-shadow:
        0 0 0 6px rgba(255, 73, 104, .82),
        0 0 28px 10px rgba(255, 73, 104, .58),
        inset 0 0 16px rgba(255, 255, 255, .9);
    }
    @media (prefers-reduced-motion: reduce) {
      .hit-marker { transition: none; }
    }
  `,document.head.append(T);let f=null;t(),requestAnimationFrame(r)}
