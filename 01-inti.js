/* ============================================================
   DIWACARE — inti aplikasi
   Seluruh data tersimpan di peramban pengguna. Tidak ada
   pengiriman data ke server mana pun.
   ============================================================ */
(function(){
'use strict';

/* ---------- pembantu ---------- */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => (p||'id')+'_'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pad2 = n => String(n).padStart(2,'0');
const icon = (n,cls) => `<svg class="${cls||''}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;

const DAY = 86400000;
const startOfDay = d => { const x=new Date(d); x.setHours(0,0,0,0); return x; };
const isoDate = d => { const x=new Date(d); return x.getFullYear()+'-'+pad2(x.getMonth()+1)+'-'+pad2(x.getDate()); };
const addDays = (d,n) => new Date(startOfDay(d).getTime()+n*DAY);
const BULAN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_S=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const HARI=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const HARI_S=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const fmtDate = s => { const d=new Date(s+'T00:00:00'); return d.getDate()+' '+BULAN[d.getMonth()]+' '+d.getFullYear(); };
const fmtDateFull = s => { const d=new Date(s+'T00:00:00'); return HARI[d.getDay()]+', '+fmtDate(s); };
const fmtShort = s => { const d=new Date(s+'T00:00:00'); return d.getDate()+' '+BULAN_S[d.getMonth()]; };
const daysFromToday = s => Math.round((startOfDay(new Date(s+'T00:00:00'))-startOfDay(new Date()))/DAY);
function relDay(s){
  const n=daysFromToday(s);
  if(n===0) return 'Hari ini'; if(n===1) return 'Besok'; if(n===-1) return 'Kemarin';
  if(n===2) return 'Lusa';
  return n>0 ? (n+' hari lagi') : (Math.abs(n)+' hari lalu');
}
function relTime(iso){
  const m=Math.round((Date.now()-new Date(iso).getTime())/60000);
  if(m<1) return 'baru saja'; if(m<60) return m+' menit lalu';
  const h=Math.round(m/60); if(h<24) return h+' jam lalu';
  const d=Math.round(h/24); if(d<30) return d+' hari lalu';
  return Math.round(d/30)+' bulan lalu';
}
const n1 = v => Number(v).toFixed(1).replace('.',',');
const n0 = v => Number(v).toFixed(0);
const initials = n => String(n||'?').replace(/^(dr\.|Dr\.|drg\.|Ns\.|Ners)\s*/i,'').trim()
  .split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();

/* ---------- sandi (disimpan sebagai hash bersalt) ---------- */
function randSalt(){
  const a=new Uint8Array(12);
  if(window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for(let i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256);
  return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(pw, salt){
  const msg = 'diwacare$'+salt+'$'+pw;
  if(window.crypto && crypto.subtle && crypto.subtle.digest){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return 'sha256:'+Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  let h1=0x811c9dc5,h2=0x01000193;
  for(let i=0;i<msg.length;i++){ h1=(h1^msg.charCodeAt(i))>>>0; h1=Math.imul(h1,16777619)>>>0; h2=(Math.imul(h2^msg.charCodeAt(i),2654435761))>>>0; }
  return 'fnv:'+h1.toString(16)+h2.toString(16);
}
function passwordScore(pw){
  if(!pw) return 0;
  let s=0;
  if(pw.length>=8) s++;
  if(pw.length>=12) s++;
  if(/[a-z]/.test(pw)&&/[A-Z]/.test(pw)) s++;
  if(/\d/.test(pw)) s++;
  if(/[^A-Za-z0-9]/.test(pw)) s++;
  return clamp(s,0,4);
}

/* ============================================================
   PENYIMPANAN
   ============================================================ */
const KEY='diwacare.data.v2';
const PREFS_KEY='diwacare.preferensi';
const EMPTY={ meta:{versi:2, urutan:{pasien:0, dokter:0, perawat:0, nakes:0}},
  users:[],patients:[],professionals:[],wounds:[],assessments:[],timeline:[],
  appointments:[],reminders:[],notifications:[],notes:[] };

let DB = null;
let storageOK = true;

function loadDB(){
  try{
    const raw = localStorage.getItem(KEY);
    DB = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(EMPTY));
    for(const k in EMPTY){ if(DB[k]===undefined) DB[k]=JSON.parse(JSON.stringify(EMPTY[k])); }
    if(!DB.meta.urutan) DB.meta.urutan={pasien:0,dokter:0,perawat:0,nakes:0};
  }catch(e){ storageOK=false; DB=JSON.parse(JSON.stringify(EMPTY)); }
  return DB;
}
function saveDB(){
  try{ localStorage.setItem(KEY, JSON.stringify(DB)); siarkan(); return true; }
  catch(e){
    toast('err','Penyimpanan penuh','Ruang penyimpanan peramban habis. Hapus beberapa dokumentasi lama lewat halaman Profil.',8000);
    return false;
  }
}
function lsSet(k,v){ try{ localStorage.setItem(k, typeof v==='string'?v:JSON.stringify(v)); }catch(e){} }
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }

function nextSeq(jenis){
  DB.meta.urutan[jenis] = (DB.meta.urutan[jenis]||0)+1;
  return DB.meta.urutan[jenis];
}
const TAHUN = new Date().getFullYear();
function makePatientId(){ return 'PAS-'+TAHUN+'-'+String(nextSeq('pasien')).padStart(4,'0'); }
function makeProId(profesi){
  const map={dokter:['DOK','dokter'],perawat:['PRW','perawat'],nakes:['NKS','nakes']};
  const m = map[profesi]||map.nakes;
  return m[0]+'-'+TAHUN+'-'+String(nextSeq(m[1])).padStart(4,'0');
}

/* ---------- preferensi tampilan ---------- */
const PREFS_DEFAULT={ theme:'system', motion:'system', contrast:'normal', text:'normal', suara:true };
let PREFS = Object.assign({},PREFS_DEFAULT);
function loadPrefs(){
  try{ PREFS = Object.assign({}, PREFS_DEFAULT, JSON.parse(lsGet(PREFS_KEY)||'{}')); }
  catch(e){ PREFS = Object.assign({},PREFS_DEFAULT); }
  applyPrefs();
}
function applyPrefs(){
  const r=document.documentElement;
  if(PREFS.theme==='system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',PREFS.theme);
  if(PREFS.motion==='system') r.removeAttribute('data-motion'); else r.setAttribute('data-motion',PREFS.motion);
  if(PREFS.contrast==='high') r.setAttribute('data-contrast','high'); else r.removeAttribute('data-contrast');
  if(PREFS.text==='large') r.setAttribute('data-text','large'); else r.removeAttribute('data-text');
}
function setPref(k,v){ PREFS[k]=v; lsSet(PREFS_KEY,PREFS); applyPrefs(); }

/* ============================================================
   SUARA NOTIFIKASI
   Nada dibangkitkan langsung oleh peramban, tanpa berkas audio.
   ============================================================ */
let AUDIO=null;
function siapkanAudio(){
  try{
    if(!AUDIO){ const K=window.AudioContext||window.webkitAudioContext; if(!K) return; AUDIO=new K(); }
    if(AUDIO.state==='suspended') AUDIO.resume();
  }catch(e){}
}
const NADA={
  notif:[[880,0],[1174,.11]],
  sukses:[[660,0],[880,.10],[1174,.20]],
  ingat:[[523,0],[659,.13],[784,.26]],
  kirim:[[784,0],[1046,.09]]
};
function bunyi(jenis){
  if(!PREFS.suara) return;
  siapkanAudio();
  if(!AUDIO || AUDIO.state!=='running') return;
  const pola=NADA[jenis]||NADA.notif, t0=AUDIO.currentTime;
  try{
    pola.forEach(function(n){
      const osc=AUDIO.createOscillator(), gain=AUDIO.createGain();
      osc.type='sine'; osc.frequency.value=n[0];
      const mulai=t0+n[1];
      gain.gain.setValueAtTime(0.0001,mulai);
      gain.gain.exponentialRampToValueAtTime(0.13,mulai+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001,mulai+0.34);
      osc.connect(gain); gain.connect(AUDIO.destination);
      osc.start(mulai); osc.stop(mulai+0.36);
    });
  }catch(e){}
}
/* peramban baru mengizinkan suara setelah pengguna menyentuh halaman sekali */
['pointerdown','keydown'].forEach(function(ev){
  window.addEventListener(ev,function sekali(){ siapkanAudio();
    window.removeEventListener(ev,sekali); },{once:true});
});

/* ============================================================
   SINKRONISASI ANTAR TAB
   Dua tab (pasien dan tenaga kesehatan) berbagi localStorage yang sama.
   Setiap penyimpanan disiarkan agar tab lain memperbarui tampilannya
   tanpa perlu dimuat ulang.
   ============================================================ */
let KANAL=null;
try{ if('BroadcastChannel' in window) KANAL=new BroadcastChannel('diwacare.sinkron'); }catch(e){}
let abaikanSiaran=false;
function siarkan(){
  try{ if(KANAL) KANAL.postMessage({t:Date.now()}); }catch(e){}
}
function terapkanSinkron(){
  if(abaikanSiaran) return;
  const sebelum = SESSION ? DB.notifications.filter(n=>n.userId===SESSION.id && !n.read).length : 0;
  loadDB();
  if(SESSION){ SESSION = DB.users.find(u=>u.id===SESSION.id) || SESSION; }
  const barisBaru = SESSION ? DB.notifications.filter(n=>n.userId===SESSION.id && !n.read) : [];
  if(window.DWrerender) window.DWrerender();
  if(barisBaru.length>sebelum){
    const b=barisBaru[0];
    toast('info', b?b.title:'Ada pembaruan', b?b.message:'', 7000);
    bunyi('notif');
  }
}
if(KANAL) KANAL.onmessage=()=>terapkanSinkron();
window.addEventListener('storage',e=>{ if(e.key===KEY) terapkanSinkron(); });

/* ============================================================
   TOAST + MODAL
   ============================================================ */
const TICONS={ok:'check',err:'x',warn:'alert',info:'info'};
function toast(kind,title,msg,ms){
  const host=$('#toasts'); if(!host) return;
  const el=document.createElement('div');
  el.className='toast toast-'+(kind||'info');
  el.innerHTML=`<span class="tk">${icon(TICONS[kind]||'info')}</span><div><div class="tt">${esc(title)}</div>${msg?`<div class="tm">${esc(msg)}</div>`:''}</div>`;
  host.appendChild(el);
  const t=setTimeout(close, ms||4400);
  el.addEventListener('click',close);
  function close(){ clearTimeout(t); el.classList.add('out'); setTimeout(()=>el.remove(),190); }
}
let modalPrev=null;
function openModal(html, opts){
  opts=opts||{};
  const root=$('#modal-root');
  modalPrev=document.activeElement;
  root.innerHTML=`<div class="mask" data-close></div>
    <div class="modal ${opts.wide?'modal-wide':''}">
      <div class="modal-hd"><h3>${esc(opts.title||'')}</h3><button class="x" data-close aria-label="Tutup">${icon('x')}</button></div>
      <div class="modal-bd">${html}</div>
    </div>`;
  root.classList.add('on');
  document.body.style.overflow='hidden';
  root.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
  const f=root.querySelector('input:not([type="radio"]):not([type="checkbox"]),select,textarea');
  if(f) setTimeout(()=>{ try{f.focus();}catch(e){} },70);
  return root.querySelector('.modal-bd');
}
function closeModal(){
  const root=$('#modal-root'); root.classList.remove('on'); root.innerHTML='';
  document.body.style.overflow='';
  if(modalPrev && modalPrev.focus) try{modalPrev.focus();}catch(e){}
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && $('#modal-root').classList.contains('on')) closeModal(); });

function confirmModal(title,msg,okLabel,kind){
  return new Promise(res=>{
    const bd=openModal(`<p style="color:var(--ink-2);line-height:1.6">${esc(msg)}</p>
      <div class="row" style="justify-content:flex-end;margin-top:19px">
        <button class="btn btn-ghost" data-no>Batal</button>
        <button class="btn ${kind==='danger'?'btn-danger':'btn-primary'}" data-yes>${esc(okLabel||'Lanjutkan')}</button>
      </div>`,{title});
    bd.querySelector('[data-no]').onclick=()=>{closeModal();res(false);};
    bd.querySelector('[data-yes]').onclick=()=>{closeModal();res(true);};
  });
}

/* ============================================================
   SESI — tidak disimpan, wajib masuk ulang setiap membuka
   ============================================================ */
let SESSION=null;
const PRO_ROLES=['dokter','perawat','nakes'];
const isPro = r => PRO_ROLES.indexOf(r)>=0;

function setSession(u){ SESSION=u; }
function clearSession(){ SESSION=null; }
/* sisa sesi dari versi lama dibersihkan sekali di awal */
function purgeLegacySession(){
  ['currentUser','isAuthenticated','userRole','diwacare.remember','diwacare.prefs','diwacare.db.v1']
    .forEach(lsDel);
  try{ sessionStorage.removeItem('diwacare.tab'); }catch(e){}
}

const me      = () => SESSION;
const myPatient = () => SESSION ? DB.patients.find(p=>p.userId===SESSION.id) : null;
const myPro     = () => SESSION ? DB.professionals.find(p=>p.userId===SESSION.id) : null;
const proById   = id => DB.professionals.find(p=>p.professionalId===id);
const userOfPro = id => { const p=proById(id); return p?DB.users.find(u=>u.id===p.userId):null; };
const proName   = id => { const u=userOfPro(id); if(u) return u.name; const p=proById(id); return p&&p.name?p.name:'Tenaga kesehatan'; };
const proSpec   = id => { const p=proById(id); return p?p.specialty:''; };
const patById   = id => DB.patients.find(p=>p.patientId===id);
const userOfPat = id => { const p=patById(id); return p?DB.users.find(u=>u.id===p.userId):null; };
const patName   = id => { const u=userOfPat(id); return u?u.name:'Pasien'; };

const PROFESI_LABEL={dokter:'Dokter',perawat:'Perawat',nakes:'Tenaga kesehatan lain'};

/* jenis dan tarif konsultasi. Pembayaran pada aplikasi ini hanya simulasi. */
const MODE_KONSUL=[
  {id:'daring', label:'Konsultasi daring', ket:'Lewat panggilan video atau pesan, tanpa datang ke fasilitas.',
   ikon:'scan', tarif:50000},
  {id:'tatap',  label:'Tatap muka', ket:'Datang langsung ke instansi tempat tenaga kesehatan bertugas.',
   ikon:'pin', tarif:150000}
];
const METODE_BAYAR=[
  {id:'qris',  label:'QRIS', ket:'Pindai kode dari aplikasi pembayaran apa pun'},
  {id:'ewallet', label:'Dompet digital', ket:'GoPay, OVO, DANA, ShopeePay'},
  {id:'transfer', label:'Transfer bank', ket:'Virtual account otomatis'},
  {id:'tempat', label:'Bayar di tempat', ket:'Hanya untuk kunjungan tatap muka'}
];
const rupiah = n => 'Rp' + Number(n||0).toLocaleString('id-ID');

/* benda acuan untuk kalibrasi alat ukur (ukuran resmi, dalam milimeter) */
const ACUAN=[
  {id:'rp1000', label:'Uang logam Rp1.000', ket:'garis tengah 24,1 mm', mm:24.1},
  {id:'rp500',  label:'Uang logam Rp500',  ket:'garis tengah 27,0 mm', mm:27.0},
  {id:'kartu',  label:'Kartu ATM atau KTP', ket:'sisi panjang 85,6 mm', mm:85.6}
];

/* daftar tenaga kesehatan yang sudah tersedia di aplikasi.
   Hanya diisi sekali, dan hanya bagian direktori profesi — data pasien tetap kosong. */
const DIREKTORI=[
  {nama:'dr. Ahmad Pratama, Sp.PD', profesi:'dokter', bidang:'Penyakit Dalam', unit:'Poli Penyakit Dalam',
   instansi:'RSUD Kota Bandung', str:'3311100118004471', pengalaman:12, kota:'Bandung',
   email:'ahmad.pratama@rsudbandung.go.id', telepon:'022 4231 5544'},
  {nama:'dr. Ratna Kusumawardani, Sp.PD-KEMD', profesi:'dokter', bidang:'Endokrinologi & Diabetes', unit:'Klinik Diabetes Terpadu',
   instansi:'RS Umum Pusat Hasan Sadikin', str:'3311100119006612', pengalaman:15, kota:'Bandung',
   email:'ratna.kusuma@rshs.go.id', telepon:'022 2034 953'},
  {nama:'dr. Bayu Nugraha, Sp.B(K)V', profesi:'dokter', bidang:'Bedah Vaskular', unit:'Poli Bedah',
   instansi:'RSUD Kota Bandung', str:'3311100120007745', pengalaman:9, kota:'Bandung',
   email:'bayu.nugraha@rsudbandung.go.id', telepon:'022 4231 5566'},
  {nama:'Ns. Siti Rahmawati, S.Kep., CWCC', profesi:'perawat', bidang:'Perawatan Luka Bersertifikat', unit:'Unit Perawatan Luka',
   instansi:'Klinik Luka Sehat Bandung', str:'3312200121001183', pengalaman:8, kota:'Bandung',
   email:'siti.rahmawati@lukasehat.id', telepon:'022 7301 220'},
  {nama:'Ns. Dimas Prayoga, S.Kep.', profesi:'perawat', bidang:'Perawatan Luka & Kaki Diabetik', unit:'Poli Umum',
   instansi:'Puskesmas Cempaka', str:'3312200122002094', pengalaman:6, kota:'Bandung',
   email:'dimas.prayoga@puskesmascempaka.id', telepon:'022 5566 108'}
];
async function seedDirektori(){
  if(DB.professionals.length) return;
  const now=new Date().toISOString();
  for(const d of DIREKTORI){
    const salt=randSalt();
    const pro={ professionalId:makeProId(d.profesi), userId:null, name:d.nama, profession:d.profesi,
      professionalRegistrationNumber:d.str, institution:d.instansi, department:d.unit, specialty:d.bidang,
      experience:d.pengalaman, workLocation:d.kota, email:d.email, phone:d.telepon,
      verificationStatus:'Terverifikasi', createdAt:now,
      salt, pwHash:await hashPassword(randSalt()+randSalt(),salt) };
    DB.professionals.push(pro);
  }
  saveDB();
}

/* hak akses: nakes hanya melihat pasien yang terhubung dengannya */
function proCanSee(patientId){
  const pro=myPro(); if(!pro) return false;
  const p=patById(patientId); if(!p) return false;
  if((p.assignedProfessionals||[]).indexOf(pro.professionalId)>=0) return true;
  return DB.appointments.some(a=>a.patientId===patientId && a.professionalId===pro.professionalId);
}
function myCaseload(){
  const pro=myPro(); if(!pro) return [];
  return DB.patients.filter(p=>proCanSee(p.patientId));
}

function patWounds(pid){ return DB.wounds.filter(w=>w.patientId===pid); }
function patAssessments(pid){ return DB.assessments.filter(a=>a.patientId===pid).sort((a,b)=>a.createdAt<b.createdAt?-1:1); }
function patTimeline(pid){ return DB.timeline.filter(t=>t.patientId===pid).sort((a,b)=>a.date<b.date?-1:1); }
function patAppointments(pid){ return DB.appointments.filter(a=>a.patientId===pid); }
function patReminders(pid){ return DB.reminders.filter(r=>r.patientId===pid); }
function myNotifs(){ return SESSION ? DB.notifications.filter(n=>n.userId===SESSION.id) : []; }
function unreadCount(){ return myNotifs().filter(n=>!n.read).length; }

/* ============================================================
   TINJAUAN ASESMEN
   Setiap asesmen menunggu dibaca tenaga kesehatan. Setelah dibaca,
   hasilnya hanya dua: aman untuk diteruskan di rumah, atau dirujuk.
   Keputusannya sepenuhnya milik manusia — aplikasi tidak pernah
   menetapkannya sendiri.
   ============================================================ */
const TINJAU={
  menunggu:{label:'Menunggu tinjauan', chip:'chip-warn', ikon:'clock',
    teks:'Dokumentasi Anda sudah terkirim dan sedang menunggu dibaca tenaga kesehatan.'},
  aman:{label:'Aman', chip:'chip-ok', ikon:'check',
    teks:'Tenaga kesehatan sudah membaca dokumentasi ini dan menilainya aman untuk diteruskan di rumah.'},
  dirujuk:{label:'Dirujuk', chip:'chip-danger', ikon:'alert',
    teks:'Tenaga kesehatan menilai luka ini perlu penanganan langsung dan menerbitkan surat rujukan.'}
};
const statusTinjau = a => (a && a.tinjauan) ? a.tinjauan.status : 'menunggu';

/* pasien wajib terhubung dengan satu tenaga kesehatan sebelum mengirim
   dokumentasi, agar setiap asesmen selalu ada yang membacanya */
function janjiAktif(pid){
  return DB.appointments.filter(a=>a.patientId===pid && a.status!=='Dibatalkan');
}
function punyaPendamping(pid){
  const p=patById(pid);
  return janjiAktif(pid).length>0 || ((p&&p.assignedProfessionals)||[]).length>0;
}

/* asesmen milik pasien yang ditangani tenaga kesehatan yang sedang masuk */
function asesmenBinaan(hanyaMenunggu){
  const pro=myPro(); if(!pro) return [];
  return DB.assessments
    .filter(a=>proCanSee(a.patientId))
    .filter(a=>!hanyaMenunggu || !a.tinjauan)
    .sort((a,b)=>a.createdAt<b.createdAt?1:-1);
}

/* menghapus satu asesmen beserta jejaknya; dipakai pasien dari halaman
   Luka Saya. Nomor hari pada riwayat dihitung ulang agar tetap runut. */
function hapusAsesmen(id){
  const a=DB.assessments.find(x=>x.assessmentId===id);
  if(!a) return false;
  const pid=a.patientId;
  DB.assessments=DB.assessments.filter(x=>x.assessmentId!==id);
  DB.timeline=DB.timeline.filter(t=>t.assessmentId!==id);
  /* janji temu yang melampirkan asesmen ini kehilangan lampirannya, bukan datanya */
  DB.appointments.forEach(ap=>{ if(ap.assessmentId===id) ap.assessmentId=null; });
  const sisa=DB.timeline.filter(t=>t.patientId===pid).sort((x,y)=>x.date<y.date?-1:1);
  const w=DB.wounds.find(x=>x.patientId===pid);
  sisa.forEach(t=>{
    t.day = w ? Math.max(1, Math.round((startOfDay(new Date(t.date+'T00:00:00'))-startOfDay(new Date(w.createdAt)))/DAY)+1) : 1;
  });
  /* perbandingan antarsesi dihitung ulang setelah ada yang dihapus */
  const asm=DB.assessments.filter(x=>x.patientId===pid).sort((x,y)=>x.createdAt<y.createdAt?-1:1);
  asm.forEach((x,i)=>{
    const awal=asm[0], lalu=i>0?asm[i-1]:null;
    x.changeFromPrev = lalu ? +(((x.woundArea-lalu.woundArea)/lalu.woundArea)*100).toFixed(1) : 0;
    x.changeFromFirst = awal ? +(((x.woundArea-awal.woundArea)/awal.woundArea)*100).toFixed(1) : 0;
  });
  if(!asm.length) DB.wounds=DB.wounds.filter(x=>x.patientId!==pid);
  return true;
}

/* ============================================================
   RUNTUTAN DOKUMENTASI
   Dihitung per minggu: satu minggu dianggap terpenuhi bila ada
   minimal satu dokumentasi luka pada minggu itu.
   ============================================================ */
function awalMinggu(d){
  const x=startOfDay(d); const h=(x.getDay()+6)%7; /* Senin sebagai hari pertama */
  return new Date(x.getTime()-h*DAY);
}
function hitungRuntutan(pid){
  const asm=DB.assessments.filter(a=>a.patientId===pid);
  if(!asm.length) return {beruntun:0,terpanjang:0,total:0,mingguIni:false,pekan:[]};
  const set={};
  asm.forEach(a=>{ set[isoDate(awalMinggu(new Date(a.date+'T00:00:00')))]=true; });
  const kunci=Object.keys(set).sort();
  /* runtutan terpanjang sepanjang riwayat */
  let terpanjang=0, jalan=0, sebelumnya=null;
  kunci.forEach(k=>{
    if(sebelumnya && (new Date(k)-new Date(sebelumnya))===7*DAY) jalan++; else jalan=1;
    if(jalan>terpanjang) terpanjang=jalan;
    sebelumnya=k;
  });
  /* runtutan berjalan: dihitung mundur dari minggu ini, toleransi satu minggu berjalan */
  const mingguIniKey=isoDate(awalMinggu(new Date()));
  const mingguLaluKey=isoDate(new Date(awalMinggu(new Date()).getTime()-7*DAY));
  let mulai = set[mingguIniKey] ? mingguIniKey : (set[mingguLaluKey] ? mingguLaluKey : null);
  let beruntun=0;
  if(mulai){
    let kursor=new Date(mulai);
    while(set[isoDate(kursor)]){ beruntun++; kursor=new Date(kursor.getTime()-7*DAY); }
  }
  /* delapan minggu terakhir untuk tampilan titik */
  const pekan=[];
  for(let i=7;i>=0;i--){
    const k=isoDate(new Date(awalMinggu(new Date()).getTime()-i*7*DAY));
    pekan.push({kunci:k, ada:!!set[k]});
  }
  return {beruntun, terpanjang:Math.max(terpanjang,beruntun), total:asm.length,
    mingguIni:!!set[mingguIniKey], pekan};
}

function pushNotif(userId,title,message,type,read){
  DB.notifications.unshift({ notificationId:uid('ntf'), userId, title, message, type:type||'info',
    read:!!read, createdAt:new Date().toISOString() });
  if(DB.notifications.length>240) DB.notifications.length=240;
}
function addMin(t,m){ const p=String(t).split(':'); const tot=(+p[0])*60+(+p[1])+m; return pad2(Math.floor(tot/60)%24)+':'+pad2(tot%60); }

window.DW = { $,$$,esc,uid,icon,clamp,pad2,toast,openModal,closeModal,confirmModal,
  DAY,startOfDay,isoDate,addDays,addMin,BULAN,BULAN_S,HARI,HARI_S,
  fmtDate,fmtDateFull,fmtShort,daysFromToday,relDay,relTime,initials,n1,n0,
  hashPassword,randSalt,passwordScore,pushNotif,bunyi,siapkanAudio,siarkan,terapkanSinkron,
  hitungRuntutan,awalMinggu,MODE_KONSUL,METODE_BAYAR,rupiah,
  TINJAU,statusTinjau,janjiAktif,punyaPendamping,asesmenBinaan,hapusAsesmen,
  loadDB,saveDB,loadPrefs,setPref,applyPrefs,purgeLegacySession,
  get DB(){return DB;}, set DB(v){DB=v;}, get PREFS(){return PREFS;},
  KEY,PREFS_KEY,EMPTY,makePatientId,makeProId,PROFESI_LABEL,ACUAN,seedDirektori,
  setSession,clearSession,me,myPatient,myPro,isPro,PRO_ROLES,
  proById,userOfPro,proName,proSpec,patById,userOfPat,patName,proCanSee,myCaseload,
  patWounds,patAssessments,patTimeline,patAppointments,patReminders,myNotifs,unreadCount,
  get storageOK(){return storageOK;}
};
})();
