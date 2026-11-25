/* ===== CONFIG: isi dari Supabase > Project Settings > API ===== */
const SUPABASE_URL="ISI_SUPABASE_URL";
const SUPABASE_ANON_KEY="ISI_SUPABASE_ANON_KEY";
const UNITS=["SUBDIT GASUM","SUBDIT DALMAS","SUBBAGRENMIN","K-9"];
/* ================================================================ */
const STAT=["Hadir","Izin","Sakit","Dinas Luar","Cuti"],SI={"Izin":"📝 Izin","Sakit":"🤒 Sakit","Dinas Luar":"🚔 Dinas Luar","Cuti":"🏖️ Cuti"};
const TZ="Asia/Makassar",$=i=>document.getElementById(i);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cls=s=>(s||"Belum").split(" ")[0],tag=s=>`<span class="tag ${cls(s)}">${esc(s||"Belum absen")}</span>`;
const today=()=>new Date().toLocaleDateString("sv-SE",{timeZone:TZ});
const T=v=>v?new Date(v).toLocaleTimeString("id-ID",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false}).replace(".",":"):"-";
const DM=d=>d.split("-").reverse().join("/");
function toast(t){const e=$("toast");e.textContent=t;e.style.display="block";clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display="none",2600)}
const ok=!SUPABASE_URL.startsWith("ISI_");
const sb=ok?supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
let me=null,tdy=null,pick="Izin",tab="me",session=null,P=[],busy=false;
try{me=JSON.parse(sessionStorage.getItem("sam_me")||"null")}catch(e){}

async function rpc(n,a){const {data,error}=await sb.rpc(n,a);if(error)throw error;return data}
function view(){["login","me","alogin","adm"].forEach(k=>$("v-"+k).classList.add("hide"));
  $("v-"+(tab==="me"?(me?"me":"login"):(session?"adm":"alogin"))).classList.remove("hide");
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.t===tab))}
function getLoc(){return new Promise(r=>{if(!navigator.geolocation)return r(null);navigator.geolocation.getCurrentPosition(p=>r({lat:+p.coords.latitude.toFixed(6),lon:+p.coords.longitude.toFixed(6),acc:Math.round(p.coords.accuracy)}),()=>r(null),{enableHighAccuracy:true,timeout:10000,maximumAge:0})})}

/* ---------- Absen Saya ---------- */
async function loadMe(){try{
  const [t,h]=await Promise.all([rpc("status_hari_ini",{p_nrp:me.nrp}),rpc("riwayat_saya",{p_nrp:me.nrp,p_bulan:$("bln").value||today().slice(0,7)})]);
  tdy=t[0]||null;if(tdy&&tdy.status!=="Hadir"){pick=tdy.status;$("ket").value=tdy.ket||""}renderMe(h)}catch(e){toast("Gagal memuat: "+e.message)}}
function drawOpts(){$("opts").innerHTML=STAT.slice(1).map(s=>`<button data-s="${s}" class="${s===pick?"on":""}">${s}</button>`).join("")}
function renderMe(h){const r=tdy,na=!!r&&r.status!=="Hadir",hd=!!r&&r.status==="Hadir";
  $("av").textContent=me.nama[0];$("m-nama").textContent=(me.pangkat?me.pangkat+" ":"")+me.nama;$("m-sub").textContent="NRP "+me.nrp+" · "+(me.unit||"-");
  $("m-st").innerHTML=tag(r&&r.status);$("m-in").textContent=r?T(r.masuk):"--:--";$("m-out").textContent=r&&r.pulang?T(r.pulang):"--:--";
  const g=$("go"),q=$("plg");g.disabled=q.disabled=na;g.className="btn w"+(na?" g":"");q.className="btn w"+(na?" g":"");
  g.textContent=na?SI[r.status]:"✅ Absen Masuk";q.textContent=na?SI[r.status]:"🏠 Absen Pulang";
  g.classList.toggle("hide",hd);q.classList.toggle("hide",!(na||(hd&&!r.pulang)));
  $("dt").classList.toggle("hide",hd);$("bk").classList.toggle("hide",!na);$("go2").textContent=na?"Perbarui Keterangan":"Kirim Keterangan";
  drawOpts();const c={};h.forEach(x=>c[x.status]=(c[x.status]||0)+1);
  $("sum").innerHTML=STAT.map(k=>`<div><b class="${cls(k)}">${c[k]||0}</b><small>${k}</small></div>`).join("");
  $("rw").innerHTML=h.map(x=>`<tr><td>${DM(x.tanggal)}</td><td>${tag(x.status)}</td><td>${T(x.masuk)}</td><td>${T(x.pulang)}</td><td>${esc(x.ket)}</td></tr>`).join("")||'<tr><td colspan="5" class="note">Belum ada catatan bulan ini.</td></tr>'}
