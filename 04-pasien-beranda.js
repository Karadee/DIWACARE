(function(){
'use strict';
const D=window.DW, {$,$$,esc,icon,toast,openModal,closeModal}=D;
const go=window.DWgo, route=window.DWroute, rerender=window.DWrerender;
const {shell,shellMount,salam}=window.DWshell;
const {lineChart,animateCounts}=window.DWchart;
const {woundStats,IND,indChip}=window.DWstats;
const {apptChip,upcomingOf,apptDetailModal}=window.DWappt;
const emptyState=window.DWempty;
const PAS=['pasien'];

/* ============================================================
   BERANDA PASIEN
   ============================================================ */
route('pat.dashboard',{auth:true,roles:PAS,render(){
  const u=D.me(), p=D.myPatient();
  const st=woundStats(p.patientId);
  const appts=D.patAppointments(p.patientId);
  const up=upcomingOf(appts);
  const next=up[0];
  const rem=D.patReminders(p.patientId).filter(r=>r.status==='menunggu')
    .sort((a,b)=>(a.date+a.time)<(b.date+b.time)?-1:1)[0];
  const tl=D.patTimeline(p.patientId);
  const marks=[...new Set(appts.filter(a=>a.status!=='Dibatalkan').map(a=>a.date))];
  const now=new Date();
  const ind=st?(IND[st.indicator]||IND.stabil):null;

  const kartuStatus = st ? `
    <div class="card card-rule card-hover" style="--rule:${ind.color}">
      <div class="card-head"><div class="card-title">${icon('heart')} Status pemantauan</div>${indChip(st.indicator)}</div>
      <p style="color:var(--ink-2);font-size:.9rem;line-height:1.55">${esc(ind.text)}</p>
      <div class="row wrap" style="gap:7px;margin-top:13px">
        <span class="chip chip-muted">${icon('clock')} Terakhir: ${D.fmtDate(st.last.date)}</span>
        <span class="chip chip-muted">${icon('list')} ${st.count} dokumentasi</span>
      </div>
      ${st.empatMinggu?`<div style="margin-top:13px;padding:12px;border-radius:var(--r-m);background:var(--warn-tint)">
        <div class="row" style="gap:9px;align-items:flex-start;color:var(--warn)">${icon('alert')}
        <div class="tiny" style="color:var(--ink-2);line-height:1.55"><b>Titik evaluasi empat minggu.</b>
        Luas luka berubah ${D.n0(st.change)}% dalam ${st.days} hari. Penelitian prognosis luka umumnya memakai
        penyusutan 50% dalam empat minggu sebagai penanda untuk meninjau ulang rencana perawatan.
        Sampaikan hal ini saat kontrol.</div></div></div>`:''}
    </div>`
  : `<div class="card">${emptyState('wound','Belum ada dokumentasi luka',
      'Mulai dari satu foto terpandu. Prosesnya sekitar satu menit.','Buat asesmen pertama','pat.assess')}</div>`;

  const kartuProgres = st ? `
    <div class="card">
      <div class="card-head"><div class="card-title">${icon('trend')} Perkembangan luka</div>
        ${st.count<2?'<span class="chip chip-muted">Dokumentasi pertama</span>'
          :`<span class="delta ${st.change<0?'delta-down':'delta-up'}">${icon(st.change<0?'trend':'alert')} ${st.change<0?'−':'+'}${D.n0(Math.abs(st.change))}%</span>`}</div>
      <div class="row wrap" style="gap:24px;align-items:flex-end">
        <div><div class="tiny muted" style="font-weight:700">Luas saat ini</div>
          <div class="metric-big"><span data-count="${st.last.woundArea}" data-dec="1">0,0</span> <small>cm²</small></div></div>
        <div><div class="tiny muted" style="font-weight:700">Luas awal</div>
          <div style="font-family:var(--display);font-weight:700;font-size:1.28rem" class="tnum">${D.n1(st.first.woundArea)} <small class="muted" style="font-size:.78rem">cm²</small></div></div>
      </div>
      <div style="margin-top:13px">${lineChart(st.asm.map(a=>({y:a.woundArea,label:D.fmtDate(a.date),short:D.fmtShort(a.date)})),{h:150})}</div>
      <p class="tiny muted" style="margin-top:5px">Tren pemantauan — hasil perkiraan, bukan pengukuran klinis.</p>
    </div>` : '';

  const kartuJanji = next ? `
    <div class="appt-hero">
      <div class="row spread wrap" style="gap:9px">
        <span class="chip" style="background:rgba(255,255,255,.18);color:var(--brand-ink)">${icon('cal')} Janji temu berikutnya</span>
        <span class="chip" style="background:rgba(255,255,255,.18);color:var(--brand-ink)"><span class="dot"></span>${esc(next.status)}</span>
      </div>
      <div class="doc" style="margin-top:15px">
        <span class="doc-av">${esc(D.initials(D.proName(next.professionalId)))}</span>
        <div style="min-width:0"><div style="font-family:var(--display);font-weight:800;font-size:1.1rem">${esc(D.proName(next.professionalId))}</div>
          <div style="opacity:.85;font-size:.83rem">${esc(D.proSpec(next.professionalId))}</div></div>
      </div>
      <div class="appt-meta">
        <div><div class="k">Tanggal</div><div class="v">${D.fmtDateFull(next.date)}</div></div>
        <div><div class="k">Waktu</div><div class="v tnum">${esc(next.time)} – ${esc(next.endTime||D.addMin(next.time,30))}</div></div>
        <div><div class="k">Tempat</div><div class="v">${esc(next.location)}</div></div>
        <div><div class="k">Jenis</div><div class="v">${esc(next.type)}</div></div>
      </div>
      <div class="row wrap" style="gap:8px">
        <button class="btn btn-primary btn-sm" data-appt="${next.appointmentId}">Lihat rincian</button>
        <button class="btn btn-ghost btn-sm" data-resched="${next.appointmentId}">Ubah jadwal</button>
      </div>
    </div>`
  : `<div class="card">${emptyState('cal','Belum ada janji temu',
      'Buat janji dengan tenaga kesehatan untuk meninjau dokumentasi luka Anda.','Cari tenaga kesehatan','pat.appts')}</div>`;

  const jadwal = up.length ? `
    <div class="card">
      <div class="card-head"><div class="card-title">${icon('cal')} Jadwal terdekat</div>
        <button class="btn btn-quiet btn-sm" data-go="pat.appts">Semua ${icon('right')}</button></div>
      <div class="sched">${up.slice(0,6).map(a=>{
        const d=new Date(a.date+'T00:00:00');
        return `<button class="sched-i" data-appt="${a.appointmentId}">
          <div class="d">${D.HARI_S[d.getDay()].toUpperCase()}</div>
          <div class="n tnum">${d.getDate()}</div>
          <div class="t tnum">${esc(a.time)}</div>
          <div class="w">${esc(D.proName(a.professionalId))}</div></button>`;}).join('')}</div>
    </div>` : '';

  const perjalanan = tl.length>1 ? `
    <div class="card reveal">
      <div class="card-head"><div class="card-title">${icon('trend')} Perjalanan luka</div>
        <button class="btn btn-quiet btn-sm" data-go="pat.wound">Selengkapnya ${icon('right')}</button></div>
      <div class="journey">${tl.map((t,i)=>`<div class="j-i">
        <button class="j-node" data-tl="${t.timelineId}">
          <div class="jd">HARI ${t.day}</div>
          <div class="ja">${D.n1(t.woundArea)}<span style="font-size:.6rem;color:var(--muted)"> cm²</span></div>
          <div class="jt">${D.fmtShort(t.date)}</div></button>
        ${i<tl.length-1?`<span class="j-arrow">${icon('right')}</span>`:''}
      </div>`).join('')}</div>
    </div>` : '';

  /* status tinjauan dokumentasi terakhir */
  const asmAkhir = st ? st.last : null;
  const stTinjau = asmAkhir ? D.statusTinjau(asmAkhir) : null;
  /* apakah ada pendamping yang benar-benar memakai aplikasi ini? */
  const pendampingApp = [...new Set((p.assignedProfessionals||[]).concat(
    D.janjiAktif(p.patientId).map(x=>x.professionalId)))].filter(pid=>D.userOfPro(pid));
  const kartuTinjau = asmAkhir ? `
    <div class="card card-rule ${stTinjau==='dirujuk'?'denyut':''}" style="--rule:${stTinjau==='dirujuk'?'var(--danger)':(stTinjau==='aman'?'var(--ok)':'var(--warn)')}">
      <div class="card-head"><div class="card-title">${icon('note')} Tanggapan tenaga kesehatan</div>
        ${window.DWtinjauChip(asmAkhir)}</div>
      <p style="color:var(--ink-2);font-size:.88rem;line-height:1.6">${esc(D.TINJAU[stTinjau].teks)}</p>
      ${asmAkhir.tinjauan
        ? `<button class="btn ${stTinjau==='dirujuk'?'btn-danger':'btn-primary'} btn-sm btn-block" style="margin-top:12px" data-surat="${asmAkhir.assessmentId}">
             ${icon(stTinjau==='dirujuk'?'alert':'note')} Baca ${stTinjau==='dirujuk'?'surat rujukan':'catatan analisis'}</button>`
        : (pendampingApp.length
          ? `<div class="row wrap" style="gap:6px;margin-top:11px">
               <span class="chip chip-muted">${icon('cal')} Dikirim ${D.relDay(asmAkhir.date)}</span>
               <span class="chip chip-muted">${icon('stetho')} ${esc(D.proName(pendampingApp[0]))}</span>
             </div>`
          : `<div class="nota nota-warn" style="margin-top:12px">${icon('info')}
               <div>Tenaga kesehatan yang Anda pilih belum memakai DIWACARE, jadi tidak ada catatan analisis
                 yang bisa dikirim lewat aplikasi. Buka halaman Luka Saya sebelum berangkat dan tunjukkan
                 grafik tren serta pembanding fotonya langsung saat kunjungan.</div></div>
             <button class="btn btn-ghost btn-sm btn-block" style="margin-top:10px" data-go="pat.wound">${icon('chart')} Buka Luka Saya</button>`)}
    </div>` : '';

  const terakhir = st ? `
    <div class="card reveal">
      <div class="card-head"><div class="card-title">${icon('scan')} Asesmen terakhir</div>
        <span class="chip chip-muted">${D.relDay(st.last.date)}</span></div>
      <div class="row" style="gap:13px;align-items:flex-start">
        ${st.last.image?`<img src="${st.last.image}" alt="Foto luka terakhir" style="width:96px;height:72px;object-fit:cover;border-radius:10px;border:1px solid var(--line);flex:0 0 auto">`:''}
        <div style="flex:1;min-width:0">
          <dl class="kv" style="gap:5px 13px">
            <dt>Luas luka</dt><dd class="tnum">${D.n1(st.last.woundArea)} cm²</dd>
            <dt>Tampilan</dt><dd style="font-weight:600;font-family:var(--body)">${esc((st.last.visualCharacteristics.summary||[])[0]||'—')}</dd>
            <dt>Status</dt><dd>${indChip(st.last.riskIndicator,true)}</dd>
          </dl>
        </div>
      </div>
      <div style="margin-top:13px">${window.DWtissue(st.last.visualCharacteristics)}</div>
      <button class="btn btn-ghost btn-sm btn-block" style="margin-top:13px" data-tl="${(tl[tl.length-1]||{}).timelineId||''}">Lihat rincian</button>
    </div>` : '';

  const pengingat = rem ? `
    <div class="card card-rule" style="--rule:var(--butter);background:var(--tint-butter);border-color:transparent">
      <div class="row" style="gap:11px;align-items:flex-start">
        <span class="ib" style="background:var(--veil);color:#8A6D04">${icon('clock')}</span>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--display);font-weight:800;font-size:.93rem">${esc(rem.title)}</div>
          <div class="tiny" style="color:var(--ink-2);margin-top:2px;line-height:1.45">${esc(rem.description)}</div>
          <div class="row" style="gap:6px;margin-top:9px">
            <span class="chip" style="background:var(--veil-2);color:var(--ink-2)">${D.relDay(rem.date)}</span>
            <span class="chip tnum" style="background:var(--veil-2);color:var(--ink-2)">${esc(rem.time)}</span>
          </div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm btn-block" style="margin-top:12px;background:var(--veil);border-color:transparent" data-rem="${rem.reminderId}">Lihat pengingat</button>
    </div>` : '';

  /* ---- runtutan dokumentasi ---- */
  const rt=D.hitungRuntutan(p.patientId);
  const TANGGA=[[2,'Awal yang baik'],[4,'Sebulan penuh'],[8,'Dua bulan berturut'],[12,'Tiga bulan berturut']];
  const berikut=TANGGA.find(t=>t[0]>rt.beruntun);
  const kartuRuntutan = `
    <div class="card runtut ${rt.beruntun>0?'nyala':''}">
      <div class="card-head"><div class="card-title">${icon('flame')} Runtutan dokumentasi</div>
        ${rt.mingguIni?'<span class="chip chip-ok">Minggu ini sudah</span>':'<span class="chip chip-warn">Minggu ini belum</span>'}</div>
      <div class="row" style="gap:15px;align-items:center">
        <div class="runtut-api">
          <span class="runtut-nyala">${icon('flame')}</span>
          <span class="runtut-n tnum">${rt.beruntun}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--display);font-weight:800;font-size:.95rem;line-height:1.35">
            ${rt.beruntun>0? rt.beruntun+' minggu berturut-turut' : 'Runtutan belum dimulai'}</div>
          <p class="tiny" style="color:var(--ink-2);line-height:1.55;margin-top:4px">
            ${rt.beruntun>0
              ? (rt.mingguIni?'Dokumentasi minggu ini sudah masuk. Pertahankan sampai minggu depan.'
                             :'Kirim satu dokumentasi minggu ini agar runtutannya tidak putus.')
              : 'Satu foto luka per minggu sudah cukup untuk membentuk tren yang bisa dibaca tenaga kesehatan.'}</p>
        </div>
      </div>
      <div class="runtut-pekan" title="Delapan minggu terakhir">
        ${rt.pekan.map(w=>`<span class="rp ${w.ada?'isi':''}"></span>`).join('')}
      </div>
      <div class="row spread" style="margin-top:11px;padding-top:11px;border-top:1px solid var(--line)">
        <span class="tiny muted" style="font-weight:700">Rekor terpanjang</span>
        <b class="tnum" style="font-family:var(--display)">${rt.terpanjang} minggu</b></div>
      <div class="row spread" style="padding-top:6px">
        <span class="tiny muted" style="font-weight:700">Total dokumentasi</span>
        <b class="tnum" style="font-family:var(--display)">${rt.total}</b></div>
      ${berikut?`<div class="runtut-target">
        <div class="row spread"><span class="tiny" style="font-weight:700;color:var(--ink-2)">${esc(berikut[1])}</span>
          <span class="tiny muted tnum">${rt.beruntun}/${berikut[0]}</span></div>
        <div class="laju" style="margin-top:6px"><i style="width:${Math.min(100,rt.beruntun/berikut[0]*100)}%"></i></div></div>`
        :`<p class="tiny muted" style="margin-top:11px">Semua tonggak sudah Anda lewati. Luar biasa konsisten.</p>`}
      ${!rt.mingguIni?`<button class="btn btn-primary btn-sm btn-block" style="margin-top:13px" data-go="pat.assess">${icon('camera')} Kirim dokumentasi minggu ini</button>`:''}
    </div>`;

  const risiko = p.medicalProfile&&p.medicalProfile.riskLevel;
  const body=`
    ${window.DWpageHead(
      salam()+', '+esc(u.name.split(' ')[0]),
      'Ringkasan pemantauan luka Anda hari ini.',
      `<button class="btn btn-primary" data-go="pat.assess">${icon('plus')} Asesmen baru</button>`)}

    <div class="dash-grid">
      <div class="col stagger">
        <div style="--i:0">${kartuStatus}</div>
        ${kartuTinjau?`<div style="--i:1">${kartuTinjau}</div>`:''}
        ${kartuProgres?`<div style="--i:2">${kartuProgres}</div>`:''}
        <div style="--i:3">${kartuJanji}</div>
        ${perjalanan?`<div style="--i:4">${perjalanan}</div>`:''}
        ${terakhir?`<div style="--i:5">${terakhir}</div>`:''}
      </div>
      <div class="col stagger">
        ${pengingat?`<div style="--i:0">${pengingat}</div>`:''}
        <div style="--i:1">${kartuRuntutan}</div>
        ${jadwal?`<div style="--i:2">${jadwal}</div>`:''}
        <div class="card" style="--i:2">
          <div class="card-head"><div class="card-title">${icon('cal')} Kalender</div></div>
          <div id="calHost">${window.DWcal(now.getFullYear(),now.getMonth(),marks,'')}</div>
          <div id="calList" class="tiny muted" style="margin-top:11px">Ketuk tanggal bertanda untuk melihat jadwalnya.</div>
        </div>
        <div class="card edu-card reveal" style="--i:3;background:var(--tint-sky);border-color:transparent">
          <span class="ib" style="background:var(--veil-2);color:var(--info)">${icon('book')}</span>
          <h4>Kenapa dokumentasi rutin itu penting</h4>
          <p>Satu foto hanya potret sesaat. Empat foto yang diambil dengan cara sama barulah menjadi tren yang bisa dibaca.</p>
          <button class="go" data-edu="dokumentasi">Baca ${icon('right')}</button>
        </div>
        <div class="card reveal" style="--i:4">
          <div class="card-head"><div class="card-title">${icon('shield')} Cek faktor risiko</div></div>
          <p class="tiny muted" style="line-height:1.55">Tujuh pertanyaan singkat berdasarkan faktor risiko kaki diabetik yang umum dipakai.
            ${risiko?`Hasil terakhir Anda: <b style="color:var(--ink-2)">${esc(risiko)}</b>.`:''}</p>
          <button class="btn btn-soft btn-sm btn-block" style="margin-top:11px" data-go="pat.risk">${risiko?'Isi ulang':'Mulai isi'}</button>
        </div>
      </div>
    </div>
    ${window.DWdisclaimer}`;

  return shell('pat.dashboard','Beranda','Ringkasan pemantauan luka',body);
},mount(){
  shellMount(); animateCounts(document); bindUmum();
  bindKalender(D.myPatient().patientId);
}});

function bindUmum(){
  bindSurat();
  $$('[data-appt]').forEach(b=>b.addEventListener('click',()=>apptDetailModal(b.dataset.appt)));
  $$('[data-resched]').forEach(b=>b.addEventListener('click',()=>{
    const a=D.DB.appointments.find(x=>x.appointmentId===b.dataset.resched);
    if(a) window.DWappt.rescheduleModal(a);
  }));
  $$('[data-tl]').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.tl) timelineModal(b.dataset.tl); }));
  $$('[data-edu]').forEach(b=>b.addEventListener('click',()=>window.DWeduModal(b.dataset.edu)));
  $$('[data-rem]').forEach(b=>b.addEventListener('click',()=>{
    const r=D.DB.reminders.find(x=>x.reminderId===b.dataset.rem); if(!r) return;
    const bd=openModal(`<dl class="kv"><dt>Pengingat</dt><dd>${esc(r.title)}</dd>
      <dt>Waktu</dt><dd>${D.fmtDateFull(r.date)} · ${esc(r.time)} WIB</dd></dl>
      <p style="color:var(--ink-2);margin-top:13px;line-height:1.6">${esc(r.description)}</p>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn btn-ghost btn-sm" data-close>Tutup</button>
        <button class="btn btn-primary btn-sm" id="remGo">Mulai asesmen sekarang</button></div>`,{title:'Pengingat'});
    $$('[data-close]',bd).forEach(x=>x.addEventListener('click',closeModal));
    $('#remGo',bd).addEventListener('click',()=>{closeModal();go('pat.assess');});
  }));
}
function bindSurat(){
  $$('[data-surat]').forEach(b=>b.addEventListener('click',()=>{
    const a=D.DB.assessments.find(x=>x.assessmentId===b.dataset.surat); if(!a||!a.tinjauan) return;
    const rujuk=a.tinjauan.status==='dirujuk';
    const bd=openModal(
      `<div class="row spread wrap" style="gap:9px;margin-bottom:13px">
        <div><span class="eyebrow">Dokumentasi ${D.fmtDate(a.date)}</span>
          <div style="font-family:var(--display);font-weight:800;font-size:1.2rem" class="tnum">${D.n1(a.woundArea)} cm²</div></div>
        ${indChip(a.riskIndicator)}
      </div>
      ${window.DWtinjauHasil(a)}
      <div class="row wrap" style="gap:8px;justify-content:flex-end;margin-top:17px">
        ${rujuk?`<button class="btn btn-ghost btn-sm" data-go="pat.appts">${icon('cal')} Buat janji temu</button>`:''}
        <button class="btn btn-primary btn-sm" data-close>Tutup</button></div>`,
      {title: rujuk?'Surat rujukan':'Catatan analisis', wide:true});
    $$('[data-close]',bd).forEach(x=>x.addEventListener('click',closeModal));
    window.DWbind(bd);
  }));
}
window.DWbindSurat=bindSurat;
window.DWbindUmum=bindUmum;

