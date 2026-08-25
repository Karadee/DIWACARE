(function(){
'use strict';
const D=window.DW, {$,$$,esc,icon,toast,openModal,closeModal}=D;

/* ============================================================
   PENGARAH HALAMAN
   ============================================================ */
const ROUTES={};
let CUR={name:'welcome',params:{}};
function route(name,def){ ROUTES[name]=def; }
window.DWroute=route;

function homeFor(u){ return !u ? 'welcome' : (D.isPro(u.role) ? 'pro.dashboard' : 'pat.dashboard'); }

let revealObs=null;
function armReveal(root){
  if(!('IntersectionObserver' in window)){ $$('.reveal',root).forEach(e=>e.classList.add('on')); return; }
  if(revealObs) revealObs.disconnect();
  revealObs=new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('on'); revealObs.unobserve(e.target); } });
  },{rootMargin:'0px 0px -8% 0px',threshold:.06});
  $$('.reveal',root).forEach(e=>revealObs.observe(e));
}
function routebar(){
  const b=$('#routebar'); if(!b) return;
  b.classList.remove('run'); void b.offsetWidth; b.classList.add('run');
}

function go(name,params,opts){
  const u=D.me();
  if(!ROUTES[name]){ name='welcome'; params={}; }
  const def=ROUTES[name];
  if(def.auth && !u){ toast('warn','Silakan masuk dulu','Halaman itu hanya bisa dibuka setelah masuk.'); name='welcome'; params={}; }
  else if(def.roles && u && def.roles.indexOf(u.role)<0){
    toast('err','Akses ditolak','Halaman itu bukan untuk peran akun Anda.');
    name=homeFor(u); params={};
  } else if(def.guest && u){ name=homeFor(u); params={}; }
  CUR={name,params:params||{}};
  routebar();
  render(opts&&opts.silent);
  if(!(opts&&opts.keepScroll)) window.scrollTo({top:0,behavior:'auto'});
}
window.DWgo=go;
const rerender = ()=>render(true);
window.DWrerender=rerender;

function render(silent){
  const app=$('#app'), def=ROUTES[CUR.name]; if(!def) return;
  if(window.__tinggalkanHalaman){ try{ window.__tinggalkanHalaman(); }catch(e){} window.__tinggalkanHalaman=null; }
  app.innerHTML=def.render(CUR.params);
  if(!silent && app.firstElementChild) app.firstElementChild.classList.add('anim-fade');
  if(def.mount) def.mount(CUR.params);
  bindCommon(app);
  armReveal(app);
  if(window.DWsesuaikanBilah) window.DWsesuaikanBilah();
}
function bindCommon(root){
  $$('[data-go]',root).forEach(el=>{
    if(el.__b) return; el.__b=1;
    el.addEventListener('click',e=>{
      e.preventDefault();
      let p={}; try{ p=JSON.parse(el.dataset.params||'{}'); }catch(_){}
      go(el.dataset.go,p);
    });
  });
  $$('.btn',root).forEach(el=>{
    if(el.__r) return; el.__r=1;
    el.addEventListener('pointerdown',e=>{
      if(document.documentElement.getAttribute('data-motion')==='reduced') return;
      const r=el.getBoundingClientRect(), s=Math.max(r.width,r.height);
      const i=document.createElement('span');
      i.className='rip';
      i.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';
      el.appendChild(i); setTimeout(()=>i.remove(),580);
    });
  });
}
window.DWbind=bindCommon;
window.DWreveal=armReveal;

/* ============================================================
   VALIDASI FORMULIR
   ============================================================ */
function clearErrs(root){
  $$('.field.bad,.check.bad',root).forEach(f=>f.classList.remove('bad'));
  $$('.err',root).forEach(e=>e.remove());
}
function markErr(root,name,msg){
  const f=root.querySelector('[data-f="'+name+'"]');
  if(!f) return;
  f.classList.add('bad');
  const e=document.createElement('div'); e.className='err';
  e.innerHTML=icon('alert')+'<span>'+esc(msg)+'</span>';
  f.appendChild(e);
}
function focusFirstErr(root){
  const f=root.querySelector('.field.bad,.check.bad');
  if(f){ const i=f.querySelector('input,select,textarea');
    (i||f).scrollIntoView({block:'center',behavior:'smooth'});
    if(i) try{i.focus({preventScroll:true});}catch(e){} }
}
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE=/^[+()\-\s0-9]{9,20}$/;

