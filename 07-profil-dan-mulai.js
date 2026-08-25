(function(){
'use strict';
const D=window.DW, {$,$$,esc,icon,toast,openModal,closeModal}=D;
const go=window.DWgo, route=window.DWroute, rerender=window.DWrerender;
const {shell,shellMount}=window.DWshell;
const {woundStats}=window.DWstats;

/* ============================================================
   PENGATURAN TAMPILAN
   ============================================================ */
function kartuPengaturan(){
  const P=D.PREFS;
  const sw=(k,v,judul,ket)=>`<div class="switch">
      <div style="flex:1"><div style="font-family:var(--display);font-weight:700;font-size:.88rem">${judul}</div>
        <div class="tiny muted" style="line-height:1.45">${ket}</div></div>
      <button class="sw" role="switch" aria-checked="${P[k]===v}" data-pref="${k}" data-on="${v}" aria-label="${judul}"></button>
    </div>`;
  return `<div class="card">
    <div class="card-head"><div class="card-title">${icon('cog')} Tampilan &amp; kemudahan akses</div></div>
    <div class="switch">
      <div style="flex:1"><div style="font-family:var(--display);font-weight:700;font-size:.88rem">Mode tampilan</div>
        <div class="tiny muted">Ikut perangkat, atau pilih sendiri.</div></div>
      <div class="segs">${[['system','Otomatis'],['light','Terang'],['dark','Gelap']]
        .map(t=>`<button class="seg ${P.theme===t[0]?'on':''}" data-theme="${t[0]}">${t[1]}</button>`).join('')}</div>
    </div>
    ${sw('motion','reduced','Kurangi animasi','Matikan gerakan dan transisi di seluruh aplikasi.')}
    ${sw('contrast','high','Kontras tinggi','Pertegas garis tepi dan warna teks.')}
    ${sw('text','large','Perbesar teks','Naikkan ukuran huruf dasar agar lebih mudah dibaca.')}
    <div class="switch">
      <div style="flex:1"><div style="font-family:var(--display);font-weight:700;font-size:.88rem">Suara pemberitahuan</div>
        <div class="tiny muted" style="line-height:1.45">Nada pendek saat asesmen sudah waktunya, saat jadwal terpasang, dan saat ada pesan baru.</div></div>
      <button class="sw" role="switch" aria-checked="${P.suara!==false}" data-bool="suara" aria-label="Suara pemberitahuan"></button>
    </div>
    <div class="row" style="justify-content:flex-end;padding-top:4px">
      <button class="btn btn-quiet btn-sm" id="cobaSuara">${icon('volume')} Coba nadanya</button></div>
  </div>`;
}
function bindPengaturan(){
  $$('[data-theme]').forEach(b=>b.addEventListener('click',()=>{ D.setPref('theme',b.dataset.theme); rerender(); }));
  $$('[data-bool]').forEach(b=>b.addEventListener('click',()=>{
    const nyala=b.getAttribute('aria-checked')==='true';
    D.setPref(b.dataset.bool, !nyala);
    if(!nyala){ D.siapkanAudio(); setTimeout(()=>D.bunyi('notif'),90); }
    rerender();
  }));
  const cs=$('#cobaSuara');
  if(cs) cs.addEventListener('click',()=>{
    D.siapkanAudio();
    if(D.PREFS.suara===false){ toast('info','Suara sedang dimatikan','Nyalakan sakelar di atas untuk mendengar nadanya.'); return; }
    D.bunyi('ingat');
  });
  $$('[data-pref]').forEach(b=>b.addEventListener('click',()=>{
    const nyala=b.getAttribute('aria-checked')==='true';
    D.setPref(b.dataset.pref, nyala ? (b.dataset.pref==='motion'?'system':'normal') : b.dataset.on);
    rerender();
  }));
}

function kartuData(){
  let bytes=0; try{ bytes=(localStorage.getItem(D.KEY)||'').length; }catch(e){}
  const kb=(bytes/1024).toFixed(0);
  return `<details class="plain">
    <summary>${icon('cog')} Data &amp; privasi</summary>
    <div style="padding:15px 18px 18px">
      <ul style="margin:0 0 14px;padding-left:18px;color:var(--ink-2);font-size:.83rem;line-height:1.75">
        <li>Semua catatan Anda tersimpan di peramban perangkat ini saja.</li>
        <li>Foto luka dianalisis di perangkat dan tidak pernah diunggah.</li>
        <li>Kata sandi disimpan sebagai hash SHA-256 bersalt, bukan teks polos.</li>
        <li>Aplikasi ini tidak melakukan permintaan jaringan apa pun.</li>
        <li>Ruang terpakai saat ini: <b class="tnum">${kb} KB</b>.</li>
      </ul>
      <button class="btn btn-danger btn-sm btn-block" id="hapusAkun">${icon('x')} Hapus akun dan seluruh data saya</button>
      <p class="tiny muted" style="margin-top:9px;line-height:1.55">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
    </div>
  </details>`;
}
function bindData(){
  const b=$('#hapusAkun'); if(!b) return;
  b.addEventListener('click',async()=>{
    const u=D.me();
    if(!await D.confirmModal('Hapus akun ini?',
      'Seluruh dokumentasi, janji temu, dan catatan yang terkait dengan akun ini akan dihapus permanen dari perangkat ini. Tindakan ini tidak dapat dibatalkan.',
      'Ya, hapus permanen','danger')) return;
    const db=D.DB;
    if(D.isPro(u.role)){
      const pro=D.myPro();
      if(pro){
        db.notes=db.notes.filter(n=>n.professionalId!==pro.professionalId);
        db.appointments=db.appointments.filter(a=>a.professionalId!==pro.professionalId);
        db.patients.forEach(p=>{
          p.assignedProfessionals=(p.assignedProfessionals||[]).filter(x=>x!==pro.professionalId);
        });
        db.professionals=db.professionals.filter(x=>x.professionalId!==pro.professionalId);
      }
    } else {
      const p=D.myPatient();
      if(p){
        const pid=p.patientId;
        db.assessments=db.assessments.filter(x=>x.patientId!==pid);
        db.timeline=db.timeline.filter(x=>x.patientId!==pid);
        db.wounds=db.wounds.filter(x=>x.patientId!==pid);
        db.appointments=db.appointments.filter(x=>x.patientId!==pid);
        db.reminders=db.reminders.filter(x=>x.patientId!==pid);
        db.notes=db.notes.filter(x=>x.patientId!==pid);
        db.patients=db.patients.filter(x=>x.patientId!==pid);
      }
    }
    db.notifications=db.notifications.filter(n=>n.userId!==u.id);
    db.users=db.users.filter(x=>x.id!==u.id);
    D.saveDB();
    D.clearSession();
    toast('info','Akun telah dihapus','Seluruh data yang terkait sudah dibersihkan dari perangkat ini.');
    go('welcome');
  });
}

/* ============================================================
   PROFIL PASIEN
   ============================================================ */
route('pat.profile',{auth:true,roles:['pasien'],render(){
  const u=D.me(), p=D.myPatient(), st=woundStats(p.patientId);
  const umur=u.dateOfBirth?Math.floor((Date.now()-new Date(u.dateOfBirth))/(365.25*86400000)):null;
  const body=`
    ${window.DWpageHead('Profil','Data akun, pengaturan, dan privasi','')}
    <div class="dash-grid">
      <div class="col">
        <div class="card card-rule anim-rise" style="--rule:var(--brand)">
          <div class="row" style="gap:14px;margin-bottom:17px">
            <span class="avatar" style="width:54px;height:54px;border-radius:17px;font-size:1.05rem">${esc(D.initials(u.name))}</span>
            <div><h2 style="font-size:1.2rem">${esc(u.name)}</h2>
              <div class="row wrap" style="gap:6px;margin-top:6px">
                <span class="chip chip-brand mono">${esc(p.patientId)}</span>
                <span class="chip chip-muted">Pasien</span>
                ${umur?`<span class="chip chip-muted">${umur} tahun</span>`:''}</div></div>
          </div>
          <div class="eyebrow" style="margin-bottom:9px">Data diri</div>
          <dl class="kv">
            <dt>Email</dt><dd style="font-weight:500;font-family:var(--body)">${esc(u.email)}</dd>
            <dt>Telepon</dt><dd class="mono" style="font-size:.82rem">${esc(u.phone||'—')}</dd>
            <dt>Tanggal lahir</dt><dd>${u.dateOfBirth?D.fmtDate(u.dateOfBirth):'—'}</dd>
            <dt>Jenis kelamin</dt><dd>${esc(u.gender||'—')}</dd>
            <dt>Domisili</dt><dd>${esc(u.address||'—')}</dd>
            <dt>Bergabung</dt><dd>${D.fmtDate(D.isoDate(new Date(u.createdAt)))}</dd>
          </dl>
          <div class="eyebrow" style="margin:20px 0 9px">Kondisi diabetes</div>
          <dl class="kv">
            <dt>Jenis</dt><dd>${esc(p.diabetesType)}</dd>
            <dt>Lama</dt><dd>${esc(p.diabetesDuration)}</dd>
            <dt>Indikator risiko</dt><dd>${p.medicalProfile&&p.medicalProfile.riskLevel?esc(p.medicalProfile.riskLevel):'Belum diisi'}</dd>
          </dl>
          <div class="eyebrow" style="margin:20px 0 9px">Kontak darurat</div>
          <dl class="kv">
            <dt>Nama</dt><dd>${esc(p.emergencyContact.name)}</dd>
            <dt>Hubungan</dt><dd>${esc(p.emergencyContact.relationship)}</dd>
            <dt>Telepon</dt><dd class="mono" style="font-size:.82rem">${esc(p.emergencyContact.phone)}</dd>
          </dl>
          <div class="row wrap" style="gap:8px;margin-top:20px">
            <button class="btn btn-ghost btn-sm" id="editProfile">${icon('note')} Ubah data</button>
            <button class="btn btn-danger btn-sm" id="logoutBtn" style="margin-left:auto">${icon('out')} Keluar</button>
          </div>
        </div>
        ${kartuData()}
      </div>
      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('chart')} Ringkasan catatan Anda</div></div>
          <div class="stat-row" style="grid-template-columns:1fr 1fr">
            <div class="stat" style="box-shadow:none"><div class="sl">Asesmen</div><div class="sv tnum">${st?st.count:0}</div></div>
            <div class="stat" style="box-shadow:none"><div class="sl">Janji temu</div><div class="sv tnum">${D.patAppointments(p.patientId).length}</div></div>
          </div>
          <p class="tiny muted" style="margin-top:13px;line-height:1.6">
            Semua yang Anda simpan tetap ada di perangkat ini, termasuk setelah keluar dari akun.
            Masuk kembali dengan email dan kata sandi yang sama untuk melanjutkan.</p>
        </div>
        ${kartuPengaturan()}
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pat.profile','Profil','Akun, pengaturan, dan privasi',body);
},mount(){
  shellMount(); bindPengaturan(); bindData();
  $('#logoutBtn').addEventListener('click',window.DWlogout);
  $('#editProfile').addEventListener('click',ubahProfilModal);
}});

/* ============================================================
   PROFIL TENAGA KESEHATAN
   ============================================================ */
route('pro.profile',{auth:true,roles:D.PRO_ROLES,render(){
  const u=D.me(), pro=D.myPro();
  const body=`
    ${window.DWpageHead('Profil','Akun profesi dan pengaturan','')}
    <div class="dash-grid">
      <div class="col">
        <div class="card card-rule anim-rise" style="--rule:var(--brand)">
          <div class="row" style="gap:14px;margin-bottom:17px">
            <span class="avatar" style="width:54px;height:54px;border-radius:17px;font-size:1.05rem">${esc(D.initials(u.name))}</span>
            <div><h2 style="font-size:1.2rem">${esc(u.name)}</h2>
              <div class="row wrap" style="gap:6px;margin-top:6px">
                <span class="chip chip-brand mono">${esc(pro.professionalId)}</span>
                <span class="chip chip-muted">${esc(D.PROFESI_LABEL[pro.profession]||'Tenaga kesehatan')}</span>
                <span class="chip ${pro.verificationStatus==='Terverifikasi'?'chip-ok':'chip-warn'}"><span class="dot"></span>Verifikasi: ${esc(pro.verificationStatus)}</span>
              </div></div>
          </div>
          <div class="eyebrow" style="margin-bottom:9px">Data diri</div>
          <dl class="kv">
            <dt>Email</dt><dd style="font-weight:500;font-family:var(--body)">${esc(u.email)}</dd>
            <dt>Telepon</dt><dd class="mono" style="font-size:.82rem">${esc(u.phone||'—')}</dd>
            <dt>Tanggal lahir</dt><dd>${u.dateOfBirth?D.fmtDate(u.dateOfBirth):'—'}</dd>
            <dt>Jenis kelamin</dt><dd>${esc(u.gender||'—')}</dd>
          </dl>
          <div class="eyebrow" style="margin:20px 0 9px">Data profesi</div>
          <dl class="kv">
            <dt>Nomor STR / SIP</dt><dd class="mono" style="font-size:.82rem">${esc(pro.professionalRegistrationNumber)}</dd>
            <dt>Instansi</dt><dd>${esc(pro.institution)}</dd>
            <dt>Unit</dt><dd>${esc(pro.department)}</dd>
            <dt>Bidang keahlian</dt><dd>${esc(pro.specialty)}</dd>
            <dt>Pengalaman</dt><dd class="tnum">${esc(String(pro.experience))} tahun</dd>
            <dt>Kota praktik</dt><dd>${esc(pro.workLocation)}</dd>
          </dl>
          <div class="row wrap" style="gap:8px;margin-top:20px">
            <button class="btn btn-ghost btn-sm" id="editProfile">${icon('note')} Ubah data</button>
            <button class="btn btn-danger btn-sm" id="logoutBtn" style="margin-left:auto">${icon('out')} Keluar</button>
          </div>
        </div>
        ${kartuData()}
      </div>
      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('users')} Ringkasan praktik</div></div>
          <div class="stat-row" style="grid-template-columns:1fr 1fr">
            <div class="stat" style="box-shadow:none"><div class="sl">Pasien terhubung</div><div class="sv tnum">${D.myCaseload().length}</div></div>
            <div class="stat" style="box-shadow:none"><div class="sl">Catatan ditulis</div><div class="sv tnum">${D.DB.notes.filter(n=>n.professionalId===pro.professionalId).length}</div></div>
          </div>
          <p class="tiny muted" style="margin-top:13px;line-height:1.6">
            Anda hanya dapat membuka rekam pasien yang terhubung dengan Anda melalui janji temu.
            Rekam pasien lain tidak dapat diakses dari akun ini.</p>
        </div>
        ${kartuPengaturan()}
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pro.profile','Profil','Akun profesi dan pengaturan',body);
},mount(){
  shellMount(); bindPengaturan(); bindData();
  $('#logoutBtn').addEventListener('click',window.DWlogout);
  $('#editProfile').addEventListener('click',ubahProfilModal);
}});

function ubahProfilModal(){
  const u=D.me();
  const bd=openModal(`<form id="epF" class="form-grid two" autocomplete="off">
      <div class="field" data-f="name"><label for="e_name">Nama lengkap</label>
        <input class="inp" id="e_name" name="name" value="${esc(u.name)}" autocomplete="off"></div>
      <div class="field" data-f="phone"><label for="e_phone">Nomor telepon</label>
        <input class="inp" id="e_phone" name="phone" value="${esc(u.phone||'')}" autocomplete="off"></div>
      <div class="field" data-f="email" style="grid-column:1/-1"><label for="e_email">Email</label>
        <input class="inp" id="e_email" name="email" type="email" value="${esc(u.email)}" autocomplete="off"></div>
      <div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;margin-top:5px">
        <button type="button" class="btn btn-ghost btn-sm" data-close>Batal</button>
        <button class="btn btn-primary btn-sm" type="submit">Simpan perubahan</button></div>
    </form>`,{title:'Ubah data akun'});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  $('#epF',bd).addEventListener('submit',e=>{
    e.preventDefault();
    const v=window.DWread(e.target), V=window.DWform.V;
    const kembar = v.email && D.DB.users.some(x=>x.id!==u.id && x.email.toLowerCase()===v.email.toLowerCase());
    const ok=window.DWform.runValidators(e.target,v,[
      ['name','Nama lengkap',[V.req,V.minWords(2)]],
      ['phone','Nomor telepon',[V.req,V.phone]],
      ['email','Email',[V.req,V.email,()=>kembar?'Email ini sudah dipakai akun lain.':'']]
    ]);
    if(!ok) return;
    u.name=v.name; u.phone=v.phone; u.email=v.email.toLowerCase();
    D.saveDB(); closeModal(); toast('ok','Data akun diperbarui'); rerender();
  });
}

/* ============================================================
   MULAI APLIKASI
   ============================================================ */
/* jaga bilah navigasi bawah tetap menempel pada area yang benar-benar terlihat,
   termasuk saat bilah alamat peramban muncul-hilang atau papan ketik terbuka */
(function jagaBilahBawah(){
  const vv=window.visualViewport; if(!vv) return;
  const sesuaikan=()=>{
    const sisa=Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--vvb', sisa+'px');
  };
  vv.addEventListener('resize',sesuaikan);
  vv.addEventListener('scroll',sesuaikan);
  window.addEventListener('resize',sesuaikan);
  window.addEventListener('scroll',sesuaikan,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(sesuaikan,120));
  window.DWsesuaikanBilah=sesuaikan;
  sesuaikan();
})();

(async function mulai(){
  D.loadPrefs();
  D.purgeLegacySession();
  D.loadDB();
  try{ await D.seedDirektori(); }catch(e){ console.warn('direktori',e); }

  if(!D.storageOK){
    toast('warn','Penyimpanan tidak tersedia',
      'Peramban ini memblokir penyimpanan lokal, sehingga data yang Anda masukkan tidak akan bertahan setelah halaman dimuat ulang.',9000);
  }
  go('welcome');

  /* ------------------------------------------------------------
     PENGINGAT BERSUARA
     Dua hal yang dibunyikan: waktunya asesmen baru, dan jadwal
     dokter yang baru terpasang. Masing-masing hanya sekali per
     hari per pengguna, supaya tidak berubah menjadi gangguan.
     ------------------------------------------------------------ */
  const SUDAH_KEY='diwacare.ingat.v1';
  function sudahDibunyikan(tanda){
    try{
      const j=JSON.parse(localStorage.getItem(SUDAH_KEY)||'{}');
      if(j[tanda]) return true;
      j[tanda]=1;
      /* buang tanda dari hari-hari sebelumnya agar tidak menumpuk */
      const hariIni=D.isoDate(new Date());
      Object.keys(j).forEach(k=>{ if(k.indexOf(hariIni)<0) delete j[k]; });
      localStorage.setItem(SUDAH_KEY, JSON.stringify(j));
      return false;
    }catch(e){ return false; }
  }
  window.DWcekPengingat=function(){
    const me=D.me(); if(!me) return;
    const hariIni=D.isoDate(new Date());
    const besok=D.isoDate(D.addDays(new Date(),1));

    if(D.isPro(me.role)){
      const pro=D.myPro(); if(!pro) return;
      const n=D.DB.appointments.filter(a=>a.professionalId===pro.professionalId&&a.date===besok&&a.status!=='Dibatalkan').length;
      if(n && !sudahDibunyikan('nakes-besok-'+me.id+'-'+hariIni)){
        toast('info','Jadwal besok', n+' janji temu sudah terjadwal untuk besok.',6500);
        D.bunyi('ingat');
      }
      const perlu=D.DB.appointments.filter(a=>a.professionalId===pro.professionalId&&a.status==='Menunggu').length;
      if(perlu && !sudahDibunyikan('nakes-tunggu-'+me.id+'-'+hariIni)){
        toast('warn','Ada konsultasi menunggu jawaban', perlu+' permintaan pasien belum dijawab.',7000);
        D.bunyi('notif');
      }
      return;
    }

    const p=D.myPatient(); if(!p) return;

    /* 1. waktunya asesmen baru */
    const jatuh=D.patReminders(p.patientId)
      .filter(r=>r.status==='menunggu' && r.date<=hariIni)
      .sort((a,b)=>a.date<b.date?-1:1)[0];
    if(jatuh && !sudahDibunyikan('asesmen-'+me.id+'-'+hariIni)){
      toast('warn','Waktunya asesmen baru',
        esc(jatuh.title)+' — '+(jatuh.date<hariIni?'terlewat sejak '+D.fmtDate(jatuh.date):'dijadwalkan hari ini')+'.',9000);
      D.bunyi('ingat');
    } else if(!jatuh){
      /* belum pernah mendokumentasikan sama sekali */
      const belum=D.patAssessments(p.patientId).length===0;
      if(belum && !sudahDibunyikan('mulai-'+me.id+'-'+hariIni)){
        toast('info','Mulai dari satu foto','Asesmen pertama membuka grafik tren dan runtutan mingguan Anda.',8000);
        D.bunyi('notif');
      }
    }

    /* 2. jadwal dokter yang otomatis terpasang */
    const jadwal=D.patAppointments(p.patientId)
      .filter(a=>a.status==='Terjadwal' && a.date>=hariIni)
      .sort((a,b)=>(a.date+a.time)<(b.date+b.time)?-1:1)[0];
    if(jadwal && !sudahDibunyikan('jadwal-'+me.id+'-'+jadwal.appointmentId+'-'+hariIni)){
      setTimeout(()=>{
        toast('ok','Jam temu terjadwal',
          D.proName(jadwal.professionalId)+' · '+D.fmtDate(jadwal.date)+' pukul '+jadwal.time+
          (jadwal.date===hariIni?' — hari ini.':'.'),8000);
        D.bunyi('sukses');
      },2200);
    }
  };
  /* diperiksa ulang setiap sepuluh menit selama aplikasi terbuka */
  setInterval(()=>{ if(D.me() && window.DWcekPengingat) window.DWcekPengingat(); }, 600000);
})();
})();