function bindKalender(pid){
  const host=$('#calHost'); if(!host) return;
  let y=new Date().getFullYear(), m=new Date().getMonth(), sel='';
  const appts=D.patAppointments(pid).filter(a=>a.status!=='Dibatalkan');
  const marks=[...new Set(appts.map(a=>a.date))];
  (function draw(){
    host.innerHTML=window.DWcal(y,m,marks,sel);
    $$('[data-cal]',host).forEach(b=>b.addEventListener('click',()=>{
      m+=Number(b.dataset.cal); if(m<0){m=11;y--;} if(m>11){m=0;y++;} draw();
    }));
    $$('[data-date]',host).forEach(b=>b.addEventListener('click',()=>{
      sel=b.dataset.date; draw();
      const hari=appts.filter(a=>a.date===sel).sort(window.DWappt.apptSort);
      const list=$('#calList');
      list.innerHTML = hari.length ? hari.map(a=>`<button class="notif" style="margin-top:6px" data-appt="${a.appointmentId}">
          <span class="ib ib-brand" style="width:28px;height:28px;border-radius:8px">${icon('stetho')}</span>
          <div style="flex:1;min-width:0"><div class="nt">${esc(D.proName(a.professionalId))}</div>
          <div class="nm">${esc(a.time)} · ${esc(a.type)}</div></div></button>`).join('')
        : `<div style="margin-top:7px">Tidak ada jadwal pada ${D.fmtDate(sel)}.</div>`;
      $$('[data-appt]',list).forEach(x=>x.addEventListener('click',()=>apptDetailModal(x.dataset.appt)));
    }));
  })();
}
window.DWbindKal=bindKalender;