function runValidators(root,vals,rules){
  clearErrs(root);
  const errs=[];
  rules.forEach(function(r){
    const name=r[0], label=r[1], fns=r[2];
    for(let i=0;i<fns.length;i++){
      const m=fns[i](vals[name],vals,label);
      if(m){ errs.push([name,m]); break; }
    }
  });
  errs.forEach(function(e){ markErr(root,e[0],e[1]); });
  if(errs.length){
    focusFirstErr(root);
    toast('err','Data belum lengkap', errs.length+' kolom masih perlu diperbaiki.');
  }
  return errs.length===0;
}
const V={
  req: (v,_,l)=> (!v || !String(v).trim() || (Array.isArray(v)&&!v.length)) ? (l||'Kolom ini')+' wajib diisi.' : '',
  email: v=> v && !EMAIL_RE.test(v) ? 'Format email belum benar. Contoh: nama@contoh.com' : '',
  phone: v=> v && !PHONE_RE.test(v) ? 'Nomor telepon hanya boleh angka, spasi, tanda + dan -.' : '',
  minLen: n=> (v,_,l)=> v && v.length<n ? (l||'Kolom ini')+' minimal '+n+' karakter.' : '',
  minWords: n=> (v,_,l)=> v && v.trim().split(/\s+/).length<n ? (l||'Kolom ini')+' harus terdiri dari minimal '+n+' kata.' : '',
  match: (other,label)=> (v,all)=> v!==all[other] ? 'Tidak sama dengan '+label+'.' : '',
  pastDate: v=>{ if(!v) return ''; const d=new Date(v+'T00:00:00');
    if(isNaN(d)) return 'Tanggal tidak valid.';
    if(d>new Date()) return 'Tanggal lahir tidak boleh melewati hari ini.';
    if(d<new Date('1900-01-01')) return 'Masukkan tanggal lahir yang wajar.';
    return ''; },
  adult: v=>{ if(!v) return ''; const d=new Date(v+'T00:00:00');
    const umur=(Date.now()-d.getTime())/(365.25*86400000);
    return umur<17 ? 'Akun hanya untuk pengguna berusia 17 tahun ke atas.' : ''; },
  uniqueEmail: v=> v && D.DB.users.some(u=>u.email.toLowerCase()===String(v).toLowerCase().trim())
    ? 'Email ini sudah terdaftar. Silakan masuk saja.' : '',
  num: (min,max)=> v=>{ if(v===''||v==null) return ''; const n=Number(v);
    if(isNaN(n)) return 'Masukkan angka.';
    if(n<min||n>max) return 'Isi antara '+min+' sampai '+max+'.'; return ''; },
  checked: v=> !v ? 'Anda harus menyetujui pernyataan ini.' : ''
};
window.DWform={clearErrs,markErr,runValidators,V,EMAIL_RE};

function readForm(root){
  const o={};
  $$('input,select,textarea',root).forEach(el=>{
    if(!el.name) return;
    if(el.type==='checkbox'){
      if(el.dataset.multi){ o[el.name]=o[el.name]||[]; if(el.checked) o[el.name].push(el.value); }
      else o[el.name]=el.checked;
    } else if(el.type==='radio'){ if(el.checked) o[el.name]=el.value; }
    else o[el.name]=el.value.trim();
  });
  return o;
}
window.DWread=readForm;

/* ============================================================
   ELEMEN BERSAMA
   ============================================================ */
function themeBtn(){
  const t=D.PREFS.theme;
  const next = t==='dark'?'light':(t==='light'?'system':'dark');
  const lbl = t==='dark'?'gelap':(t==='light'?'terang':'ikut perangkat');
  return `<button class="icon-btn" id="themeBtn" title="Tampilan: ${lbl}" aria-label="Ganti tampilan, sekarang ${lbl}" data-theme-next="${next}">${icon(t==='dark'?'moon':'sun')}</button>`;
}
function bindTheme(){
  const b=$('#themeBtn'); if(!b) return;
  b.addEventListener('click',()=>{ D.setPref('theme',b.dataset.themeNext); rerender(); });
}
window.DWtheme={themeBtn,bindTheme};

function logoBlock(big){
  return `<div class="logo ${big?'logo-lg':''}">
    <span class="logo-mark">${icon('logo')}</span>
    <span class="logo-word">DIWA<em>CARE</em></span>
  </div>`;
}
window.DWlogo=logoBlock;

const DISCLAIMER = `<div class="disclaimer">${icon('shield')}<div><b style="color:var(--ink-2)">Catatan medis.</b>
  DIWACARE adalah alat bantu dokumentasi, pemantauan, dan edukasi luka. Aplikasi ini tidak menggantikan
  pemeriksaan atau diagnosis oleh tenaga kesehatan.</div></div>`;
window.DWdisclaimer=DISCLAIMER;

const GENDERS=['Laki-laki','Perempuan'];
function selOpts(list,cur,placeholder){
  return (placeholder?`<option value="">${esc(placeholder)}</option>`:'')+
    list.map(o=>`<option value="${esc(o)}"${o===cur?' selected':''}>${esc(o)}</option>`).join('');
}
function fld(name,label,inner,hint){
  return `<div class="field" data-f="${name}"><label for="f_${name}">${esc(label)} <span class="req">*</span></label>
    ${inner}${hint?`<span class="hint">${hint}</span>`:''}</div>`;
}
function pills(name,list,type,checkedList){
  return `<div class="opts">`+list.map(o=>`<label class="opt ${type==='checkbox'?'sq':''}">
    <input type="${type}" name="${name}" value="${esc(o)}"${type==='checkbox'?' data-multi="1"':''}${(checkedList||[]).indexOf(o)>=0?' checked':''}>
    <span>${esc(o)}</span></label>`).join('')+`</div>`;
}
window.DWfields={selOpts,fld,pills,GENDERS};

