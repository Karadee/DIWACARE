(function(){
'use strict';
const D=window.DW, {$,$$,esc,icon,toast,openModal,closeModal}=D;
const go=window.DWgo, route=window.DWroute, rerender=window.DWrerender;

/* ============================================================
   NAVIGASI + KERANGKA
   ============================================================ */
const NAV_PASIEN=[
  ['pat.dashboard','Beranda','home','Beranda'],
  ['pat.wound','Luka Saya','wound','Luka'],
  ['pat.assess','Asesmen','camera','Nilai'],
  ['pat.appts','Janji Temu','cal','Jadwal'],
  ['pat.edu','Edukasi','book','Edukasi'],
  ['pat.profile','Profil','cog','Profil']
];
const NAV_NAKES=[
  ['pro.dashboard','Beranda','home','Beranda'],
  ['pro.konsul','Konsultasi','note','Konsul'],
  ['pro.patients','Pasien','users','Pasien'],
  ['pro.schedule','Jadwal Saya','cal','Jadwal'],
  ['pro.profile','Profil','cog','Profil']
];
const navFor = () => D.isPro(D.me().role) ? NAV_NAKES : NAV_PASIEN;

function salam(){
  const h=new Date().getHours();
  if(h<11) return 'Selamat pagi';
  if(h<15) return 'Selamat siang';
  if(h<18) return 'Selamat sore';
  return 'Selamat malam';
}
function shell(active, title, sub, body){
  const u=D.me(), nav=navFor(), un=D.unreadCount();
  return `<div class="shell">
    <aside class="side">
      <div style="padding:4px 8px 0">${window.DWlogo()}</div>
      <nav class="side-nav" aria-label="Navigasi utama">
        ${nav.map(n=>`<button class="nav-i ${n[0]===active?'on':''}" data-go="${n[0]}">${icon(n[2])}<span>${n[1]}</span></button>`).join('')}
      </nav>
      <div style="border-top:1px solid var(--line);padding-top:11px;margin-top:8px">
        <div class="row" style="gap:10px;padding:5px 8px 11px">
          <span class="avatar" style="width:32px;height:32px;font-size:.74rem">${esc(D.initials(u.name))}</span>
          <div style="min-width:0">
            <div style="font-family:var(--display);font-weight:700;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.name)}</div>
            <div class="tiny muted">${esc(D.isPro(u.role)?(D.PROFESI_LABEL[u.role]||'Nakes'):'Pasien')}</div>
          </div>
        </div>
        <button class="nav-i" id="logoutSide">${icon('out')}<span>Keluar</span></button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-l">
          <span class="bar" aria-hidden="true"></span>
          <div style="min-width:0">
            <h1>${title}</h1>
            ${sub?`<div class="sub">${sub}</div>`:''}
          </div>
        </div>
        <div class="topbar-r">
          ${window.DWtheme.themeBtn()}
          <button class="icon-btn" id="notifBtn" aria-label="Notifikasi${un?(', '+un+' belum dibaca'):''}">${icon('bell')}${un?'<span class="nd"></span>':''}</button>
          <button class="avatar" id="profBtn" aria-label="Profil Anda">${esc(D.initials(u.name))}</button>
        </div>
      </header>
      <div class="page">${body}</div>
    </div>
    <nav class="tabbar" aria-label="Navigasi utama">
      ${nav.slice(0,5).map(n=>`<button class="tab ${n[0]===active?'on':''}" data-go="${n[0]}" aria-label="${n[1]}">${icon(n[2])}<span>${n[3]}</span></button>`).join('')}
    </nav>
  </div>`;
}
function shellMount(){
  window.DWtheme.bindTheme();
  const lo=$('#logoutSide'); if(lo) lo.addEventListener('click',window.DWlogout);
  const nb=$('#notifBtn'); if(nb) nb.addEventListener('click',notifPanel);
  const pb=$('#profBtn'); if(pb) pb.addEventListener('click',()=>go(D.isPro(D.me().role)?'pro.profile':'pat.profile'));
}
window.DWshell={shell,shellMount,salam};

function pageHead(judul,lead,aksi){
  return `<div class="pagehead">
    <div><h2>${judul}</h2>${lead?`<div class="lead">${lead}</div>`:''}</div>
    ${aksi||''}
  </div>`;
}
window.DWpageHead=pageHead;

/* ---------- notifikasi ---------- */
const NOTIF_IB={janji:'sky',pengingat:'butter',asesmen:'mint',sistem:'lilac'};
const NOTIF_IC={janji:'cal',pengingat:'clock',asesmen:'scan',sistem:'spark'};
function notifPanel(){
  const list=D.myNotifs();
  const bd=openModal(list.length?`<div class="grid" style="gap:8px;max-height:56vh;overflow-y:auto">
      ${list.map(n=>`<div class="notif ${n.read?'':'unread'}" style="align-items:flex-start">
        <span class="ib ib-${NOTIF_IB[n.type]||'lilac'}" style="width:30px;height:30px;border-radius:9px">${icon(NOTIF_IC[n.type]||'spark')}</span>
        <div style="flex:1;min-width:0"><div class="nt">${esc(n.title)}</div><div class="nm">${esc(n.message)}</div>
          <div class="nw">${D.relTime(n.createdAt)}</div></div>
      </div>`).join('')}
    </div>
    <div class="row" style="justify-content:space-between;margin-top:15px">
      <button class="btn btn-quiet btn-sm" id="markAll">Tandai semua dibaca</button>
      <button class="btn btn-ghost btn-sm" data-close>Tutup</button>
    </div>`
  : `<div class="empty-st"><span class="empty-art">${icon('bell')}</span>
      <h4>Belum ada notifikasi</h4><p class="muted tiny">Kabar tentang janji temu dan asesmen Anda akan muncul di sini.</p></div>
      <div class="row" style="justify-content:flex-end;margin-top:11px"><button class="btn btn-ghost btn-sm" data-close>Tutup</button></div>`,
  {title:'Notifikasi'});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  const m=$('#markAll',bd);
  if(m) m.addEventListener('click',()=>{ D.myNotifs().forEach(n=>n.read=true); D.saveDB(); closeModal(); rerender(); toast('ok','Semua notifikasi ditandai dibaca'); });
}
window.DWnotifPanel=notifPanel;

/* ============================================================
   GRAFIK
   ============================================================ */
function lineChart(pts,opts){
  opts=opts||{};
  const W=opts.w||520, H=opts.h||170, P={l:34,r:12,t:14,b:26};
  if(!pts.length) return '<div class="muted tiny" style="padding:20px;text-align:center">Belum ada data.</div>';
  const ys=pts.map(p=>p.y);
  let min=Math.min.apply(null,ys), max=Math.max.apply(null,ys);
  if(max===min){ max=min+1; min=Math.max(0,min-1); }
  const pad=(max-min)*0.18; max+=pad; min=Math.max(0,min-pad);
  const iw=W-P.l-P.r, ih=H-P.t-P.b;
  const X=i=> P.l + (pts.length===1? iw/2 : (i/(pts.length-1))*iw);
  const Y=v=> P.t + ih - ((v-min)/(max-min))*ih;
  const line=pts.map((p,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area=line+` L${X(pts.length-1).toFixed(1)},${(P.t+ih).toFixed(1)} L${X(0).toFixed(1)},${(P.t+ih).toFixed(1)} Z`;
  const gid='g'+Math.random().toString(36).slice(2,8);
  const gl=[0,.5,1].map(f=>{ const v=min+(max-min)*f, y=Y(v);
    return `<line x1="${P.l}" y1="${y.toFixed(1)}" x2="${W-P.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${P.l-7}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="9.5" fill="var(--muted)">${D.n1(v)}</text>`;
  }).join('');
  const dots=pts.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${i===pts.length-1?4.6:3.2}"
      fill="${i===pts.length-1?'var(--brand)':'var(--surface)'}" stroke="var(--brand)" stroke-width="2">
      <title>${esc(p.label||'')}: ${D.n1(p.y)} cm²</title></circle>`).join('');
  const labs=pts.map((p,i)=> (pts.length<=6 || i%Math.ceil(pts.length/5)===0 || i===pts.length-1)
    ? `<text x="${X(i).toFixed(1)}" y="${H-7}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(p.short||'')}</text>`:'').join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img"
      aria-label="${esc(opts.aria||'Grafik luas luka dari waktu ke waktu')}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--brand-2)" stop-opacity=".28"/>
      <stop offset="100%" stop-color="var(--brand-2)" stop-opacity="0"/></linearGradient></defs>
    ${gl}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="var(--brand)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"
      pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="animation:drawLine 950ms var(--ease-out) forwards"/>
    ${dots}${labs}
  </svg>`;
}
function spark(vals,color){
  if(!vals.length) return '';
  const W=72,H=22,min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);
  const r=(max-min)||1;
  const d=vals.map((v,i)=>`${i?'L':'M'}${(3+(i/(Math.max(vals.length-1,1)))*(W-6)).toFixed(1)},${(H-3-((v-min)/r)*(H-6)).toFixed(1)}`).join(' ');
  const lx=W-3, ly=H-3-((vals[vals.length-1]-min)/r)*(H-6);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;height:${H}px" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly.toFixed(1)}" r="2.8" fill="${color}"/></svg>`;
}
function countUp(el,to,dec,suffix){
  const r=document.documentElement.getAttribute('data-motion');
  const reduced = r==='reduced' ||
    (r!=='full' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fmt=v=>v.toFixed(dec||0).replace('.',',');
  if(reduced){ el.textContent=fmt(to)+(suffix||''); return; }
  const t0=performance.now(), dur=800;
  (function step(t){
    const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,3);
    el.textContent=fmt(to*e)+(suffix||'');
    if(k<1) requestAnimationFrame(step);
  })(t0);
}
function animateCounts(root){
  $$('[data-count]',root).forEach(el=>{
    const to=parseFloat(el.dataset.count), dec=parseInt(el.dataset.dec||'0',10);
    countUp(el,isNaN(to)?0:to,dec,el.dataset.suffix||'');
  });
}
window.DWchart={lineChart,spark,animateCounts,countUp};

/* ============================================================
   STATUS PEMANTAUAN
   ============================================================ */
const IND={
  stabil:  {label:'Stabil', short:'Stabil', cls:'chip-ok', color:'var(--ok)',
            text:'Dokumentasi terakhir Anda menunjukkan tren yang stabil.'},
  pantau:  {label:'Perlu dipantau', short:'Dipantau', cls:'chip-warn', color:'var(--warn)',
            text:'Tren belum jelas membaik. Lanjutkan dokumentasi lebih rapat.'},
  periksa: {label:'Perlu diperiksa tenaga kesehatan', short:'Perlu diperiksa', cls:'chip-danger', color:'var(--danger)',
            text:'Ada temuan yang sebaiknya diperiksa langsung oleh tenaga kesehatan.'}
};
function woundStats(pid){
  const asm=D.patAssessments(pid);
  if(!asm.length) return null;
  const first=asm[0], last=asm[asm.length-1];
  const change = first.woundArea? ((last.woundArea-first.woundArea)/first.woundArea)*100 : 0;
  const days = Math.round((new Date(last.date)-new Date(first.date))/D.DAY);
  const prev = asm.length>1 ? asm[asm.length-2] : null;
  const changePrev = prev && prev.woundArea ? ((last.woundArea-prev.woundArea)/prev.woundArea)*100 : 0;
  const weeks = days/7;
  const empatMinggu = weeks>=3.5 && change>-50;
  return { asm, first, last, prev, change, changePrev, days, weeks, empatMinggu,
    indicator: last.riskIndicator||'stabil', count:asm.length };
}
function indChip(k,short){ const i=IND[k]||IND.stabil;
  return `<span class="chip ${i.cls}" title="${esc(i.label)}"><span class="dot"></span>${short?i.short:i.label}</span>`; }
window.DWstats={woundStats,IND,indChip};

/* ============================================================
   KALENDER KECIL
   ============================================================ */
function calendarHTML(year,month,marks,selected){
  const first=new Date(year,month,1), start=first.getDay(), n=new Date(year,month+1,0).getDate();
  const todayISO=D.isoDate(new Date());
  let cells='';
  for(let i=0;i<start;i++) cells+='<div class="cal-d empty"></div>';
  for(let d=1;d<=n;d++){
    const iso=year+'-'+D.pad2(month+1)+'-'+D.pad2(d);
    const has=marks.indexOf(iso)>=0;
    cells+=`<button class="cal-d ${iso===todayISO?'today':''} ${iso===selected?'sel':''}" data-date="${iso}"
      aria-label="${D.fmtDate(iso)}${has?', ada janji temu':''}">${d}${has?'<span class="pip"></span>':'<span style="height:4px"></span>'}</button>`;
  }
  return `<div class="cal-head">
      <button class="icon-btn" data-cal="-1" aria-label="Bulan sebelumnya" style="width:30px;height:30px">${icon('left')}</button>
      <b>${D.BULAN[month]} ${year}</b>
      <button class="icon-btn" data-cal="1" aria-label="Bulan berikutnya" style="width:30px;height:30px">${icon('right')}</button>
    </div>
    <div class="cal">${['M','S','S','R','K','J','S'].map(d=>`<div class="dow">${d}</div>`).join('')}${cells}</div>`;
}
window.DWcal=calendarHTML;

/* ============================================================
   JANJI TEMU
   ============================================================ */
const STATUS_CLS={Menunggu:'chip-warn',Terjadwal:'chip-ok',Berhasil:'chip-ok',Selesai:'chip-info',Dibatalkan:'chip-danger'};
const AKTIF_STATUS=['Menunggu','Terjadwal'];
function apptChip(s){ return `<span class="chip ${STATUS_CLS[s]||'chip-muted'}"><span class="dot"></span>${esc(s)}</span>`; }
function apptSort(a,b){ return (a.date+a.time) < (b.date+b.time) ? -1 : 1; }
function upcomingOf(list){
  const t=D.isoDate(new Date()), now=D.pad2(new Date().getHours())+':'+D.pad2(new Date().getMinutes());
  return list.filter(a=>AKTIF_STATUS.indexOf(a.status)>=0 && (a.date>t || (a.date===t && a.time>=now))).sort(apptSort);
}
function timeSlots(){ return ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00']; }
function slotTaken(proId,date,time,exceptId){
  return D.DB.appointments.some(a=>a.professionalId===proId && a.date===date && a.time===time &&
    a.status!=='Dibatalkan' && a.appointmentId!==exceptId);
}
function apptDetailModal(id,onChange){
  const a=D.DB.appointments.find(x=>x.appointmentId===id); if(!a) return;
  const sbgPasien = !D.isPro(D.me().role);
  const siapa = sbgPasien ? D.proName(a.professionalId) : D.patName(a.patientId);
  const sub = sbgPasien ? D.proSpec(a.professionalId) : ((D.patById(a.patientId)||{}).patientId||'');
  const aktif = AKTIF_STATUS.indexOf(a.status)>=0;
  const modeLabel = a.mode==='daring' ? 'Konsultasi daring' : (a.mode==='tatap' ? 'Tatap muka' : '—');
  const bd=openModal(`
    <div class="row" style="gap:12px;margin-bottom:15px">
      <span class="ib ib-brand" style="width:44px;height:44px;border-radius:13px">${icon(sbgPasien?'stetho':'user')}</span>
      <div style="min-width:0"><div style="font-family:var(--display);font-weight:800;font-size:1.02rem">${esc(siapa)}</div>
        <div class="tiny muted">${esc(sub)}</div></div>
    </div>
    <dl class="kv">
      <dt>Tanggal</dt><dd>${D.fmtDateFull(a.date)}</dd>
      <dt>Waktu</dt><dd class="tnum">${esc(a.time)} – ${esc(a.endTime||D.addMin(a.time,30))} WIB</dd>
      <dt>Jenis</dt><dd>${esc(a.type)}</dd>
      <dt>Bentuk</dt><dd>${esc(modeLabel)}</dd>
      <dt>Lokasi</dt><dd style="font-family:var(--body);font-weight:600">${esc(a.location)}</dd>
      <dt>Status</dt><dd>${apptChip(a.status)}</dd>
      ${a.bayar?`<dt>Pembayaran</dt><dd>${esc(D.rupiah(a.bayar.jumlah))} · ${esc(a.bayar.metodeLabel)}
        <span class="chip chip-ok" style="margin-left:6px;font-size:.64rem">${esc(a.bayar.status)}</span></dd>
        <dt>Nomor bayar</dt><dd class="mono" style="font-size:.76rem">${esc(a.bayar.ref)}</dd>`:''}
      ${a.notes?`<dt>Catatan</dt><dd style="font-weight:500;font-family:var(--body)">${esc(a.notes)}</dd>`:''}
    </dl>
    ${a.keluhan?`<div class="nota nota-info" style="margin-top:14px">${icon('note')}
      <div><b>Keluhan yang ditulis pasien.</b><br>${esc(a.keluhan)}</div></div>`:''}
    ${a.konsultasi?window.DWkonsulHasil(a):''}
    <div class="row wrap" style="margin-top:19px;gap:8px">
      ${sbgPasien ? (aktif ? `
        <button class="btn btn-ghost btn-sm" data-act="ubah">${icon('cal')} Ubah jadwal</button>
        <button class="btn btn-danger btn-sm" data-act="batal">${icon('x')} Batalkan</button>` : '')
      : (aktif ? `
        <button class="btn btn-primary btn-sm" data-act="konsul">${icon('stetho')} Buka ruang konsultasi</button>
        <button class="btn btn-ghost btn-sm" data-act="catatan">${icon('note')} Catatan</button>
        <button class="btn btn-danger btn-sm" data-act="batal">${icon('x')} Batalkan</button>` : '')}
      <button class="btn btn-quiet btn-sm" data-close style="margin-left:auto">Tutup</button>
    </div>`, {title:'Rincian janji temu'});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  const selesai=()=>{ D.saveDB(); closeModal(); onChange?onChange():rerender(); };
  $$('[data-act]',bd).forEach(b=>b.addEventListener('click',async()=>{
    const act=b.dataset.act;
    if(act==='batal'){
      if(await D.confirmModal('Batalkan janji temu?',
        'Janji temu akan dipindahkan ke daftar Dibatalkan. Riwayatnya tetap tersimpan.','Ya, batalkan','danger')){
        a.status='Dibatalkan';
        const pu=D.userOfPat(a.patientId);
        if(pu) D.pushNotif(pu.id,'Janji temu dibatalkan',esc(a.type)+' pada '+D.fmtDate(a.date)+' telah dibatalkan.','janji',false);
        toast('info','Janji temu dibatalkan');
        selesai();
      }
    } else if(act==='terima'){
      a.status='Terjadwal';
      const pu=D.userOfPat(a.patientId);
      if(pu) D.pushNotif(pu.id,'Janji temu disetujui','Jadwal '+D.fmtDate(a.date)+' pukul '+a.time+' sudah dikonfirmasi.','janji',false);
      toast('ok','Janji temu disetujui'); selesai();
    } else if(act==='selesai'){ a.status='Selesai'; toast('ok','Ditandai selesai'); selesai(); }
    else if(act==='konsul'){ closeModal(); go('pro.konsultasi',{id:a.appointmentId}); }
    else if(act==='ubah'){ closeModal(); rescheduleModal(a,onChange); }
    else if(act==='catatan'){ closeModal(); apptNoteModal(a,onChange); }
  }));
}
function rescheduleModal(a,onChange){
  const min=D.isoDate(new Date());
  const bd=openModal(`<div class="grid" style="gap:13px">
      <div class="field" data-f="date"><label for="rsD">Tanggal baru</label>
        <input class="inp" type="date" id="rsD" min="${min}" value="${a.date}"></div>
      <div class="field" data-f="time"><label>Jam baru</label>
        <div class="opts" id="rsT">${timeSlots().map(t=>`<label class="opt"><input type="radio" name="t" value="${t}"${t===a.time?' checked':''}><span class="tnum">${t}</span></label>`).join('')}</div></div>
      <div id="rsWarn"></div>
      <div class="row" style="justify-content:flex-end;gap:8px">
        <button class="btn btn-ghost btn-sm" data-close>Batal</button>
        <button class="btn btn-primary btn-sm" id="rsGo">Simpan jadwal baru</button>
      </div></div>`,{title:'Ubah jadwal'});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  $('#rsGo',bd).addEventListener('click',()=>{
    const d=$('#rsD',bd).value, tEl=bd.querySelector('input[name="t"]:checked'), w=$('#rsWarn',bd);
    w.innerHTML='';
    const err=m=>{ w.innerHTML='<div class="err">'+icon('alert')+'<span>'+m+'</span></div>'; };
    if(!d || !tEl) return err('Pilih tanggal dan jam terlebih dulu.');
    if(d<min) return err('Pilih hari ini atau tanggal setelahnya.');
    if(slotTaken(a.professionalId,d,tEl.value,a.appointmentId)) return err('Jam itu sudah terisi. Pilih jam lain.');
    a.date=d; a.time=tEl.value; a.endTime=D.addMin(tEl.value,30); a.status='Terjadwal';
    const pu=D.userOfPat(a.patientId);
    if(pu) D.pushNotif(pu.id,'Jadwal diperbarui','Janji temu Anda dipindah ke '+D.fmtDate(d)+' pukul '+tEl.value+'.','janji',false);
    D.saveDB(); closeModal(); toast('ok','Jadwal diperbarui',D.fmtDate(d)+' pukul '+tEl.value);
    onChange?onChange():rerender();
  });
}
function apptNoteModal(a,onChange){
  const bd=openModal(`<div class="field" data-f="n"><label for="anT">Catatan untuk janji temu ini</label>
      <textarea class="ta" id="anT" placeholder="Hasil pengamatan, rencana, atau instruksi tindak lanjut…">${esc(a.notes||'')}</textarea></div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:13px">
      <button class="btn btn-ghost btn-sm" data-close>Batal</button>
      <button class="btn btn-primary btn-sm" id="anGo">Simpan catatan</button></div>`,{title:'Catatan janji temu'});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
  $('#anGo',bd).addEventListener('click',()=>{
    a.notes=$('#anT',bd).value.trim(); D.saveDB(); closeModal(); toast('ok','Catatan tersimpan');
    onChange?onChange():rerender();
  });
}
function konsulHasil(a){
  const k=a.konsultasi; if(!k) return '';
  return `<div class="konsul-hasil">
    <div class="row spread wrap" style="gap:9px;margin-bottom:12px">
      <div class="row" style="gap:9px">
        <span class="ib ib-mint">${icon('check')}</span>
        <div><div style="font-family:var(--display);font-weight:800;font-size:.95rem">Hasil konsultasi</div>
          <div class="tiny muted">Dikirim ${D.relTime(k.dikirimAt)} oleh ${esc(D.proName(k.professionalId))}</div></div>
      </div>
      <span class="chip chip-ok"><span class="dot"></span>Berhasil</span>
    </div>
    ${k.penjelasan?`<div class="eyebrow">Penjelasan klinis</div>
      <p style="color:var(--ink-2);font-size:.87rem;line-height:1.65;margin:6px 0 14px">${esc(k.penjelasan)}</p>`:''}
    ${(k.resep&&k.resep.length)?`<div class="eyebrow">Resep obat</div>
      <div class="resep-list">${k.resep.map((r,i)=>`<div class="resep-item">
        <span class="ib ib-brand" style="width:30px;height:30px;border-radius:9px">${icon('pill')}</span>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--display);font-weight:700;font-size:.88rem">${esc(r.nama)}</div>
          ${(r.dosis||r.aturan)?`<div class="tiny muted">${[r.dosis,r.aturan].filter(Boolean).map(esc).join(' · ')}</div>`:''}
        </div>
        <span class="resep-n mono">${i+1}</span></div>`).join('')}</div>`:''}
    ${k.saran?`<div class="eyebrow" style="margin-top:14px">Saran perawatan di rumah</div>
      <p style="color:var(--ink-2);font-size:.87rem;line-height:1.65;margin-top:6px">${esc(k.saran)}</p>`:''}
    ${k.tindakLanjut?`<div class="eyebrow" style="margin-top:14px">Tindak lanjut</div>
      <div class="nota nota-brand" style="margin-top:6px">${icon('cal')}<div>${esc(k.tindakLanjut)}</div></div>`:''}
    <p class="tiny muted" style="margin-top:14px;line-height:1.55">
      Resep dan penjelasan ini ditulis oleh tenaga kesehatan yang menangani Anda. Ikuti aturan pakainya,
      dan hubungi kembali bila muncul keluhan baru.</p>
  </div>`;
}
window.DWkonsulHasil=konsulHasil;

/* hasil tinjauan asesmen — dipakai di sisi pasien maupun tenaga kesehatan */
function tinjauHasil(a){
  const t=a&&a.tinjauan; if(!t) return '';
  const rujuk=t.status==='dirujuk';
  const r=t.rujukan||{};
  return `<div class="konsul-hasil ${rujuk?'hasil-rujuk':''}">
    <div class="row spread wrap" style="gap:9px;margin-bottom:12px">
      <div class="row" style="gap:9px;min-width:0">
        <span class="ib ${rujuk?'ib-blush':'ib-mint'}">${icon(rujuk?'alert':'check')}</span>
        <div style="min-width:0"><div style="font-family:var(--display);font-weight:800;font-size:.95rem">
          ${rujuk?'Surat rujukan':'Catatan analisis'}</div>
          <div class="tiny muted">Dikirim ${D.relTime(t.dikirimAt)} oleh ${esc(D.proName(t.professionalId))}</div></div>
      </div>
      <span class="chip ${rujuk?'chip-danger':'chip-ok'}"><span class="dot"></span>${rujuk?'Dirujuk':'Aman'}</span>
    </div>
    ${rujuk?`<div class="rujuk-kop">
      <div class="row spread wrap" style="gap:8px">
        <span class="eyebrow">Nomor rujukan</span><span class="mono" style="font-size:.76rem">${esc(r.nomor||'—')}</span></div>
      <dl class="kv" style="margin-top:9px">
        <dt>Dirujuk ke</dt><dd>${esc(r.tujuan||'—')}</dd>
        <dt>Waktu</dt><dd>${esc(r.urgensiLabel||'—')}</dd>
      </dl>
      ${r.alasan?`<div style="margin-top:9px"><span class="eyebrow">Alasan</span>
        <p style="color:var(--ink-2);font-size:.85rem;line-height:1.65;margin-top:5px">${esc(r.alasan)}</p></div>`:''}
    </div>`:''}
    ${t.surat?`<div class="eyebrow" style="${rujuk?'margin-top:14px':''}">Catatan analisis</div>
      <p style="color:var(--ink-2);font-size:.87rem;line-height:1.65;margin:6px 0 0;white-space:pre-wrap">${esc(t.surat)}</p>`:''}
    ${t.rawat?`<div class="eyebrow" style="margin-top:14px">Anjuran perawatan</div>
      <p style="color:var(--ink-2);font-size:.87rem;line-height:1.65;margin-top:6px;white-space:pre-wrap">${esc(t.rawat)}</p>`:''}
    <p class="tiny muted" style="margin-top:14px;line-height:1.55">
      ${rujuk?'Bawa surat ini saat datang ke fasilitas yang dituju. Bila muncul demam, nyeri hebat, atau luka meluas sebelum jadwalnya, datang lebih cepat.'
             :'Lanjutkan perawatan seperti biasa dan kirim dokumentasi berikutnya sesuai pengingat. Hubungi tenaga kesehatan bila ada perubahan.'}</p>
  </div>`;
}
window.DWtinjauHasil=tinjauHasil;

/* lencana status tinjauan, dipakai di beberapa daftar */
function tinjauChip(a){
  const t=D.TINJAU[D.statusTinjau(a)];
  return `<span class="chip ${t.chip}">${icon(t.ikon)} ${t.label}</span>`;
}
window.DWtinjauChip=tinjauChip;

window.DWappt={apptChip,apptSort,upcomingOf,apptDetailModal,timeSlots,slotTaken,rescheduleModal,STATUS_CLS,AKTIF_STATUS};

/* ============================================================
   KOMPOSISI JARINGAN
   ============================================================ */
function tissueBar(v){
  v=v||{redPct:0,yellowPct:0,darkPct:0};
  return `<div class="tissue">
      <i style="width:${v.redPct}%;background:#B8443B"></i>
      <i style="width:${v.yellowPct}%;background:#C08D1C"></i>
      <i style="width:${v.darkPct}%;background:#3A3631"></i>
    </div>
    <div class="legend" style="margin-top:7px">
      <span><b style="background:#B8443B"></b>Merah muda ${v.redPct}%</span>
      <span><b style="background:#C08D1C"></b>Kekuningan ${v.yellowPct}%</span>
      <span><b style="background:#3A3631"></b>Gelap ${v.darkPct}%</span>
    </div>`;
}
window.DWtissue=tissueBar;

function emptyState(icn,judul,teks,btnLabel,btnRoute){
  return `<div class="empty-st"><span class="empty-art">${icon(icn)}</span>
    <h4>${esc(judul)}</h4>
    <p class="muted tiny">${esc(teks)}</p>
    ${btnLabel?`<button class="btn btn-primary btn-sm" data-go="${btnRoute}">${esc(btnLabel)}</button>`:''}</div>`;
}
window.DWempty=emptyState;
})();