/* ============================================================
   RINCIAN SATU DOKUMENTASI
   ============================================================ */
function timelineModal(tid){
  const t=D.DB.timeline.find(x=>x.timelineId===tid); if(!t) return;
  const a=D.DB.assessments.find(x=>x.assessmentId===t.assessmentId)||{};
  const v=a.visualCharacteristics||{redPct:0,yellowPct:0,darkPct:0,summary:[]};
  const bd=openModal(`
    ${t.image?`<img src="${t.image}" alt="Dokumentasi luka ${D.fmtDate(t.date)}" style="width:100%;border-radius:var(--r-l);border:1px solid var(--line);margin-bottom:15px">`:''}
    <div class="row spread wrap" style="gap:9px;margin-bottom:13px">
      <div><span class="eyebrow">Hari ke-${t.day}</span>
        <div style="font-family:var(--display);font-weight:800;font-size:1.28rem" class="tnum">${D.n1(t.woundArea)} cm²</div></div>
      ${indChip(t.assessment)}
    </div>
    <dl class="kv" style="margin-bottom:13px">
      <dt>Tanggal</dt><dd>${D.fmtDateFull(t.date)}</dd>
      ${a.changeFromPrev!==undefined?`<dt>Dibanding sebelumnya</dt><dd class="tnum">${a.changeFromPrev>0?'+':(a.changeFromPrev<0?'−':'')}${D.n1(Math.abs(Number(a.changeFromPrev||0)))}%</dd>`:''}
      ${a.changeFromFirst!==undefined?`<dt>Dibanding awal</dt><dd class="tnum">${a.changeFromFirst>0?'+':(a.changeFromFirst<0?'−':'')}${D.n1(Math.abs(Number(a.changeFromFirst||0)))}%</dd>`:''}
      ${a.ukur&&a.ukur.panjangCm?`<dt>Panjang terukur</dt><dd class="tnum">${D.n1(a.ukur.panjangCm)} cm${a.ukur.terkalibrasi?'':' (perkiraan)'}</dd>`:''}
      ${a.ukur&&a.ukur.terkalibrasi?`<dt>Kalibrasi</dt><dd style="font-weight:500;font-family:var(--body)">${esc(a.ukur.acuan||'benda acuan')}</dd>`:''}
      ${a.symptoms&&a.symptoms.length?`<dt>Keluhan</dt><dd style="font-weight:500;font-family:var(--body)">${esc(a.symptoms.join(', '))}</dd>`:''}
    </dl>
    ${window.DWtissue(v)}
    ${(v.summary||[]).length?`<ul style="margin:13px 0 0;padding-left:18px;color:var(--ink-2);font-size:.85rem;line-height:1.7">
      ${v.summary.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}
    ${(a.reasons&&a.reasons.length)?`<div style="margin-top:13px;padding:12px;border-radius:var(--r-m);background:var(--surface-2);border:1px solid var(--line)">
      <div class="eyebrow">Dasar penilaian</div>
      <ul style="margin:7px 0 0;padding-left:18px;color:var(--ink-2);font-size:.83rem;line-height:1.6">
        ${a.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div>`:''}
    <p class="tiny muted" style="margin-top:13px;font-style:italic">Hasil perkiraan dari analisis foto, bukan pengukuran klinis.</p>
    ${a.tinjauan ? window.DWtinjauHasil(a)
      : `<div class="nota nota-warn" style="margin-top:14px">${icon('clock')}
          <div><b>Menunggu tinjauan.</b> Dokumentasi ini sudah terkirim ke tenaga kesehatan Anda dan belum dibaca.
            Anda akan mendapat pemberitahuan begitu catatan analisisnya dikirim.</div></div>`}
    <div class="row wrap" style="justify-content:space-between;gap:8px;margin-top:17px">
      <button class="btn btn-danger btn-sm" data-hapus="${a.assessmentId||''}">${icon('trash')} Hapus dokumentasi</button>
      <button class="btn btn-primary btn-sm" data-close>Tutup</button></div>`,
    {title:'Rincian dokumentasi',wide:true});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  $$('[data-hapus]',bd).forEach(b=>b.addEventListener('click',async()=>{
    const asm=D.DB.assessments.find(x=>x.assessmentId===b.dataset.hapus); if(!asm) return;
    const ok=await D.confirmModal('Hapus dokumentasi ini?',
      'Dokumentasi '+D.fmtDate(asm.date)+' seluas '+D.n1(asm.woundArea)+' cm² akan dihapus permanen, '+
      'bersama fotonya'+(asm.tinjauan?' dan catatan analisis dari tenaga kesehatan':'')+
      '. Tindakan ini tidak bisa dibatalkan.','Ya, hapus','danger');
    if(!ok) return;
    D.hapusAsesmen(b.dataset.hapus);
    if(!D.saveDB()) return;
    closeModal();
    toast('info','Dokumentasi dihapus','Riwayat dan grafik sudah diperbarui.');
    const p=D.myPatient();
    if(!D.patAssessments(p.patientId).length) go('pat.dashboard'); else rerender();
  }));
}
window.DWtlModal=timelineModal;

/* ------------------------------------------------------------
   MENGHAPUS DOKUMENTASI
   Data ini milik pasien, jadi mereka boleh menghapusnya sendiri.
   Konfirmasinya sengaja menyebutkan apa saja yang ikut hilang.
   ------------------------------------------------------------ */
function bindHapusAsesmen(){
  $$('[data-hapus]').forEach(b=>b.addEventListener('click',async e=>{
    e.stopPropagation();
    const id=b.dataset.hapus; if(!id) return;
    const a=D.DB.assessments.find(x=>x.assessmentId===id); if(!a) return;
    const ditinjau=!!a.tinjauan;
    const ok=await D.confirmModal('Hapus dokumentasi ini?',
      'Dokumentasi '+D.fmtDate(a.date)+' seluas '+D.n1(a.woundArea)+' cm² akan dihapus permanen, '+
      'bersama fotonya'+(ditinjau?' dan catatan analisis dari tenaga kesehatan':'')+'. '+
      'Angka perbandingan antarsesi akan dihitung ulang. Tindakan ini tidak bisa dibatalkan.',
      'Ya, hapus','danger');
    if(!ok) return;
    D.hapusAsesmen(id);
    if(!D.saveDB()) return;
    toast('info','Dokumentasi dihapus','Riwayat dan grafik sudah diperbarui.');
    const p=D.myPatient();
    if(!D.patAssessments(p.patientId).length) go('pat.dashboard'); else rerender();
  }));
}
window.DWbindHapus=bindHapusAsesmen;

/* ============================================================
   LUKA SAYA
   ============================================================ */
route('pat.wound',{auth:true,roles:PAS,render(){
  const p=D.myPatient(), st=woundStats(p.patientId), tl=D.patTimeline(p.patientId);
  const w=D.patWounds(p.patientId)[0];
  if(!st) return shell('pat.wound','Luka Saya','Pusat pemantauan luka Anda',
    `<div class="card">${emptyState('wound','Belum ada dokumentasi luka',
      'Setelah asesmen pertama disimpan, grafik tren, pembanding sebelum–sesudah, dan riwayat akan muncul di halaman ini.',
      'Buat asesmen pertama','pat.assess')}</div>${window.DWdisclaimer}`);

  const berGambar=tl.filter(t=>t.image);
  const body=`
    ${window.DWpageHead('Luka Saya','Perkembangan dokumentasi dan riwayat asesmen',
      `<button class="btn btn-primary" data-go="pat.assess">${icon('plus')} Asesmen baru</button>`)}

    <div class="stat-row stagger" style="margin-bottom:16px">
      <div class="stat" style="--i:0;--glow:${IND[st.indicator].color}"><span class="strip" style="background:${IND[st.indicator].color}"></span>
        <div class="sl">Status pemantauan</div>
        <div class="sv" style="font-size:1.06rem;color:${IND[st.indicator].color};line-height:1.2">${IND[st.indicator].label}</div></div>
      <div class="stat" style="--i:1;--glow:var(--brand-2)"><span class="strip" style="background:var(--brand)"></span>
        <div class="sl">Luas saat ini</div><div class="sv"><span data-count="${st.last.woundArea}" data-dec="1">0</span><span style="font-size:.85rem;color:var(--muted)"> cm²</span></div></div>
      <div class="stat" style="--i:2"><span class="strip" style="background:var(--line-2)"></span>
        <div class="sl">Luas awal</div><div class="sv tnum">${D.n1(st.first.woundArea)}<span style="font-size:.85rem;color:var(--muted)"> cm²</span></div></div>
      <div class="stat" style="--i:3"><span class="strip" style="background:${st.count<2?'var(--line-2)':(st.change<0?'var(--ok)':'var(--danger)')}"></span>
        <div class="sl">Perubahan sejak awal</div>
        ${st.count<2?'<div class="sv" style="font-size:1rem;color:var(--muted);line-height:1.3">Belum bisa dihitung</div>'
          :`<div class="sv" style="color:${st.change<0?'var(--ok)':'var(--danger)'}">${st.change<0?'−':(st.change>0?'+':'')}<span data-count="${Math.abs(st.change)}" data-dec="0">0</span>%</div>`}</div>
    </div>

    <div class="dash-grid">
      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('chart')} Tren pemantauan</div>
            <div class="segs" id="rangeSeg">
              ${[['7','7 hari'],['14','14 hari'],['30','30 hari'],['all','Semua']].map(r=>
                `<button class="seg ${r[0]==='all'?'on':''}" data-range="${r[0]}">${r[1]}</button>`).join('')}
            </div></div>
          <div id="chartHost">${lineChart(st.asm.map(a=>({y:a.woundArea,label:D.fmtDate(a.date),short:D.fmtShort(a.date)})),{h:205})}</div>
          <p class="tiny muted" style="margin-top:7px">Grafik ini menunjukkan perkembangan dokumentasi, bukan bukti kesembuhan klinis.</p>
        </div>

        ${berGambar.length>=2?`<div class="card reveal">
          <div class="card-head"><div class="card-title">${icon('eye')} Bandingkan dokumentasi</div></div>
          <div class="form-grid two" style="margin-bottom:13px">
            <div class="field"><label for="baA">Foto kiri</label>
              <select class="sel" id="baA">${berGambar.map((t,i)=>`<option value="${t.timelineId}"${i===0?' selected':''}>Hari ke-${t.day} — ${D.fmtDate(t.date)}</option>`).join('')}</select></div>
            <div class="field"><label for="baB">Foto kanan</label>
              <select class="sel" id="baB">${berGambar.map((t,i)=>`<option value="${t.timelineId}"${i===berGambar.length-1?' selected':''}>Hari ke-${t.day} — ${D.fmtDate(t.date)}</option>`).join('')}</select></div>
          </div>
          <div class="ba" id="ba" tabindex="0" role="slider" aria-label="Penggeser pembanding foto" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
            <img id="baImgA" src="${berGambar[0].image}" alt="Dokumentasi lebih awal">
            <div class="after-w" id="baW"><img id="baImgB" src="${berGambar[berGambar.length-1].image}" alt="Dokumentasi terbaru"></div>
            <div class="ba-handle" id="baH"></div>
            <span class="ba-lbl" id="baLA" style="left:9px">Awal</span>
            <span class="ba-lbl" id="baLB" style="right:9px">Terbaru</span>
          </div>
          <p class="tiny muted" style="margin-top:8px">Geser pemisah di tengah, atau gunakan tombol panah kiri dan kanan.</p>
        </div>`:''}

        <div class="card reveal">
          <div class="card-head"><div class="card-title">${icon('list')} Riwayat asesmen</div>
            <span class="chip chip-muted">${tl.length} catatan</span></div>
          <div class="vtimeline">${tl.slice().reverse().map(t=>{
            const a=D.DB.assessments.find(x=>x.assessmentId===t.assessmentId)||{};
            return `<div class="vt-i"><span class="vt-dot">H${t.day}</span>
              <div class="vt-baris">
                <button class="vt-body" data-tl="${t.timelineId}">
                  <div class="row spread wrap" style="gap:8px">
                    <div style="min-width:0"><div style="font-family:var(--display);font-weight:800;font-size:1rem" class="tnum">${D.n1(t.woundArea)} cm²</div>
                      <div class="tiny muted">${D.fmtDate(t.date)} · ${D.relDay(t.date)}</div></div>
                    <div class="row wrap" style="gap:6px;justify-content:flex-end">
                      ${indChip(t.assessment,true)}${window.DWtinjauChip(a)}
                    </div>
                  </div></button>
                <button class="vt-hapus" data-hapus="${a.assessmentId||''}" aria-label="Hapus dokumentasi ${D.fmtDate(t.date)}" title="Hapus dokumentasi ini">${icon('trash')}</button>
              </div></div>`;}).join('')}</div>
          <p class="tiny muted" style="margin-top:11px;line-height:1.55">
            Dokumentasi milik Anda sendiri, jadi bisa dihapus kapan pun lewat tombol di samping kanan setiap baris.
            Penghapusan bersifat permanen dan angka perbandingannya akan dihitung ulang.</p>
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('wound')} Data luka</div></div>
          <dl class="kv">
            <dt>Lokasi</dt><dd>${esc(w?w.location:'—')}</dd>
            <dt>Sudah berapa lama</dt><dd>${esc(w?w.duration:'—')}</dd>
            <dt>Keluhan</dt><dd style="font-weight:500;font-family:var(--body)">${esc(w&&w.symptoms.length?w.symptoms.join(', '):'Tidak ada')}</dd>
            <dt>Mulai dicatat</dt><dd>${w?D.fmtDate(D.isoDate(new Date(w.createdAt))):'—'}</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('clock')} Kerajinan mencatat</div></div>
          <div class="row spread" style="padding:8px 0;border-bottom:1px solid var(--line)">
            <span class="muted tiny" style="font-weight:700">Jumlah asesmen</span><b class="tnum" style="font-family:var(--display)">${st.count}</b></div>
          <div class="row spread" style="padding:8px 0;border-bottom:1px solid var(--line)">
            <span class="muted tiny" style="font-weight:700">Terakhir menilai</span><b style="font-family:var(--display)">${D.relDay(st.last.date)}</b></div>
          <div class="row spread" style="padding:8px 0">
            <span class="muted tiny" style="font-weight:700">Jadwal berikutnya</span>
            <b style="font-family:var(--display)">${(function(){
              const r=D.patReminders(p.patientId).filter(x=>x.status==='menunggu'&&/pemantauan/i.test(x.title))
                .sort((a,b)=>a.date<b.date?-1:1)[0];
              return r?D.relDay(r.date):'Belum dijadwalkan';})()}</b></div>
        </div>
        ${st.empatMinggu?`<div class="card card-rule" style="--rule:var(--warn);background:var(--warn-tint);border-color:transparent">
          <div class="card-head"><div class="card-title" style="color:var(--warn)">${icon('alert')} Titik evaluasi empat minggu</div></div>
          <p class="tiny" style="color:var(--ink-2);line-height:1.6">Luas luka Anda berubah ${D.n0(st.change)}% selama ${st.days} hari.
            Penelitian prognosis luka umumnya menganggap penyusutan kurang dari 50% pada minggu keempat sebagai tanda untuk
            meninjau ulang rencana perawatan. Bawa catatan ini ke kontrol berikutnya.</p>
          <button class="btn btn-soft btn-sm btn-block" style="margin-top:11px" data-go="pat.appts">Buat janji kontrol</button>
        </div>`:''}
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pat.wound','Luka Saya','Perkembangan dan riwayat dokumentasi',body);
},mount(){
  shellMount(); animateCounts(document); bindUmum(); bindHapusAsesmen();
  const p=D.myPatient(), st=woundStats(p.patientId);
  $$('#rangeSeg .seg').forEach(b=>b.addEventListener('click',()=>{
    $$('#rangeSeg .seg').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    const r=b.dataset.range;
    let pts=st.asm;
    if(r!=='all'){ const cut=D.isoDate(D.addDays(new Date(),-Number(r))); pts=st.asm.filter(a=>a.date>=cut); }
    $('#chartHost').innerHTML = pts.length
      ? lineChart(pts.map(a=>({y:a.woundArea,label:D.fmtDate(a.date),short:D.fmtShort(a.date)})),{h:205})
      : '<div class="muted tiny" style="padding:26px;text-align:center">Tidak ada dokumentasi pada rentang ini.</div>';
  }));
  const ba=$('#ba');
  if(ba){
    const w=$('#baW'), h=$('#baH'), imgA=$('#baImgA'), imgB=$('#baImgB'), selA=$('#baA'), selB=$('#baB');
    const set=pct=>{ pct=D.clamp(pct,0,100); w.style.clipPath='inset(0 0 0 '+pct+'%)'; h.style.left=pct+'%';
      ba.setAttribute('aria-valuenow',Math.round(pct)); };
    const dari=e=>{ const r=ba.getBoundingClientRect();
      const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left; set((x/r.width)*100); };
    let drag=false;
    ba.addEventListener('pointerdown',e=>{drag=true;ba.setPointerCapture(e.pointerId);dari(e);});
    ba.addEventListener('pointermove',e=>{if(drag)dari(e);});
    ba.addEventListener('pointerup',()=>{drag=false;});
    ba.addEventListener('keydown',e=>{
      const c=Number(ba.getAttribute('aria-valuenow'));
      if(e.key==='ArrowLeft'){set(c-5);e.preventDefault();}
      if(e.key==='ArrowRight'){set(c+5);e.preventDefault();}
    });
    const tukar=()=>{
      const a=D.DB.timeline.find(t=>t.timelineId===selA.value), b=D.DB.timeline.find(t=>t.timelineId===selB.value);
      if(a){imgA.src=a.image;$('#baLA').textContent='Hari '+a.day;}
      if(b){imgB.src=b.image;$('#baLB').textContent='Hari '+b.day;}
    };
    selA.addEventListener('change',tukar); selB.addEventListener('change',tukar); tukar(); set(50);
  }
}});