/* ============================================================
   1 — HALAMAN AWAL
   ============================================================ */
route('welcome',{ guest:true, render(){
  const fitur=[
    ['scan','Foto terpandu','Bingkai dan panduan jarak menjaga setiap foto tetap sebanding.','mint'],
    ['trend','Tren terukur','Luas luka dihitung otomatis dan dirangkai jadi grafik mingguan.','sky'],
    ['stetho','Terhubung nakes','Perawat dan dokter melihat perkembangan Anda tanpa perlu tebak-tebakan.','lilac']
  ];
  return `<div class="auth-wrap">
    <div class="blobs" aria-hidden="true"><i class="blob"></i><i class="blob"></i><i class="blob"></i><i class="blob"></i></div>
    <div style="position:absolute;top:16px;right:16px;z-index:2">${themeBtn()}</div>
    <div class="auth-card" style="max-width:580px;text-align:center">
      <div style="display:flex;justify-content:center">${logoBlock(true)}</div>
      <p style="font-family:var(--display);font-weight:600;font-size:1rem;color:var(--ink-2);margin-top:12px">
        Perawatan dan Penilaian Luka Digital</p>
      <div class="tagline" style="margin-top:11px"><span>Nilai</span><span>Pantau</span><span>Rawat</span></div>

      <div class="stagger" style="display:grid;gap:9px;margin:24px 0 22px;text-align:left">
        ${fitur.map((f,i)=>`<div style="--i:${i}" class="row" style="gap:12px;padding:12px 13px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-m)">
            <span class="ib ib-${f[3]}">${icon(f[0])}</span>
            <div style="flex:1;min-width:0">
              <div style="font-family:var(--display);font-weight:700;font-size:.88rem">${f[1]}</div>
              <div class="tiny muted" style="line-height:1.45;margin-top:1px">${f[2]}</div>
            </div>
          </div>`).join('')}
      </div>

      <div style="display:grid;gap:9px">
        <button class="btn btn-primary btn-lg btn-block" data-go="login">Masuk</button>
        <button class="btn btn-ghost btn-lg btn-block" data-go="role">Buat Akun Baru</button>
      </div>

      <p class="tiny muted" style="margin-top:20px;line-height:1.65">
        Foto dan catatan Anda diolah di perangkat ini dan tidak dikirim ke mana pun.<br>
        DIWACARE tidak menggantikan pemeriksaan tenaga kesehatan.</p>
    </div>
  </div>`;
}, mount(){ bindTheme(); }});

/* ============================================================
   2 — PILIH PERAN
   ============================================================ */
route('role',{ guest:true, render(){
  return `<div class="auth-wrap">
    <div class="blobs" aria-hidden="true"><i class="blob"></i><i class="blob"></i><i class="blob"></i><i class="blob"></i></div>
    <div style="position:absolute;top:16px;right:16px;z-index:2">${themeBtn()}</div>
    <div class="auth-card wide">
      <button class="btn btn-quiet btn-sm" data-go="welcome" style="margin-bottom:14px">${icon('left')} Kembali</button>
      <div style="text-align:center;margin-bottom:24px">
        <span class="eyebrow">Buat akun</span>
        <h1 style="font-size:clamp(1.5rem,5vw,1.95rem);margin-top:7px">Anda mendaftar sebagai apa?</h1>
        <p class="muted" style="margin-top:7px;font-size:.9rem">Pilih jenis akun yang sesuai dengan cara Anda memakai DIWACARE.</p>
      </div>
      <div class="role-cards stagger">
        <div class="role-card" style="--i:0;--rc:var(--brand)">
          <span class="role-art" style="background:var(--tint-mint);color:var(--brand)">${icon('user')}</span>
          <h3>Pasien</h3>
          <p>Dokumentasikan luka Anda sendiri, ikuti perkembangannya dari minggu ke minggu, dan atur jadwal kontrol.</p>
          <button class="btn btn-primary btn-block" data-go="reg.patient">Lanjut sebagai Pasien ${icon('right')}</button>
        </div>
        <div class="role-card" style="--i:1;--rc:var(--accent)">
          <span class="role-art" style="background:var(--tint-lilac);color:#6A57C8">${icon('stetho')}</span>
          <h3>Tenaga Kesehatan</h3>
          <p>Pantau pasien yang terhubung dengan Anda, nilai perkembangan luka, dan kelola tindak lanjut.</p>
          <button class="btn btn-primary btn-block" data-go="reg.pro">Lanjut sebagai Nakes ${icon('right')}</button>
        </div>
      </div>
      <p class="tiny muted" style="text-align:center;margin-top:20px">
        Sudah punya akun? <a href="#" data-go="login" style="font-weight:700">Masuk di sini</a></p>
    </div>
  </div>`;
}, mount(){ bindTheme(); }});

/* ============================================================
   3 — PENDAFTARAN PASIEN
   ============================================================ */