async function absen(st){if(busy)return;busy=true;toast("Mengambil lokasi…");
  try{const l=await getLoc();await rpc("absen_masuk",{p_nrp:me.nrp,p_status:st,p_ket:st==="Hadir"?"":$("ket").value.trim(),p_lok:l});toast("Absen tercatat: "+st+(l?" 📍":" (lokasi tidak tersedia)"));await loadMe()}
  catch(e){toast("Gagal: "+e.message)}busy=false}
$("go").onclick=()=>absen("Hadir");$("go2").onclick=()=>absen(pick);
$("plg").onclick=async()=>{if(busy)return;busy=true;toast("Mengambil lokasi…");
  try{const l=await getLoc();await rpc("absen_pulang",{p_nrp:me.nrp,p_lok:l});toast("Absen pulang tercatat"+(l?" 📍":" (lokasi tidak tersedia)"));await loadMe()}catch(e){toast("Gagal: "+e.message)}busy=false};
$("bk").onclick=async()=>{try{await rpc("batalkan_keterangan",{p_nrp:me.nrp});$("ket").value="";toast("Keterangan dibatalkan");await loadMe()}catch(e){toast("Gagal: "+e.message)}};
$("opts").onclick=e=>{if(e.target.dataset.s){pick=e.target.dataset.s;drawOpts()}};
$("bln").onchange=loadMe;
$("l-go").onclick=async()=>{const n=$("l-nrp").value.trim();if(!n)return;
  try{const r=await rpc("cek_nrp",{p_nrp:n});if(!r.length){$("l-err").textContent="NRP tidak terdaftar. Hubungi admin.";return}
    $("l-err").textContent="";me=r[0];try{sessionStorage.setItem("sam_me",JSON.stringify(me))}catch(e){}tab="me";view();loadMe()}catch(e){$("l-err").textContent="Gagal terhubung: "+e.message}};
$("l-nrp").addEventListener("keydown",e=>{if(e.key==="Enter")$("l-go").click()});
$("out").onclick=()=>{me=null;tdy=null;try{sessionStorage.removeItem("sam_me")}catch(e){}view()};

/* ---------- Admin ---------- */
$("ad-go").onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$("ad-em").value.trim(),password:$("ad-pw").value});
  $("ad-err").textContent=error?"Email atau password salah.":"";if(!error)$("ad-pw").value=""};
$("ao").onclick=()=>sb.auth.signOut();
const lok=l=>l?`<a href="https://www.google.com/maps?q=${Number(l.lat)},${Number(l.lon)}" target="_blank" rel="noopener">`:"";
async function loadAdm(){if(!session)return;
  const d=$("tg").value||today(),[a,b]=await Promise.all([sb.from("personel").select("*").order("nama"),sb.from("absensi").select("*").eq("tanggal",d)]);
  if(a.error||b.error){toast("Gagal memuat: "+(a.error||b.error).message);return}
  P=a.data;const A={};b.data.forEach(x=>A[x.nrp]=x);window.AA=A;
  const fu=$("fu"),cur=fu.value,us=[...new Set(UNITS.concat(P.map(p=>p.unit).filter(Boolean)))];
  fu.innerHTML='<option value="">Semua unit</option>'+us.map(u=>`<option${u===cur?" selected":""}>${esc(u)}</option>`).join("");
  const L=cur?P.filter(p=>p.unit===cur):P,c={Hadir:0,Izin:0,Sakit:0,"Dinas Luar":0,Cuti:0,Belum:0};
  $("atb").innerHTML=L.map(p=>{const r=A[p.nrp],s=r?r.status:"Belum";c[s]++;
    return`<tr><td>${esc(p.nrp)}</td><td>${esc(p.pangkat)} ${esc(p.nama)}</td><td>${esc(p.unit)}</td><td>${tag(s)}</td><td>${T(r&&r.masuk)}</td><td>${T(r&&r.pulang)}</td><td>${esc(r&&r.ket||"")}</td><td>${r&&r.lok_in?lok(r.lok_in)+"📍Masuk</a> ":""}${r&&r.lok_out?lok(r.lok_out)+"📍Pulang</a>":""}${r&&(r.lok_in||r.lok_out)?"":"-"}</td></tr>`}).join("")||'<tr><td colspan="8" class="note">Belum ada personel.</td></tr>';
  $("asum").innerHTML=Object.keys(c).map(k=>`<div><b class="${cls(k)}">${c[k]}</b><small>${k==="Belum"?"Belum":k}</small></div>`).join("");
  $("cnt").textContent="("+P.length+")";
  $("tp").innerHTML=P.map(p=>`<tr><td>${esc(p.nrp)}</td><td>${esc(p.nama)}</td><td>${esc(p.unit)}</td><td><button class="btn d s" data-x="${esc(p.nrp)}">Hapus</button></td></tr>`).join("")||'<tr><td colspan="4" class="note">Belum ada personel.</td></tr>'}