/* ============================================================
   CEK FAKTOR RISIKO
   ============================================================ */
const RISK_Q=[
  ['q1','Pernah mengalami luka di kaki karena diabetes?',2],
  ['q2','Pernah punya ulkus atau luka terbuka di kaki sebelumnya?',3],
  ['q3','Kaki terasa kebas, kesemutan, atau berkurang rasanya?',3],
  ['q4','Ada gangguan peredaran darah di kaki atau tungkai?',3],
  ['q5','Pernah menjalani amputasi jari kaki, kaki, atau tungkai?',4],
  ['q6','Sering mengalami lecet atau luka berulang di kaki?',2],
  ['q7','Ada kelainan bentuk kaki, seperti jari bengkok atau tonjolan tulang?',2]
];
route('pat.risk',{auth:true,roles:PAS,render(){
  const p=D.myPatient(), prev=p.medicalProfile||{};
  const body=`
    ${window.DWpageHead('Cek Faktor Risiko','Daftar periksa edukatif — bukan diagnosis',
      `<button class="btn btn-ghost btn-sm" data-go="pat.dashboard">${icon('left')} Beranda</button>`)}
    <div class="dash-grid">
      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('shield')} Tujuh pertanyaan</div>
            <span class="chip chip-muted">Semua wajib dijawab</span></div>
          <p class="tiny muted" style="margin-bottom:16px;line-height:1.6">
            Pertanyaan berikut mengikuti faktor risiko kaki diabetik yang konsisten muncul dalam literatur.
            Hasilnya berupa indikator edukatif, bukan diagnosis.</p>
          <form id="riskF" class="grid" style="gap:11px">
            ${RISK_Q.map((q,i)=>`<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-m);padding:14px">
              <div class="row" style="gap:10px;align-items:flex-start;margin-bottom:10px">
                <span class="ib ib-brand" style="width:24px;height:24px;border-radius:7px;font-family:var(--mono);font-weight:600;font-size:.7rem">${i+1}</span>
                <div style="font-family:var(--display);font-weight:700;font-size:.9rem;line-height:1.4;flex:1">${esc(q[1])}</div>
              </div>
              <div class="opts" data-f="${q[0]}">
                <label class="opt"><input type="radio" name="${q[0]}" value="ya"><span>Ya</span></label>
                <label class="opt"><input type="radio" name="${q[0]}" value="tidak"><span>Tidak</span></label>
                <label class="opt"><input type="radio" name="${q[0]}" value="ragu"><span>Tidak yakin</span></label>
              </div></div>`).join('')}
            <button class="btn btn-primary btn-lg btn-block" type="submit">Lihat hasil saya</button>
          </form>
        </div>
      </div>
      <div class="col">
        <div class="card" id="riskOut">
          ${prev.riskLevel?riskResultHTML(prev.riskLevel,prev.riskScore,prev.riskFactors||[],prev.riskMax,true)
            :`<div class="empty-st"><span class="empty-art">${icon('shield')}</span>
              <h4>Belum ada hasil</h4>
              <p class="muted tiny">Jawab tujuh pertanyaan di samping untuk melihat indikator risiko Anda.</p></div>`}
        </div>
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pat.dashboard','Cek Faktor Risiko','Daftar periksa edukatif',body);
},mount(){
  shellMount();
  $('#riskF').addEventListener('submit',e=>{
    e.preventDefault();
    const root=e.target, vals=window.DWread(root);
    window.DWform.clearErrs(root);
    const kurang=RISK_Q.filter(q=>!vals[q[0]]);
    if(kurang.length){
      kurang.forEach(q=>{
        const el=root.querySelector('[data-f="'+q[0]+'"]');
        const d=document.createElement('div'); d.className='err';
        d.innerHTML=icon('alert')+'<span>Pertanyaan ini belum dijawab.</span>';
        el.parentNode.appendChild(d);
      });
      toast('err','Masih ada yang kosong', kurang.length+' dari 7 pertanyaan belum dijawab.');
      const f=root.querySelector('.err'); if(f) f.scrollIntoView({block:'center',behavior:'smooth'});
      return;
    }
    let skor=0; const faktor=[];
    RISK_Q.forEach(q=>{
      if(vals[q[0]]==='ya'){ skor+=q[2]; faktor.push(q[1].replace(/\?$/,'')); }
      else if(vals[q[0]]==='ragu'){ skor+=1; }
    });
    const maks=RISK_Q.reduce((s,q)=>s+q[2],0);
    const tingkat = skor>=8?'Tinggi':(skor>=4?'Sedang':'Rendah');
    const p=D.myPatient();
    p.medicalProfile=Object.assign({},p.medicalProfile,
      {riskLevel:tingkat,riskScore:skor,riskMax:maks,riskFactors:faktor,riskDate:new Date().toISOString()});
    p.updatedAt=new Date().toISOString();
    D.pushNotif(D.me().id,'Hasil cek faktor risiko','Indikator Anda: '+tingkat+'. Bahas hasil ini saat kontrol berikutnya.','sistem',false);
    D.saveDB();
    $('#riskOut').innerHTML=riskResultHTML(tingkat,skor,faktor,maks,false);
    window.DWbind(document);
    toast('ok','Hasil tersimpan','Indikator: '+tingkat);
    $('#riskOut').scrollIntoView({block:'center',behavior:'smooth'});
  });
}});
function riskResultHTML(tingkat,skor,faktor,maks,lama){
  const map={Rendah:['var(--ok)','chip-ok',26],Sedang:['var(--warn)','chip-warn',62],Tinggi:['var(--danger)','chip-danger',94]};
  const m=map[tingkat]||map.Rendah;
  return `<div class="card-head"><div class="card-title">${icon('shield')} Indikator risiko Anda</div>
      ${lama?'<span class="chip chip-muted">Hasil sebelumnya</span>':''}</div>
    <div class="row" style="gap:11px;align-items:center;margin-bottom:13px">
      <span class="chip ${m[1]}" style="font-size:.88rem;padding:7px 14px"><span class="dot"></span>${tingkat}</span>
      <span class="muted tiny tnum">Skor ${skor} dari ${maks||19}</span>
    </div>
    <div class="risk-meter"><i style="width:${m[2]}%;background:${m[0]}"></i></div>
    <div class="eyebrow" style="margin-top:18px">Apa yang memengaruhi hasil ini?</div>
    ${faktor.length?`<ul style="margin:8px 0 0;padding-left:18px;color:var(--ink-2);font-size:.85rem;line-height:1.7">
        ${faktor.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`
      :`<p class="tiny muted" style="margin-top:8px">Anda tidak melaporkan satu pun faktor risiko di daftar tersebut.
        Tetap periksa kaki Anda setiap hari.</p>`}
    <p class="tiny muted" style="margin-top:15px;line-height:1.6">
      Daftar periksa ini hanya menghitung faktor risiko yang Anda laporkan sendiri. Ia tidak memeriksa kaki Anda,
      tidak menegakkan diagnosis, dan tidak menggantikan pemeriksaan tenaga kesehatan.</p>
    <button class="btn btn-soft btn-sm btn-block" style="margin-top:13px" data-go="pat.appts">Bahas saat kontrol</button>`;
}
})();