route('reg.patient',{ guest:true, render(){
  return `<div class="auth-wrap" style="align-items:flex-start">
    <div class="blobs" aria-hidden="true"><i class="blob"></i><i class="blob"></i><i class="blob"></i><i class="blob"></i></div>
    <div style="position:absolute;top:16px;right:16px;z-index:2">${themeBtn()}</div>
    <div class="auth-card wide" style="margin-top:6px">
      <button class="btn btn-quiet btn-sm" data-go="role" style="margin-bottom:12px">${icon('left')} Kembali</button>
      <div class="row spread wrap" style="margin-bottom:5px;gap:10px">
        <div><span class="eyebrow">Pendaftaran</span><h1 style="font-size:1.5rem;margin-top:5px">Akun Pasien</h1></div>
        <span class="chip chip-brand">${icon('user')} Pasien</span>
      </div>
      <p class="muted tiny" style="margin-bottom:20px">Seluruh kolom wajib diisi agar akun dapat dibuat.</p>

      <form id="regPat" novalidate autocomplete="off">
        <fieldset class="fs" style="margin-bottom:22px">
          <legend class="fs-legend"><b>1</b> Data diri</legend>
          <div class="form-grid two">
            ${fld('name','Nama lengkap','<input class="inp" id="f_name" name="name" autocomplete="off" placeholder="Nama sesuai kartu identitas">','Minimal dua kata.')}
            ${fld('dateOfBirth','Tanggal lahir','<input class="inp" id="f_dateOfBirth" name="dateOfBirth" type="date" max="'+D.isoDate(new Date())+'">')}
            ${fld('gender','Jenis kelamin','<select class="sel" id="f_gender" name="gender">'+selOpts(GENDERS,'','Pilih…')+'</select>')}
            ${fld('phone','Nomor telepon','<input class="inp" id="f_phone" name="phone" type="tel" autocomplete="off" placeholder="08xx xxxx xxxx">')}
            ${fld('address','Kota / kabupaten','<input class="inp" id="f_address" name="address" autocomplete="off" placeholder="Contoh: Bandung">')}
            <div></div>
          </div>
        </fieldset>

        <fieldset class="fs" style="margin-bottom:22px">
          <legend class="fs-legend"><b>2</b> Akun masuk</legend>
          <div class="form-grid two">
            ${fld('email','Email','<input class="inp" id="f_email" name="email" type="email" autocomplete="off" placeholder="nama@contoh.com">','Dipakai untuk masuk ke aplikasi.')}
            <div></div>
            ${fld('password','Kata sandi','<input class="inp" id="f_password" name="password" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter"><div class="pw-meter" id="pwm"><i></i><i></i><i></i><i></i></div>','Gabungkan huruf besar, huruf kecil, dan angka.')}
            ${fld('password2','Ulangi kata sandi','<input class="inp" id="f_password2" name="password2" type="password" autocomplete="new-password" placeholder="Ketik ulang kata sandi">')}
          </div>
        </fieldset>

        <fieldset class="fs" style="margin-bottom:22px">
          <legend class="fs-legend"><b>3</b> Kondisi diabetes</legend>
          <div class="grid" style="gap:15px">
            <div class="field" data-f="diabetesType"><label>Jenis diabetes <span class="req">*</span></label>
              ${pills('diabetesType',['Tipe 1','Tipe 2','Diabetes gestasional','Belum tahu pasti'],'radio')}</div>
            <div class="field" data-f="diabetesDuration"><label>Sudah berapa lama? <span class="req">*</span></label>
              ${pills('diabetesDuration',['Kurang dari 1 tahun','1–5 tahun','5–10 tahun','Lebih dari 10 tahun'],'radio')}</div>
          </div>
        </fieldset>

        <fieldset class="fs" style="margin-bottom:22px">
          <legend class="fs-legend"><b>4</b> Kontak darurat</legend>
          <div class="form-grid two">
            ${fld('ecName','Nama','<input class="inp" id="f_ecName" name="ecName" autocomplete="off" placeholder="Nama keluarga atau kerabat">')}
            ${fld('ecRel','Hubungan','<input class="inp" id="f_ecRel" name="ecRel" autocomplete="off" placeholder="Contoh: anak, istri, saudara">')}
            ${fld('ecPhone','Nomor telepon','<input class="inp" id="f_ecPhone" name="ecPhone" type="tel" autocomplete="off" placeholder="08xx xxxx xxxx">')}
            <div></div>
          </div>
        </fieldset>

        <fieldset class="fs" style="margin-bottom:20px">
          <legend class="fs-legend"><b>5</b> Persetujuan</legend>
          <label class="check" data-f="consent">
            <input type="checkbox" name="consent" id="f_consent">
            <p>Saya memahami bahwa DIWACARE adalah alat bantu pemantauan dan penilaian luka, dan tidak menggantikan
              diagnosis maupun pemeriksaan oleh tenaga kesehatan.</p>
          </label>
        </fieldset>

        <button class="btn btn-primary btn-lg btn-block" type="submit" id="regPatBtn">Daftarkan Akun Pasien</button>
        <p class="tiny muted" style="text-align:center;margin-top:13px">
          Sudah punya akun? <a href="#" data-go="login" style="font-weight:700">Masuk di sini</a></p>
      </form>
    </div>
  </div>`;
}, mount(){
  bindTheme();
  bindPwMeter('#f_password','#pwm');
  $('#regPat').addEventListener('submit',async e=>{
    e.preventDefault();
    const root=e.target, v=readForm(root);
    const ok=runValidators(root,v,[
      ['name','Nama lengkap',[V.req,V.minWords(2)]],
      ['dateOfBirth','Tanggal lahir',[V.req,V.pastDate,V.adult]],
      ['gender','Jenis kelamin',[V.req]],
      ['phone','Nomor telepon',[V.req,V.phone]],
      ['address','Kota atau kabupaten',[V.req,V.minLen(3)]],
      ['email','Email',[V.req,V.email,V.uniqueEmail]],
      ['password','Kata sandi',[V.req,V.minLen(8)]],
      ['password2','Ulangi kata sandi',[V.req,V.match('password','kata sandi')]],
      ['diabetesType','Jenis diabetes',[V.req]],
      ['diabetesDuration','Lama diabetes',[V.req]],
      ['ecName','Nama kontak darurat',[V.req,V.minWords(1)]],
      ['ecRel','Hubungan',[V.req]],
      ['ecPhone','Nomor kontak darurat',[V.req,V.phone]],
      ['consent','Persetujuan',[V.checked]]
    ]);
    if(!ok) return;
    const btn=$('#regPatBtn'); btn.disabled=true; btn.innerHTML='<span class="spin"></span> Membuat akun…';
    const salt=D.randSalt(), pwHash=await D.hashPassword(v.password,salt);
    const now=new Date().toISOString();
    const u={ id:D.uid('usr'), role:'pasien', name:v.name, email:v.email.toLowerCase(), phone:v.phone,
      dateOfBirth:v.dateOfBirth, gender:v.gender, address:v.address, createdAt:now, salt, pwHash };
    D.DB.users.push(u);
    const p={ patientId:D.makePatientId(), userId:u.id, diabetesType:v.diabetesType, diabetesDuration:v.diabetesDuration,
      emergencyContact:{name:v.ecName,relationship:v.ecRel,phone:v.ecPhone},
      medicalProfile:{riskLevel:null,riskScore:null,riskFactors:[]},
      assignedProfessionals:[], consent:true, createdAt:now, updatedAt:now };
    D.DB.patients.push(p);
    D.pushNotif(u.id,'Selamat datang di DIWACARE','Mulai dengan mendokumentasikan luka Anda yang pertama.','sistem',false);
    if(!D.saveDB()){ btn.disabled=false; btn.textContent='Daftarkan Akun Pasien'; return; }
    D.setSession(u);
    toast('ok','Akun berhasil dibuat','Nomor pasien Anda: '+p.patientId);
    go('pat.dashboard');
  });
}});

