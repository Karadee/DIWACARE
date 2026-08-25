(function(){
'use strict';
const D=window.DW, {$,$$,esc,icon,toast,openModal,closeModal}=D;
const go=window.DWgo, route=window.DWroute, rerender=window.DWrerender;
const {shell,shellMount,salam}=window.DWshell;
const {lineChart,spark,animateCounts}=window.DWchart;
const {woundStats,IND,indChip}=window.DWstats;
const {apptChip,apptSort,apptDetailModal}=window.DWappt;
const emptyState=window.DWempty;
const NAKES=D.PRO_ROLES;

function daftarPasien(){
  return D.myCaseload().map(p=>{
    const st=woundStats(p.patientId);
    const u=D.userOfPat(p.patientId);
    return { p, u, st,
      last: st?st.last:null,
      indicator: st?st.indicator:null,
      lastDate: st?st.last.date:null,
      membaik: st? st.change<-15 : false,
      perluTinjau: st? (st.indicator==='periksa'||st.empatMinggu) : false,
      risikoTinggi: (p.medicalProfile&&p.medicalProfile.riskLevel==='Tinggi') || (st&&st.indicator==='periksa'),
      aktif: st? D.daysFromToday(st.last.date)>=-10 : false };
  });
}
function selStatus(r){
  if(!r.st) return '<span class="chip chip-muted">Belum ada data</span>';
  return indChip(r.indicator,true);
}
function bindPro(){
  $$('[data-pat]').forEach(b=>b.addEventListener('click',()=>go('pro.patient',{id:b.dataset.pat})));
  $$('[data-appt]').forEach(b=>b.addEventListener('click',()=>apptDetailModal(b.dataset.appt)));
  $$('[data-konsul]').forEach(b=>b.addEventListener('click',()=>go('pro.konsultasi',{id:b.dataset.konsul})));
  $$('[data-tinjau]').forEach(b=>b.addEventListener('click',()=>go('pro.tinjau',{id:b.dataset.tinjau})));
}

/* ============================================================
   BERANDA TENAGA KESEHATAN
   ============================================================ */
route('pro.dashboard',{auth:true,roles:NAKES,render(){
  const u=D.me(), pro=D.myPro(), rows=daftarPasien();
  const hariIni=D.isoDate(new Date());
  const milik=D.DB.appointments.filter(a=>a.professionalId===pro.professionalId);
  const jadwalHariIni=milik.filter(a=>a.date===hariIni && a.status!=='Dibatalkan').sort(apptSort);
  const menunggu=milik.filter(a=>a.status==='Menunggu').sort(apptSort);
  const asmMenunggu=D.asesmenBinaan(true);
  const total=rows.length, aktif=rows.filter(r=>r.aktif).length, tinjau=rows.filter(r=>r.perluTinjau).length;
  const peringatan=rows.filter(r=>r.st && (r.indicator!=='stabil' || r.st.empatMinggu))
    .sort((a,b)=> (a.indicator==='periksa'?0:1)-(b.indicator==='periksa'?0:1)).slice(0,5);
  const teratas=rows.filter(r=>r.st).sort((a,b)=>{
    const nilai=x=>x.indicator==='periksa'?0:(x.st.empatMinggu?1:(x.indicator==='pantau'?2:3));
    return nilai(a)-nilai(b);
  }).slice(0,8);

  const statistik=[
    ['Total pasien',total,'var(--brand)','users'],
    ['Aktif dipantau',aktif,'var(--info)','trend'],
    ['Asesmen menunggu',asmMenunggu.length,'var(--warn)','wound'],
    ['Jadwal hari ini',jadwalHariIni.length,'var(--ok)','cal']
  ];

  const body=`
    ${window.DWpageHead(
      salam()+', '+esc(u.name.split(' ').slice(0,2).join(' ')),
      'Ringkasan pemantauan pasien Anda hari ini.',
      `<button class="btn btn-primary" data-go="pro.schedule">${icon('cal')} Jadwal saya</button>`)}

    <div class="stat-row stagger" style="margin-bottom:16px">
      ${statistik.map((s,i)=>`<div class="stat" style="--i:${i};--glow:${s[2]}"><span class="strip" style="background:${s[2]}"></span>
        <span class="ib" style="width:28px;height:28px;border-radius:8px;background:var(--surface-2);color:${s[2]}">${icon(s[3])}</span>
        <div class="sv" data-count="${s[1]}">0</div><div class="sl">${s[0]}</div></div>`).join('')}
    </div>

    ${asmMenunggu.length?`<div class="card card-rule denyut" style="--rule:var(--danger);margin-bottom:15px">
      <div class="card-head"><div class="card-title">${icon('wound')} Asesmen baru menunggu tinjauan Anda</div>
        <span class="chip chip-danger">${asmMenunggu.length}</span></div>
      <div class="grid" style="gap:8px">${asmMenunggu.slice(0,4).map(a=>`
        <button class="notif unread" data-tinjau="${a.assessmentId}" style="padding:11px;align-items:center">
          ${a.image?`<img class="asm-mini" src="${a.image}" alt="Dokumentasi luka ${esc(D.patName(a.patientId))}">`
            :`<span class="ib ib-brand" style="width:52px;height:52px;border-radius:12px">${icon('wound')}</span>`}
          <div style="flex:1;min-width:0"><div class="nt">${esc(D.patName(a.patientId))}</div>
            <div class="nm">${D.fmtDate(a.date)} · <span class="tnum">${D.n1(a.woundArea)} cm²</span></div>
            <div class="row wrap" style="gap:5px;margin-top:6px">${indChip(a.riskIndicator,true)}
              ${a.changeFromPrev?`<span class="chip ${a.changeFromPrev<0?'chip-ok':'chip-warn'} tnum">${a.changeFromPrev<0?'▼':'▲'} ${D.n0(Math.abs(a.changeFromPrev))}%</span>`:''}</div>
          </div>${icon('right')}</button>`).join('')}</div>
      ${asmMenunggu.length>4?`<button class="btn btn-quiet btn-sm" style="margin-top:10px;width:100%" data-go="pro.konsul" data-params='{"tab":"asesmen"}'>Lihat semua ${asmMenunggu.length} asesmen ${icon('right')}</button>`:''}
      <p class="tiny muted" style="margin-top:11px;line-height:1.55">
        Setiap dokumentasi menunggu satu keputusan Anda: aman diteruskan di rumah, atau dirujuk untuk ditangani langsung.</p>
    </div>`:''}

    ${menunggu.length?`<div class="card card-rule denyut" style="--rule:var(--warn);margin-bottom:15px">
      <div class="card-head"><div class="card-title">${icon('note')} Permintaan konsultasi menunggu jawaban</div>
        <span class="chip chip-warn">${menunggu.length}</span></div>
      <div class="grid" style="gap:8px">${menunggu.slice(0,4).map(a=>`
        <button class="notif unread" data-konsul="${a.appointmentId}" style="padding:12px;align-items:flex-start">
          <span class="chip chip-brand tnum" style="font-size:.76rem">${esc(a.time)}</span>
          <div style="flex:1;min-width:0"><div class="nt">${esc(D.patName(a.patientId))}</div>
            <div class="nm">${D.fmtDate(a.date)} · ${esc(a.type)}${a.modeLabel?' · '+esc(a.modeLabel):''}</div>
            ${a.keluhan?`<p class="tiny" style="color:var(--ink-2);line-height:1.5;margin-top:5px">${esc(a.keluhan.slice(0,90))}${a.keluhan.length>90?'…':''}</p>`:''}
          </div>${icon('right')}</button>`).join('')}</div>
      ${menunggu.length>4?`<button class="btn btn-quiet btn-sm" style="margin-top:10px;width:100%" data-go="pro.konsul">Lihat semua ${menunggu.length} permintaan ${icon('right')}</button>`:''}
    </div>`:''}

    <div class="dash-grid">
      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('users')} Pemantauan pasien</div>
            <button class="btn btn-quiet btn-sm" data-go="pro.patients">Semua ${icon('right')}</button></div>
          ${teratas.length?`<div class="tw"><table>
            <thead><tr><th>Pasien</th><th>Status luka</th><th>Luas terakhir</th><th>Tren</th><th>Asesmen terakhir</th></tr></thead>
            <tbody>${teratas.map(r=>`<tr style="cursor:pointer" data-pat="${r.p.patientId}">
              <td><div class="pname">${esc(r.u.name)}</div><div class="pid">${esc(r.p.patientId)}</div></td>
              <td>${selStatus(r)}</td>
              <td class="tnum">${D.n1(r.last.woundArea)} cm²</td>
              <td>${spark(r.st.asm.map(a=>a.woundArea), r.st.change<0?'var(--ok)':'var(--danger)')}</td>
              <td class="tiny muted">${D.relDay(r.lastDate)}</td>
            </tr>`).join('')}</tbody></table></div>`
          : emptyState('users','Belum ada pasien terhubung',
              'Pasien akan muncul di sini setelah mereka membuat janji temu dengan Anda melalui aplikasi.','','')}
        </div>

        <div class="card reveal">
          <div class="card-head"><div class="card-title">${icon('cal')} Jadwal hari ini</div>
            <span class="chip chip-muted">${D.fmtDate(hariIni)}</span></div>
          ${jadwalHariIni.length?`<div class="grid" style="gap:8px">${jadwalHariIni.map(a=>`
            <button class="notif" data-appt="${a.appointmentId}" style="padding:12px">
              <span class="chip chip-brand tnum" style="font-size:.78rem;padding:7px 11px">${esc(a.time)}</span>
              <div style="flex:1;min-width:0"><div class="nt">${esc(D.patName(a.patientId))}</div>
                <div class="nm">${esc(a.type)}</div></div>
              ${apptChip(a.status)}</button>`).join('')}</div>`
          : `<p class="tiny muted" style="padding:12px 0">Tidak ada jadwal untuk hari ini.</p>`}
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('alert')} Perlu perhatian</div>
            ${peringatan.length?`<span class="chip chip-warn">${peringatan.length}</span>`:''}</div>
          ${peringatan.length?`<div class="grid" style="gap:8px">${peringatan.map(r=>`
            <button class="notif" data-pat="${r.p.patientId}" style="padding:12px;align-items:flex-start">
              <span class="ib" style="width:28px;height:28px;border-radius:8px;background:${r.indicator==='periksa'?'var(--danger-tint)':'var(--warn-tint)'};color:${IND[r.indicator].color}">${icon('alert')}</span>
              <div style="flex:1;min-width:0"><div class="nt">${esc(r.u.name)}</div>
                <div class="nm">${r.indicator==='periksa'
                  ? 'Dokumentasi terakhir menunjukkan temuan yang sebaiknya diperiksa langsung.'
                  : (r.st.empatMinggu ? 'Penyusutan kurang dari 50% pada titik empat minggu.'
                                      : 'Tren belum jelas membaik — pemantauan perlu dirapatkan.')}</div></div>
            </button>`).join('')}</div>
            <p class="tiny muted" style="margin-top:11px;line-height:1.55">
              Peringatan ini merangkum dokumentasi yang dikirim pasien. Sifatnya mengingatkan untuk meninjau, bukan menegakkan diagnosis.</p>`
          : `<p class="tiny muted" style="padding:9px 0">Belum ada pasien yang ditandai.</p>`}
        </div>

        ${rows.length?`<div class="card reveal">
          <div class="card-head"><div class="card-title">${icon('chart')} Sebaran status</div></div>
          ${(function(){
            const b={stabil:0,pantau:0,periksa:0,kosong:0};
            rows.forEach(r=> b[r.indicator||'kosong']++);
            const t=rows.length||1;
            return `<div class="tissue" style="height:18px">
                <i style="width:${b.stabil/t*100}%;background:var(--ok)"></i>
                <i style="width:${b.pantau/t*100}%;background:var(--warn)"></i>
                <i style="width:${b.periksa/t*100}%;background:var(--danger)"></i>
                <i style="width:${b.kosong/t*100}%;background:var(--line-2)"></i></div>
              <div class="legend" style="margin-top:9px">
                <span><b style="background:var(--ok)"></b>Stabil ${b.stabil}</span>
                <span><b style="background:var(--warn)"></b>Dipantau ${b.pantau}</span>
                <span><b style="background:var(--danger)"></b>Perlu diperiksa ${b.periksa}</span>
                <span><b style="background:var(--line-2)"></b>Belum ada data ${b.kosong}</span>
              </div>`;
          })()}
          <div class="row spread" style="margin-top:15px;padding-top:13px;border-top:1px solid var(--line)">
            <span class="muted tiny" style="font-weight:700">Membaik lebih dari 15%</span>
            <b style="font-family:var(--display)" class="tnum">${rows.filter(r=>r.membaik).length}</b></div>
          <div class="row spread" style="padding-top:8px">
            <span class="muted tiny" style="font-weight:700">Catatan klinis ditulis</span>
            <b style="font-family:var(--display)" class="tnum">${D.DB.notes.filter(n=>n.professionalId===pro.professionalId).length}</b></div>
        </div>`:''}
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pro.dashboard','Beranda','Ringkasan pemantauan pasien',body);
},mount(){ shellMount(); animateCounts(document); bindPro(); }});

/* ============================================================
   DAFTAR PASIEN
   ============================================================ */
route('pro.patients',{auth:true,roles:NAKES,render(params){
  const f=(params&&params.filter)||'semua', q=(params&&params.q)||'';
  let rows=daftarPasien();
  const semua=daftarPasien();
  if(f==='tinjau') rows=rows.filter(r=>r.perluTinjau);
  if(f==='risiko') rows=rows.filter(r=>r.risikoTinggi);
  if(f==='membaik') rows=rows.filter(r=>r.membaik);
  if(f==='baru') rows=rows.filter(r=>r.st && D.daysFromToday(r.lastDate)>=-7);
  if(q) rows=rows.filter(r=>(r.u.name+' '+r.p.patientId).toLowerCase().indexOf(q.toLowerCase())>=0);
  const n={semua:semua.length,tinjau:semua.filter(r=>r.perluTinjau).length,risiko:semua.filter(r=>r.risikoTinggi).length,
    membaik:semua.filter(r=>r.membaik).length,baru:semua.filter(r=>r.st&&D.daysFromToday(r.lastDate)>=-7).length};
  const tersembunyi=D.DB.patients.length-semua.length;

  const body=`
    ${window.DWpageHead('Pasien','Daftar pasien yang terhubung dengan Anda','')}
    <div class="row spread wrap" style="gap:11px;margin-bottom:14px">
      <div class="filters">
        ${[['semua','Semua'],['tinjau','Perlu ditinjau'],['risiko','Risiko tinggi'],['membaik','Membaik'],['baru','Terbaru']]
          .map(x=>`<button class="fchip ${f===x[0]?'on':''}" data-filter="${x[0]}">${x[1]} · ${n[x[0]]}</button>`).join('')}
      </div>
      <div style="position:relative;min-width:200px;flex:1;max-width:320px">
        <input class="inp" id="patQ" placeholder="Cari nama atau nomor pasien…" value="${esc(q)}" style="padding-left:36px" autocomplete="off">
        <span style="position:absolute;left:12px;top:10px;color:var(--muted)">${icon('search')}</span>
      </div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      ${rows.length?`<div class="tw" style="border:none;border-radius:0"><table>
        <thead><tr><th>Nomor pasien</th><th>Nama</th><th>Status luka</th><th>Luas terakhir</th><th>Tren</th><th>Asesmen terakhir</th><th>Risiko</th></tr></thead>
        <tbody>${rows.map(r=>`<tr style="cursor:pointer" data-pat="${r.p.patientId}">
          <td class="pid">${esc(r.p.patientId)}</td>
          <td><div class="pname">${esc(r.u.name)}</div>
            <div class="tiny muted">${esc(r.p.diabetesType)} · ${esc(r.p.diabetesDuration)}</div></td>
          <td>${selStatus(r)}</td>
          <td class="tnum">${r.last?D.n1(r.last.woundArea)+' cm²':'—'}</td>
          <td>${r.st?spark(r.st.asm.map(a=>a.woundArea), r.st.change<0?'var(--ok)':'var(--danger)'):''}</td>
          <td class="tiny muted">${r.lastDate?D.relDay(r.lastDate):'—'}</td>
          <td>${r.p.medicalProfile&&r.p.medicalProfile.riskLevel
              ?`<span class="chip ${r.p.medicalProfile.riskLevel==='Tinggi'?'chip-danger':(r.p.medicalProfile.riskLevel==='Sedang'?'chip-warn':'chip-ok')}">${esc(r.p.medicalProfile.riskLevel)}</span>`
              :'<span class="tiny muted">Belum diisi</span>'}</td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div style="padding:8px">${emptyState(semua.length?'search':'users',
          semua.length?'Tidak ada pasien yang cocok':'Belum ada pasien terhubung',
          semua.length?'Coba ganti penyaring atau kosongkan kolom pencarian.'
                     :'Pasien akan muncul di sini setelah mereka membuat janji temu dengan Anda melalui aplikasi.','','')}</div>`}
    </div>
    <p class="tiny muted" style="margin-top:11px;line-height:1.6">
      Anda hanya dapat membuka rekam pasien yang terhubung dengan Anda.
      ${tersembunyi>0?`Saat ini ada ${tersembunyi} rekam pasien lain di aplikasi ini yang tidak dapat Anda akses.`:''}</p>
    ${window.DWdisclaimer}`;
  return shell('pro.patients','Pasien','Daftar pasien Anda',body);
},mount(params){
  shellMount(); bindPro();
  $$('[data-filter]').forEach(b=>b.addEventListener('click',()=>go('pro.patients',{filter:b.dataset.filter,q:(params&&params.q)||''})));
  const q=$('#patQ'); let t;
  q.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(()=>{
    go('pro.patients',{filter:(params&&params.filter)||'semua',q:q.value},{keepScroll:true});
    const nq=$('#patQ'); if(nq){ nq.focus(); nq.setSelectionRange(nq.value.length,nq.value.length); }
  },340); });
}});

/* ============================================================
   RINCIAN PASIEN
   ============================================================ */
route('pro.patient',{auth:true,roles:NAKES,render(params){
  const id=params.id;
  if(!D.proCanSee(id)){
    return shell('pro.patients','Akses ditolak','',
      `<div class="card">${emptyState('shield','Anda tidak memiliki akses ke pasien ini',
        'Tenaga kesehatan hanya dapat membuka rekam pasien yang terhubung dengannya melalui janji temu.',
        'Kembali ke daftar pasien','pro.patients')}</div>`);
  }
  const p=D.patById(id), u=D.userOfPat(id), st=woundStats(id);
  const w=D.patWounds(id)[0], tl=D.patTimeline(id);
  const janji=D.patAppointments(id).sort(apptSort).reverse();
  const catatan=D.DB.notes.filter(n=>n.patientId===id).sort((a,b)=>a.createdAt<b.createdAt?1:-1);
  const risiko=p.medicalProfile||{};
  const berGambar=tl.filter(t=>t.image);
  const umur=u.dateOfBirth?Math.floor((Date.now()-new Date(u.dateOfBirth))/(365.25*86400000)):null;

  const body=`
    <button class="btn btn-quiet btn-sm" data-go="pro.patients" style="margin-bottom:13px">${icon('left')} Semua pasien</button>
    <div class="card card-rule anim-rise" style="--rule:${st?IND[st.indicator].color:'var(--line-2)'};margin-bottom:16px">
      <div class="row spread wrap" style="gap:13px">
        <div class="row" style="gap:13px">
          <span class="avatar" style="width:48px;height:48px;border-radius:15px;font-size:.95rem">${esc(D.initials(u.name))}</span>
          <div>
            <h2 style="font-size:1.2rem">${esc(u.name)}</h2>
            <div class="row wrap" style="gap:6px;margin-top:6px">
              <span class="chip chip-muted mono">${esc(p.patientId)}</span>
              ${umur?`<span class="chip chip-muted">${umur} tahun</span>`:''}
              <span class="chip chip-muted">${esc(u.gender||'—')}</span>
              <span class="chip chip-muted">${esc(p.diabetesType)}</span>
            </div>
          </div>
        </div>
        <div class="row wrap" style="gap:8px">
          ${st?indChip(st.indicator):'<span class="chip chip-muted">Belum ada dokumentasi</span>'}
          <button class="btn btn-primary btn-sm" id="addNote">${icon('note')} Tulis catatan</button>
        </div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="col">
        ${st?`<div class="card">
          <div class="card-head"><div class="card-title">${icon('chart')} Tren pemantauan</div>
            ${st.count<2?'<span class="chip chip-muted">Dokumentasi pertama</span>'
              :`<span class="delta ${st.change<0?'delta-down':'delta-up'}">${st.change<0?'−':'+'}${D.n0(Math.abs(st.change))}% sejak awal</span>`}</div>
          <div class="stat-row" style="margin-bottom:13px">
            <div class="stat" style="box-shadow:none"><div class="sl">Saat ini</div><div class="sv tnum">${D.n1(st.last.woundArea)}<span style="font-size:.82rem;color:var(--muted)"> cm²</span></div></div>
            <div class="stat" style="box-shadow:none"><div class="sl">Awal</div><div class="sv tnum">${D.n1(st.first.woundArea)}<span style="font-size:.82rem;color:var(--muted)"> cm²</span></div></div>
            <div class="stat" style="box-shadow:none"><div class="sl">Asesmen</div><div class="sv tnum">${st.count}</div></div>
            <div class="stat" style="box-shadow:none"><div class="sl">Hari dipantau</div><div class="sv tnum">${st.days}</div></div>
          </div>
          ${lineChart(st.asm.map(a=>({y:a.woundArea,label:D.fmtDate(a.date),short:D.fmtShort(a.date)})),{h:200})}
          ${st.empatMinggu?`<div style="margin-top:13px;padding:12px;border-radius:var(--r-m);background:var(--warn-tint)">
            <div class="tiny" style="color:var(--ink-2);line-height:1.6"><b>Titik evaluasi empat minggu terlampaui.</b>
              Luas luka yang didokumentasikan pasien berubah ${D.n0(st.change)}% dalam ${st.days} hari.</div></div>`:''}
        </div>`:`<div class="card">${emptyState('wound','Belum ada dokumentasi luka',
          'Pasien ini belum menyimpan satu pun asesmen.','','')}</div>`}

        ${berGambar.length>=2?`<div class="card reveal">
          <div class="card-head"><div class="card-title">${icon('eye')} Pembanding sebelum dan sesudah</div></div>
          <div class="ba" id="pba" tabindex="0" role="slider" aria-label="Penggeser pembanding foto" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
            <img src="${berGambar[0].image}" alt="Dokumentasi pertama">
            <div class="after-w" id="pbaW"><img src="${berGambar[berGambar.length-1].image}" alt="Dokumentasi terbaru"></div>
            <div class="ba-handle" id="pbaH"></div>
            <span class="ba-lbl" style="left:9px">Hari ${berGambar[0].day}</span>
            <span class="ba-lbl" style="right:9px">Hari ${berGambar[berGambar.length-1].day}</span>
          </div>
        </div>`:''}

        ${tl.length?`<div class="card reveal">
          <div class="card-head"><div class="card-title">${icon('list')} Riwayat asesmen</div></div>
          <div class="vtimeline">${tl.slice().reverse().map(t=>`
            <div class="vt-i"><span class="vt-dot">H${t.day}</span>
              <button class="vt-body" data-tl="${t.timelineId}">
                <div class="row spread wrap" style="gap:8px">
                  <div><div style="font-family:var(--display);font-weight:800;font-size:1rem" class="tnum">${D.n1(t.woundArea)} cm²</div>
                    <div class="tiny muted">${D.fmtDate(t.date)}</div></div>
                  ${indChip(t.assessment,true)}</div></button></div>`).join('')}</div>
        </div>`:''}

        <div class="card reveal">
          <div class="card-head"><div class="card-title">${icon('note')} Catatan klinis</div>
            <span class="chip chip-muted">${catatan.length}</span></div>
          ${catatan.length?`<div class="grid" style="gap:9px">${catatan.map(n=>`
            <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-m);padding:13px">
              <div class="row spread wrap" style="gap:8px;margin-bottom:6px">
                <span class="chip chip-brand">${esc(D.proName(n.professionalId))}</span>
                <span class="tiny muted mono">${D.relTime(n.createdAt)}</span></div>
              <p style="font-size:.87rem;color:var(--ink-2);line-height:1.6">${esc(n.content)}</p></div>`).join('')}</div>`
          : `<p class="tiny muted" style="padding:7px 0">Belum ada catatan klinis untuk pasien ini.</p>`}
          <button class="btn btn-soft btn-sm btn-block" style="margin-top:13px" id="addNote2">${icon('plus')} Tulis catatan</button>
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('user')} Data pasien</div></div>
          <dl class="kv">
            <dt>Email</dt><dd style="font-weight:500;font-family:var(--body)">${esc(u.email)}</dd>
            <dt>Telepon</dt><dd class="mono" style="font-size:.8rem">${esc(u.phone||'—')}</dd>
            <dt>Tanggal lahir</dt><dd>${u.dateOfBirth?D.fmtDate(u.dateOfBirth):'—'}</dd>
            <dt>Domisili</dt><dd>${esc(u.address||'—')}</dd>
            <dt>Lama diabetes</dt><dd>${esc(p.diabetesDuration)}</dd>
            <dt>Kontak darurat</dt><dd style="font-weight:500;font-family:var(--body)">${esc(p.emergencyContact.name)} (${esc(p.emergencyContact.relationship)})</dd>
            <dt>Nomor kontak</dt><dd class="mono" style="font-size:.8rem">${esc(p.emergencyContact.phone)}</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('wound')} Data luka</div></div>
          <dl class="kv">
            <dt>Lokasi</dt><dd>${esc(w?w.location:'—')}</dd>
            <dt>Lama luka</dt><dd>${esc(w?w.duration:'—')}</dd>
            <dt>Keluhan</dt><dd style="font-weight:500;font-family:var(--body)">${esc(w&&w.symptoms.length?w.symptoms.join(', '):'Tidak ada')}</dd>
          </dl>
          ${st&&st.last.ukur&&st.last.ukur.panjangCm?`<dl class="kv" style="margin-top:10px">
            <dt>Panjang terukur</dt><dd class="tnum">${D.n1(st.last.ukur.panjangCm)} cm${st.last.ukur.terkalibrasi?'':' (perkiraan)'}</dd>
            <dt>Kalibrasi</dt><dd style="font-family:var(--body);font-weight:600">${st.last.ukur.terkalibrasi?esc(st.last.ukur.acuan||'benda acuan'):'Belum dikalibrasi'}</dd></dl>`:''}
          ${st?`<div style="margin-top:13px">${window.DWtissue(st.last.visualCharacteristics)}</div>`:''}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('shield')} Cek faktor risiko</div></div>
          ${risiko.riskLevel?`<div class="row" style="gap:10px;margin-bottom:11px">
              <span class="chip ${risiko.riskLevel==='Tinggi'?'chip-danger':(risiko.riskLevel==='Sedang'?'chip-warn':'chip-ok')}" style="padding:6px 13px"><span class="dot"></span>${esc(risiko.riskLevel)}</span>
              <span class="tiny muted tnum">Skor ${risiko.riskScore}/${risiko.riskMax||19}</span></div>
            ${(risiko.riskFactors||[]).length?`<ul style="margin:0;padding-left:18px;color:var(--ink-2);font-size:.83rem;line-height:1.65">
              ${risiko.riskFactors.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:'<p class="tiny muted">Tidak ada faktor yang dilaporkan.</p>'}
            <p class="tiny muted" style="margin-top:9px">Dilaporkan sendiri oleh pasien pada ${risiko.riskDate?D.fmtDate(D.isoDate(new Date(risiko.riskDate))):'—'}.</p>`
          : `<p class="tiny muted">Pasien belum mengisi daftar periksa faktor risiko.</p>`}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('cal')} Janji temu</div></div>
          ${janji.length?`<div class="grid" style="gap:7px">${janji.slice(0,6).map(a=>`
            <button class="notif" data-appt="${a.appointmentId}" style="padding:10px">
              <div style="flex:1;min-width:0"><div class="nt">${esc(a.type)}</div>
                <div class="nm">${D.fmtDate(a.date)} · ${esc(a.time)} · ${esc(D.proName(a.professionalId))}</div></div>
              ${apptChip(a.status)}</button>`).join('')}</div>`
          : `<p class="tiny muted">Belum ada janji temu.</p>`}
        </div>
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pro.patients',u.name,p.patientId,body);
},mount(params){
  shellMount(); bindPro();
  $$('[data-tl]').forEach(b=>b.addEventListener('click',()=>window.DWtlModal(b.dataset.tl)));
  const buka=()=>catatanModal(params.id);
  const a=$('#addNote'), b=$('#addNote2');
  if(a) a.addEventListener('click',buka); if(b) b.addEventListener('click',buka);
  const ba=$('#pba');
  if(ba){
    const w=$('#pbaW'), h=$('#pbaH');
    const set=p=>{ p=D.clamp(p,0,100); w.style.clipPath='inset(0 0 0 '+p+'%)'; h.style.left=p+'%'; ba.setAttribute('aria-valuenow',Math.round(p)); };
    const dari=e=>{ const r=ba.getBoundingClientRect(); set((((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width)*100); };
    let drag=false;
    ba.addEventListener('pointerdown',e=>{drag=true;ba.setPointerCapture(e.pointerId);dari(e);});
    ba.addEventListener('pointermove',e=>{if(drag)dari(e);});
    ba.addEventListener('pointerup',()=>{drag=false;});
    ba.addEventListener('keydown',e=>{ const c=Number(ba.getAttribute('aria-valuenow'));
      if(e.key==='ArrowLeft'){set(c-5);e.preventDefault();} if(e.key==='ArrowRight'){set(c+5);e.preventDefault();} });
    set(50);
  }
}});

function catatanModal(pid){
  const bd=openModal(`<div class="field" data-f="c"><label for="nTxt">Catatan klinis</label>
      <textarea class="ta" id="nTxt" placeholder="Hasil pengamatan, rencana perawatan, atau instruksi tindak lanjut…"></textarea>
      <span class="hint">Terlihat oleh tenaga kesehatan yang terhubung dengan pasien ini.</span></div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:15px">
      <button class="btn btn-ghost btn-sm" data-close>Batal</button>
      <button class="btn btn-primary btn-sm" id="nSave">Simpan catatan</button></div>`,{title:'Tulis catatan klinis'});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  $('#nSave',bd).addEventListener('click',()=>{
    const t=$('#nTxt',bd).value.trim();
    const f=bd.querySelector('[data-f="c"]');
    bd.querySelectorAll('.err').forEach(e=>e.remove()); f.classList.remove('bad');
    if(t.length<5){
      f.classList.add('bad');
      const e=document.createElement('div'); e.className='err';
      e.innerHTML=icon('alert')+'<span>Tulis catatan singkat terlebih dulu, minimal lima karakter.</span>';
      f.appendChild(e);
      toast('err','Catatan masih kosong'); return;
    }
    D.DB.notes.push({ noteId:D.uid('nte'), patientId:pid, professionalId:D.myPro().professionalId,
      content:t, createdAt:new Date().toISOString() });
    const pu=D.userOfPat(pid);
    if(pu) D.pushNotif(pu.id,'Catatan baru dari tim perawatan',
      D.me().name+' menambahkan catatan pada rekam Anda.','sistem',false);
    D.saveDB(); closeModal(); toast('ok','Catatan tersimpan'); rerender();
  });
}

/* ============================================================
   RUANG KONSULTASI
   Dokter membaca keluhan, foto, dan hasil analisis, lalu menulis
   penjelasan klinis serta resep. Semua ditulis manusia — aplikasi
   tidak pernah mengarang isi resep.
   ============================================================ */
function konsulMasuk(){
  const pro=D.myPro(); if(!pro) return {baru:[],selesai:[]};
  const milik=D.DB.appointments.filter(a=>a.professionalId===pro.professionalId);
  return { baru: milik.filter(a=>a.status==='Menunggu').sort(apptSort),
           selesai: milik.filter(a=>a.status==='Berhasil').sort(apptSort).reverse() };
}
function kartuMasuk(a,tunggu){
  const cuplik=(a.keluhan||'').slice(0,120);
  return `<button class="notif ${tunggu?'unread':''}" data-konsul="${a.appointmentId}" style="padding:14px;align-items:flex-start">
    <span class="avatar" style="width:38px;height:38px;font-size:.74rem">${esc(D.initials(D.patName(a.patientId)))}</span>
    <div style="flex:1;min-width:0">
      <div class="nt">${esc(D.patName(a.patientId))}</div>
      <div class="nm">${esc(a.type)}${a.modeLabel?' · '+esc(a.modeLabel):''}</div>
      ${cuplik?`<p class="tiny" style="color:var(--ink-2);line-height:1.55;margin-top:6px">${esc(cuplik)}${(a.keluhan||'').length>120?'…':''}</p>`:''}
      <div class="row wrap" style="gap:6px;margin-top:8px">
        <span class="chip chip-muted">${icon('cal')} ${D.fmtDate(a.date)}</span>
        <span class="chip chip-muted tnum">${icon('clock')} ${esc(a.time)}</span>
        ${a.assessmentId?`<span class="chip chip-info">${icon('camera')} Ada foto luka</span>`:''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">${apptChip(a.status)}
      <span class="tiny muted">${D.relDay(a.date)}</span></div></button>`;
}
function kartuAsesmen(a,i){
  const u=D.userOfPat(a.patientId)||{}, st=D.statusTinjau(a), t=D.TINJAU[st];
  return `<button class="notif ${st==='menunggu'?'unread':''}" style="--i:${i};padding:13px;align-items:flex-start" data-tinjau="${a.assessmentId}">
    ${a.image?`<img class="asm-mini" src="${a.image}" alt="Dokumentasi luka ${esc(u.name||'pasien')}">`
      :`<span class="ib ib-brand" style="width:52px;height:52px;border-radius:12px">${icon('wound')}</span>`}
    <div style="flex:1;min-width:0">
      <div class="nt">${esc(u.name||'Pasien')}</div>
      <div class="nm">${esc(a.patientId)} · ${D.fmtDate(a.date)}</div>
      <div class="row wrap" style="gap:6px;margin-top:7px">
        <span class="chip chip-muted tnum">${D.n1(a.woundArea)} cm²</span>
        ${indChip(a.riskIndicator,true)}
        ${a.changeFromPrev?`<span class="chip ${a.changeFromPrev<0?'chip-ok':'chip-warn'} tnum">
          ${a.changeFromPrev<0?'▼':'▲'} ${D.n0(Math.abs(a.changeFromPrev))}%</span>`:''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <span class="chip ${t.chip}">${icon(t.ikon)} ${t.label}</span>
      <span class="tiny muted">${D.relDay(a.date)}</span></div></button>`;
}
route('pro.konsul',{auth:true,roles:NAKES,render(params){
  const {baru,selesai}=konsulMasuk();
  const asm=D.asesmenBinaan(false);
  const asmBaru=asm.filter(a=>!a.tinjauan);
  const tab=(params&&params.tab)||(asmBaru.length?'asesmen':(baru.length?'baru':'asesmen'));
  const TABS=[['asesmen','Asesmen baru',asmBaru.length],['baru','Permintaan konsultasi',baru.length],
              ['selesai','Sudah ditanggapi',selesai.length+asm.filter(a=>a.tinjauan).length]];
  let isi='';
  if(tab==='asesmen'){
    isi = asmBaru.length
      ? `<div class="grid stagger" style="gap:9px">${asmBaru.map((a,i)=>kartuAsesmen(a,i)).join('')}</div>`
      : emptyState('wound','Tidak ada asesmen menunggu tinjauan',
          'Dokumentasi luka yang baru dikirim pasien Anda muncul di sini secara langsung, tanpa perlu memuat ulang halaman.','','');
  } else if(tab==='baru'){
    isi = baru.length
      ? `<div class="grid stagger" style="gap:9px">${baru.map((a,i)=>
          kartuMasuk(a,true).replace('class="notif','style="--i:'+i+'" class="notif')).join('')}</div>`
      : emptyState('note','Tidak ada permintaan menunggu',
          'Permintaan konsultasi baru dari pasien akan muncul di sini tanpa perlu memuat ulang halaman.','','');
  } else {
    const sudah=asm.filter(a=>a.tinjauan);
    isi = (selesai.length||sudah.length)
      ? `${selesai.length?`<div class="eyebrow" style="margin-bottom:9px">Konsultasi janji temu</div>
          <div class="grid" style="gap:9px;margin-bottom:19px">${selesai.map((a,i)=>
            kartuMasuk(a,false).replace('class="notif','style="--i:'+i+'" class="notif')).join('')}</div>`:''}
         ${sudah.length?`<div class="eyebrow" style="margin-bottom:9px">Tinjauan asesmen</div>
          <div class="grid" style="gap:9px">${sudah.map((a,i)=>kartuAsesmen(a,i)).join('')}</div>`:''}`
      : emptyState('check','Belum ada yang ditanggapi',
          'Setiap tinjauan asesmen dan jawaban konsultasi yang Anda kirim tersimpan lengkap di bagian ini.','','');
  }
  const body=`
    ${window.DWpageHead('Konsultasi','Dokumentasi dan permintaan yang dikirim pasien Anda','')}
    <div class="segs segs-scroll" style="margin-bottom:15px">
      ${TABS.map(t=>`<button class="seg ${tab===t[0]?'on':''}" data-tab="${t[0]}">${esc(t[1])} (${t[2]})</button>`).join('')}
    </div>
    <div class="card">${isi}</div>
    ${window.DWdisclaimer}`;
  return shell('pro.konsul','Konsultasi','Permintaan dan dokumentasi pasien',body);
},mount(){
  shellMount();
  $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>go('pro.konsul',{tab:b.dataset.tab})));
  $$('[data-konsul]').forEach(b=>b.addEventListener('click',()=>go('pro.konsultasi',{id:b.dataset.konsul})));
  $$('[data-tinjau]').forEach(b=>b.addEventListener('click',()=>go('pro.tinjau',{id:b.dataset.tinjau})));
}});