$("tp").onclick=async e=>{const n=e.target.dataset.x;if(!n||!confirm("Hapus personel "+n+" beserta riwayat absennya?"))return;
  const {error}=await sb.from("personel").delete().eq("nrp",n);toast(error?"Gagal: "+error.message:"Personel dihapus");loadAdm()};
$("add").onclick=async()=>{const n=$("a-nrp").value.trim(),m=$("a-nama").value.trim();if(!n||!m)return toast("NRP dan nama wajib diisi");
  const {error}=await sb.from("personel").upsert({nrp:n,nama:m,pangkat:$("a-pkt").value.trim().toUpperCase(),unit:$("a-unit").value});
  if(error)return toast("Gagal: "+error.message);["a-nrp","a-nama","a-pkt"].forEach(i=>$(i).value="");toast("Personel disimpan");loadAdm()};
$("imp").onclick=async()=>{const rows=$("bulk").value.split("\n").map(l=>l.split(",").map(s=>s.trim())).filter(x=>x[0]&&x[1]).map(x=>({nrp:x[0],nama:x[1],pangkat:(x[2]||"").toUpperCase(),unit:x[3]||""}));
  if(!rows.length)return toast("Tidak ada baris valid");const {error}=await sb.from("personel").upsert(rows);
  if(error)return toast("Gagal: "+error.message);$("bulk").value="";toast(rows.length+" personel diimpor");loadAdm()};
$("csv").onclick=()=>{const d=$("tg").value||today(),cur=$("fu").value,A=window.AA||{},ll=l=>l?Number(l.lat)+","+Number(l.lon):"";
  const out=[["NRP","Nama","Pangkat","Unit","Status","Masuk","Pulang","Keterangan","Lokasi Masuk","Lokasi Pulang"]];
  P.filter(p=>!cur||p.unit===cur).forEach(p=>{const r=A[p.nrp]||{};out.push([p.nrp,p.nama,p.pangkat,p.unit,r.status||"Belum absen",r.masuk?T(r.masuk):"",r.pulang?T(r.pulang):"",r.ket||"",ll(r.lok_in),ll(r.lok_out)])});
  const t="\ufeff"+out.map(r=>r.map(v=>{v=String(v);return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv"}));a.download="absensi-samapta-"+d+".csv";a.click()};
$("tg").onchange=$("fu").onchange=$("rf").onclick=loadAdm;
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{tab=b.dataset.t;view();if(tab==="adm")loadAdm()});

/* ---------- Mulai ---------- */
const HR=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"],BL=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
function tick(){const d=new Date(),w=new Date(d.toLocaleString("en-US",{timeZone:TZ})),p=n=>(n<10?"0":"")+n;
  $("jam").textContent=p(w.getHours())+":"+p(w.getMinutes())+":"+p(w.getSeconds())+" WITA";$("tgl").textContent=HR[w.getDay()]+", "+w.getDate()+" "+BL[w.getMonth()]+" "+w.getFullYear()}
tick();setInterval(tick,1000);
$("a-unit").innerHTML='<option value="">Pilih Unit / Subdit</option>'+UNITS.map(u=>`<option>${u}</option>`).join("");
$("tg").value=today();$("bln").value=today().slice(0,7);drawOpts();
if(!ok){$("setup").classList.remove("hide");document.querySelector("nav").classList.add("hide");$("v-login").classList.add("hide")}
else{sb.auth.getSession().then(({data})=>{session=data.session;view();if(me)loadMe()});
  sb.auth.onAuthStateChange((_e,s)=>{session=s;view();if(s)loadAdm()});
  setInterval(()=>{if(session&&tab==="adm")loadAdm()},30000)}