function bindPwMeter(inpSel,meterSel){
  const inp=$(inpSel), m=$(meterSel); if(!inp||!m) return;
  const bars=$$('i',m);
  const warna=['var(--danger)','var(--warn)','var(--info)','var(--ok)'];
  inp.addEventListener('input',()=>{
    const s=D.passwordScore(inp.value);
    bars.forEach((b,i)=>{ b.style.background = i<s ? warna[Math.min(s,4)-1] : 'var(--line)'; });
  });
}

/* ============================================================
   4 — PENDAFTARAN TENAGA KESEHATAN
   ============================================================ */
const PROFESI=[['dokter','Dokter'],['perawat','Perawat'],['nakes','Tenaga kesehatan lain']];

route('reg.pro',{ guest:true, render(){
  return `<div class="auth-wrap" style="align-items:flex-start">
    <div class="blobs" aria-hidden="true"><i class="blob"></i><i class="blob"></i><i class="blob"></i><i class="blob"></i></div>
    <div style="position:absolute;top:16px;right:16px;z-index:2">${themeBtn()}</div>
    <div class="auth-card wide" style="margin-top:6px">
      <button class="btn btn-quiet btn-sm" data-go="role" style="margin-bottom:12px">${icon('left')} Kembali</button>
      <div class="row spread wrap" style="margin-bottom:5px;gap:10px">
        <div><span class="eyebrow">Pendaftaran</span><h1 style="font-size:1.5rem;margin-top:5px">Akun Tenaga Kesehatan</h1></div>
        <span class="chip" style="background:var(--tint-lilac);color:#6A57C8">${icon('stetho')} Nakes</span>
      </div>
      <p class="muted tiny" style="margin-bottom:20px">Seluruh kolom wajib diisi agar akun dapat dibuat.</p>

      <form id="regPro" novalidate autocomplete="off">
        <fieldset class="fs" style="margin-bottom:22px">
          <legend class="fs-legend"><b>1</b> Data diri</legend>
          <div class="form-grid two">
            ${fld('name','Nama lengkap','<input class="inp" id="f_name" name="name" autocomplete="off" placeholder="Sertakan gelar jika ada">','Minimal dua kata.')}
            ${fld('dateOfBirth','Tanggal lahir','<input class="inp" id="f_dateOfBirth" name="dateOfBirth" type="date" max="'+D.isoDate(new Date())+'">')}
            ${fld('gender','Jenis kelamin','<select class="sel" id="f_gender" name="gender">'+selOpts(GENDERS,'','Pilih…')+'</select>')}
            ${fld('phone','Nomor telepon','<input class="inp" id="f_phone" name="phone" type="tel" autocomplete="off" placeholder="08xx xxxx xxxx">')}
          </div>
        </fieldset>

        <fieldset class="fs" style="margin-bottom:22px">
          <legend class="fs-legend"><b>2</b> Akun masuk</legend>
          <div class="form-grid two">
            ${fld('email','Email','<input class="inp" id="f_email" name="email" type="email" autocomplete="off" placeholder="nama@instansi.id">','Dipakai untuk masuk ke aplikasi.')}
            <div></div>
            ${fld('password','Kata sandi','<input class="inp" id="f_password" name="password" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter"><div class="pw-meter" id="pwm"><i></i><i></i><i></i><i></i></div>','Gabungkan huruf besar, huruf kecil, dan angka.')}
            ${fld('password2','Ulangi kata sandi','<input class="inp" id="f_password2" name="password2" type="password" autocomplete="new-password" placeholder="Ketik ulang kata sandi">')}
          </div>
        </fieldset>

        <fieldset class="fs" style="margin-bottom:22px">
          <legend class="fs-legend"><b>3</b> Data profesi</legend>
          <div class="form-grid two">
            ${fld('profession','Profesi','<select class="sel" id="f_profession" name="profession"><option value="">Pilih…</option>'+
              PROFESI.map(p=>`<option value="${p[0]}">${p[1]}</option>`).join('')+'</select>')}
            ${fld('reg','Nomor STR / SIP','<input class="inp" id="f_reg" name="reg" autocomplete="off" placeholder="Contoh: 3311100118004471">','Nomor registrasi profesi Anda.')}
            ${fld('inst','Instansi tempat bertugas','<input class="inp" id="f_inst" name="inst" autocomplete="off" placeholder="Rumah sakit, klinik, atau puskesmas">')}
            ${fld('dept','Unit / bagian','<input class="inp" id="f_dept" name="dept" autocomplete="off" placeholder="Contoh: Penyakit Dalam">')}
            ${fld('specialty','Bidang keahlian','<input class="inp" id="f_specialty" name="specialty" autocomplete="off" placeholder="Contoh: Endokrinologi, Perawatan Luka">','Ditampilkan kepada pasien saat memilih jadwal.')}
            ${fld('exp','Lama pengalaman (tahun)','<input class="inp" id="f_exp" name="exp" type="number" min="0" max="60" autocomplete="off" placeholder="Contoh: 9">')}
            ${fld('loc','Kota / kabupaten praktik','<input class="inp" id="f_loc" name="loc" autocomplete="off" placeholder="Contoh: Bandung">')}
            <div class="field" data-f="professionalId"><label>Nomor tenaga kesehatan</label>
              <input class="inp mono" id="proIdPrev" value="Terbit otomatis" readonly aria-readonly="true" tabindex="-1">
              <span class="hint">Dibuat otomatis setelah profesi dipilih.</span></div>
          </div>
        </fieldset>

        <fieldset class="fs" style="margin-bottom:20px">
          <legend class="fs-legend"><b>4</b> Pernyataan</legend>
          <label class="check" data-f="consent">
            <input type="checkbox" name="consent" id="f_consent">
            <p>Saya menyatakan data profesi di atas benar, dan saya memahami bahwa DIWACARE adalah alat bantu
              dokumentasi serta pemantauan luka, bukan alat diagnosis.</p>
          </label>
          <div class="row" style="gap:10px;margin-top:12px;padding:12px 13px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-m)">
            <span class="ib ib-butter">${icon('shield')}</span>
            <div style="flex:1"><div style="font-family:var(--display);font-weight:700;font-size:.87rem">Status verifikasi: Menunggu</div>
              <div class="tiny muted" style="line-height:1.45;margin-top:1px">Akun tetap dapat dipakai. Verifikasi nomor STR dilakukan terpisah oleh pengelola instansi.</div></div>
          </div>
        </fieldset>

        <button class="btn btn-primary btn-lg btn-block" type="submit" id="regProBtn">Daftarkan Akun Tenaga Kesehatan</button>
        <p class="tiny muted" style="text-align:center;margin-top:13px">
          Sudah punya akun? <a href="#" data-go="login" style="font-weight:700">Masuk di sini</a></p>
      </form>
    </div>
  </div>`;
}, mount(){
  bindTheme();
  bindPwMeter('#f_password','#pwm');
  const profSel=$('#f_profession'), prev=$('#proIdPrev');
  profSel.addEventListener('change',()=>{
    if(!profSel.value){ prev.value='Terbit otomatis'; return; }
    const map={dokter:['DOK','dokter'],perawat:['PRW','perawat'],nakes:['NKS','nakes']};
    const m=map[profSel.value];
    prev.value=m[0]+'-'+new Date().getFullYear()+'-'+String((D.DB.meta.urutan[m[1]]||0)+1).padStart(4,'0');
  });
  $('#regPro').addEventListener('submit',async e=>{
    e.preventDefault();
    const root=e.target, v=readForm(root);
    const ok=runValidators(root,v,[
      ['name','Nama lengkap',[V.req,V.minWords(2)]],
      ['dateOfBirth','Tanggal lahir',[V.req,V.pastDate,V.adult]],
      ['gender','Jenis kelamin',[V.req]],
      ['phone','Nomor telepon',[V.req,V.phone]],
      ['email','Email',[V.req,V.email,V.uniqueEmail]],
      ['password','Kata sandi',[V.req,V.minLen(8)]],
      ['password2','Ulangi kata sandi',[V.req,V.match('password','kata sandi')]],
      ['profession','Profesi',[V.req]],
      ['reg','Nomor STR atau SIP',[V.req,V.minLen(6)]],
      ['inst','Instansi',[V.req,V.minLen(3)]],
      ['dept','Unit atau bagian',[V.req,V.minLen(3)]],
      ['specialty','Bidang keahlian',[V.req,V.minLen(3)]],
      ['exp','Lama pengalaman',[V.req,V.num(0,60)]],
      ['loc','Kota praktik',[V.req,V.minLen(3)]],
      ['consent','Pernyataan',[V.checked]]
    ]);
    if(!ok) return;
    const btn=$('#regProBtn'); btn.disabled=true; btn.innerHTML='<span class="spin"></span> Membuat akun…';
    const salt=D.randSalt(), pwHash=await D.hashPassword(v.password,salt);
    const now=new Date().toISOString();
    const u={ id:D.uid('usr'), role:v.profession, name:v.name, email:v.email.toLowerCase(), phone:v.phone,
      dateOfBirth:v.dateOfBirth, gender:v.gender, createdAt:now, salt, pwHash };
    D.DB.users.push(u);
    const pro={ professionalId:D.makeProId(v.profession), userId:u.id, profession:v.profession,
      professionalRegistrationNumber:v.reg, institution:v.inst, department:v.dept, specialty:v.specialty,
      experience:Number(v.exp), workLocation:v.loc, verificationStatus:'Menunggu', createdAt:now };
    D.DB.professionals.push(pro);
    D.pushNotif(u.id,'Selamat datang di DIWACARE','Pasien akan muncul di sini setelah membuat janji temu dengan Anda.','sistem',false);
    if(!D.saveDB()){ btn.disabled=false; btn.textContent='Daftarkan Akun Tenaga Kesehatan'; return; }
    D.setSession(u);
    toast('ok','Akun berhasil dibuat','Nomor Anda: '+pro.professionalId);
    go('pro.dashboard');
  });
}});