/* ------------------------------------------------------------
   RUANG TINJAUAN ASESMEN
   Tenaga kesehatan membaca dokumentasi luka yang dikirim pasien,
   menulis surat analisis, lalu memilih satu dari dua keputusan:
   aman diteruskan di rumah, atau dirujuk untuk penanganan langsung.
   ------------------------------------------------------------ */
const TUJUAN_RUJUK=['Poliklinik penyakit dalam','Poliklinik bedah','Klinik perawatan luka',
  'Instalasi gawat darurat','Poliklinik bedah vaskular','Rumah sakit rujukan lanjutan'];
const URGENSI=[
  {id:'segera',label:'Hari ini juga',ket:'Ada tanda yang tidak sebaiknya menunggu.'},
  {id:'cepat',label:'Dalam 1–3 hari',ket:'Perlu dilihat langsung dalam waktu dekat.'},
  {id:'terjadwal',label:'Dalam 1–2 minggu',ket:'Perlu penanganan lanjutan, tetapi tidak mendesak.'}
];
route('pro.tinjau',{auth:true,roles:NAKES,render(params){
  const a=D.DB.assessments.find(x=>x.assessmentId===(params&&params.id));
  const pro=D.myPro();
  if(!a || !pro || !D.proCanSee(a.patientId)){
    return shell('pro.konsul','Tinjauan asesmen','',`<div class="card">${
      emptyState('alert','Dokumentasi tidak ditemukan',
        'Asesmen ini mungkin sudah dihapus pasien, atau pasiennya bukan binaan Anda.',
        'Kembali ke daftar','pro.konsul')}</div>`);
  }
  const u=D.userOfPat(a.patientId)||{}, pat=D.patById(a.patientId)||{};
  const st=woundStats(a.patientId);
  const riwayat=D.patAssessments(a.patientId);
  const urut=riwayat.findIndex(x=>x.assessmentId===a.assessmentId)+1;
  const sebelum=urut>1?riwayat[urut-2]:null;
  const sudah=!!a.tinjauan;
  const v=a.visualCharacteristics||{};

  const kiri=`
    <div class="card card-rule" style="--rule:var(--brand)">
      <div class="card-head"><div class="card-title">${icon('user')} Pasien</div>
        <span class="chip ${D.TINJAU[D.statusTinjau(a)].chip}">${icon(D.TINJAU[D.statusTinjau(a)].ikon)} ${D.TINJAU[D.statusTinjau(a)].label}</span></div>
      <div class="row" style="gap:12px;align-items:flex-start">
        <span class="avatar" style="width:46px;height:46px;font-size:.86rem">${esc(D.initials(u.name||'Pasien'))}</span>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--display);font-weight:800;font-size:1rem">${esc(u.name||'Pasien')}</div>
          <div class="tiny muted mono">${esc(a.patientId)}</div>
          <div class="row wrap" style="gap:6px;margin-top:8px">
            ${pat.age?`<span class="chip chip-muted">${pat.age} tahun</span>`:''}
            ${pat.medicalProfile&&pat.medicalProfile.diabetesType?`<span class="chip chip-muted">${esc(pat.medicalProfile.diabetesType)}</span>`:''}
            ${pat.medicalProfile&&pat.medicalProfile.riskLevel?`<span class="chip ${pat.medicalProfile.riskLevel==='Tinggi'?'chip-danger':'chip-muted'}">Risiko ${esc(pat.medicalProfile.riskLevel)}</span>`:''}
            <span class="chip chip-muted">Dokumentasi ke-${urut}</span>
          </div>
          <button class="btn btn-quiet btn-sm" style="margin-top:10px" data-go="pro.patient" data-params='{"id":"${esc(a.patientId)}"}'>Buka rekam lengkap ${icon('right')}</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">${icon('scan')} Dokumentasi ${D.fmtDate(a.date)}</div>
        ${indChip(a.riskIndicator,true)}</div>
      ${a.image?`<div class="konsul-foto"><img src="${a.image}" alt="Foto luka pasien"></div>`:''}
      <div class="fakta-grid" style="margin-top:13px">
        <div class="fakta"><span class="fl">Luas terukur</span><span class="fv tnum">${D.n1(a.woundArea)} cm²</span></div>
        <div class="fakta"><span class="fl">Dibanding sesi lalu</span><span class="fv tnum">${a.changeFromPrev>0?'+':''}${D.n1(a.changeFromPrev||0)}%</span></div>
        <div class="fakta"><span class="fl">Panjang terukur</span><span class="fv tnum">${a.ukur&&a.ukur.panjangCm?D.n1(a.ukur.panjangCm)+' cm':'—'}</span></div>
        <div class="fakta"><span class="fl">Kalibrasi</span><span class="fv" style="font-size:.8rem">${a.ukur&&a.ukur.terkalibrasi?esc(a.ukur.acuan||'Terkalibrasi'):'Belum'}</span></div>
      </div>
      <div style="margin-top:13px">${window.DWtissue(v)}</div>
      ${(v.summary||[]).length?`<div class="row wrap" style="gap:6px;margin-top:10px">
        ${v.summary.map(x=>`<span class="chip chip-muted">${esc(x)}</span>`).join('')}</div>`:''}
      ${(a.symptoms&&a.symptoms.length)?`<div style="margin-top:13px">
        <span class="eyebrow">Keluhan yang dipilih pasien</span>
        <div class="row wrap" style="gap:6px;margin-top:7px">
          ${a.symptoms.map(x=>`<span class="chip chip-warn">${esc(x)}</span>`).join('')}</div></div>`:''}
      ${(a.reasons&&a.reasons.length)?`<div style="margin-top:13px">
        <span class="eyebrow">Dasar penilaian aplikasi</span>
        <ul class="poin">${a.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div>`:''}
      <p class="tiny muted" style="margin-top:12px;line-height:1.55">
        Angka di atas berasal dari analisis piksel di perangkat pasien dan aturan yang tertulis eksplisit di kode.
        Bukan diagnosis, dan tidak menggantikan pemeriksaan Anda.</p>
    </div>

    ${sebelum?`<div class="card">
      <div class="card-head"><div class="card-title">${icon('trend')} Dibanding dokumentasi sebelumnya</div>
        <span class="chip chip-muted">${D.fmtDate(sebelum.date)}</span></div>
      <div class="banding">
        <figure><img src="${sebelum.image}" alt="Dokumentasi ${D.fmtDate(sebelum.date)}">
          <figcaption>${D.fmtDate(sebelum.date)} · <b class="tnum">${D.n1(sebelum.woundArea)} cm²</b></figcaption></figure>
        <figure><img src="${a.image}" alt="Dokumentasi ${D.fmtDate(a.date)}">
          <figcaption>${D.fmtDate(a.date)} · <b class="tnum">${D.n1(a.woundArea)} cm²</b></figcaption></figure>
      </div>
    </div>`:''}

    ${st&&st.asm.length>1?`<div class="card">
      <div class="card-head"><div class="card-title">${icon('chart')} Tren luas luka</div></div>
      ${lineChart(st.asm.map(x=>({y:x.woundArea,label:D.fmtDate(x.date),short:D.fmtShort(x.date)})),{h:170})}
      ${st.empatMinggu?`<div class="nota nota-warn" style="margin-top:11px">${icon('alert')}
        <div>Penyusutan kurang dari 50% pada titik empat minggu. Ambang ini lazim dipakai dalam literatur luka
          sebagai penanda untuk meninjau ulang rencana perawatan.</div></div>`:''}
    </div>`:''}`;

  const kanan = sudah ? `
    <div class="card card-rule" style="--rule:${a.tinjauan.status==='dirujuk'?'var(--danger)':'var(--ok)'}">
      <div class="card-head"><div class="card-title">${icon('check')} Tinjauan sudah dikirim</div></div>
      ${window.DWtinjauHasil(a)}
      <button class="btn btn-ghost btn-sm" style="margin-top:14px;width:100%" data-go="pro.konsul">${icon('left')} Kembali ke daftar</button>
    </div>` : `
    <div class="card konsul-tulis">
      <div class="card-head"><div class="card-title">${icon('note')} Surat dan catatan analisis</div></div>

      <div class="field"><label for="tjSurat">Catatan analisis untuk pasien <span class="req">*</span></label>
        <textarea class="inp" id="tjSurat" rows="8" placeholder="Apa yang Anda lihat pada dokumentasi ini, apa artinya bagi pasien, dan apa yang perlu dilakukan sampai kontrol berikutnya."></textarea>
        <span class="hint">Surat ini yang dibaca pasien. Tulis apa adanya — aplikasi tidak menambahkan atau menyarankan isinya.</span></div>

      <div class="field"><label for="tjRawat">Anjuran perawatan sampai sesi berikutnya</label>
        <textarea class="inp" id="tjRawat" rows="4" placeholder="Cara membersihkan luka, jenis balutan, pembebanan kaki, kebersihan, dan hal lain yang perlu dijaga."></textarea></div>

      <div class="pilih-putusan">
        <span class="eyebrow">Keputusan Anda</span>
        <div class="putusan-grid" style="margin-top:9px">
          <button class="putusan on" data-putusan="aman">
            <span class="ib ib-mint">${icon('check')}</span>
            <b>Aman diteruskan</b>
            <i>Perawatan di rumah dilanjutkan, pemantauan berjalan seperti biasa.</i></button>
          <button class="putusan bahaya" data-putusan="rujuk">
            <span class="ib ib-blush">${icon('alert')}</span>
            <b>Perlu dirujuk</b>
            <i>Luka perlu dilihat dan ditangani langsung di fasilitas kesehatan.</i></button>
        </div>
      </div>

      <div id="tjRujuk" class="sembunyi">
        <div class="field" style="margin-top:15px"><label for="tjTujuan">Dirujuk ke</label>
          <select class="inp" id="tjTujuan">${TUJUAN_RUJUK.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div>
        <div class="field"><label>Seberapa cepat</label>
          <div class="grid" style="gap:8px">${URGENSI.map((x,i)=>
            `<label class="opt opt-blok"><input type="radio" name="tjU" value="${x.id}"${i===1?' checked':''}>
              <span style="flex:1"><span class="nt" style="display:block">${esc(x.label)}</span>
                <span class="nm" style="display:block">${esc(x.ket)}</span></span></label>`).join('')}</div></div>
        <div class="field"><label for="tjAlasan">Alasan rujukan <span class="req">*</span></label>
          <textarea class="inp" id="tjAlasan" rows="3" placeholder="Temuan yang membuat luka ini perlu ditangani langsung."></textarea></div>
      </div>

      <div class="nota nota-info" style="margin-top:14px">${icon('info')}
        <div>Setelah dikirim, tinjauan ini tidak bisa diubah lagi. Pasien langsung menerima pemberitahuan
          beserta suratnya, dan status dokumentasi ini berubah menjadi
          <b id="tjStatusKata">Aman</b> pada beranda mereka.</div></div>

      <button class="btn btn-primary btn-block btn-lg" id="tjKirim" style="margin-top:14px">
        ${icon('check')} <span>Kirim — tandai aman</span></button>
    </div>`;

  const body=`
    ${window.DWpageHead('Tinjauan asesmen', esc(u.name||'Pasien')+' · dokumentasi '+D.fmtDate(a.date),
      `<button class="btn btn-ghost" data-go="pro.konsul">${icon('left')} Daftar konsultasi</button>`)}
    <div class="dash-grid"><div class="col">${kiri}</div><div class="col">${kanan}</div></div>
    ${window.DWdisclaimer}`;
  return shell('pro.konsul','Tinjauan asesmen','Menanggapi dokumentasi pasien',body);
},mount(params){
  shellMount(); window.DWbindUmum();
  const kirim=$('#tjKirim'); if(!kirim) return;
  let RJ=false;
  /* pergantian keputusan hanya mengubah tampilan, tidak menggambar ulang
     halaman — supaya surat yang sudah diketik tidak ikut hilang */
  const setPutusan=rujuk=>{
    RJ=rujuk;
    $$('[data-putusan]').forEach(x=>x.classList.toggle('on', (x.dataset.putusan==='rujuk')===rujuk));
    $('#tjRujuk').classList.toggle('sembunyi',!rujuk);
    $('#tjStatusKata').textContent = rujuk?'Dirujuk':'Aman';
    kirim.classList.toggle('btn-danger',rujuk);
    kirim.classList.toggle('btn-primary',!rujuk);
    kirim.innerHTML = icon(rujuk?'alert':'check')+'<span>'+(rujuk?'Terbitkan surat rujukan':'Kirim — tandai aman')+'</span>';
  };
  $$('[data-putusan]').forEach(b=>b.addEventListener('click',()=>setPutusan(b.dataset.putusan==='rujuk')));
  kirim.addEventListener('click',()=>{
    const surat=$('#tjSurat').value.trim(), rawat=$('#tjRawat').value.trim();
    if(surat.length<20){
      toast('err','Catatan analisis masih terlalu singkat','Tulis minimal beberapa kalimat agar pasien benar-benar paham.');
      $('#tjSurat').focus(); return;
    }
    let rujukan=null;
    if(RJ){
      const alasan=$('#tjAlasan').value.trim();
      if(alasan.length<10){ toast('err','Alasan rujukan belum diisi','Sebutkan temuan yang membuat luka ini perlu ditangani langsung.'); $('#tjAlasan').focus(); return; }
      const uEl=document.querySelector('input[name="tjU"]:checked');
      const ur=URGENSI.find(x=>x.id===(uEl?uEl.value:'cepat'))||URGENSI[1];
      rujukan={ tujuan:$('#tjTujuan').value, urgensi:ur.id, urgensiLabel:ur.label, alasan,
        nomor:'RJK-'+String(Date.now()).slice(-8) };
    }
    const a=D.DB.assessments.find(x=>x.assessmentId===(params&&params.id));
    if(!a){ toast('err','Data tidak ditemukan','Dokumentasi ini sudah tidak ada.'); return go('pro.konsul'); }
    const pro=D.myPro();
    a.tinjauan={ status: RJ?'dirujuk':'aman', surat, rawat, rujukan,
      professionalId:pro.professionalId, dikirimAt:new Date().toISOString() };
    D.DB.notes.push({ noteId:D.uid('nt'), patientId:a.patientId, professionalId:pro.professionalId,
      date:D.isoDate(new Date()),
      text:'Tinjauan dokumentasi '+D.fmtDate(a.date)+' ('+(RJ?'dirujuk':'aman')+'): '+surat+
        (rujukan?' Rujukan ke '+rujukan.tujuan+' — '+rujukan.alasan:'') });
    const pu=D.userOfPat(a.patientId);
    if(pu) D.pushNotif(pu.id, RJ?'Dokumentasi Anda dirujuk':'Dokumentasi Anda dinyatakan aman',
      RJ ? D.proName(pro.professionalId)+' menerbitkan surat rujukan ke '+rujukan.tujuan+' ('+rujukan.urgensiLabel.toLowerCase()+'). Buka Luka Saya untuk membacanya.'
         : D.proName(pro.professionalId)+' sudah membaca dokumentasi '+D.fmtDate(a.date)+' dan menilainya aman untuk diteruskan di rumah.',
      'asesmen',false);
    const pat=D.patById(a.patientId)||{};
    (pat.assignedProfessionals||[]).forEach(pid=>{
      if(pid===pro.professionalId) return;
      const uu=D.userOfPro(pid);
      if(uu) D.pushNotif(uu.id,'Tinjauan pasien bersama',
        D.proName(pro.professionalId)+' menandai dokumentasi '+D.patName(a.patientId)+' sebagai '+(RJ?'dirujuk':'aman')+'.','asesmen',false);
    });
    if(!D.saveDB()) return;
    D.bunyi(RJ?'ingat':'sukses');
    toast(RJ?'warn':'ok', RJ?'Surat rujukan terkirim':'Tinjauan terkirim',
      D.patName(a.patientId)+' sudah menerima pemberitahuannya.');
    go('pro.tinjau',{id:a.assessmentId});
  });
}});

let RESEP=[];
route('pro.konsultasi',{auth:true,roles:NAKES,render(params){
  const a=D.DB.appointments.find(x=>x.appointmentId===(params&&params.id));
  const pro=D.myPro();
  if(!a || !pro || a.professionalId!==pro.professionalId){
    return shell('pro.konsul','Konsultasi','',`<div class="card">${
      emptyState('alert','Data konsultasi tidak ditemukan','Permintaan ini mungkin sudah dibatalkan pasien.',
        'Kembali ke daftar konsultasi','pro.konsul')}</div>`);
  }
  const pat=D.patById(a.patientId)||{}, u=D.userOfPat(a.patientId)||{};
  const asm = a.assessmentId ? D.DB.assessments.find(x=>x.assessmentId===a.assessmentId) : null;
  const st=woundStats(a.patientId);
  const terkunci=!!a.konsultasi;
  RESEP = terkunci ? (a.konsultasi.resep||[]).slice() : [{nama:'',dosis:'',aturan:''}];

  const kiri=`
    <div class="card card-rule" style="--rule:var(--brand)">
      <div class="card-head"><div class="card-title">${icon('user')} Pasien</div>${apptChip(a.status)}</div>
      <div class="row" style="gap:12px;align-items:flex-start">
        <span class="avatar" style="width:46px;height:46px;font-size:.86rem">${esc(D.initials(u.name||'Pasien'))}</span>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--display);font-weight:800;font-size:1rem">${esc(u.name||'Pasien')}</div>
          <div class="tiny muted mono">${esc(a.patientId)}</div>
          <div class="row wrap" style="gap:6px;margin-top:8px">
            ${pat.age?`<span class="chip chip-muted">${pat.age} tahun</span>`:''}
            ${pat.medicalProfile&&pat.medicalProfile.diabetesType?`<span class="chip chip-muted">${esc(pat.medicalProfile.diabetesType)}</span>`:''}
            ${pat.medicalProfile&&pat.medicalProfile.riskLevel?`<span class="chip ${pat.medicalProfile.riskLevel==='Tinggi'?'chip-danger':'chip-muted'}">Risiko ${esc(pat.medicalProfile.riskLevel)}</span>`:''}
          </div>
          <button class="btn btn-quiet btn-sm" style="margin-top:10px" data-go="pro.patient" data-params='{"id":"${esc(a.patientId)}"}'>Buka rekam lengkap ${icon('right')}</button>
        </div>
      </div>
      <dl class="kv" style="margin-top:15px;padding-top:13px;border-top:1px solid var(--line)">
        <dt>Bentuk</dt><dd>${esc(a.modeLabel||'—')}</dd>
        <dt>Jadwal</dt><dd>${D.fmtDate(a.date)} · <span class="tnum">${esc(a.time)}</span></dd>
        <dt>Jenis</dt><dd>${esc(a.type)}</dd>
        ${a.bayar?`<dt>Pembayaran</dt><dd class="tnum">${D.rupiah(a.bayar.jumlah)} · ${esc(a.bayar.status)}</dd>`:''}
      </dl>
    </div>

    <div class="card card-rule" style="--rule:var(--accent)">
      <div class="card-head"><div class="card-title">${icon('note')} Keluhan yang ditulis pasien</div></div>
      ${a.keluhan?`<p class="kutipan">${esc(a.keluhan)}</p>`
        :`<p class="tiny muted">Pasien tidak menuliskan keluhan.</p>`}
      <p class="tiny muted" style="margin-top:10px">Dikirim ${D.relDay(a.createdAt?a.createdAt.slice(0,10):a.date)}.</p>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">${icon('scan')} Dokumentasi dan hasil analisis</div>
        ${asm?indChip(asm.riskIndicator,true):''}</div>
      ${asm?`
        <div class="konsul-foto">
          <img src="${asm.image}" alt="Foto luka pasien">
        </div>
        <div class="fakta-grid" style="margin-top:13px">
          <div class="fakta"><span class="fl">Luas terukur</span><span class="fv tnum">${D.n1(asm.woundArea)} cm²</span></div>
          <div class="fakta"><span class="fl">Perubahan dari sesi lalu</span><span class="fv tnum">${asm.changeFromPrev>0?'+':''}${D.n1(asm.changeFromPrev)}%</span></div>
          <div class="fakta"><span class="fl">Panjang terukur</span><span class="fv tnum">${asm.ukur&&asm.ukur.panjangCm?D.n1(asm.ukur.panjangCm)+' cm':'—'}</span></div>
          <div class="fakta"><span class="fl">Kalibrasi</span><span class="fv" style="font-size:.8rem">${asm.ukur&&asm.ukur.terkalibrasi?esc(asm.ukur.acuan||'Terkalibrasi'):'Belum'}</span></div>
        </div>
        ${asm.visualCharacteristics?`<div style="margin-top:13px">${window.DWtissue(asm.visualCharacteristics)}</div>
          ${(asm.visualCharacteristics.summary||[]).length?`<div class="row wrap" style="gap:6px;margin-top:9px">
            ${asm.visualCharacteristics.summary.map(x=>`<span class="chip chip-muted">${esc(x)}</span>`).join('')}</div>`:''}`:''}
        ${(asm.reasons&&asm.reasons.length)?`<ul class="poin" style="margin-top:13px">${asm.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:''}
        ${(asm.symptoms&&asm.symptoms.length)?`<div class="row wrap" style="gap:6px;margin-top:11px">
            ${asm.symptoms.map(x=>`<span class="chip chip-warn">${esc(x)}</span>`).join('')}</div>`:''}
        <p class="tiny muted" style="margin-top:12px;line-height:1.55">
          Angka di atas berasal dari analisis piksel di perangkat pasien dan aturan yang tertulis eksplisit di kode.
          Bukan diagnosis, dan tidak menggantikan pemeriksaan Anda.</p>`
      : `<p class="tiny muted" style="padding:10px 0">Pasien tidak melampirkan asesmen pada permintaan ini.</p>`}
      ${st&&st.asm.length>1?`<div style="margin-top:15px;padding-top:13px;border-top:1px solid var(--line)">
        <span class="eyebrow">Tren luas luka</span>
        <div style="margin-top:9px">${lineChart(st.asm.map(x=>({y:x.woundArea,label:D.fmtDate(x.date),short:D.fmtShort(x.date)})),{h:150})}</div></div>`:''}
    </div>`;

  const kanan = terkunci ? `
    <div class="card card-rule" style="--rule:var(--ok)">
      <div class="card-head"><div class="card-title">${icon('check')} Sudah dikirim</div>
        <span class="chip chip-ok">Berhasil</span></div>
      ${window.DWkonsulHasil(a)}
      <button class="btn btn-ghost btn-sm" style="margin-top:14px;width:100%" data-go="pro.konsul">${icon('left')} Kembali ke daftar</button>
    </div>` : `
    <div class="card konsul-tulis">
      <div class="card-head"><div class="card-title">${icon('stetho')} Jawaban Anda</div></div>

      <div class="field"><label for="kPen">Penjelasan klinis untuk pasien</label>
        <textarea class="inp" id="kPen" rows="6" placeholder="Jelaskan temuan Anda dengan bahasa yang bisa dimengerti pasien."></textarea>
        <span class="hint">Ditulis apa adanya oleh Anda. Aplikasi tidak menambahkan atau menyarankan isi apa pun.</span></div>

      <div class="row spread" style="margin:18px 0 9px">
        <span class="eyebrow">Resep obat</span>
        <button class="btn btn-quiet btn-sm" id="kAdd">${icon('plus')} Tambah baris</button></div>
      <div id="kResep" class="grid" style="gap:10px"></div>

      <div class="field" style="margin-top:18px"><label for="kSar">Saran perawatan di rumah</label>
        <textarea class="inp" id="kSar" rows="4" placeholder="Cara merawat luka, kebersihan, alas kaki, pola makan, dan hal lain yang perlu dijaga."></textarea></div>

      <div class="field"><label for="kTin">Tindak lanjut</label>
        <textarea class="inp" id="kTin" rows="3" placeholder="Kapan kontrol berikutnya, tanda bahaya yang harus segera dilaporkan, atau rujukan bila diperlukan."></textarea></div>

      <div class="nota nota-info" style="margin-top:6px">
        <p class="tiny" style="line-height:1.6">Setelah dikirim, jawaban ini tidak bisa diubah lagi. Pasien langsung menerima pemberitahuan,
          statusnya berubah menjadi <strong>Berhasil</strong>, dan seluruh isinya pindah ke menu Riwayat mereka.</p></div>

      <button class="btn btn-primary" id="kKirim" style="width:100%;margin-top:14px">${icon('check')} Kirim ke pasien</button>
    </div>`;

  const body=`
    ${window.DWpageHead('Ruang konsultasi', esc(u.name||'Pasien')+' · '+D.fmtDate(a.date)+' pukul '+esc(a.time),
      `<button class="btn btn-ghost" data-go="pro.konsul">${icon('left')} Daftar konsultasi</button>`)}
    <div class="dash-grid"><div class="col">${kiri}</div><div class="col">${kanan}</div></div>
    ${window.DWdisclaimer}`;
  return shell('pro.konsul','Ruang konsultasi','Menjawab permintaan pasien',body);
},mount(params){
  shellMount(); window.DWbindUmum();
  const host=$('#kResep'); if(!host) return;
  const gambarResep=()=>{
    host.innerHTML=RESEP.map((r,i)=>`
      <div class="resep-baris" data-i="${i}">
        <span class="resep-no mono">${i+1}</span>
        <div class="resep-isi">
          <input class="inp" data-f="nama" placeholder="Nama obat atau bahan" value="${esc(r.nama)}">
          <div class="row" style="gap:8px">
            <input class="inp" data-f="dosis" placeholder="Dosis, mis. 500 mg" value="${esc(r.dosis)}">
            <input class="inp" data-f="aturan" placeholder="Aturan pakai, mis. 3x sehari" value="${esc(r.aturan)}">
          </div>
        </div>
        ${RESEP.length>1?`<button class="btn btn-quiet btn-sm resep-buang" title="Hapus baris">${icon('x')}</button>`:''}
      </div>`).join('');
    $$('.resep-baris',host).forEach(row=>{
      const i=+row.dataset.i;
      $$('input',row).forEach(inp=>inp.addEventListener('input',()=>{ RESEP[i][inp.dataset.f]=inp.value; }));
      const b=$('.resep-buang',row);
      if(b) b.addEventListener('click',()=>{ RESEP.splice(i,1); gambarResep(); });
    });
  };
  gambarResep();
  $('#kAdd').addEventListener('click',()=>{ RESEP.push({nama:'',dosis:'',aturan:''}); gambarResep();
    const f=host.querySelector('.resep-baris:last-child input'); if(f) f.focus(); });

  $('#kKirim').addEventListener('click',()=>{
    const pen=$('#kPen').value.trim(), sar=$('#kSar').value.trim(), tin=$('#kTin').value.trim();
    if(pen.length<20){ toast('err','Penjelasan klinis masih terlalu singkat','Tulis minimal beberapa kalimat agar pasien benar-benar paham.'); $('#kPen').focus(); return; }
    const resep=RESEP.filter(r=>r.nama.trim()).map(r=>({nama:r.nama.trim(),dosis:r.dosis.trim(),aturan:r.aturan.trim()}));
    const a=D.DB.appointments.find(x=>x.appointmentId===(params&&params.id));
    if(!a){ toast('err','Data tidak ditemukan','Permintaan ini sudah tidak ada.'); return go('pro.konsul'); }
    const pro=D.myPro();
    a.konsultasi={ penjelasan:pen, resep, saran:sar, tindakLanjut:tin,
      professionalId:pro.professionalId, dikirimAt:new Date().toISOString() };
    a.status='Berhasil';
    /* catatan klinis ikut tersimpan pada rekam pasien */
    D.DB.notes.push({ noteId:D.uid('nt'), patientId:a.patientId, professionalId:pro.professionalId,
      date:D.isoDate(new Date()),
      text:'Hasil konsultasi '+(a.modeLabel||a.type)+': '+pen+(resep.length?' Resep: '+resep.map(r=>r.nama+(r.dosis?' '+r.dosis:'')+(r.aturan?' ('+r.aturan+')':'')).join('; ')+'.':'') });
    const pu=D.userOfPat(a.patientId);
    if(pu) D.pushNotif(pu.id,'Jawaban konsultasi sudah dikirim',
      D.proName(pro.professionalId)+' mengirim penjelasan klinis'+(resep.length?', resep '+resep.length+' item,':'')+
      ' dan saran perawatan. Buka menu Janji Temu › Riwayat untuk membacanya.','janji',false);
    /* tenaga kesehatan lain yang menangani pasien yang sama ikut diberi tahu */
    const pat=D.patById(a.patientId)||{};
    (pat.assignedProfessionals||[]).forEach(pid=>{
      if(pid===pro.professionalId) return;
      const uu=D.userOfPro(pid);
      if(uu) D.pushNotif(uu.id,'Konsultasi pasien bersama',
        D.proName(pro.professionalId)+' baru mengirim jawaban konsultasi untuk '+D.patName(a.patientId)+'.','janji',false);
    });
    if(!D.saveDB()) return;
    D.bunyi('kirim');
    toast('ok','Jawaban terkirim', D.patName(a.patientId)+' sudah menerima pemberitahuannya.');
    go('pro.konsultasi',{id:a.appointmentId});
  });
}});

/* ============================================================
   JADWAL
   ============================================================ */
route('pro.schedule',{auth:true,roles:NAKES,render(params){
  const pro=D.myPro(), tampil=(params&&params.view)||'hari';
  const hari=new Date(), tISO=D.isoDate(hari);
  const milik=D.DB.appointments.filter(a=>a.professionalId===pro.professionalId && a.status!=='Dibatalkan');
  let list, label;
  if(tampil==='hari'){ list=milik.filter(a=>a.date===tISO); label='Hari ini · '+D.fmtDate(tISO); }
  else if(tampil==='minggu'){
    const akhir=D.isoDate(D.addDays(hari,6));
    list=milik.filter(a=>a.date>=tISO && a.date<=akhir); label='Tujuh hari ke depan';
  } else {
    const m=hari.getMonth(), y=hari.getFullYear();
    list=milik.filter(a=>{const d=new Date(a.date+'T00:00:00');return d.getMonth()===m&&d.getFullYear()===y;});
    label=D.BULAN[m]+' '+y;
  }
  list=list.sort(apptSort);
  const perHari={};
  list.forEach(a=>{ (perHari[a.date]=perHari[a.date]||[]).push(a); });

  const body=`
    ${window.DWpageHead('Jadwal Saya','Janji temu dari seluruh pasien Anda','')}
    <div class="row spread wrap" style="gap:11px;margin-bottom:14px">
      <div class="segs">${[['hari','Hari ini'],['minggu','Minggu'],['bulan','Bulan']]
        .map(v=>`<button class="seg ${tampil===v[0]?'on':''}" data-view="${v[0]}">${v[1]}</button>`).join('')}</div>
      <span class="chip chip-muted">${esc(label)} · ${list.length} janji temu</span>
    </div>
    <div class="dash-grid">
      <div class="col">
        ${Object.keys(perHari).length?Object.keys(perHari).sort().map(d=>`
          <div class="card">
            <div class="card-head"><div class="card-title">${icon('cal')} ${D.fmtDateFull(d)}</div>
              <span class="chip chip-muted">${D.relDay(d)}</span></div>
            <div class="grid" style="gap:8px">${perHari[d].map(a=>`
              <button class="notif" data-appt="${a.appointmentId}" style="padding:12px;align-items:flex-start">
                <span class="chip chip-brand tnum" style="font-size:.78rem;padding:7px 11px">${esc(a.time)}</span>
                <div style="flex:1;min-width:0">
                  <div class="nt">${esc(D.patName(a.patientId))}</div>
                  <div class="nm">${esc(a.type)} · ${esc((D.patById(a.patientId)||{}).patientId||'')}</div>
                  ${a.notes?`<div class="tiny muted" style="margin-top:3px">${icon('note')} ${esc(a.notes.slice(0,70))}${a.notes.length>70?'…':''}</div>`:''}
                </div>
                ${apptChip(a.status)}</button>`).join('')}</div>
          </div>`).join('')
        : `<div class="card">${emptyState('cal','Tidak ada jadwal',
            'Belum ada janji temu pada rentang waktu ini.','','')}</div>`}
      </div>
      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('cal')} Kalender bulan</div></div>
          <div id="calHost"></div>
          <div id="calList" class="tiny muted" style="margin-top:11px">Ketuk tanggal bertanda untuk melihat jadwalnya.</div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('list')} Yang bisa Anda lakukan</div></div>
          <p class="tiny muted" style="line-height:1.6;margin-bottom:11px">
            Buka salah satu janji temu untuk menyetujui, menandai selesai, menambahkan catatan, atau membatalkannya.</p>
          <button class="btn btn-soft btn-sm btn-block" data-go="pro.patients">${icon('users')} Buka daftar pasien</button>
        </div>
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pro.schedule','Jadwal Saya','Janji temu pasien Anda',body);
},mount(){
  shellMount(); bindPro();
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>go('pro.schedule',{view:b.dataset.view})));
  const pro=D.myPro(), host=$('#calHost'); if(!host) return;
  const milik=D.DB.appointments.filter(a=>a.professionalId===pro.professionalId && a.status!=='Dibatalkan');
  const marks=[...new Set(milik.map(a=>a.date))];
  let y=new Date().getFullYear(), m=new Date().getMonth(), sel='';
  (function draw(){
    host.innerHTML=window.DWcal(y,m,marks,sel);
    $$('[data-cal]',host).forEach(b=>b.addEventListener('click',()=>{ m+=Number(b.dataset.cal); if(m<0){m=11;y--;} if(m>11){m=0;y++;} draw(); }));
    $$('[data-date]',host).forEach(b=>b.addEventListener('click',()=>{
      sel=b.dataset.date; draw();
      const h=milik.filter(a=>a.date===sel).sort(apptSort), list=$('#calList');
      list.innerHTML=h.length?h.map(a=>`<button class="notif" style="margin-top:6px" data-appt="${a.appointmentId}">
          <span class="chip chip-brand tnum" style="font-size:.72rem">${esc(a.time)}</span>
          <div style="flex:1;min-width:0"><div class="nt">${esc(D.patName(a.patientId))}</div><div class="nm">${esc(a.type)}</div></div>
        </button>`).join('') : `<div style="margin-top:7px">Tidak ada jadwal pada ${D.fmtDate(sel)}.</div>`;
      $$('[data-appt]',list).forEach(x=>x.addEventListener('click',()=>apptDetailModal(x.dataset.appt)));
    }));
  })();
}});
})();