/* ============================================================
   5 — MASUK
   ============================================================ */
route('login',{ guest:true, render(){
  const jml=D.DB.users.length;
  const sorot=[
    ['scan','Analisis di perangkat','Foto luka diproses di peramban Anda sendiri. Tidak ada yang diunggah ke mana pun.'],
    ['ruler','Ukuran yang bisa dipercaya','Kalibrasi dengan uang logam membuat angka sentimeternya berarti, bukan tebakan.'],
    ['stetho','Terhubung dengan tenaga kesehatan','Kirim keluhan beserta dokumentasinya, terima penjelasan klinis dan resep.']
  ];
  return `<div class="auth-wrap masuk-wrap">
    <div class="blobs" aria-hidden="true"><i class="blob"></i><i class="blob"></i><i class="blob"></i><i class="blob"></i></div>
    <div style="position:absolute;top:16px;right:16px;z-index:3">${themeBtn()}</div>

    <div class="masuk-panel">
      <aside class="masuk-kiri">
        <div class="masuk-kiri-isi">
          ${logoBlock()}
          <h2 class="masuk-tag">Luka yang dipantau<br>dengan cara yang sama<br><span>setiap minggu.</span></h2>
          <p class="masuk-sub">Satu foto per minggu sudah cukup. Sisanya dikerjakan aplikasi:
            luas, tren, dan catatan yang bisa langsung ditunjukkan saat kontrol.</p>
          <ul class="masuk-poin">
            ${sorot.map((x,i)=>`<li style="--i:${i}">
              <span class="ib">${icon(x[0])}</span>
              <span><b>${esc(x[1])}</b><i>${esc(x[2])}</i></span></li>`).join('')}
          </ul>
          <div class="masuk-kaki">
            <span class="chip">${icon('shield')} Data hanya di perangkat ini</span>
            ${jml?`<span class="chip">${icon('users')} ${jml} akun tersimpan</span>`:''}
          </div>
        </div>
        <div class="masuk-garis" aria-hidden="true"></div>
      </aside>

      <div class="masuk-kanan">
        <button class="btn btn-quiet btn-sm" data-go="welcome" style="align-self:flex-start;margin-bottom:16px">${icon('left')} Kembali</button>
        <div class="masuk-logo-hp">${logoBlock()}</div>
        <span class="eyebrow">Selamat datang kembali</span>
        <h1 style="font-size:1.5rem;margin-top:8px">Masuk ke akun Anda</h1>
        <p class="muted" style="font-size:.86rem;margin-top:7px;margin-bottom:20px;line-height:1.6">
          Email dan kata sandi selalu diminta ulang setiap kali aplikasi dibuka — tidak ada sesi yang disimpan diam-diam.</p>

        <form id="loginF" novalidate autocomplete="off">
          <div class="grid" style="gap:14px">
            <div class="field" data-f="email"><label for="f_email">Email <span class="req">*</span></label>
              <div class="inp-ikon">${icon('mail')}
                <input class="inp" id="f_email" name="email" type="email" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="nama@contoh.com"></div></div>
            <div class="field" data-f="password"><label for="f_password">Kata sandi <span class="req">*</span></label>
              <div class="inp-ikon">${icon('lock')}
                <input class="inp" id="f_password" name="password" type="password" autocomplete="off" placeholder="Kata sandi Anda" style="padding-right:42px">
                <button type="button" class="icon-btn" id="peek" aria-label="Tampilkan kata sandi"
                  style="position:absolute;right:4px;top:4px;width:30px;height:30px;border:none;background:transparent">${icon('eye')}</button>
              </div></div>
            <button class="btn btn-primary btn-lg btn-block" type="submit" id="loginBtn">${icon('right')} Masuk</button>
            <button type="button" class="btn btn-quiet btn-sm" id="forgot" style="justify-self:center">Lupa kata sandi?</button>
          </div>
        </form>

        <div class="divider" style="margin:22px 0 16px">BELUM PUNYA AKUN</div>
        <div class="masuk-pilih">
          <button class="masuk-peran" data-go="reg.patient">
            <span class="ib ib-mint">${icon('user')}</span>
            <span><b>Daftar sebagai pasien</b><i>Pantau luka Anda sendiri</i></span>${icon('right')}</button>
          <button class="masuk-peran" data-go="reg.pro">
            <span class="ib ib-sky">${icon('stetho')}</span>
            <span><b>Daftar sebagai tenaga kesehatan</b><i>Dampingi pasien Anda</i></span>${icon('right')}</button>
        </div>
      </div>
    </div>
  </div>`;
}, mount(){
  bindTheme();
  const peek=$('#peek'), pw=$('#f_password');
  peek.addEventListener('click',()=>{
    pw.type = pw.type==='password'?'text':'password';
    peek.setAttribute('aria-label', pw.type==='password'?'Tampilkan kata sandi':'Sembunyikan kata sandi');
  });
  $('#forgot').addEventListener('click',()=>{
    const bd=openModal(`<p style="color:var(--ink-2);line-height:1.65">Pemulihan kata sandi lewat email belum tersedia
        pada versi ini, karena seluruh data akun tersimpan di perangkat Anda sendiri dan tidak ada server yang menyimpannya.</p>
      <p style="color:var(--ink-2);line-height:1.65;margin-top:11px">Jika kata sandi terlupa, buat akun baru dengan alamat email lain.</p>
      <div class="row" style="justify-content:flex-end;margin-top:19px"><button class="btn btn-primary" data-close>Mengerti</button></div>`,
      {title:'Lupa kata sandi'});
    $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  });
  $('#loginF').addEventListener('submit',e=>{
    e.preventDefault();
    const root=e.target, v=readForm(root);
    if(!runValidators(root,v,[['email','Email',[V.req,V.email]],['password','Kata sandi',[V.req]]])) return;
    doLogin(v.email,v.password,$('#loginBtn'));
  });
}});

async function doLogin(email,password,btn){
  const label = btn ? btn.textContent : 'Masuk';
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="spin"></span> Memeriksa…'; }
  const u=D.DB.users.find(x=>x.email.toLowerCase()===String(email).toLowerCase().trim());
  const gagal = (field,msg) =>{
    if(btn){ btn.disabled=false; btn.textContent=label; }
    const root=$('#loginF');
    if(root){ window.DWform.clearErrs(root); window.DWform.markErr(root,field,msg); }
    toast('err','Gagal masuk',msg);
  };
  if(!u) return gagal('email','Email ini belum terdaftar. Periksa ejaannya atau buat akun baru.');
  const h=await D.hashPassword(password,u.salt);
  if(h!==u.pwHash) return gagal('password','Kata sandi salah. Coba ketik ulang dengan teliti.');
  D.setSession(u);
  toast('ok','Selamat datang kembali','Halo, '+u.name.split(' ')[0]+'.');
  go(homeFor(u));
  setTimeout(()=>{ if(window.DWcekPengingat) window.DWcekPengingat(); },1500);
}

function logout(){
  const n=D.me()?D.me().name.split(' ')[0]:'';
  D.clearSession();
  toast('info','Anda telah keluar', n?('Sampai jumpa, '+n+'. Data Anda tetap tersimpan.'):'Data Anda tetap tersimpan.');
  go('welcome');
}
window.DWlogout=logout;
window.DWhomeFor=homeFor;
})();
