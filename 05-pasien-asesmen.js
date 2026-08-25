(function(){
'use strict';
const D=window.DW, {$,$$,esc,icon,toast,openModal,closeModal}=D;
const go=window.DWgo, route=window.DWroute, rerender=window.DWrerender;
const {shell,shellMount}=window.DWshell;
const {animateCounts}=window.DWchart;
const {woundStats,IND,indChip}=window.DWstats;
const {apptChip,apptSort,upcomingOf,apptDetailModal,timeSlots,slotTaken}=window.DWappt;
const emptyState=window.DWempty;
const PAS=['pasien'];

/* lebar bidang pandang yang diasumsikan bila pengguna belum mengkalibrasi (cm) */
const LEBAR_ASUMSI = 8;

/* ============================================================
   ANALISIS CITRA — dijalankan sepenuhnya di perangkat
   ============================================================ */
function rgb2hsv(r,g,b){
  r/=255;g/=255;b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let h=0;
  if(d){ h = mx===r ? 60*(((g-b)/d)%6) : mx===g ? 60*(((b-r)/d)+2) : 60*(((r-g)/d)+4); }
  if(h<0) h+=360;
  return [h, mx?d/mx:0, mx];
}
function loadImg(src){
  return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
}
function downscale(img,maxW,quality){
  const s=Math.min(1,maxW/img.naturalWidth);
  const w=Math.round(img.naturalWidth*s), h=Math.round(img.naturalHeight*s);
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').drawImage(img,0,0,w,h);
  return c.toDataURL('image/jpeg',quality||0.74);
}
function analyzePixels(img, cmPerLebar){
  const N=180, c=document.createElement('canvas'); c.width=N; c.height=N;
  const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(img,0,0,N,N);
  const dat=x.getImageData(0,0,N,N).data;

  /* mutu foto: kecerahan + ketajaman tepi */
  const gray=new Float32Array(N*N);
  let sum=0;
  for(let i=0,p=0;i<dat.length;i+=4,p++){ const g=dat[i]*0.299+dat[i+1]*0.587+dat[i+2]*0.114; gray[p]=g; sum+=g; }
  const rata=sum/(N*N);
  let tepi=0;
  for(let yy=1;yy<N-1;yy++) for(let xx=1;xx<N-1;xx++){
    const p=yy*N+xx;
    tepi += Math.abs(gray[p]-gray[p-1]) + Math.abs(gray[p]-gray[p-N]);
  }
  const tajam = tepi/((N-2)*(N-2));
  const mutu = { kecerahan:+rata.toFixed(1), ketajaman:+tajam.toFixed(2), masalah:[] };
  if(rata<58) mutu.masalah.push('Foto terlihat terlalu gelap. Coba cari cahaya alami yang lebih merata.');
  else if(rata>212) mutu.masalah.push('Foto terlalu terang. Hindari lampu kilat langsung ke arah luka.');
  if(tajam<2.2) mutu.masalah.push('Foto terlihat buram. Tahan tangan sejenak dan ketuk layar untuk memfokuskan.');
  mutu.ok = mutu.masalah.length===0;

  /* warna kulit acuan diambil dari pinggir bingkai */
  const kemerahan=new Float32Array(N*N);
  const pinggir=[];
  for(let yy=0;yy<N;yy++) for(let xx=0;xx<N;xx++){
    const p=yy*N+xx, i=p*4;
    kemerahan[p]=(dat[i]-(dat[i+1]+dat[i+2])/2)/255;
    if(xx<N*0.10 || xx>N*0.90 || yy<N*0.10 || yy>N*0.90) pinggir.push(kemerahan[p]);
  }
  pinggir.sort((a,b)=>a-b);
  const acuanKulit = pinggir.length? pinggir[Math.floor(pinggir.length*0.5)] : 0.1;

  /* penandaan piksel luka di dalam oval panduan */
  const cx=N/2, cy=N/2, rx=N*0.44, ry=N*0.44;
  let dalamOval=0;
  const mask=new Uint8Array(N*N);
  for(let yy=0;yy<N;yy++) for(let xx=0;xx<N;xx++){
    const p=yy*N+xx;
    const dx=(xx-cx)/rx, dy=(yy-cy)/ry;
    if(dx*dx+dy*dy>1) continue;
    dalamOval++;
    const i=p*4;
    const hsv=rgb2hsv(dat[i],dat[i+1],dat[i+2]);
    const h=hsv[0], s=hsv[1], v=hsv[2];
    const gelap  = v<0.24 && s<0.62;
    const kuning = h>=32 && h<=68 && s>0.34 && v>0.32;
    const merah  = kemerahan[p] > acuanKulit+0.085 && s>0.24;
    if(gelap||kuning||merah) mask[p]=1;
  }
  /* buang bintik terisolasi */
  let bersih=0, cM=0,cK=0,cG=0;
  for(let yy=1;yy<N-1;yy++) for(let xx=1;xx<N-1;xx++){
    const p=yy*N+xx; if(!mask[p]) continue;
    if(mask[p-1]+mask[p+1]+mask[p-N]+mask[p+N] < 2){ mask[p]=0; continue; }
    bersih++;
    const i=p*4, hsv=rgb2hsv(dat[i],dat[i+1],dat[i+2]);
    if(hsv[2]<0.24&&hsv[1]<0.62) cG++;
    else if(hsv[0]>=32&&hsv[0]<=68&&hsv[1]>0.34&&hsv[2]>0.32) cK++;
    else cM++;
  }
  /* luas bidang pandang dihitung dari kalibrasi bila ada */
  const lebar = cmPerLebar || LEBAR_ASUMSI;
  const rasio = img.naturalHeight/img.naturalWidth;
  const luasBingkai = lebar*lebar*rasio;
  const luas = D.clamp(+((bersih/(N*N))*luasBingkai).toFixed(1), 0.1, 90);
  const tot = bersih||1;
  const merahPct=Math.round(cM/tot*100), kuningPct=Math.round(cK/tot*100);
  const gelapPct=Math.max(0,100-merahPct-kuningPct);
  return {
    mutu, luas, luasBingkai:+luasBingkai.toFixed(1), terdeteksi: bersih>(dalamOval*0.012),
    cakupan:+((bersih/Math.max(dalamOval,1))*100).toFixed(1),
    visual:{ redPct:merahPct, yellowPct:kuningPct, darkPct:gelapPct,
      summary:[
        merahPct>=50?'Didominasi jaringan merah muda':(kuningPct>=merahPct?'Didominasi area kekuningan':'Tampilan bercampur'),
        kuningPct>=12?'Terdeteksi area kekuningan':'Area kekuningan minimal',
        gelapPct>=6?'Terdeteksi area gelap':'Area gelap minimal' ] }
  };
}
/* aturan penilaian — setiap penanda menyebutkan alasannya sendiri */
function tentukanIndikator(res,luasSebelum,keluhan,mingguSejakAwal,perubahanDariAwal,terkalibrasi){
  const alasan=[]; let level='stabil';
  const naik=l=>{ const o={stabil:0,pantau:1,periksa:2}; if(o[l]>o[level]) level=l; };
  const v=res.visual;
  if(v.darkPct>=10){ naik('periksa'); alasan.push('Area gelap menutupi sekitar '+v.darkPct+'% bagian luka yang terdeteksi.'); }
  else if(v.darkPct>=5){ naik('pantau'); alasan.push('Terdeteksi sebagian area gelap ('+v.darkPct+'% dari area luka).'); }
  if(v.yellowPct>=35){ naik('periksa'); alasan.push('Area kekuningan cukup luas, sekitar '+v.yellowPct+'%.'); }
  else if(v.yellowPct>=18){ naik('pantau'); alasan.push('Area kekuningan berada di angka '+v.yellowPct+'%.'); }
  if(luasSebelum!=null){
    const ch=((res.luas-luasSebelum)/luasSebelum)*100;
    if(ch>8){ naik('periksa'); alasan.push('Perkiraan luas luka bertambah '+D.n0(ch)+'% dibanding dokumentasi sebelumnya.'); }
    else if(ch>-3){ naik('pantau'); alasan.push('Perkiraan luas luka hampir tidak berubah dibanding dokumentasi sebelumnya.'); }
  }
  if(mingguSejakAwal>=3.5 && perubahanDariAwal>-50){
    naik('periksa');
    alasan.push('Penyusutan kurang dari 50% setelah sekitar empat minggu — ambang yang lazim dipakai untuk meninjau ulang perawatan.');
  }
  const k=keluhan||[];
  if(k.indexOf('Keluar cairan')>=0 && k.indexOf('Kemerahan')>=0){ naik('pantau'); alasan.push('Anda melaporkan cairan sekaligus kemerahan.'); }
  if(k.indexOf('Perubahan warna')>=0){ naik('pantau'); alasan.push('Anda melaporkan adanya perubahan warna di sekitar luka.'); }
  if(k.indexOf('Bau tidak sedap')>=0){ naik('periksa'); alasan.push('Anda melaporkan bau tidak sedap dari luka.'); }
  if(!res.mutu.ok) alasan.push('Mutu foto ditandai bermasalah, sehingga perkiraan luas kali ini kurang dapat diandalkan.');
  if(!terkalibrasi) alasan.push('Foto belum dikalibrasi dengan benda acuan, jadi ukuran masih memakai perkiraan jarak pemotretan.');
  if(!alasan.length) alasan.push('Tidak ada aturan penilaian yang terpicu oleh dokumentasi ini.');
  return {level,alasan};
}

/* ============================================================
   KAMERA LANGSUNG
   ============================================================ */
const CAM={stream:null,facing:'environment',siap:false,ditolak:false,pesan:''};
function matikanKamera(){
  if(CAM.stream){ CAM.stream.getTracks().forEach(t=>{ try{t.stop();}catch(e){} }); CAM.stream=null; }
  CAM.siap=false;
}
window.DWmatikanKamera=matikanKamera;

async function nyalakanKamera(){
  const v=$('#camVid'); if(!v) return;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    CAM.ditolak=true; CAM.pesan='Peramban ini tidak mendukung akses kamera langsung.'; redraw(); return;
  }
  matikanKamera();
  try{
    CAM.stream=await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ideal:CAM.facing}, width:{ideal:1280}, height:{ideal:960} }, audio:false });
    const vid=$('#camVid'); if(!vid){ matikanKamera(); return; }
    vid.srcObject=CAM.stream;
    vid.style.transform = CAM.facing==='user' ? 'scaleX(-1)' : 'none';
    await vid.play().catch(()=>{});
    CAM.siap=true; CAM.ditolak=false;
    window.__tinggalkanHalaman=matikanKamera;
    const st=$('#camStatus'); if(st) st.remove();
    const wrap=$('#camWrap'); if(wrap) wrap.classList.add('siap');
  }catch(e){
    CAM.ditolak=true;
    CAM.pesan = (e && (e.name==='NotAllowedError'||e.name==='SecurityError'))
      ? 'Izin kamera belum diberikan. Aktifkan izin kamera untuk situs ini, atau pilih foto dari galeri.'
      : 'Kamera tidak dapat dibuka di perangkat ini. Silakan pilih foto dari galeri.';
    redraw();
  }
}
function ambilFrame(){
  const v=$('#camVid'); if(!v || !v.videoWidth) return null;
  const c=document.createElement('canvas');
  c.width=v.videoWidth; c.height=v.videoHeight;
  const x=c.getContext('2d');
  if(CAM.facing==='user'){ x.translate(c.width,0); x.scale(-1,1); }
  x.drawImage(v,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.9);
}

/* ============================================================
   ALAT UKUR — dua titik, dengan kalibrasi benda acuan
   ============================================================ */
const UK={ titik:[], silang:{x:.5,y:.5}, mode:'ukur', acuan:'rp1000', cmPerLebar:null, hasilCm:null };
function resetUkur(){ UK.titik=[]; UK.silang={x:.5,y:.5}; UK.hasilCm=null; }
function acuanAktif(){ return D.ACUAN.find(a=>a.id===UK.acuan)||D.ACUAN[0]; }
function jarakRel(a,b,rect){
  const dx=(a.x-b.x)*rect.width, dy=(a.y-b.y)*rect.height;
  return Math.hypot(dx,dy);
}
function ukurHTML(src){
  const t=UK.titik, ada=t.length;
  const garis = ada===2
    ? `<svg class="ukur-svg" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
         <line x1="${t[0].x*100}" y1="${t[0].y*100}" x2="${t[1].x*100}" y2="${t[1].y*100}"
           stroke="var(--brand-2)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round"/>
       </svg>` : '';
  const titikEl = t.map((p,i)=>`<span class="ukur-pt" style="left:${p.x*100}%;top:${p.y*100}%"><b>${i?'B':'A'}</b></span>`).join('');
  const label = UK.hasilCm!=null
    ? `<span class="ukur-nilai" style="left:${((t[0].x+t[1].x)/2)*100}%;top:${((t[0].y+t[1].y)/2)*100}%">${D.n1(UK.hasilCm)} cm</span>` : '';
  return `<div class="ukur ${ada>=2?'selesai':''}" id="ukurBox">
      <img id="ukurImg" src="${src}" alt="Foto luka untuk diukur" draggable="false">
      ${garis}${titikEl}${label}
      <span class="ukur-silang" id="ukurSilang" style="left:${UK.silang.x*100}%;top:${UK.silang.y*100}%"></span>
    </div>`;
}
function panelUkur(){
  const a=acuanAktif();
  const langkah = UK.mode==='kalibrasi'
    ? ['Geser tanda silang ke tepi kiri '+a.label.toLowerCase()+', lalu tekan tombol +.',
       'Geser ke tepi seberangnya, lalu tekan + sekali lagi.']
    : ['Geser tanda silang ke ujung awal luka, lalu tekan tombol +.',
       'Geser ke ujung satunya, lalu tekan + sekali lagi.'];
  const n=UK.titik.length;
  return `<div class="ukur-panel">
    <div class="segs" style="width:100%">
      <button class="seg ${UK.mode==='ukur'?'on':''}" data-mode="ukur" style="flex:1">${icon('ruler')} Ukur luka</button>
      <button class="seg ${UK.mode==='kalibrasi'?'on':''}" data-mode="kalibrasi" style="flex:1">${icon('spark')} Kalibrasi</button>
    </div>
    ${UK.mode==='kalibrasi'?`
      <div class="field" style="margin-top:11px">
        <label for="acuanSel">Benda acuan yang Anda letakkan di samping luka</label>
        <select class="sel" id="acuanSel">${D.ACUAN.map(x=>
          `<option value="${x.id}"${x.id===UK.acuan?' selected':''}>${esc(x.label)} — ${esc(x.ket)}</option>`).join('')}</select>
      </div>`:''}
    <p class="ukur-arah">${icon(n<2?'right':'check')} <span>${n<2?esc(langkah[n]):(UK.mode==='kalibrasi'?'Kalibrasi tersimpan.':'Hasil pengukuran muncul di foto.')}</span></p>
    <div class="ukur-aksi">
      <button class="btn btn-ghost btn-sm" id="ukurUlang">${icon('refresh')} Ulangi</button>
      <button class="ukur-plus" id="ukurTambah" aria-label="Tandai titik di posisi tanda silang" ${n>=2?'disabled':''}>
        ${icon('plus')}<span>${n===0?'Titik awal':(n===1?'Titik akhir':'Selesai')}</span></button>
    </div>
    <div class="ukur-hasil">
      ${UK.cmPerLebar
        ? `<span class="chip chip-ok"><span class="dot"></span>Terkalibrasi · lebar foto ${D.n1(UK.cmPerLebar)} cm</span>`
        : `<span class="chip chip-warn"><span class="dot"></span>Belum dikalibrasi · dianggap ${LEBAR_ASUMSI} cm</span>`}
      ${UK.mode==='ukur'&&UK.hasilCm!=null
        ? `<span class="chip chip-brand">${icon('ruler')} Panjang ${D.n1(UK.hasilCm)} cm</span>`:''}
    </div>
  </div>`;
}
function pasangUkur(){
  const box=$('#ukurBox'); if(!box) return;
  const silang=$('#ukurSilang');
  const set=(x,y)=>{ UK.silang={x:D.clamp(x,0,1),y:D.clamp(y,0,1)};
    silang.style.left=(UK.silang.x*100)+'%'; silang.style.top=(UK.silang.y*100)+'%'; };
  const dari=e=>{ const r=box.getBoundingClientRect();
    set(((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width,
        ((e.touches?e.touches[0].clientY:e.clientY)-r.top)/r.height); };
  let seret=false;
  const gerak=e=>{ if(seret) dari(e); };
  const lepas=()=>{ seret=false;
    window.removeEventListener('pointermove',gerak);
    window.removeEventListener('pointerup',lepas);
    window.removeEventListener('pointercancel',lepas); };
  box.addEventListener('pointerdown',e=>{
    seret=true; dari(e); e.preventDefault();
    window.addEventListener('pointermove',gerak);
    window.addEventListener('pointerup',lepas);
    window.addEventListener('pointercancel',lepas); });
  box.setAttribute('tabindex','0');
  box.addEventListener('keydown',e=>{
    const l=e.shiftKey?0.05:0.01;
    if(e.key==='ArrowLeft'){ set(UK.silang.x-l,UK.silang.y); e.preventDefault(); }
    if(e.key==='ArrowRight'){ set(UK.silang.x+l,UK.silang.y); e.preventDefault(); }
    if(e.key==='ArrowUp'){ set(UK.silang.x,UK.silang.y-l); e.preventDefault(); }
    if(e.key==='ArrowDown'){ set(UK.silang.x,UK.silang.y+l); e.preventDefault(); }
    if(e.key==='Enter'||e.key===' '){ tambahTitik(); e.preventDefault(); }
  });
  const tambah=$('#ukurTambah'); if(tambah) tambah.addEventListener('click',tambahTitik);
  const ulang=$('#ukurUlang'); if(ulang) ulang.addEventListener('click',()=>{ UK.titik=[]; UK.hasilCm=null; redraw(); });
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    UK.mode=b.dataset.mode; UK.titik=[]; UK.hasilCm=null; redraw();
  }));
  const sel=$('#acuanSel'); if(sel) sel.addEventListener('change',()=>{ UK.acuan=sel.value; });
}
function tambahTitik(){
  const box=$('#ukurBox'); if(!box) return;
  if(UK.titik.length>=2) return;
  UK.titik.push({x:UK.silang.x,y:UK.silang.y});
  if(UK.titik.length===2){
    const rect=box.getBoundingClientRect();
    const px=jarakRel(UK.titik[0],UK.titik[1],rect);
    if(px<6){
      UK.titik=[]; toast('warn','Dua titik terlalu dekat','Beri jarak yang jelas antara titik awal dan titik akhir.');
      redraw(); return;
    }
    if(UK.mode==='kalibrasi'){
      const a=acuanAktif();
      UK.cmPerLebar = +(((a.mm/10) * rect.width) / px).toFixed(2);
      UK.titik=[]; UK.hasilCm=null;
      toast('ok','Kalibrasi tersimpan','Lebar foto setara '+D.n1(UK.cmPerLebar)+' cm. Ukuran kini memakai patokan ini.');
      UK.mode='ukur';
    } else {
      const lebar = UK.cmPerLebar || LEBAR_ASUMSI;
      UK.hasilCm = +((px/rect.width)*lebar).toFixed(2);
      toast('ok','Panjang terukur', D.n1(UK.hasilCm)+' cm'+(UK.cmPerLebar?'':' (perkiraan, belum dikalibrasi)'));
    }
  }
  redraw();
}

/* ============================================================
   ALUR ASESMEN
   ============================================================ */
let AS=null;
function resetAS(){
  AS={step:1,info:{location:'',duration:'',symptoms:[]},image:'',res:null,keputusan:null};
  resetUkur(); UK.cmPerLebar=null; UK.mode='ukur';
}
const NAMA_LANGKAH=['Data luka','Panduan foto','Ambil foto','Analisis','Hasil'];
const LOKASI=['Jari kaki','Telapak kaki','Tumit','Punggung kaki','Pergelangan kaki','Lainnya'];
const LAMA=['Kurang dari 1 minggu','1–4 minggu','1–3 bulan','Lebih dari 3 bulan'];
const KELUHAN=['Nyeri','Bengkak','Keluar cairan','Kemerahan','Perubahan warna','Bau tidak sedap','Tidak ada keluhan'];

route('pat.assess',{auth:true,roles:PAS,render(){
  if(!AS) resetAS();
  const p=D.myPatient(), w=D.patWounds(p.patientId)[0];
  /* setiap dokumentasi harus ada yang membacanya, jadi pasien perlu
     terhubung dengan satu tenaga kesehatan sebelum mengirim yang pertama */
  if(!D.punyaPendamping(p.patientId)) return shell('pat.assess','Asesmen Baru',
    'Hubungkan diri dengan tenaga kesehatan dulu', gerbangJanji());
  if(w && AS.step===1 && !AS.info.location){
    AS.info={location:w.location,duration:w.duration,symptoms:(w.symptoms||[]).slice()};
  }
  const body=`
    <div class="card wizard" style="max-width:840px;margin:0 auto">
      <div class="steps-bar">${NAMA_LANGKAH.map((_,i)=>`<i class="${AS.step>i?'on':''}"></i>`).join('')}</div>
      <div class="row spread wrap" style="margin-bottom:17px;gap:10px">
        <div><span class="eyebrow" id="asStep">Langkah ${AS.step} dari 5</span>
          <h2 style="font-size:1.26rem;margin-top:4px" id="asTitle">${NAMA_LANGKAH[AS.step-1]}</h2></div>
        <span class="chip chip-brand">${icon('scan')} Analisis citra</span>
      </div>
      <div id="asBody">${stepHTML(AS.step)}</div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pat.assess','Asesmen Baru','Dokumentasi terpandu dengan analisis citra',body);
},mount(){
  shellMount();
  if($('#gerbangBtn')){ window.DWbindUmum(); return; }
  bindStep();
}});

/* layar gerbang: muncul selama pasien belum punya tenaga kesehatan pendamping */
function gerbangJanji(){
  const langkah=[
    ['users','Pilih tenaga kesehatan','Ada dokter dan perawat luka yang sudah tersedia di dalam aplikasi. Pilih satu yang paling dekat atau paling sesuai.'],
    ['cal','Atur jadwal dan tulis keluhan','Tentukan bentuk konsultasi, tanggal, dan jam, lalu ceritakan keluhan Anda dengan bahasa sendiri.'],
    ['camera','Baru kirim dokumentasi luka','Setelah terhubung, setiap foto luka yang Anda kirim akan dibaca dan ditanggapi oleh tenaga kesehatan itu.']
  ];
  return `
    <div class="card gerbang" style="max-width:760px;margin:0 auto">
      <span class="ib ib-brand" style="width:52px;height:52px;border-radius:16px">${icon('stetho')}</span>
      <h2 style="font-size:1.28rem;margin-top:15px">Hubungkan diri dengan tenaga kesehatan dulu</h2>
      <p style="color:var(--ink-2);font-size:.9rem;line-height:1.68;margin-top:9px;max-width:52ch">
        DIWACARE tidak menilai luka sendirian. Setiap dokumentasi yang Anda kirim dibaca oleh dokter atau perawat
        yang menangani Anda, lalu ditanggapi dengan catatan analisis. Karena itu janji temu dibuat lebih dulu —
        supaya hasil pemantauan Anda tidak berhenti sebagai angka di layar.</p>
      <ol class="gerbang-langkah">
        ${langkah.map((x,i)=>`<li style="--i:${i}">
          <span class="ib ib-mint">${icon(x[0])}</span>
          <div><b>${esc(x[1])}</b><span>${esc(x[2])}</span></div>
          <em class="mono">${i+1}</em></li>`).join('')}
      </ol>
      <div class="row wrap" style="gap:9px;margin-top:20px">
        <button class="btn btn-primary btn-lg" id="gerbangBtn" data-go="pat.appts">${icon('plus')} Buat janji temu sekarang</button>
        <button class="btn btn-ghost btn-lg" data-go="pat.edu">${icon('book')} Baca dulu panduannya</button>
      </div>
      <div class="nota nota-info" style="margin-top:18px">${icon('info')}
        <div>Konsultasi daring maupun tatap muka sama-sama bisa dipilih. Setelah janji temu pertama terbuat,
          halaman ini langsung berubah menjadi alur pemotretan lima langkah.</div></div>
    </div>
    ${window.DWdisclaimer}`;
}

function stepHTML(s){
  if(s===1) return step1();
  if(s===2) return step2();
  if(s===3) return step3();
  if(s===4) return step4();
  return step5();
}
function pill(n,list,t,cur){
  return `<div class="opts">`+list.map(o=>`<label class="opt ${t==='checkbox'?'sq':''}">
    <input type="${t}" name="${n}" value="${esc(o)}"${t==='checkbox'?' data-multi="1"':''}${
      t==='checkbox'?((cur||[]).indexOf(o)>=0?' checked':''):(cur===o?' checked':'')}>
    <span>${esc(o)}</span></label>`).join('')+`</div>`;
}
function step1(){
  return `<form id="s1" class="grid" style="gap:19px">
    <div class="field" data-f="location"><label>Di bagian mana lukanya? <span class="req">*</span></label>${pill('location',LOKASI,'radio',AS.info.location)}</div>
    <div class="field" data-f="duration"><label>Sudah berapa lama ada? <span class="req">*</span></label>${pill('duration',LAMA,'radio',AS.info.duration)}</div>
    <div class="field" data-f="symptoms"><label>Keluhan yang Anda rasakan <span class="req">*</span></label>${pill('symptoms',KELUHAN,'checkbox',AS.info.symptoms)}
      <span class="hint">Pilih semua yang sesuai. Jika tidak ada keluhan sama sekali, pilih “Tidak ada keluhan”.</span></div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Lanjut ${icon('right')}</button>
  </form>`;
}
function step2(){
  const tips=[
    ['sun','Cahaya cukup','Cahaya alami dekat jendela lebih baik daripada lampu kilat.'],
    ['scan','Fokus tajam','Ketuk layar tepat di area luka sebelum memotret.'],
    ['eye','Sudut sama','Potret lurus dari depan, dengan cara yang sama setiap kali.'],
    ['pin','Jarak sama','Isi oval panduan tanpa memotong tepi luka.'],
    ['ruler','Benda acuan','Letakkan uang logam Rp1.000 di samping luka agar ukuran bisa dikalibrasi.'],
    ['refresh','Posisi sama','Posisi kaki yang sama membuat perbandingan antarminggu jadi adil.']
  ];
  return `<div class="grid" style="gap:19px">
    <div class="row wrap" style="gap:20px;align-items:flex-start">
      <div class="guide-vf" style="flex:0 0 auto"><div class="ring"></div><div class="coin">Rp<br>1000</div></div>
      <div style="flex:1;min-width:230px">
        <h3 style="font-size:1.02rem;margin-bottom:6px">Ambil foto yang konsisten</h3>
        <p class="tiny muted" style="line-height:1.6;margin-bottom:13px">
          Konsistensi lebih menentukan daripada kualitas kamera. Uang logam di samping luka bukan sekadar hiasan —
          aplikasi memakainya untuk mengubah piksel menjadi sentimeter.</p>
        <div class="grid" style="gap:8px">
          ${tips.map(t=>`<div class="row" style="gap:10px;align-items:flex-start">
            <span class="ib ib-mint" style="width:26px;height:26px;border-radius:8px">${icon(t[0])}</span>
            <div style="flex:1"><div style="font-family:var(--display);font-weight:700;font-size:.85rem">${t[1]}</div>
            <div class="tiny muted" style="line-height:1.45">${t[2]}</div></div></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="row" style="gap:9px">
      <button class="btn btn-ghost" data-back>${icon('left')} Kembali</button>
      <button class="btn btn-primary" style="flex:1" data-next>Buka kamera ${icon('camera')}</button>
    </div>
  </div>`;
}
function step3(){
  if(AS.image){
    return `<div class="grid" style="gap:15px">
      ${ukurHTML(AS.image)}
      ${panelUkur()}
      <div class="row wrap" style="gap:9px">
        <button class="btn btn-ghost" id="retake">${icon('refresh')} Ambil ulang</button>
        <button class="btn btn-primary" style="flex:1" data-next>Lanjut ke analisis ${icon('right')}</button>
      </div>
    </div>`;
  }
  if(CAM.ditolak){
    return `<div class="grid" style="gap:15px">
      <div class="cam-tolak">
        <span class="ib ib-butter" style="width:40px;height:40px;border-radius:13px">${icon('alert')}</span>
        <div><div style="font-family:var(--display);font-weight:700;font-size:.92rem">Kamera tidak bisa dibuka</div>
          <p class="tiny muted" style="line-height:1.55;margin-top:3px">${esc(CAM.pesan)}</p></div>
      </div>
      <div class="form-grid two">
        <label class="upload-zone" for="camIn">
          <span class="ib ib-brand" style="margin:0 auto 9px;width:40px;height:40px;border-radius:13px">${icon('camera')}</span>
          <div style="font-family:var(--display);font-weight:800;font-size:.92rem">Kamera bawaan</div>
          <div class="tiny muted" style="margin-top:2px">Pakai aplikasi kamera perangkat</div>
          <input id="camIn" type="file" accept="image/*" capture="environment" class="sr">
        </label>
        <label class="upload-zone" for="upIn">
          <span class="ib ib-sky" style="margin:0 auto 9px;width:40px;height:40px;border-radius:13px">${icon('upload')}</span>
          <div style="font-family:var(--display);font-weight:800;font-size:.92rem">Pilih dari galeri</div>
          <div class="tiny muted" style="margin-top:2px">Ambil foto yang sudah ada</div>
          <input id="upIn" type="file" accept="image/*" class="sr">
        </label>
      </div>
      <div class="row" style="gap:9px">
        <button class="btn btn-quiet btn-sm" data-back>${icon('left')} Kembali</button>
        <button class="btn btn-ghost btn-sm" id="camUlang" style="margin-left:auto">${icon('refresh')} Coba kamera lagi</button>
      </div>
    </div>`;
  }
  return `<div class="grid" style="gap:14px">
    <div class="cam" id="camWrap">
      <video id="camVid" playsinline muted autoplay></video>
      <div class="cam-guide" aria-hidden="true">
        <span class="ring"></span>
        <i></i><i></i><i></i><i></i>
      </div>
      <div class="cam-status" id="camStatus"><span class="spin"></span> Menyalakan kamera…</div>
      <button class="cam-flip" id="camFlip" aria-label="Ganti kamera depan atau belakang">${icon('refresh')}</button>
      <span class="cam-tag">${CAM.facing==='user'?'Kamera depan':'Kamera belakang'}</span>
    </div>
    <div class="cam-bar">
      <label class="cam-side" for="upIn" title="Pilih dari galeri">${icon('upload')}<input id="upIn" type="file" accept="image/*" class="sr"></label>
      <button class="cam-shutter" id="camShot" aria-label="Ambil foto"><span></span></button>
      <button class="cam-side" data-back aria-label="Kembali ke panduan">${icon('left')}</button>
    </div>
    <p class="tiny muted" style="text-align:center;line-height:1.6">
      Isi oval panduan dengan luka, sertakan uang logam di sampingnya, lalu tekan tombol putih.<br>
      Foto diproses di perangkat ini dan tidak dikirim ke mana pun.</p>
  </div>`;
}
function step4(){
  const tahap=['Memeriksa mutu foto','Menandai area luka','Menghitung perkiraan luas','Membaca komposisi warna','Membandingkan dengan riwayat'];
  return `<div class="grid" style="gap:16px">
    <div class="row wrap" style="gap:19px;align-items:flex-start">
      <div style="flex:1;min-width:220px">
        <div class="scan"><img src="${AS.image}" alt="Foto sedang dianalisis">
          <div class="scan-grid"></div><div class="scan-line"></div>
          <div class="scan-corner"><i></i><i></i><i></i><i></i></div></div>
      </div>
      <div style="flex:1;min-width:220px">
        <div class="eyebrow" style="margin-bottom:9px">Sedang menganalisis</div>
        <div class="cv-stages" id="cvStages">
          ${tahap.map((s,i)=>`<div class="cv-st" data-i="${i}"><span class="ic">${i+1}</span><span class="nm">${s}</span><span class="sp"></span></div>`).join('')}
        </div>
        <p class="tiny muted" style="margin-top:13px;line-height:1.55">
          Seluruh perhitungan berjalan di peramban Anda. Tidak ada foto yang dikirim ke server.</p>
      </div>
    </div>
  </div>`;
}
function step5(){
  const r=AS.res, d=AS.keputusan;
  if(!r||!d) return `<div class="empty-st"><span class="empty-art">${icon('alert')}</span>
    <h4>Belum ada hasil</h4><p class="muted tiny">Analisis tidak selesai. Silakan ulangi dari awal.</p>
    <button class="btn btn-primary btn-sm" id="redo">Ulangi</button></div>`;
  const ind=IND[d.level];
  const p=D.myPatient(), st=woundStats(p.patientId);
  const tint={stabil:'var(--ok-tint)',pantau:'var(--warn-tint)',periksa:'var(--danger-tint)'};
  return `<div class="grid" style="gap:16px">
    ${!r.terdeteksi?`<div class="nota nota-warn">${icon('alert')}
      <div><b>Keyakinan rendah.</b> Sangat sedikit jaringan menyerupai luka yang terdeteksi di dalam oval panduan.
      Perkiraan di bawah ini mungkin kurang berarti — pertimbangkan memotret ulang dengan luka tepat di tengah bingkai.</div></div>`:''}
    ${!r.mutu.ok?`<div class="nota nota-info">${icon('info')}
      <div><b>Catatan mutu foto.</b> ${r.mutu.masalah.map(esc).join(' ')}</div></div>`:''}

    <div class="hasil-grid">
      <div><div class="scan"><img src="${AS.image}" alt="Foto luka yang dianalisis"></div></div>
      <div>
        <div class="eyebrow">Perkiraan luas luka</div>
        <div class="metric-big" style="margin:5px 0 3px"><span data-count="${r.luas}" data-dec="1">0,0</span> <small>cm²</small></div>
        <p class="tiny muted" style="font-style:italic">Hasil perkiraan dari analisis foto, bukan pengukuran klinis.</p>
        <div class="row wrap" style="gap:7px;margin-top:11px">
          ${st?`<span class="chip chip-muted">Sebelumnya ${D.n1(st.last.woundArea)} cm²</span>
            <span class="chip ${r.luas<st.last.woundArea?'chip-ok':'chip-warn'}">
              ${r.luas<st.last.woundArea?'▼':'▲'} ${D.n0(Math.abs(((r.luas-st.last.woundArea)/st.last.woundArea)*100))}%</span>`
            :'<span class="chip chip-muted">Dokumentasi pertama</span>'}
          ${UK.hasilCm!=null?`<span class="chip chip-brand">${icon('ruler')} Panjang ${D.n1(UK.hasilCm)} cm</span>`:''}
          <span class="chip ${UK.cmPerLebar?'chip-ok':'chip-warn'}"><span class="dot"></span>${UK.cmPerLebar?'Terkalibrasi':'Belum dikalibrasi'}</span>
        </div>
        <div style="margin-top:18px" class="eyebrow">Komposisi warna</div>
        <div style="margin-top:8px">${window.DWtissue(r.visual)}</div>
        <ul class="poin">${r.visual.summary.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="card card-rule" style="--rule:${ind.color};background:${tint[d.level]};border-color:transparent">
      <div class="card-head"><div class="card-title">Status pemantauan</div>${indChip(d.level)}</div>
      <p style="color:var(--ink-2);font-size:.9rem;line-height:1.55">${esc(ind.text)}</p>
      <div class="eyebrow" style="margin-top:15px">Dasar penilaian</div>
      <ul class="poin">${d.alasan.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      <p class="tiny" style="margin-top:13px;color:var(--ink-2);opacity:.8">
        Status ini disusun dari aturan yang tertulis di atas. Ia bukan diagnosis.</p>
    </div>

    <div class="row wrap" style="gap:9px">
      <button class="btn btn-ghost" id="redo">${icon('refresh')} Ulangi</button>
      <button class="btn btn-primary" style="flex:1" id="saveAs">${icon('check')} Simpan ke riwayat luka</button>
    </div>
  </div>`;
}

function redraw(){
  const b=$('#asBody'); if(!b) return;
  b.innerHTML=stepHTML(AS.step);
  $$('.steps-bar i').forEach((el,i)=>el.classList.toggle('on',AS.step>i));
  const t=$('#asTitle'); if(t) t.textContent=NAMA_LANGKAH[AS.step-1];
  const s=$('#asStep'); if(s) s.textContent='Langkah '+AS.step+' dari 5';
  bindStep(); window.DWbind(document); animateCounts(document);
}
function terimaFoto(dataUrl){
  loadImg(dataUrl).then(img=>{
    AS.image=downscale(img,720,0.78);
    matikanKamera();
    resetUkur();
    redraw();
    toast('ok','Foto siap','Ukur luka bila perlu, lalu lanjutkan ke analisis.');
  }).catch(()=>toast('err','Gambar tidak terbaca','Coba ambil foto lain.'));
}
function bindStep(){
  const scope=$('#asBody'); if(!scope) return;
  $$('[data-back]',scope).forEach(b=>b.addEventListener('click',()=>{
    matikanKamera(); AS.step=Math.max(1,AS.step-1); redraw();
  }));
  $$('[data-next]',scope).forEach(b=>b.addEventListener('click',()=>{
    if(AS.step>=5) return;
    if(AS.step===3 && !AS.image){ toast('warn','Belum ada foto','Ambil foto luka terlebih dulu.'); return; }
    matikanKamera();
    AS.step++; redraw(); if(AS.step===4) jalankanAnalisis();
  }));

  if(AS.step===1){
    $('#s1',scope).addEventListener('submit',e=>{
      e.preventDefault();
      const v=window.DWread(e.target);
      window.DWform.clearErrs(e.target);
      const err=[];
      if(!v.location) err.push(['location','Pilih bagian kaki yang terluka.']);
      if(!v.duration) err.push(['duration','Pilih sudah berapa lama lukanya ada.']);
      if(!v.symptoms || !v.symptoms.length) err.push(['symptoms','Pilih minimal satu pilihan keluhan.']);
      if(err.length){
        err.forEach(function(x){
          const f=e.target.querySelector('[data-f="'+x[0]+'"]');
          const d=document.createElement('div'); d.className='err';
          d.innerHTML=icon('alert')+'<span>'+x[1]+'</span>';
          f.appendChild(d);
        });
        toast('err','Data belum lengkap', err.length+' pertanyaan masih kosong.');
        const f=e.target.querySelector('.err'); if(f) f.scrollIntoView({block:'center',behavior:'smooth'});
        return;
      }
      let keluhan=v.symptoms.slice();
      if(keluhan.indexOf('Tidak ada keluhan')>=0) keluhan=['Tidak ada keluhan'];
      AS.info={location:v.location,duration:v.duration,symptoms:keluhan};
      AS.step=2; redraw();
    });
  }

  if(AS.step===3 && !AS.image){
    const olah=inp=>{
      const f=inp.files&&inp.files[0]; if(!f) return;
      if(!/^image\//.test(f.type)){ toast('err','Bukan berkas gambar','Pilih berkas JPG atau PNG.'); return; }
      if(f.size>18*1024*1024){ toast('err','Berkas terlalu besar','Pilih gambar di bawah 18 MB.'); return; }
      const fr=new FileReader();
      fr.onload=()=>terimaFoto(fr.result);
      fr.onerror=()=>toast('err','Berkas tidak terbaca','Coba pilih foto lain.');
      fr.readAsDataURL(f);
    };
    const ci=$('#camIn',scope), ui=$('#upIn',scope);
    if(ci) ci.addEventListener('change',()=>olah(ci));
    if(ui) ui.addEventListener('change',()=>olah(ui));
    const shot=$('#camShot',scope);
    if(shot) shot.addEventListener('click',()=>{
      if(!CAM.siap){ toast('warn','Kamera belum siap','Tunggu sebentar sampai gambar muncul.'); return; }
      const f=ambilFrame();
      if(!f){ toast('err','Gagal mengambil gambar','Coba sekali lagi.'); return; }
      const w=$('#camWrap'); if(w){ w.classList.add('jepret'); setTimeout(()=>w.classList.remove('jepret'),260); }
      setTimeout(()=>terimaFoto(f),120);
    });
    const flip=$('#camFlip',scope);
    if(flip) flip.addEventListener('click',()=>{
      CAM.facing = CAM.facing==='environment' ? 'user' : 'environment';
      const tag=$('.cam-tag',scope); if(tag) tag.textContent = CAM.facing==='user'?'Kamera depan':'Kamera belakang';
      nyalakanKamera();
    });
    const ulang=$('#camUlang',scope);
    if(ulang) ulang.addEventListener('click',()=>{ CAM.ditolak=false; redraw(); });
    if(!CAM.ditolak) nyalakanKamera();
  }

  if(AS.step===3 && AS.image){
    pasangUkur();
    const rt=$('#retake',scope);
    if(rt) rt.addEventListener('click',()=>{ AS.image=''; resetUkur(); CAM.ditolak=false; redraw(); });
  }

  if(AS.step===5){
    const rd=$('#redo',scope); if(rd) rd.addEventListener('click',()=>{ resetAS(); redraw(); });
    const sv=$('#saveAs',scope); if(sv) sv.addEventListener('click',simpanAsesmen);
  }
}
async function jalankanAnalisis(){
  const tahapan=$$('#cvStages .cv-st');
  const pelan=document.documentElement.getAttribute('data-motion')==='reduced';
  const tunggu=ms=>new Promise(r=>setTimeout(r,pelan?50:ms));
  let img,res;
  try{ img=await loadImg(AS.image); }
  catch(e){ toast('err','Gambar gagal dianalisis','Coba foto lain.'); AS.step=3; redraw(); return; }
  for(let i=0;i<tahapan.length;i++){
    tahapan[i].classList.add('run');
    tahapan[i].querySelector('.sp').innerHTML='<span class="spin"></span>';
    if(i===0) await tunggu(620);
    if(i===1){ await tunggu(300); try{ res=analyzePixels(img, UK.cmPerLebar); }catch(e){ res=null; } await tunggu(420); }
    if(i>1) await tunggu(560);
    tahapan[i].classList.remove('run'); tahapan[i].classList.add('done');
    tahapan[i].querySelector('.ic').innerHTML='<svg style="width:12px;height:12px"><use href="#i-check"></use></svg>';
    tahapan[i].querySelector('.sp').innerHTML='';
  }
  if(!res){ toast('err','Analisis gagal','Coba gunakan foto lain.'); AS.step=3; redraw(); return; }
  const p=D.myPatient(), st=woundStats(p.patientId);
  const luasSebelum = st? st.last.woundArea : null;
  const luasAwal = st? st.first.woundArea : res.luas;
  const minggu = st ? (Math.round((new Date()-new Date(st.first.date))/D.DAY))/7 : 0;
  const dariAwal = st ? ((res.luas-luasAwal)/luasAwal)*100 : 0;
  AS.res=res;
  AS.keputusan=tentukanIndikator(res,luasSebelum,AS.info.symptoms,minggu,dariAwal,!!UK.cmPerLebar);
  await tunggu(260);
  AS.step=5; redraw();
}
function simpanAsesmen(){
  const p=D.myPatient(), now=new Date(), hariIni=D.isoDate(now);
  let w=D.patWounds(p.patientId)[0];
  if(!w){
    w={ woundId:D.uid('wnd'), patientId:p.patientId, location:AS.info.location, duration:AS.info.duration,
      symptoms:AS.info.symptoms, createdAt:now.toISOString(), updatedAt:now.toISOString(), status:'aktif' };
    D.DB.wounds.push(w);
  } else {
    w.location=AS.info.location; w.duration=AS.info.duration; w.symptoms=AS.info.symptoms; w.updatedAt=now.toISOString();
  }
  const sebelum=D.patAssessments(p.patientId);
  const pertama=sebelum[0], terakhir=sebelum[sebelum.length-1];
  const hari = sebelum.length
    ? Math.max(1, Math.round((D.startOfDay(now)-D.startOfDay(new Date(w.createdAt)))/D.DAY)+1) : 1;
  const a={ assessmentId:D.uid('asm'), woundId:w.woundId, patientId:p.patientId, image:AS.image,
    woundArea:AS.res.luas, visualCharacteristics:AS.res.visual, riskIndicator:AS.keputusan.level,
    symptoms:AS.info.symptoms.slice(), reasons:AS.keputusan.alasan.slice(),
    quality:AS.res.mutu, coverage:AS.res.cakupan,
    ukur:{ panjangCm: UK.hasilCm, cmPerLebar: UK.cmPerLebar, terkalibrasi: !!UK.cmPerLebar,
           acuan: UK.cmPerLebar ? acuanAktif().label : null },
    changeFromPrev: terakhir? +(((AS.res.luas-terakhir.woundArea)/terakhir.woundArea)*100).toFixed(1) : 0,
    changeFromFirst: pertama? +(((AS.res.luas-pertama.woundArea)/pertama.woundArea)*100).toFixed(1) : 0,
    tinjauan:null,
    date:hariIni, createdAt:now.toISOString() };
  D.DB.assessments.push(a);
  D.DB.timeline.push({ timelineId:D.uid('tl'), woundId:w.woundId, patientId:p.patientId, assessmentId:a.assessmentId,
    day:hari, date:hariIni, image:AS.image, woundArea:AS.res.luas, assessment:AS.keputusan.level,
    notes: sebelum.length?'Dokumentasi pemantauan rutin.':'Dokumentasi pertama.' });
  D.DB.reminders.push({ reminderId:D.uid('rmd'), patientId:p.patientId, title:'Sesi pemantauan luka',
    description:'Ambil foto luka dengan cara yang sama seperti sebelumnya.',
    date:D.isoDate(D.addDays(now,7)), time:'08:00', status:'menunggu' });
  D.pushNotif(D.me().id,'Asesmen terkirim',
    'Luas '+D.n1(AS.res.luas)+' cm² tercatat pada '+D.fmtDate(hariIni)+
    '. Menunggu dibaca tenaga kesehatan Anda.','asesmen',false);
  const pendamping=[...new Set((p.assignedProfessionals||[]).concat(
    D.janjiAktif(p.patientId).map(x=>x.professionalId)))];
  pendamping.forEach(pid=>{
    const u=D.userOfPro(pid);
    if(u) D.pushNotif(u.id,'Asesmen baru menunggu tinjauan',
      D.me().name+' mengirim dokumentasi luka baru ('+IND[AS.keputusan.level].label+
      ', '+D.n1(AS.res.luas)+' cm²). Buka menu Konsultasi untuk menanggapinya.','asesmen',false);
  });
  p.updatedAt=now.toISOString();
  if(!D.saveDB()) return;
  D.bunyi('kirim');
  toast('ok','Dokumentasi terkirim',
    'Luas '+D.n1(AS.res.luas)+' cm² · menunggu tinjauan tenaga kesehatan');
  resetAS();
  go('pat.wound');
}

/* ============================================================
   JANJI TEMU
   ============================================================ */
route('pat.appts',{auth:true,roles:PAS,render(params){
  const p=D.myPatient(), semua=D.patAppointments(p.patientId);
  const tunggu=semua.filter(a=>a.status==='Menunggu').sort(apptSort);
  const akan=upcomingOf(semua).filter(a=>a.status!=='Menunggu');
  const riwayat=semua.filter(a=>['Berhasil','Selesai'].indexOf(a.status)>=0 ||
      (a.status==='Terjadwal' && akan.indexOf(a)<0)).sort(apptSort).reverse();
  const batal=semua.filter(a=>a.status==='Dibatalkan').sort(apptSort).reverse();
  const tab=(params&&params.tab)||(tunggu.length?'menunggu':'mendatang');
  const list = tab==='menunggu'?tunggu:(tab==='mendatang'?akan:(tab==='riwayat'?riwayat:batal));
  const KOSONG={ menunggu:['Belum ada permintaan menunggu','Setiap permintaan konsultasi yang baru dikirim muncul di sini sampai tenaga kesehatan menjawabnya.'],
    mendatang:['Belum ada jadwal mendatang','Pilih tenaga kesehatan dari daftar di samping untuk mengatur jadwal kontrol.'],
    riwayat:['Riwayat masih kosong','Konsultasi yang sudah dijawab tenaga kesehatan akan tersimpan di sini beserta resep dan penjelasannya.'],
    batal:['Tidak ada yang dibatalkan','Belum ada catatan pada bagian ini.'] };

  const body=`
    ${window.DWpageHead('Janji Temu','Atur dan tinjau jadwal kontrol Anda',
      `<button class="btn btn-primary" id="bookBtn">${icon('plus')} Buat janji temu</button>`)}
    <div class="row spread wrap" style="gap:11px;margin-bottom:15px">
      <div class="segs">
        ${[['menunggu','Menunggu',tunggu.length],['mendatang','Terjadwal',akan.length],['riwayat','Riwayat',riwayat.length],['batal','Dibatalkan',batal.length]]
          .map(t=>`<button class="seg ${tab===t[0]?'on':''}" data-tab="${t[0]}">${t[1]} (${t[2]})</button>`).join('')}
      </div>
    </div>
    <div class="dash-grid">
      <div class="col">
        <div class="card">
          ${list.length? `<div class="grid stagger" style="gap:9px">${list.map((a,i)=>`
            <button class="notif" style="--i:${i};padding:14px;align-items:flex-start" data-appt="${a.appointmentId}">
              <span class="ib ib-brand" style="width:40px;height:40px;border-radius:12px;font-family:var(--display);font-weight:800;font-size:.76rem">${esc(D.initials(D.proName(a.professionalId)))}</span>
              <div style="flex:1;min-width:0">
                <div class="nt">${esc(D.proName(a.professionalId))}</div>
                <div class="nm">${esc(D.proSpec(a.professionalId))} · ${esc(a.type)}</div>
                <div class="row wrap" style="gap:6px;margin-top:7px">
                  <span class="chip chip-muted">${icon('cal')} ${D.fmtDate(a.date)}</span>
                  <span class="chip chip-muted tnum">${icon('clock')} ${esc(a.time)}</span>
                  ${a.modeLabel?`<span class="chip chip-info">${esc(a.modeLabel)}</span>`:''}
                  ${a.konsultasi?`<span class="chip chip-ok">${icon('note')} Ada jawaban</span>`:''}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">${apptChip(a.status)}
                <span class="tiny muted">${D.relDay(a.date)}</span></div>
            </button>`).join('')}</div>`
          : emptyState('cal',KOSONG[tab][0],KOSONG[tab][1],'','')}
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('users')} Tenaga kesehatan tersedia</div>
            <span class="chip chip-muted">${D.DB.professionals.length}</span></div>
          <div class="grid" style="gap:8px">
            ${D.DB.professionals.map(pro=>{
              const milik=(p.assignedProfessionals||[]).indexOf(pro.professionalId)>=0;
              return `<button class="nakes-kartu" data-pilih="${pro.professionalId}">
                <span class="avatar" style="width:36px;height:36px;font-size:.74rem">${esc(D.initials(D.proName(pro.professionalId)))}</span>
                <span style="flex:1;min-width:0;text-align:left">
                  <span class="nt" style="display:block">${esc(D.proName(pro.professionalId))}</span>
                  <span class="nm" style="display:block">${esc(pro.specialty)}</span>
                  <span class="tiny muted" style="display:block;margin-top:2px">${esc(pro.institution)}</span>
                </span>
                ${milik?'<span class="chip chip-ok" style="font-size:.64rem">Terhubung</span>':icon('right')}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('cal')} Kalender</div></div>
          <div id="calHost"></div>
          <div id="calList" class="tiny muted" style="margin-top:11px">Ketuk tanggal bertanda untuk melihat jadwalnya.</div>
        </div>
        <div class="card" style="background:var(--tint-sky);border-color:transparent">
          <div class="row" style="gap:11px;align-items:flex-start">
            <span class="ib" style="background:var(--veil);color:var(--info)">${icon('info')}</span>
            <div style="flex:1">
              <div style="font-family:var(--display);font-weight:700;font-size:.88rem">Bawa catatan Anda saat kontrol</div>
              <p class="tiny" style="color:var(--ink-2);line-height:1.55;margin-top:3px">
                Buka halaman Luka Saya sebelum berangkat. Grafik tren dan pembanding foto di sana bisa langsung
                ditunjukkan kepada dokter atau perawat.</p>
              <button class="btn btn-ghost btn-sm" style="margin-top:10px;background:var(--veil);border-color:transparent" data-go="pat.wound">Buka Luka Saya ${icon('right')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${window.DWdisclaimer}`;
  return shell('pat.appts','Janji Temu','Atur dan tinjau jadwal kontrol',body);
},mount(){
  shellMount(); window.DWbindUmum();
  $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>go('pat.appts',{tab:b.dataset.tab})));
  $('#bookBtn').addEventListener('click',()=>mulaiBooking());
  $$('[data-pilih]').forEach(b=>b.addEventListener('click',()=>mulaiBooking(b.dataset.pilih)));
  window.DWbindKal(D.myPatient().patientId);
}});

let BK=null;
function mulaiBooking(proTerpilih){
  if(!D.DB.professionals.length){
    toast('warn','Belum ada tenaga kesehatan','Daftar tenaga kesehatan masih kosong.');
    return;
  }
  BK={step:proTerpilih?2:1,pro:proTerpilih||'',mode:'',date:'',time:'',type:'',
      keluhan:'',lampir:true,bayar:'',setuju:false};
  gambarBooking();
}
const BK_JUDUL=['Pilih tenaga kesehatan','Bentuk konsultasi','Pilih tanggal','Pilih jam',
                'Keluhan Anda','Pembayaran','Konfirmasi'];
const modeAktif = () => D.MODE_KONSUL.find(m=>m.id===BK.mode) || null;

function bkKartuNakes(){
  const pro=D.proById(BK.pro)||{};
  return `<div class="row bk-ringkas">
      <span class="avatar" style="width:34px;height:34px;font-size:.72rem">${esc(D.initials(D.proName(BK.pro)))}</span>
      <div style="min-width:0;flex:1"><div style="font-family:var(--display);font-weight:700;font-size:.87rem">${esc(D.proName(BK.pro))}</div>
        <div class="tiny muted">${esc(D.proSpec(BK.pro))}${pro.institution?' · '+esc(pro.institution):''}</div></div>
      ${BK.mode?`<span class="chip chip-info">${esc(modeAktif()?modeAktif().label:'')}</span>`:''}
    </div>`;
}
function bkLangkah(){
  return `<div class="bk-langkah" aria-hidden="true">${BK_JUDUL.map((j,i)=>
    `<span class="bk-tik ${i+1<BK.step?'lewat':(i+1===BK.step?'kini':'')}"></span>`).join('')}</div>`;
}
function asesmenTerakhir(){
  const p=D.myPatient(); if(!p) return null;
  const list=D.patAssessments(p.patientId);
  return list.length? list[list.length-1] : null;
}

function gambarBooking(){
  const bd=openModal('<div id="bkBody"></div>',{title:BK_JUDUL[BK.step-1],wide:true});
  const body=$('#bkBody',bd);
  const nav=(label,aktif)=>`<div class="row bk-nav" style="gap:8px">
      ${BK.step>1?`<button class="btn btn-ghost btn-sm" id="bkBack">${icon('left')} Kembali</button>`:''}
      <button class="btn btn-primary btn-sm" style="flex:1" id="bkNext"${aktif?'':' disabled'}>${label}</button></div>`;
  let html=bkLangkah();

  if(BK.step===1){
    html+=`<div class="grid" style="gap:9px">${D.DB.professionals.map(pro=>
      `<button class="notif ${BK.pro===pro.professionalId?'unread':''}" data-pro="${pro.professionalId}" style="padding:14px;align-items:flex-start">
        <span class="avatar" style="width:40px;height:40px;font-size:.78rem">${esc(D.initials(D.proName(pro.professionalId)))}</span>
        <div style="flex:1;min-width:0"><div class="nt">${esc(D.proName(pro.professionalId))}</div>
          <div class="nm">${esc(pro.specialty)}</div>
          <div class="tiny muted" style="margin-top:2px">${esc(pro.institution)} · ${esc(pro.workLocation)}</div>
          <div class="tiny muted mono" style="margin-top:3px">${esc(pro.professionalId)}</div></div>
        ${BK.pro===pro.professionalId?`<span class="chip chip-ok">${icon('check')}</span>`:icon('right')}</button>`).join('')}</div>`
      +nav('Lanjut',!!BK.pro);

  } else if(BK.step===2){
    html+=bkKartuNakes()
      +`<div class="grid" style="gap:10px">${D.MODE_KONSUL.map(m=>
        `<button class="mode-kartu ${BK.mode===m.id?'on':''}" data-mode="${m.id}">
          <span class="ib ib-brand">${icon(m.ikon)}</span>
          <span style="flex:1;min-width:0;text-align:left">
            <span class="nt" style="display:block">${esc(m.label)}</span>
            <span class="nm" style="display:block">${esc(m.ket)}</span></span>
          <span class="mode-tarif tnum">${D.rupiah(m.tarif)}</span></button>`).join('')}</div>
      <p class="hint" style="margin-top:10px">Tarif di atas adalah simulasi untuk purwarupa. Tidak ada transaksi nyata yang diproses.</p>`
      +nav('Lanjut',!!BK.mode);

  } else if(BK.step===3){
    const min=D.isoDate(new Date());
    html+=bkKartuNakes()
      +`<div class="field"><label for="bkD">Tanggal kunjungan</label>
        <input class="inp" type="date" id="bkD" min="${min}" value="${BK.date||''}">
        <span class="hint">Jam layanan Senin sampai Sabtu, pukul 08.00–16.00.</span></div>`+nav('Lanjut',!!BK.date);

  } else if(BK.step===4){
    html+=`<div class="opts">${timeSlots().map(t=>{
      const terisi=slotTaken(BK.pro,BK.date,t);
      return `<label class="opt" style="${terisi?'opacity:.4;pointer-events:none':''}">
        <input type="radio" name="bkt" value="${t}"${BK.time===t?' checked':''}${terisi?' disabled':''}>
        <span class="tnum">${t}${terisi?' · terisi':''}</span></label>`;}).join('')}</div>
      <p class="hint" style="margin-top:9px">Setiap sesi berdurasi 30 menit.</p>`+nav('Lanjut',!!BK.time);

  } else if(BK.step===5){
    const asm=asesmenTerakhir();
    html+=`<div class="opts" style="margin-bottom:15px">${['Kontrol rutin','Perawatan luka','Konsultasi','Pemeriksaan pertama'].map(t=>
        `<label class="opt"><input type="radio" name="bkty" value="${t}"${BK.type===t?' checked':''}><span>${t}</span></label>`).join('')}</div>
      <div class="field"><label for="bkK">Keluhan yang ingin disampaikan</label>
        <textarea class="inp" id="bkK" rows="5" maxlength="600"
          placeholder="Contoh: luka di telapak kaki kanan masih basah, sekitarnya kemerahan sejak tiga hari lalu, dan terasa lebih hangat.">${esc(BK.keluhan)}</textarea>
        <span class="hint"><span id="bkKn" class="tnum">${BK.keluhan.length}</span>/600 karakter. Tulis apa adanya — ini yang pertama dibaca tenaga kesehatan.</span></div>
      ${asm?`<label class="opt opt-blok"><input type="checkbox" id="bkL"${BK.lampir?' checked':''}>
          <span style="flex:1"><span class="nt" style="display:block">Lampirkan hasil asesmen terakhir</span>
            <span class="nm" style="display:block">${D.fmtDate(asm.date)} · luas ${D.n1(asm.woundArea)} cm² · foto luka ikut terkirim</span></span></label>`
        :`<div class="nota nota-info"><p class="tiny" style="line-height:1.6">Anda belum punya asesmen luka. Janji temu tetap bisa dibuat, tetapi tenaga kesehatan tidak akan melihat foto maupun hasil analisisnya.</p></div>`}`
      +nav('Lanjut ke pembayaran', !!BK.type && BK.keluhan.trim().length>=12);

  } else if(BK.step===6){
    const m=modeAktif()||{tarif:0,label:''};
    const metode=D.METODE_BAYAR.filter(x=>x.id!=='tempat' || BK.mode==='tatap');
    html+=`<div class="bayar-total">
        <div><span class="eyebrow">Total tagihan</span>
          <div class="bayar-nom tnum">${D.rupiah(m.tarif)}</div>
          <div class="tiny muted">${esc(m.label)} · sesi 30 menit</div></div>
        <span class="ib ib-brand">${icon('shield')}</span></div>
      <div class="eyebrow" style="margin:15px 0 9px">Metode pembayaran</div>
      <div class="grid" style="gap:8px">${metode.map(x=>
        `<label class="opt opt-blok"><input type="radio" name="bkby" value="${x.id}"${BK.bayar===x.id?' checked':''}>
          <span style="flex:1"><span class="nt" style="display:block">${esc(x.label)}</span>
            <span class="nm" style="display:block">${esc(x.ket)}</span></span></label>`).join('')}</div>
      <div class="nota nota-warn" style="margin-top:14px">
        <p class="tiny" style="line-height:1.6"><strong>Pembayaran ini simulasi.</strong> Tidak ada uang yang berpindah, tidak ada nomor kartu yang diminta, dan tidak ada data yang dikirim ke luar perangkat Anda. Bagian ini dibuat untuk memperagakan alur layanan.</p></div>`
      +nav('Bayar sekarang',!!BK.bayar);

  } else {
    const pro=D.proById(BK.pro)||{}, m=modeAktif()||{}, mb=D.METODE_BAYAR.find(x=>x.id===BK.bayar)||{};
    const asm=BK.lampir?asesmenTerakhir():null;
    html+=`<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-m);padding:15px">
        <dl class="kv">
          <dt>Tenaga kesehatan</dt><dd>${esc(D.proName(BK.pro))}</dd>
          <dt>Bidang</dt><dd>${esc(pro.specialty||'')}</dd>
          <dt>Bentuk</dt><dd>${esc(m.label||'')}</dd>
          <dt>Tanggal</dt><dd>${D.fmtDateFull(BK.date)}</dd>
          <dt>Waktu</dt><dd class="tnum">${esc(BK.time)} – ${D.addMin(BK.time,30)} WIB</dd>
          <dt>Jenis</dt><dd>${esc(BK.type)}</dd>
          <dt>${BK.mode==='daring'?'Tautan':'Tempat'}</dt><dd style="font-family:var(--body);font-weight:600">${BK.mode==='daring'?'Dikirim ke notifikasi menjelang jadwal':esc(pro.institution||'—')}</dd>
          <dt>Pembayaran</dt><dd class="tnum">${D.rupiah(m.tarif||0)} · ${esc(mb.label||'')}</dd>
          <dt>Lampiran</dt><dd style="font-family:var(--body);font-weight:600">${asm?'Asesmen '+D.fmtDate(asm.date):'Tanpa lampiran'}</dd>
        </dl></div>
      <div class="field" style="margin-top:14px">
        <span class="eyebrow">Keluhan yang dikirim</span>
        <p class="tiny" style="color:var(--ink-2);line-height:1.6;margin-top:6px;white-space:pre-wrap">${esc(BK.keluhan)}</p></div>
      ${D.userOfPro(BK.pro)
        ? `<div class="nota nota-info" style="margin-top:14px">${icon('info')}
            <div>${esc(D.proName(BK.pro))} memakai DIWACARE. Permintaan Anda masuk ke ruang konsultasi beliau,
              dan statusnya tetap <b>Menunggu</b> sampai jawaban klinisnya dikirim.</div></div>`
        : `<div class="nota nota-warn" style="margin-top:14px">${icon('alert')}
            <div>${esc(D.proName(BK.pro))} belum memakai DIWACARE. Jadwalnya akan dikonfirmasi otomatis oleh
              sistem penjadwalan aplikasi ini, dan keluhan Anda perlu disampaikan langsung saat kunjungan.</div></div>`}
      <label class="opt opt-blok" style="margin-top:12px"><input type="checkbox" id="bkS"${BK.setuju?' checked':''}>
        <span class="tiny" style="line-height:1.55">Saya paham DIWACARE bukan alat diagnosis, dan keputusan klinis tetap berada pada tenaga kesehatan.</span></label>`
      +nav('Kirim permintaan',BK.setuju);
  }

  body.innerHTML=html;
  $$('[data-pro]',body).forEach(b=>b.addEventListener('click',()=>{ BK.pro=b.dataset.pro; closeModal(); gambarBooking(); }));
  $$('[data-mode]',body).forEach(b=>b.addEventListener('click',()=>{
    BK.mode=b.dataset.mode;
    if(BK.mode!=='tatap' && BK.bayar==='tempat') BK.bayar='';
    closeModal(); gambarBooking();
  }));
  const d=$('#bkD',body); if(d) d.addEventListener('change',()=>{ BK.date=d.value; $('#bkNext',body).disabled=!d.value; });
  $$('input[name="bkt"]',body).forEach(r=>r.addEventListener('change',()=>{ BK.time=r.value; $('#bkNext',body).disabled=false; }));
  $$('input[name="bkty"]',body).forEach(r=>r.addEventListener('change',()=>{ BK.type=r.value; segarBkNext(body); }));
  $$('input[name="bkby"]',body).forEach(r=>r.addEventListener('change',()=>{ BK.bayar=r.value; $('#bkNext',body).disabled=false; }));
  const k=$('#bkK',body);
  if(k) k.addEventListener('input',()=>{ BK.keluhan=k.value; const c=$('#bkKn',body); if(c) c.textContent=k.value.length; segarBkNext(body); });
  const lp=$('#bkL',body); if(lp) lp.addEventListener('change',()=>{ BK.lampir=lp.checked; });
  const sj=$('#bkS',body); if(sj) sj.addEventListener('change',()=>{ BK.setuju=sj.checked; $('#bkNext',body).disabled=!sj.checked; });
  const back=$('#bkBack',body); if(back) back.addEventListener('click',()=>{ BK.step--; closeModal(); gambarBooking(); });
  $('#bkNext',body).addEventListener('click',()=>{
    if(BK.step===3 && BK.date < D.isoDate(new Date())){ toast('err','Tanggal sudah lewat','Pilih hari ini atau sesudahnya.'); return; }
    if(BK.step===6) return prosesBayar();
    if(BK.step===7) return konfirmasiBooking();
    BK.step++; closeModal(); gambarBooking();
  });
}
function segarBkNext(body){
  const b=$('#bkNext',body); if(!b) return;
  b.disabled = !(BK.type && BK.keluhan.trim().length>=12);
}

/* Pembayaran simulasi: jeda singkat supaya alurnya terasa, tanpa jaringan apa pun. */
function prosesBayar(){
  const m=modeAktif()||{tarif:0};
  const tombol=$('#bkNext'); if(tombol){ tombol.disabled=true; tombol.innerHTML='Memproses…'; }
  const bd=$('#bkBody');
  if(bd) bd.insertAdjacentHTML('beforeend',
    `<div class="bayar-proses" id="bkProses"><span class="spin"></span>
      <span class="tiny">Menyiapkan tagihan ${D.rupiah(m.tarif)}…</span></div>`);
  setTimeout(()=>{
    BK.ref='DWC'+String(Date.now()).slice(-8);
    D.bunyi('sukses');
    toast('ok','Pembayaran berhasil','Nomor rujukan '+BK.ref+'. Tinggal satu langkah lagi.');
    BK.step=7; closeModal(); gambarBooking();
  },900);
}

function konfirmasiBooking(){
  const p=D.myPatient(), pro=D.proById(BK.pro)||{}, m=modeAktif()||{tarif:0,label:''};
  if(slotTaken(BK.pro,BK.date,BK.time)){
    toast('err','Jam baru saja terisi','Silakan pilih jam lain.');
    BK.step=4; closeModal(); gambarBooking(); return;
  }
  const mb=D.METODE_BAYAR.find(x=>x.id===BK.bayar)||{};
  const asm=BK.lampir?asesmenTerakhir():null;
  const a={ appointmentId:D.uid('apt'), patientId:p.patientId, professionalId:BK.pro, date:BK.date, time:BK.time,
    endTime:D.addMin(BK.time,30), type:BK.type, mode:BK.mode, modeLabel:m.label,
    location: BK.mode==='daring' ? 'Konsultasi daring' : (pro.institution||'Fasilitas kesehatan'),
    keluhan:BK.keluhan.trim(), assessmentId: asm? asm.assessmentId : null,
    bayar:{ jumlah:m.tarif||0, metode:BK.bayar, metodeLabel:mb.label||'', status:'Lunas',
            ref:BK.ref||('DWC'+String(Date.now()).slice(-8)), waktu:new Date().toISOString() },
    konsultasi:null, status:'Menunggu', notes:'', createdAt:new Date().toISOString() };
  D.DB.appointments.push(a);
  if((p.assignedProfessionals||[]).indexOf(BK.pro)<0)
    p.assignedProfessionals=(p.assignedProfessionals||[]).concat([BK.pro]);
  D.pushNotif(D.me().id,'Permintaan janji temu terkirim',
    D.proName(BK.pro)+' · '+m.label+' · '+D.fmtDate(BK.date)+' pukul '+BK.time+
    '. Status menunggu sampai tenaga kesehatan mengirim jawabannya.','janji',false);
  const pu=D.userOfPro(BK.pro);
  if(pu) D.pushNotif(pu.id,'Permintaan konsultasi baru',
    D.me().name+' mengirim keluhan untuk '+m.label.toLowerCase()+' pada '+D.fmtDate(BK.date)+' pukul '+BK.time+'.','janji',false);
  if(!D.saveDB()) return;
  D.bunyi('kirim');
  closeModal();
  toast('ok','Permintaan terkirim', D.fmtDate(BK.date)+' pukul '+BK.time+' · status menunggu');
  go('pat.appts',{tab:'menunggu'});
  /* tenaga kesehatan yang belum memakai aplikasi ini tidak bisa menjawab dari dalam
     DIWACARE, jadi penjadwalan dikonfirmasi otomatis agar permintaannya tidak menggantung */
  if(!pu) jadwalkanOtomatis(a.appointmentId);
}

function jadwalkanOtomatis(id){
  setTimeout(()=>{
    const a=D.DB.appointments.find(x=>x.appointmentId===id);
    if(!a || a.status!=='Menunggu') return;
    a.status='Terjadwal';
    const u=D.userOfPat(a.patientId);
    if(u) D.pushNotif(u.id,'Jam temu otomatis terjadwal',
      D.proName(a.professionalId)+' · '+D.fmtDate(a.date)+' pukul '+a.time+' di '+a.location+
      '. Bawa catatan pemantauan Anda saat datang.','janji',false);
    D.saveDB();
    if(D.me() && u && D.me().id===u.id){
      toast('ok','Jam temu terjadwal',
        D.proName(a.professionalId)+' · '+D.fmtDate(a.date)+' pukul '+a.time+'.',8000);
      D.bunyi('sukses');
      if(window.DWrerender) window.DWrerender();
    }
  }, 5200);
}

/* ============================================================
   EDUKASI
   ============================================================ */
const EDU={
  /* ---------- Dasar biologi ---------- */
  fase:{kat:'Dasar Biologi',judul:'Empat fase penyembuhan luka',tint:'mint',ic:'refresh',
    lead:'Luka tidak menutup sekaligus. Tubuh mengerjakannya bertahap, dan setiap tahap punya petugasnya sendiri.',
    isi:[['1. Hemostasis — beberapa menit pertama','Pembuluh menyempit sampai sekitar sepuluh menit untuk menahan darah, lalu trombosit menggumpal dan benang fibrin membentuk sumbat sementara. Sumbat inilah yang nanti menjadi jalan bagi sel-sel perbaikan.'],
      ['2. Inflamasi — hari ke-0 sampai ke-5','Neutrofil datang dalam 24 jam pertama untuk memakan kuman dan kotoran. Sekitar hari ketiga makrofag mengambil alih dan berubah peran, dari penyerang menjadi pengatur perbaikan. Bengkak, hangat, dan kemerahan pada tahap ini normal — yang tidak normal adalah bila terus meluas.'],
      ['3. Proliferasi — hari ke-3 sampai beberapa minggu','Tiga pekerjaan berjalan bersamaan: pembuluh darah baru tumbuh, sel kulit merayap dari tepi luka ke tengah, dan fibroblas menganyam kolagen sebagai kerangka jaringan baru. Warna merah muda berbutir yang terlihat pada dasar luka adalah hasil tahap ini.'],
      ['4. Remodeling — hari ke-21 sampai satu tahun','Kolagen tipe III yang lemah diganti kolagen tipe I yang jauh lebih kuat. Kekuatan tarik jaringan naik perlahan dan berhenti di sekitar 80% kekuatan kulit aslinya — bekas luka tidak pernah sekuat kulit yang belum pernah terluka.']],
    tutup:'Karena itu luka yang sudah menutup pun masih perlu dilindungi berbulan-bulan sesudahnya. Permukaannya sudah rapat, tetapi anyaman di bawahnya belum selesai dikerjakan.',
    sumber:'Physiology of Wound Healing dan Wound Healing Phases, StatPearls, National Library of Medicine (NCBI Bookshelf).'},

  saraf:{kat:'Dasar Biologi',judul:'Kenapa rasa di kaki bisa menumpul',tint:'lilac',ic:'lamp',
    lead:'Gula darah tinggi yang berlangsung lama merusak saraf lewat beberapa jalur sekaligus, bukan satu.',
    isi:[['Jalur poliol','Kelebihan glukosa diubah enzim aldose reduktase menjadi sorbitol di dalam sel saraf. Sorbitol menumpuk, menarik air, dan mengganggu keseimbangan osmotik sel. Zat pelindung seperti inositol dan taurin ikut terdesak keluar.'],
      ['AGE dan reseptornya','Gula yang berlebih menempel pada protein dan lemak membentuk advanced glycation end products. Saat AGE bertemu reseptornya, jalur peradangan menyala dan merusak pembuluh halus di sekitar saraf.'],
      ['Protein kinase C','Glukosa berlebih menghasilkan diasilgliserol yang mengaktifkan PKC. Akibatnya pengaturan pembuluh darah terganggu dan aliran ke jaringan saraf berkurang.'],
      ['Stres oksidatif','Semua jalur di atas bermuara pada satu hal: produksi radikal bebas melebihi kemampuan sel menanganinya. Mitokondria terganggu, pasokan energi sel saraf turun.'],
      ['Vasa nervorum','Saraf punya pembuluh darahnya sendiri yang sangat halus. Dindingnya menebal pada diabetes, sehingga saraf mengalami kekurangan oksigen dari dalam.']],
    tutup:'Ujungnya sama: rasa nyeri yang seharusnya menjadi alarm ikut hilang. Luka kecil bisa berhari-hari tidak disadari, dan itulah alasan pemeriksaan kaki setiap hari menggantikan peran rasa sakit.',
    sumber:'Diabetic peripheral neuropathy: pathogenetic mechanisms and treatment, Frontiers in Endocrinology (2023).'},

  pembuluh:{kat:'Dasar Biologi',judul:'Aliran darah, oksigen, dan penyembuhan',tint:'sky',ic:'heart',
    lead:'Penyembuhan luka adalah pekerjaan yang boros oksigen. Bila pasokannya seret, seluruh prosesnya melambat.',
    isi:[['Kenapa oksigen menentukan','Pembentukan kolagen memerlukan oksigen dan vitamin C untuk proses hidroksilasi. Tanpa keduanya, kolagen yang terbentuk rapuh dan luka gampang terbuka kembali.'],
      ['Pembuluh baru harus dibangun dulu','Jaringan baru tidak bisa hidup tanpa pembuluh. Kekurangan oksigen justru memicu sinyal VEGF yang memerintahkan pembuluh baru tumbuh — tetapi pada diabetes sinyal ini sering tidak berjalan mulus.'],
      ['Penyakit arteri perifer','Penyempitan arteri tungkai membuat darah yang sampai ke kaki berkurang. Tandanya bisa berupa nadi kaki yang sulit diraba, kaki dingin, atau nyeri saat berjalan yang mereda saat berhenti.'],
      ['Angka yang dipakai klinisi','Tekanan pergelangan kaki di bawah 50 mmHg, indeks ABI di bawah 0,4, atau tekanan jari kaki di bawah 30 mmHg termasuk temuan yang mendorong pertimbangan tindakan membuka aliran darah. Nilai ABI normal berkisar 0,9 sampai 1,3.']],
    tutup:'Bila luka tidak juga membaik padahal perawatannya sudah benar, aliran darah adalah salah satu hal pertama yang perlu diperiksa tenaga kesehatan.',
    sumber:'IWGDF Practical Guidelines on the prevention and management of diabetes-related foot disease (pembaruan 2023) dan StatPearls, Physiology of Wound Healing.'},

  kolagen:{kat:'Dasar Biologi',judul:'Kolagen, bahan bangunan jaringan baru',tint:'apricot',ic:'spark',
    lead:'Kalau luka adalah bangunan yang sedang diperbaiki, kolagen adalah rangka besinya.',
    isi:[['Dianyam oleh fibroblas','Fibroblas datang pada tahap proliferasi dan mulai menganyam kolagen tipe III bersama fibronektin dan glikosaminoglikan, menggantikan gumpalan fibrin sementara.'],
      ['Ditukar dengan yang lebih kuat','Pada tahap remodeling, kolagen tipe III diurai dan digantikan kolagen tipe I yang jauh lebih kuat. Proses tukar-menukar ini yang menaikkan kekuatan jaringan.'],
      ['Miofibroblas menarik tepi luka','Sebagian fibroblas berubah menjadi miofibroblas yang mampu berkontraksi, menarik tepi luka saling mendekat. Setelah kulit menutup, sel-sel ini mati terprogram.'],
      ['Bahan bakunya dari makanan','Pembentukan kolagen berjalan setidaknya empat minggu dan memerlukan protein, oksigen, serta vitamin C. Kekurangan salah satunya memperlambat seluruh rantai.']],
    tutup:'Karena itu makan cukup protein bukan anjuran hiasan. Tubuh benar-benar sedang membangun sesuatu, dan bahannya harus tersedia.',
    sumber:'Physiology of Wound Healing, StatPearls, National Library of Medicine.'},

  /* ---------- Diabetes dan luka ---------- */
  penyebab:{kat:'Diabetes & Luka',judul:'Kenapa diabetes memperlambat penyembuhan luka',tint:'blush',ic:'heart',
    lead:'Tiga hal biasanya bekerja melawan luka pada saat bersamaan.',
    isi:[['Saraf','Rasa yang berkurang membuat luka kecil bisa tidak disadari berhari-hari. Nyeri sebenarnya adalah alarm, dan ketika alarm itu diam, kerusakan menumpuk tanpa terasa.'],
      ['Aliran darah','Pembuluh yang menyempit mengantar lebih sedikit oksigen dan sel perbaikan, sehingga proses penyembuhan berjalan lebih lambat dari biasanya.'],
      ['Daya tahan','Gula darah tinggi menumpulkan respons kekebalan tubuh, sehingga bakteri punya ruang lebih besar untuk berkembang.']],
    tutup:'Itulah sebabnya luka yang di tempat lain dianggap sepele justru perlu perhatian serius pada kaki penyandang diabetes. Kementerian Kesehatan menyebut tiga faktor yang sama: neuropati, angiopati, dan infeksi.',
    sumber:'Kementerian Kesehatan RI, Benarkah Penyandang Diabetes Harus Berhati-hati dengan Kaki Mereka; dan IWGDF 2023.'},

  memahami:{kat:'Diabetes & Luka',judul:'Membaca tampilan luka',tint:'apricot',ic:'wound',
    lead:'Warna pada dasar luka bisa dibaca kalau Anda tahu artinya.',
    isi:[['Merah atau merah muda','Umumnya jaringan granulasi, yaitu jaringan baru yang sedang mengisi luka. Biasanya pertanda perbaikan sedang berjalan.'],
      ['Kekuningan','Sering berupa lapisan lunak yang bisa memperlambat penutupan luka bila menutupi sebagian besar permukaannya.'],
      ['Gelap atau kehitaman','Bisa menandakan jaringan yang mati. Kondisi ini selalu perlu dinilai tenaga kesehatan, bukan ditebak sendiri di rumah.'],
      ['Tepi luka juga bercerita','Tepi yang menebal dan menggulung sering menandakan luka yang sudah lama berjalan di tempat, sementara tepi landai dan merah muda biasanya menandakan penutupan sedang berlangsung.']],
    tutup:'DIWACARE hanya melaporkan perbandingan warnanya agar tren terlihat dari minggu ke minggu. Aplikasi ini tidak menyimpulkan jenis jaringannya.',
    sumber:'IWGDF 2023 dan literatur perawatan luka umum.'},

  infeksi:{kat:'Diabetes & Luka',judul:'Mengenali tanda infeksi',tint:'blush',ic:'alert',
    lead:'Ada kesepakatan internasional tentang kapan sebuah luka disebut terinfeksi, dan patokannya sederhana.',
    isi:[['Dua dari empat tanda radang','Infeksi ditegakkan bila ada minimal dua tanda peradangan lokal — kemerahan, hangat, pengerasan jaringan, atau nyeri — atau bila keluar nanah.'],
      ['Ringan','Infeksi hanya di permukaan kulit dengan kemerahan sekitar yang terbatas.'],
      ['Sedang','Menembus lebih dalam dari kulit, atau kemerahannya meluas, kadang disertai kantong nanah.'],
      ['Berat','Disertai tanda tubuh secara keseluruhan ikut terkena: demam, menggigil, denyut cepat, atau kesadaran menurun. Ini keadaan yang tidak boleh menunggu.'],
      ['Yang menyulitkan pada diabetes','Rasa nyeri yang menumpul membuat infeksi bisa berkembang jauh sebelum terasa. Jadi jangan menunggu sakit sebagai penanda.']],
    tutup:'Jika Anda ragu apakah sebuah luka terinfeksi, anggap saja iya dan hubungi tenaga kesehatan. Kesalahan ke arah hati-hati jauh lebih murah daripada sebaliknya.',
    sumber:'Klasifikasi infeksi IWGDF/IDSA, dalam IWGDF Practical Guidelines 2023.'},

  /* ---------- Pemantauan ---------- */
  dokumentasi:{kat:'Pemantauan',judul:'Kenapa dokumentasi rutin itu penting',tint:'sky',ic:'chart',
    lead:'Satu foto hanya potret sesaat. Empat foto yang diambil dengan cara sama barulah menjadi tren.',
    isi:[['Yang bisa diukur','Perubahan luas luka dari waktu ke waktu adalah petunjuk paling mudah ditangkap oleh kamera.'],
      ['Titik empat minggu','Penelitian prognosis luka berulang kali memakai penyusutan sekitar 50% pada minggu keempat sebagai ambang untuk meninjau ulang rencana perawatan.'],
      ['Kenapa harus konsisten','Kalau jarak, sudut, dan cahaya berubah-ubah antarfoto, yang Anda lihat bisa jadi perbedaan kamera, bukan perbedaan luka.']],
    tutup:'Itulah alasan adanya layar panduan pemotretan — untuk menjaga agar perbandingannya tetap adil.',
    sumber:'IWGDF 2023 dan literatur prognosis penyembuhan luka.'},

  memotret:{kat:'Pemantauan',judul:'Cara memotret dan mengukur luka',tint:'mint',ic:'camera',
    lead:'Enam kebiasaan ini sudah cukup.',
    isi:[['Cahaya sama','Cahaya alami dekat jendela, jangan lampu kilat langsung ke luka.'],
      ['Jarak sama','Isi oval panduan setiap kali, tanpa memotong tepi luka.'],
      ['Sudut sama','Lurus dari depan, bukan menyerong.'],
      ['Posisi sama','Posisi kaki dan alas yang sama setiap sesi.'],
      ['Kalibrasi dengan benda acuan','Letakkan uang logam Rp1.000 di samping luka, lalu tandai kedua tepinya di menu Kalibrasi. Setelah itu ukuran dalam sentimeter menjadi jauh lebih dapat dipercaya.'],
      ['Ukur sisi terpanjang','Di menu Ukur luka, geser tanda silang ke satu ujung luka, tekan +, lalu geser ke ujung seberangnya dan tekan + lagi.']],
    tutup:'Konsistensi selalu lebih menentukan daripada kualitas kamera.',
    sumber:'Panduan internal DIWACARE, mengikuti prinsip dokumentasi luka standar.'},

  klasifikasi:{kat:'Pemantauan',judul:'Enam hal yang dicatat klinisi: SINBAD',tint:'lilac',ic:'list',
    lead:'Saat tenaga kesehatan mendokumentasikan luka kaki diabetik, ada enam butir yang selalu dicatat.',
    isi:[['S — Site, letaknya','Bagian depan, tengah, atau belakang kaki; sisi telapak, punggung, dalam, atau luar.'],
      ['I — Ischemia, aliran darahnya','Nadi masih teraba atau tidak, hasil pemeriksaan Doppler, nilai ABI atau tekanan jari kaki.'],
      ['N — Neuropathy, rasa pelindungnya','Apakah rasa pelindung masih ada, diperiksa antara lain dengan monofilamen 10 gram.'],
      ['B — Bacterial infection, infeksinya','Ringan, sedang, atau berat menurut kriteria IWGDF/IDSA.'],
      ['A — Area, luasnya','Dinyatakan dalam sentimeter persegi. Bagian inilah yang coba dibantu dokumentasinya oleh DIWACARE.'],
      ['D — Depth, kedalamannya','Sebatas kulit, menembus jaringan bawah kulit, mengenai otot dan tendon, atau sudah sampai tulang.']],
    tutup:'Mengetahui enam butir ini membuat Anda lebih siap saat kontrol. Anda jadi paham apa yang sedang dicari dan mengapa pertanyaannya seperti itu.',
    sumber:'Sistem klasifikasi SINBAD, IWGDF Practical Guidelines 2023.'},

  empatminggu:{kat:'Pemantauan',judul:'Titik empat minggu dan kapan dirujuk',tint:'butter',ic:'target',
    lead:'Ada dua tenggat yang sering dipakai untuk menilai apakah rencana perawatan perlu diubah.',
    isi:[['Penyusutan 50% pada minggu keempat','Bila luas luka belum menyusut sekitar setengahnya setelah empat minggu perawatan yang baik, itu tanda untuk meninjau ulang, bukan tanda untuk menyerah.'],
      ['Empat sampai enam minggu tanpa kemajuan','Pedoman internasional menyebutkan luka yang tidak menunjukkan kemajuan penyembuhan dalam empat sampai enam minggu meskipun perawatannya sudah optimal sebaiknya dirujuk ke layanan yang lebih khusus.'],
      ['Yang biasanya ditinjau ulang','Apakah tekanan pada luka sudah benar-benar dikurangi, apakah ada infeksi yang belum tertangani, apakah aliran darahnya cukup, dan apakah gula darahnya terkendali.'],
      ['Rujukan bukan kegagalan','Merujuk berarti menambah orang yang menangani, bukan mengganti. Semakin cepat dilakukan, semakin banyak pilihan yang masih terbuka.']],
    tutup:'DIWACARE menandai titik empat minggu secara otomatis dari data Anda sendiri, lalu menyerahkan penilaiannya kepada tenaga kesehatan.',
    sumber:'IWGDF Practical Guidelines 2023, bagian kriteria rujukan.'},

  /* ---------- Pencegahan ---------- */
  periksa:{kat:'Pencegahan',judul:'Memeriksa kaki setiap hari',tint:'butter',ic:'eye',
    lead:'Kebiasaan dua menit, sebaiknya pada jam yang sama setiap malam.',
    isi:[['Periksa seluruh bagian','Punggung kaki, telapak, tumit, dan sela-sela setiap jari. Cermin yang diletakkan di lantai membantu melihat telapak.'],
      ['Yang dicari','Kemerahan baru, lepuh, luka gores, kulit pecah, bengkak, atau satu bagian yang terasa lebih hangat.'],
      ['Raba, jangan hanya lihat','Bandingkan kedua kaki dengan punggung tangan. Perbedaan suhu di satu sisi layak dicatat.'],
      ['Mencuci kaki','Pakai air di bawah 37 derajat Celsius — diukur dengan siku atau termometer, bukan dengan telapak kaki yang rasanya sudah menumpul. Keringkan sampai ke sela jari.']],
    tutup:'Apa pun yang baru dan belum mereda dalam satu dua hari sebaiknya ditunjukkan kepada tenaga kesehatan.',
    sumber:'Anjuran perawatan kaki mandiri, IWGDF Practical Guidelines 2023.'},

  lindungi:{kat:'Pencegahan',judul:'Melindungi kaki',tint:'lilac',ic:'shield',
    lead:'Sebagian besar luka kaki diabetik berawal dari tekanan atau gesekan yang tidak terasa.',
    isi:[['Jangan bertelanjang kaki','Termasuk di dalam rumah, dan terutama di permukaan yang panas. Berjalan hanya dengan kaus kaki juga terhitung.'],
      ['Periksa bagian dalam alas kaki','Raba dengan tangan sebelum memakainya. Satu kerikil kecil bisa menimbulkan masalah besar.'],
      ['Kaus kaki tanpa jahitan menonjol','Ganti setiap hari. Jahitan yang menekan bisa menjadi titik awal lecet.'],
      ['Potong kuku lurus','Mengikuti bentuk ujung jari, tidak membulat sampai ke sudut, agar tidak tumbuh menusuk ke dalam.'],
      ['Rawat kulit','Lembapkan kulit yang kering, tetapi jangan di sela-sela jari — kelembapan yang tertahan di sana mengundang jamur.']],
    tutup:'Pencegahan memang tidak terlihat menarik, tetapi terbukti paling efektif.',
    sumber:'IWGDF Practical Guidelines 2023, lima pilar pencegahan.'},

  alaskaki:{kat:'Pencegahan',judul:'Memilih alas kaki yang benar',tint:'mint',ic:'ruler',
    lead:'Sepatu yang salah adalah penyebab luka kaki yang paling sering dan paling mudah dicegah.',
    isi:[['Panjang bagian dalam','Beri ruang 1 sampai 2 sentimeter lebih panjang daripada kaki Anda saat berdiri.'],
      ['Lebar dan tinggi','Lebarnya harus memberi ruang di bagian pangkal jari, tingginya cukup agar jari tidak tertekan dari atas.'],
      ['Coba sambil berdiri','Ukur dan coba saat berdiri, lebih baik pada sore atau malam hari ketika kaki sedang dalam ukuran terbesarnya.'],
      ['Alas kaki khusus bila perlu','Bila ada kelainan bentuk kaki, riwayat luka sebelumnya, atau tanda tekanan berlebih seperti kapalan dan kemerahan menetap, alas kaki terapeutik yang diresepkan lebih tepat daripada sepatu biasa.'],
      ['Jangan pakai lagi sepatu penyebab luka','Sepatu yang pernah menyebabkan luka tidak boleh dipakai kembali, sebaik apa pun kelihatannya.'],
      ['Pakai secara bertahap','Sepatu baru dicoba sebentar-sebentar dulu, sambil kaki diperiksa setelahnya.']],
    tutup:'Alas kaki dipakai di dalam maupun di luar rumah. Perlindungan yang hanya berlaku setengah hari tidak banyak menolong.',
    sumber:'IWGDF Practical Guidelines 2023, bagian alas kaki.'},

  risiko:{kat:'Pencegahan',judul:'Empat tingkat risiko dan jadwal periksanya',tint:'sky',ic:'shield',
    lead:'Seberapa sering kaki perlu diperiksa tenaga kesehatan bergantung pada tingkat risikonya.',
    isi:[['Tingkat 0 — sangat rendah','Rasa pelindung masih baik dan tidak ada penyakit arteri perifer. Pemeriksaan cukup setahun sekali.'],
      ['Tingkat 1 — rendah','Sudah ada salah satu: rasa pelindung menurun, atau penyakit arteri perifer. Diperiksa setiap 6 sampai 12 bulan.'],
      ['Tingkat 2 — sedang','Rasa pelindung menurun bersamaan dengan penyakit arteri perifer, atau salah satunya disertai kelainan bentuk kaki. Diperiksa setiap 3 sampai 6 bulan.'],
      ['Tingkat 3 — tinggi','Pernah mengalami luka kaki, pernah diamputasi, atau menjalani cuci darah. Diperiksa setiap 1 sampai 3 bulan.']],
    tutup:'Menu Cek Faktor Risiko di aplikasi ini mengikuti faktor-faktor yang sama, tetapi hasilnya bersifat edukatif. Penetapan tingkat risiko yang sesungguhnya dilakukan lewat pemeriksaan langsung.',
    sumber:'Sistem stratifikasi risiko IWGDF, Practical Guidelines 2023.'},

  kapan:{kat:'Pencegahan',judul:'Kapan harus segera ke tenaga kesehatan',tint:'blush',ic:'alert',
    lead:'Beberapa temuan sebaiknya tidak menunggu jadwal kontrol berikutnya.',
    isi:[['Kemerahan meluas atau terasa panas','Apalagi bila disertai demam atau badan terasa tidak enak.'],
      ['Cairan atau bau baru','Perubahan bau atau cairan yang keluar dari luka.'],
      ['Muncul jaringan gelap','Area hitam atau gelap yang baru di dalam maupun di sekitar luka.'],
      ['Luka tidak mengecil','Nyaris tidak ada perubahan setelah beberapa minggu perawatan.'],
      ['Nyeri atau kebas baru','Perubahan rasa, ke arah mana pun.'],
      ['Kaki mendadak merah, panas, dan bengkak','Terutama bila rasa kakinya sudah menumpul. Ini termasuk keadaan yang perlu dinilai segera.']],
    tutup:'DIWACARE bisa menandai tren, tetapi tidak bisa memeriksa Anda. Bila ragu, hubungi tenaga kesehatan.',
    sumber:'Kriteria rujukan IWGDF Practical Guidelines 2023.'},

  /* ---------- Hidup sehari-hari ---------- */
  gula:{kat:'Hidup Sehari-hari',judul:'Gula darah dan penyembuhan luka',tint:'butter',ic:'trend',
    lead:'Mengendalikan gula darah bukan urusan terpisah dari luka. Keduanya satu perkara.',
    isi:[['Kenapa berpengaruh','Gula darah tinggi menumpulkan kerja sel darah putih, mempercepat pembentukan AGE yang merusak pembuluh halus, dan memperlambat pembentukan kolagen.'],
      ['HbA1c menggambarkan rata-rata','Pemeriksaan HbA1c mencerminkan rata-rata gula darah sekitar dua sampai tiga bulan terakhir, jadi tidak bisa diperbaiki mendadak menjelang kontrol.'],
      ['Sasarannya tidak seragam','Sasaran gula darah setiap orang berbeda, bergantung pada usia, lama menyandang diabetes, penyakit penyerta, dan risiko gula darah turun terlalu rendah. Angkanya ditetapkan bersama dokter Anda.'],
      ['Yang bisa Anda kerjakan','Minum obat sesuai jadwal, makan dengan pola yang tetap, bergerak secara teratur, dan mencatat hasil pengukuran agar polanya terlihat.']],
    tutup:'Luka yang tidak kunjung membaik kadang bukan soal balutannya, melainkan soal gula darah yang masih tinggi berbulan-bulan.',
    sumber:'American Diabetes Association, Standards of Care in Diabetes; dan mekanisme AGE pada Frontiers in Endocrinology (2023).'},

  makan:{kat:'Hidup Sehari-hari',judul:'Makanan yang membantu luka menutup',tint:'mint',ic:'heart',
    lead:'Tubuh sedang membangun jaringan baru. Bahan bakunya datang dari piring Anda.',
    isi:[['Protein','Kolagen tersusun dari asam amino. Kekurangan protein memperlambat pembentukan jaringan baru. Sumbernya bisa telur, ikan, ayam, tahu, tempe, dan kacang-kacangan.'],
      ['Vitamin C','Diperlukan untuk hidroksilasi kolagen — tanpa itu kolagen yang terbentuk rapuh. Ada pada jambu biji, jeruk, pepaya, dan sayuran hijau.'],
      ['Seng dan zat besi','Berperan pada pembelahan sel dan pengangkutan oksigen. Kekurangannya sering menyertai penyembuhan yang tersendat.'],
      ['Cairan yang cukup','Aliran darah yang baik memerlukan volume cairan yang cukup, kecuali dokter Anda memberi batasan khusus.'],
      ['Tetap dalam pola diabetes','Semua di atas tetap harus masuk ke dalam pengaturan pola makan diabetes Anda. Menambah porsi tanpa perhitungan justru menaikkan gula darah.']],
    tutup:'Bila nafsu makan menurun atau berat badan turun tanpa sengaja, sampaikan kepada tenaga kesehatan. Itu ikut memengaruhi penyembuhan.',
    sumber:'Physiology of Wound Healing, StatPearls; dan prinsip gizi klinis umum.'},

  gerak:{kat:'Hidup Sehari-hari',judul:'Bergerak tanpa menekan luka',tint:'sky',ic:'refresh',
    lead:'Aktivitas bagus untuk aliran darah, tetapi luka di telapak kaki tidak boleh terus diinjak.',
    isi:[['Kenapa tekanan harus dikurangi','Luka di telapak kaki yang terus menerima beban berjalan sulit menutup, sebaik apa pun balutannya. Mengurangi tekanan adalah bagian utama pengobatannya, bukan pelengkap.'],
      ['Alat pelega tekanan','Untuk luka telapak akibat neuropati, pilihan pertama menurut pedoman adalah alat setinggi lutut yang tidak bisa dilepas sendiri, seperti total contact cast. Pilihan berikutnya alat yang bisa dilepas, disertai penjelasan agar tetap dipakai.'],
      ['Senam kaki','Gerakan sederhana untuk pergelangan dan jari kaki membantu peredaran darah dan kelenturan otot. Kementerian Kesehatan menganjurkannya sebagai bagian perawatan kaki.'],
      ['Pilih aktivitas yang tidak membebani luka','Selama ada luka telapak, aktivitas dengan posisi duduk atau berbaring, atau yang membebani lengan, lebih aman daripada berjalan jauh.']],
    tutup:'Tanyakan kepada tenaga kesehatan Anda bentuk aktivitas yang aman selama luka masih ada. Jawabannya berbeda-beda menurut letak lukanya.',
    sumber:'IWGDF Guidelines on offloading foot ulcers (pembaruan 2023) dan Kementerian Kesehatan RI.'},

  /* ---------- Panduan aplikasi ---------- */
  panduan:{kat:'Panduan DIWACARE',judul:'Cara memakai DIWACARE',tint:'mint',ic:'spark',
    lead:'Alurnya satu jalur, dari janji temu sampai tanggapan tenaga kesehatan.',
    isi:[['1. Buat janji temu dulu','Setiap dokumentasi perlu ada yang membacanya. Karena itu asesmen baru terbuka setelah Anda terhubung dengan satu dokter atau perawat.'],
      ['2. Asesmen','Jawab tiga pertanyaan tentang luka, potret lewat kamera terpandu, ukur bila perlu, lalu biarkan analisis berjalan di perangkat Anda.'],
      ['3. Menunggu tinjauan','Setelah terkirim, statusnya Menunggu. Tenaga kesehatan Anda membaca fotonya, hasil analisisnya, dan keluhan yang Anda pilih.'],
      ['4. Aman atau dirujuk','Tenaga kesehatan mengirim catatan analisis. Bila aman, perawatan di rumah dilanjutkan. Bila perlu penanganan langsung, terbit surat rujukan dan statusnya berubah menjadi Dirujuk.'],
      ['5. Luka Saya','Grafik tren, pembanding sebelum–sesudah, dan seluruh riwayat ada di sini. Dokumentasi milik Anda, jadi bisa dihapus sendiri kapan pun.']],
    tutup:'Semua yang Anda masukkan tersimpan di perangkat ini saja dan tidak diunggah ke mana pun.',
    sumber:'Panduan penggunaan DIWACARE.'},

  batas:{kat:'Panduan DIWACARE',judul:'Yang bisa dan tidak bisa dilakukan aplikasi ini',tint:'apricot',ic:'info',
    lead:'Menyebutkan batas dengan jujur membuat alat ini lebih berguna, bukan kurang berguna.',
    isi:[['Yang bisa','Mencatat luas luka dari foto, menyusun trennya dari minggu ke minggu, mengingatkan jadwal dokumentasi, dan menyalurkan hasilnya kepada tenaga kesehatan Anda.'],
      ['Yang tidak bisa','Menegakkan diagnosis, menilai kedalaman luka, memastikan ada tidaknya infeksi, atau menggantikan pemeriksaan langsung.'],
      ['Cara kerjanya bukan kecerdasan buatan','Penilaian statusnya berasal dari aturan yang ditulis eksplisit di dalam kode, dan setiap penanda selalu menyebutkan alasannya sendiri di layar.'],
      ['Angkanya perkiraan','Luas dan panjang yang ditampilkan adalah perkiraan dari analisis piksel, bukan pengukuran klinis. Kalibrasi dengan benda acuan membuatnya jauh lebih dapat dipercaya, tetapi tetap perkiraan.'],
      ['Belum diuji lintas warna kulit','Model warna yang dipakai belum diuji pada beragam tipe kulit dan kondisi pencahayaan. Ini keterbatasan yang penting Anda ketahui.']],
    tutup:'DIWACARE dibuat untuk menemani perawatan, bukan menggantikannya. Keputusan klinis selalu ada pada tenaga kesehatan yang memeriksa Anda.',
    sumber:'Dokumentasi purwarupa DIWACARE.'}
};
function eduModal(k){
  const e=EDU[k]; if(!e) return;
  const bd=openModal(`
    <span class="eyebrow">${esc(e.kat)}</span>
    <p style="font-family:var(--display);font-weight:700;font-size:1rem;margin:9px 0 17px;color:var(--ink-2);line-height:1.45">${esc(e.lead)}</p>
    <div class="grid" style="gap:11px">
      ${e.isi.map((b,i)=>`<div class="row" style="gap:11px;align-items:flex-start">
        <span class="ib ib-${e.tint}" style="width:26px;height:26px;border-radius:8px;font-family:var(--mono);font-weight:600;font-size:.7rem">${i+1}</span>
        <div style="flex:1"><div style="font-family:var(--display);font-weight:700;font-size:.89rem">${esc(b[0])}</div>
          <div class="tiny" style="color:var(--ink-2);line-height:1.6;margin-top:2px">${esc(b[1])}</div></div></div>`).join('')}
    </div>
    <div style="margin-top:17px;padding:13px;border-radius:var(--r-m);background:var(--tint-${e.tint})">
      <p class="tiny" style="color:var(--ink-2);line-height:1.6">${esc(e.tutup)}</p></div>
    ${e.sumber?`<div class="sumber">${icon('book')}<div><b>Sumber</b><span>${esc(e.sumber)}</span></div></div>`:''}
    <div class="row" style="justify-content:flex-end;margin-top:15px"><button class="btn btn-primary btn-sm" data-close>Tutup</button></div>`,
    {title:e.judul,wide:true});
  $$('[data-close]',bd).forEach(b=>b.addEventListener('click',closeModal));
}
window.DWeduModal=eduModal;

/* ------------------------------------------------------------
   KARTU OBAT DAN BAHAN
   Isinya pengenalan umum: golongan, gunanya, dan hal yang perlu
   diperhatikan. Tidak ada dosis, karena dosis adalah wewenang
   tenaga kesehatan yang memeriksa langsung.
   ------------------------------------------------------------ */
const KARTU=[
  {id:'metformin',nama:'Metformin',gol:'Obat diabetes oral',kat:'Obat diabetes',tint:'mint',
   guna:'Menurunkan produksi gula dari hati dan membuat tubuh lebih peka terhadap insulin. Paling sering menjadi obat pertama pada diabetes tipe 2.',
   awas:'Biasanya diminum bersama atau sesudah makan untuk mengurangi keluhan pada lambung. Beri tahu dokter bila ada gangguan ginjal.'},
  {id:'sulfonilurea',nama:'Sulfonilurea',gol:'Obat diabetes oral',kat:'Obat diabetes',tint:'mint',
   guna:'Golongan seperti glibenklamid dan glimepirid yang merangsang pankreas mengeluarkan lebih banyak insulin.',
   awas:'Bisa menurunkan gula darah terlalu jauh, terutama bila makan terlambat. Kenali tanda gemetar, keringat dingin, dan bingung, lalu segera minum yang manis.'},
  {id:'insulin',nama:'Insulin',gol:'Hormon suntik',kat:'Obat diabetes',tint:'sky',
   guna:'Menggantikan atau menambah insulin tubuh agar gula darah bisa masuk ke dalam sel. Ada yang kerja cepat, ada yang kerja panjang.',
   awas:'Tempat suntik perlu berpindah-pindah agar jaringan bawah kulit tidak menebal. Kenali tanda gula darah terlalu rendah.'},
  {id:'statin',nama:'Statin',gol:'Obat kolesterol',kat:'Pelindung pembuluh',tint:'lilac',
   guna:'Menurunkan kolesterol jahat. Sering diresepkan pada penyandang diabetes untuk menjaga pembuluh darah, termasuk pembuluh yang memberi makan kaki.',
   awas:'Laporkan bila muncul nyeri otot yang tidak biasa. Jangan berhenti sendiri tanpa memberi tahu dokter.'},
  {id:'antihipertensi',nama:'ACE inhibitor dan ARB',gol:'Obat tekanan darah',kat:'Pelindung pembuluh',tint:'lilac',
   guna:'Menurunkan tekanan darah sekaligus melindungi ginjal pada penyandang diabetes. Nama yang sering terdengar: kaptopril, lisinopril, valsartan.',
   awas:'Batuk kering yang menetap bisa menjadi efek golongan ACE inhibitor dan layak dilaporkan. Fungsi ginjal dan kalium darah biasanya dipantau berkala.'},
  {id:'antiplatelet',nama:'Antiplatelet',gol:'Pengencer darah ringan',kat:'Pelindung pembuluh',tint:'blush',
   guna:'Seperti aspirin dosis rendah atau klopidogrel, dipakai untuk mengurangi risiko sumbatan pembuluh pada sebagian penyandang diabetes.',
   awas:'Meningkatkan kecenderungan mudah memar dan berdarah. Sampaikan pemakaiannya sebelum tindakan apa pun, termasuk cabut gigi.'},
  {id:'nacl',nama:'NaCl 0,9%',gol:'Cairan pembersih luka',kat:'Perawatan luka',tint:'sky',
   guna:'Larutan garam fisiologis untuk membersihkan luka. Kadar garamnya setara cairan tubuh sehingga tidak merusak jaringan yang sedang tumbuh.',
   awas:'Menjadi pilihan pertama pembersih luka justru karena sifatnya netral. Sekali kemasan terbuka, ikuti aturan simpan yang tertera.'},
  {id:'povidon',nama:'Povidon iodin',gol:'Antiseptik',kat:'Perawatan luka',tint:'apricot',
   guna:'Membunuh kuman di permukaan kulit dan luka. Warnanya cokelat khas dan biasa dipakai sebelum tindakan.',
   awas:'Penggunaan berulang pada luka terbuka dapat mengganggu jaringan baru. Pemakaiannya pada luka kronik perlu arahan tenaga kesehatan.'},
  {id:'hidrokoloid',nama:'Balutan hidrokoloid',gol:'Balutan modern',kat:'Balutan',tint:'lilac',
   guna:'Menjaga luka tetap lembap terkendali sehingga sel perbaikan bekerja lebih nyaman, sekaligus melindungi dari gesekan.',
   awas:'Tidak untuk semua jenis luka. Luka dengan banyak cairan atau tanda infeksi memerlukan jenis balutan lain.'},
  {id:'alginat',nama:'Balutan alginat',gol:'Balutan penyerap',kat:'Balutan',tint:'mint',
   guna:'Terbuat dari serat rumput laut yang menyerap cairan luka dalam jumlah banyak dan berubah menjadi gel lembut.',
   awas:'Dipakai untuk luka yang basah. Pada luka kering justru bisa membuat permukaannya menempel dan sakit saat dibuka.'},
  {id:'hidrogel',nama:'Balutan hidrogel',gol:'Balutan pelembap',kat:'Balutan',tint:'sky',
   guna:'Menambahkan kelembapan pada luka yang terlalu kering, sehingga jaringan mati lebih mudah lepas dengan sendirinya.',
   awas:'Justru tidak cocok untuk luka yang sudah banyak mengeluarkan cairan, karena bisa membuat kulit sekitarnya melunak dan rusak.'},
  {id:'busa',nama:'Balutan busa',gol:'Balutan penyerap dan pelindung',kat:'Balutan',tint:'butter',
   guna:'Menyerap cairan sedang sampai banyak sambil memberi bantalan terhadap tekanan. Sering dipakai pada daerah yang menahan beban.',
   awas:'Perlu diganti sesuai jadwal, bukan menunggu bocor. Balutan yang sudah jenuh berhenti melindungi dan mulai melukai kulit sekitar.'},
  {id:'perak',nama:'Balutan mengandung perak',gol:'Balutan antimikroba',kat:'Balutan',tint:'apricot',
   guna:'Melepaskan ion perak yang menekan pertumbuhan bakteri pada permukaan luka yang dicurigai bermasalah.',
   awas:'Bukan untuk pemakaian rutin jangka panjang. Dipakai terbatas dan dievaluasi ulang oleh tenaga kesehatan.'},
  {id:'antibiotik',nama:'Antibiotik',gol:'Obat infeksi',kat:'Infeksi',tint:'blush',
   guna:'Melawan bakteri ketika luka benar-benar terinfeksi. Bisa berupa salep untuk permukaan atau obat minum dan suntik untuk infeksi yang lebih dalam.',
   awas:'Hanya atas resep. Menghentikan sebelum waktunya atau memakai sisa obat lama membuat bakteri makin sulit diobati.'},
  {id:'analgesik',nama:'Parasetamol',gol:'Pereda nyeri dan demam',kat:'Gejala',tint:'butter',
   guna:'Meredakan nyeri ringan sampai sedang dan menurunkan demam. Sering menjadi pilihan awal karena relatif lembut pada lambung.',
   awas:'Ada batas jumlah harian yang tidak boleh dilewati. Periksa apakah obat lain yang Anda minum sudah mengandung parasetamol juga.'},
  {id:'nyerisaraf',nama:'Obat nyeri saraf',gol:'Untuk neuropati',kat:'Gejala',tint:'lilac',
   guna:'Golongan seperti pregabalin, gabapentin, duloksetin, atau amitriptilin dipakai untuk nyeri akibat kerusakan saraf, yang tidak mempan dengan pereda nyeri biasa.',
   awas:'Sering menimbulkan kantuk dan pusing pada awal pemakaian, dan dosisnya dinaikkan bertahap. Jangan dihentikan mendadak.'},
  {id:'debridemen',nama:'Debridemen',gol:'Tindakan, bukan obat',kat:'Tindakan',tint:'apricot',
   guna:'Pengangkatan jaringan mati dari dasar luka agar jaringan sehat punya ruang untuk tumbuh. Dikerjakan tenaga kesehatan terlatih.',
   awas:'Tidak boleh dikerjakan sendiri di rumah. Mengelupas jaringan dengan alat seadanya berisiko memperbesar luka dan menambah infeksi.'},
  {id:'offloading',nama:'Alat pelega tekanan',gol:'Tindakan, bukan obat',kat:'Tindakan',tint:'mint',
   guna:'Sepatu khusus, alat setinggi lutut, atau total contact cast yang memindahkan beban dari luka. Untuk luka telapak akibat neuropati, ini bagian utama pengobatan.',
   awas:'Alat yang bisa dilepas hanya berguna bila benar-benar dipakai. Pedoman internasional justru mengutamakan alat yang tidak bisa dilepas sendiri.'},
  {id:'monofilamen',nama:'Monofilamen 10 gram',gol:'Alat periksa',kat:'Alat pemeriksaan',tint:'sky',
   guna:'Serat nilon yang ditekan pada beberapa titik telapak kaki untuk menguji apakah rasa pelindung masih ada. Sederhana, murah, dan sangat menentukan.',
   awas:'Hasilnya bukan penilaian akhir. Bila rasa pelindung berkurang, kaki masuk kelompok yang perlu diperiksa lebih sering.'},
  {id:'abi',nama:'Pemeriksaan ABI',gol:'Alat periksa',kat:'Alat pemeriksaan',tint:'blush',
   guna:'Membandingkan tekanan darah di pergelangan kaki dengan di lengan untuk menilai aliran darah ke tungkai. Nilai normalnya sekitar 0,9 sampai 1,3.',
   awas:'Pada pembuluh yang mengeras karena diabetes, nilainya bisa terbaca lebih tinggi dari keadaan sebenarnya, sehingga sering dilengkapi pemeriksaan lain.'}
];

/* ------------------------------------------------------------
   KUIS SINGKAT
   ------------------------------------------------------------ */
const SOAL=[
  {t:'Kaki sebaiknya diperiksa setiap…',p:['Seminggu sekali','Setiap hari','Hanya bila terasa sakit','Sebulan sekali'],b:1,
   k:'Setiap hari. Saraf yang menumpul membuat luka kecil bisa tidak terasa berhari-hari, jadi mata menggantikan peran rasa nyeri.'},
  {t:'Berjalan tanpa alas kaki di dalam rumah…',p:['Tetap berisiko','Aman selama lantainya bersih','Dianjurkan agar kaki bernapas','Hanya berbahaya di luar rumah'],b:0,
   k:'Tetap berisiko. Kerikil, serpihan, atau lantai panas bisa melukai tanpa terasa. Berjalan hanya dengan kaus kaki pun terhitung.'},
  {t:'Melembapkan kulit kaki sebaiknya dilakukan…',p:['Hanya pada telapak','Termasuk di sela-sela jari','Di seluruh kaki kecuali sela jari','Tidak perlu sama sekali'],b:2,
   k:'Di seluruh kaki kecuali sela jari. Kelembapan yang tertahan di sela jari justru mengundang jamur dan kulit pecah.'},
  {t:'Air untuk mencuci kaki sebaiknya bersuhu…',p:['Sepanas yang tertahan','Di bawah 37 derajat Celsius','Sedingin mungkin','Tidak penting diperhatikan'],b:1,
   k:'Di bawah 37 derajat Celsius, dan diukur dengan siku atau termometer — bukan dengan telapak kaki yang rasanya sudah menumpul.'},
  {t:'Warna kekuningan pada dasar luka umumnya menandakan…',p:['Luka sudah sembuh','Warna normal kulit','Jaringan mati yang pasti','Lapisan lunak yang bisa memperlambat penutupan'],b:3,
   k:'Lapisan lunak yang bisa memperlambat penutupan bila menutupi sebagian besar permukaan. Penilaian pastinya tetap oleh tenaga kesehatan.'},
  {t:'Jaringan merah muda berbutir pada dasar luka biasanya…',p:['Jaringan granulasi yang sedang tumbuh','Tanda infeksi berat','Sisa darah kering','Jaringan yang mati'],b:0,
   k:'Jaringan granulasi — jaringan baru yang sedang mengisi luka. Umumnya pertanda perbaikan sedang berjalan.'},
  {t:'Titik empat minggu dipakai untuk…',p:['Menghentikan pengobatan','Menentukan jenis diabetes','Meninjau ulang rencana perawatan bila penyusutan kurang dari 50%','Mengganti dokter'],b:2,
   k:'Meninjau ulang rencana perawatan. Penyusutan kurang dari 50% pada minggu keempat adalah penanda yang lazim dipakai dalam literatur luka.'},
  {t:'Menurut pedoman internasional, luka yang tidak menunjukkan kemajuan meski perawatannya optimal sebaiknya dirujuk setelah…',p:['1 minggu','4 sampai 6 minggu','6 bulan','1 tahun'],b:1,
   k:'Empat sampai enam minggu. Merujuk lebih awal berarti lebih banyak pilihan penanganan yang masih terbuka.'},
  {t:'Agar foto luka bisa dibandingkan antarwaktu, yang paling menentukan adalah…',p:['Kamera yang mahal','Jumlah foto sebanyak mungkin','Filter warna','Konsistensi jarak, sudut, dan cahaya'],b:3,
   k:'Konsistensi. Bila jarak dan cahaya berubah-ubah, yang terlihat berbeda bisa jadi kameranya, bukan lukanya.'},
  {t:'Uang logam yang diletakkan di samping luka berfungsi untuk…',p:['Menakar kedalaman luka','Mengukur suhu kulit','Memberi skala agar piksel bisa diubah menjadi sentimeter','Menahan balutan'],b:2,
   k:'Memberi skala. Tanpa benda acuan berukuran diketahui, aplikasi hanya tahu proporsi — bukan ukuran sebenarnya.'},
  {t:'Menemukan kemerahan baru yang meluas disertai demam sebaiknya…',p:['Ditunggu sampai jadwal kontrol','Diobati dengan sisa antibiotik di rumah','Cukup dikompres es','Segera dilaporkan ke tenaga kesehatan'],b:3,
   k:'Segera dilaporkan. Kemerahan meluas dengan demam termasuk temuan yang tidak sebaiknya menunggu jadwal berikutnya.'},
  {t:'Menurut kriteria IWGDF/IDSA, sebuah luka disebut terinfeksi bila ada…',p:['Minimal dua tanda radang lokal, atau keluar nanah','Rasa nyeri saja','Luka yang lebih dari 2 cm','Warna kemerahan sedikit di tepi'],b:0,
   k:'Minimal dua tanda radang lokal — kemerahan, hangat, pengerasan, nyeri — atau adanya nanah. Pada diabetes, nyeri sering tidak muncul, jadi jangan menunggu sakit.'},
  {t:'Hasil analisis foto di DIWACARE adalah…',p:['Diagnosis resmi','Perkiraan untuk memantau tren','Pengganti kunjungan dokter','Hasil laboratorium'],b:1,
   k:'Perkiraan untuk memantau tren. Aplikasi ini menghitung luas dan warna dari piksel foto lalu memakai aturan yang ditulis eksplisit — bukan diagnosis.'},
  {t:'Yang boleh mengangkat jaringan mati dari dasar luka adalah…',p:['Pasien sendiri di rumah','Anggota keluarga','Tenaga kesehatan terlatih','Siapa saja asal alatnya bersih'],b:2,
   k:'Tenaga kesehatan terlatih. Debridemen sendiri di rumah berisiko memperbesar luka dan menambah infeksi.'},
  {t:'Bagian kaki yang paling sering terlewat saat memeriksa sendiri adalah…',p:['Punggung kaki','Betis','Pergelangan','Telapak dan sela jari'],b:3,
   k:'Telapak dan sela jari. Cermin yang diletakkan di lantai sangat membantu melihat bagian bawah kaki.'},
  {t:'Sepatu yang pernah menyebabkan luka di kaki sebaiknya…',p:['Dipakai lagi setelah luka sembuh','Tidak dipakai lagi','Dipakai hanya di dalam rumah','Diberi bantalan tambahan lalu dipakai'],b:1,
   k:'Tidak dipakai lagi, sebaik apa pun kelihatannya. Sepatu itu sudah terbukti menimbulkan tekanan di titik yang salah.'},
  {t:'Panjang bagian dalam sepatu sebaiknya lebih panjang daripada kaki sebesar…',p:['1 sampai 2 sentimeter','Tepat pas tanpa ruang','5 sentimeter','Tidak ada patokan'],b:0,
   k:'Satu sampai dua sentimeter, diukur sambil berdiri dan sebaiknya pada sore hari ketika kaki dalam ukuran terbesarnya.'},
  {t:'Fase penyembuhan luka yang berlangsung paling lama adalah…',p:['Hemostasis','Inflamasi','Proliferasi','Remodeling'],b:3,
   k:'Remodeling, yang dimulai sekitar hari ke-21 dan bisa berlanjut sampai satu tahun. Di tahap inilah kolagen tipe III diganti kolagen tipe I yang lebih kuat.'},
  {t:'Kekuatan jaringan yang sudah sembuh sempurna mencapai sekitar…',p:['50% kekuatan kulit asli','80% kekuatan kulit asli','100% seperti semula','120% karena ada bekas luka'],b:1,
   k:'Sekitar 80%. Bekas luka tidak pernah sekuat kulit yang belum pernah terluka, jadi daerah itu tetap perlu dilindungi meski sudah menutup.'},
  {t:'Zat gizi yang diperlukan agar kolagen terbentuk dengan benar antara lain…',p:['Vitamin C dan protein','Kafein','Garam','Gula tambahan'],b:0,
   k:'Vitamin C dan protein. Vitamin C diperlukan pada proses hidroksilasi kolagen; tanpa itu kolagen yang terbentuk rapuh.'},
  {t:'Untuk luka di telapak kaki akibat neuropati, bagian utama pengobatannya adalah…',p:['Mengganti balutan sesering mungkin','Mengurangi tekanan pada luka','Berjalan lebih banyak agar aliran darah lancar','Mengeringkan luka dengan kipas'],b:1,
   k:'Mengurangi tekanan. Luka telapak yang terus diinjak sulit menutup, sebaik apa pun balutannya.'},
  {t:'Pemeriksaan monofilamen 10 gram dipakai untuk menilai…',p:['Kadar gula darah','Kedalaman luka','Rasa pelindung pada telapak kaki','Tekanan darah'],b:2,
   k:'Rasa pelindung pada telapak kaki. Bila rasa ini berkurang, kaki masuk kelompok yang perlu diperiksa lebih sering.'},
  {t:'Seseorang yang pernah mengalami luka kaki diabetik termasuk tingkat risiko…',p:['Tingkat 0, sangat rendah','Tingkat 1, rendah','Tingkat 2, sedang','Tingkat 3, tinggi'],b:3,
   k:'Tingkat 3, tinggi. Menurut stratifikasi IWGDF, kelompok ini dianjurkan diperiksa setiap satu sampai tiga bulan.'},
  {t:'HbA1c menggambarkan rata-rata gula darah selama…',p:['24 jam terakhir','Seminggu terakhir','Dua sampai tiga bulan terakhir','Setahun terakhir'],b:2,
   k:'Dua sampai tiga bulan terakhir. Karena itu hasilnya tidak bisa diperbaiki mendadak menjelang kontrol.'},
  {t:'Kaki yang mendadak merah, panas, dan bengkak pada penyandang neuropati…',p:['Cukup dikompres di rumah','Perlu dinilai tenaga kesehatan segera','Wajar setelah berjalan jauh','Ditunggu seminggu dulu'],b:1,
   k:'Perlu dinilai segera. Gambaran itu termasuk yang mengarah pada kondisi serius seperti infeksi dalam atau kaki Charcot.'}
];

const KUIS_N=10;
function acakSoal(){
  const idx=SOAL.map((_,i)=>i);
  for(let i=idx.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=idx[i]; idx[i]=idx[j]; idx[j]=t; }
  return idx.slice(0,KUIS_N);
}
function eduData(p){ return (p&&p.edu) || {kuisTerbaik:0,kuisMain:0,kartuPaham:[]}; }
function simpanEdu(p,obj){ p.edu=obj; D.saveDB(); }

/* --- kartu obat: berurutan, sekali jalan --- */
let KT_UKUR=null;
/* Kartu maju sendiri setelah ditandai paham, dan tidak bisa diulang.
   Urutannya tetap agar materinya terbangun dari dasar ke lanjutan. */
function kartuBerikut(e){
  for(let i=0;i<KARTU.length;i++) if(e.kartuPaham.indexOf(KARTU[i].id)<0) return i;
  return -1;
}
function panelKartu(p){
  const e=eduData(p);
  const idx=kartuBerikut(e);
  const selesai=e.kartuPaham.length;

  if(idx<0) return `
    <div class="kuis-hasil">
      <span class="ib ib-brand" style="width:56px;height:56px;border-radius:17px">${icon('trophy')}</span>
      <h3 style="font-family:var(--display);font-weight:800;font-size:1.2rem;margin-top:14px">Semua kartu sudah dilalui</h3>
      <p style="color:var(--ink-2);font-size:.88rem;line-height:1.65;margin-top:8px;max-width:46ch">
        ${KARTU.length} kartu obat dan bahan perawatan sudah Anda tandai paham. Ingat, isinya pengenalan umum —
        dosis dan aturan pakai tetap ditentukan tenaga kesehatan yang memeriksa Anda.</p>
      <div class="row wrap" style="gap:8px;margin-top:17px;justify-content:center">
        <button class="btn btn-primary" data-tab="kuis">${icon('target')} Uji lewat kuis</button>
        <button class="btn btn-ghost" id="ktBaca">${icon('cards')} Baca ulang semua kartu</button>
      </div>
      <div id="ktArsip" class="sembunyi" style="width:100%;margin-top:19px;text-align:left">
        <span class="eyebrow">Arsip kartu</span>
        <div class="arsip-grid">${KARTU.map(k=>`
          <div class="arsip-kartu" style="background:var(--tint-${k.tint})">
            <div class="row spread" style="gap:8px"><b>${esc(k.nama)}</b>${icon('check')}</div>
            <em>${esc(k.gol)}</em>
            <p>${esc(k.guna)}</p>
            <p class="awas"><b>Perhatikan:</b> ${esc(k.awas)}</p>
          </div>`).join('')}</div>
      </div>
    </div>`;

  const k=KARTU[idx];
  return `
    <div class="row spread wrap" style="gap:10px;margin-bottom:13px">
      <div><span class="eyebrow">Kartu ${idx+1} dari ${KARTU.length}</span>
        <div class="tiny muted" style="margin-top:3px" id="ktHitung">${selesai} kartu sudah dilalui · sisa ${KARTU.length-selesai}</div></div>
      <span class="chip chip-muted">${icon('cards')} ${esc(k.kat||'Pengenalan')}</span>
    </div>
    <div class="laju" style="margin-bottom:16px"><i id="ktLaju" style="width:${selesai/KARTU.length*100}%"></i></div>
    <div class="kartu-obat" id="ktBox">
      <div class="ko-dalam">
        <div class="ko-sisi ko-depan" style="background:var(--tint-${k.tint})">
          <span class="ib" style="background:var(--veil);color:var(--ink-2)">${icon('pill')}</span>
          <h3>${esc(k.nama)}</h3>
          <span class="ko-gol">${esc(k.gol)}</span>
          <span class="ko-balik">${icon('refresh')} Ketuk untuk membalik</span>
        </div>
        <div class="ko-sisi ko-belakang">
          <div class="ko-kepala"><span class="ib ib-brand">${icon('pill')}</span>
            <div><b>${esc(k.nama)}</b><i>${esc(k.gol)}</i></div></div>
          <span class="eyebrow">Gunanya</span>
          <p>${esc(k.guna)}</p>
          <span class="eyebrow" style="margin-top:11px;display:block">Yang perlu diperhatikan</span>
          <p>${esc(k.awas)}</p>
        </div>
      </div>
    </div>
    <div class="kt-aksi">
      <button class="btn btn-ghost" id="ktPaham" disabled>${icon('check')} <span>Sudah Paham</span></button>
      <button class="btn btn-ghost" id="ktLanjut" disabled><span>Lanjut</span> ${icon('right')}</button>
    </div>
    <p class="hint kt-hint" id="ktHint">Balik dulu kartunya untuk membuka tombol <b>Sudah Paham</b>.</p>
    <div class="nota nota-warn" style="margin-top:15px">${icon('alert')}
      <div>Kartu ini pengenalan umum, bukan petunjuk pemakaian. Dosis, kombinasi, dan lamanya pemakaian
        selalu ditentukan tenaga kesehatan yang memeriksa Anda langsung.</div></div>`;
}
function pasangKartu(p){
  const ulang=()=>{ $('#eduPanel').innerHTML=panelKartu(p); pasangKartu(p); };
  const baca=$('#ktBaca');
  if(baca){
    baca.addEventListener('click',()=>{
      const ar=$('#ktArsip');
      ar.classList.toggle('sembunyi');
      baca.innerHTML = ar.classList.contains('sembunyi')
        ? icon('cards')+' Baca ulang semua kartu' : icon('x')+' Tutup arsip';
    });
    const kt=$('[data-tab="kuis"]');
    if(kt) kt.addEventListener('click',()=>go('pat.edu',{tab:'kuis'}));
    return;
  }
  const box=$('#ktBox'); if(!box) return;
  const bPaham=$('#ktPaham'), bLanjut=$('#ktLanjut'), hint=$('#ktHint');
  let dibalik=false, ditandai=false;

  /* tinggi kartu mengikuti sisi yang isinya paling panjang, supaya
     penjelasan di sisi belakang tidak pernah terpotong */
  const dalam=box.querySelector('.ko-dalam');
  const ukur=()=>{
    if(!dalam.isConnected){ window.removeEventListener('resize',ukur); return; }
    dalam.style.minHeight='0px';
    const t=Math.max(box.querySelector('.ko-depan').scrollHeight,
                     box.querySelector('.ko-belakang').scrollHeight);
    dalam.style.minHeight=(t+2)+'px';
  };
  if(KT_UKUR) window.removeEventListener('resize',KT_UKUR);
  KT_UKUR=ukur;
  window.addEventListener('resize',ukur);
  ukur();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(ukur).catch(()=>{});

  /* kartu harus dibalik dulu -> tombol Sudah Paham terbuka
     -> setelah ditandai paham, barulah tombol Lanjut terbuka */
  box.addEventListener('click',()=>{
    box.classList.toggle('balik');
    if(!dibalik && box.classList.contains('balik')){
      dibalik=true;
      bPaham.disabled=false;
      bPaham.classList.remove('btn-ghost'); bPaham.classList.add('btn-primary');
      hint.innerHTML='Sudah dibaca? Tekan <b>Sudah Paham</b> untuk menandainya.';
    }
  });

  bPaham.addEventListener('click',()=>{
    if(ditandai) return;
    const e=eduData(p), idx=kartuBerikut(e);
    if(idx<0) return;
    ditandai=true;
    e.kartuPaham=e.kartuPaham.concat([KARTU[idx].id]);
    simpanEdu(p,e);
    D.bunyi('sukses');
    const selesai=e.kartuPaham.length, sisa=KARTU.length-selesai;
    bPaham.disabled=true;
    bPaham.classList.remove('btn-primary'); bPaham.classList.add('btn-tandai');
    bPaham.innerHTML=icon('check')+'<span>Sudah ditandai</span>';
    bLanjut.disabled=false;
    bLanjut.classList.remove('btn-ghost'); bLanjut.classList.add('btn-primary');
    bLanjut.innerHTML='<span>'+(sisa?'Kartu berikutnya':'Lihat ringkasan')+'</span>'+icon('right');
    hint.innerHTML = sisa
      ? esc(KARTU[idx].nama)+' selesai. Sisa <b>'+sisa+'</b> kartu — tekan <b>'+(sisa?'Kartu berikutnya':'Lanjut')+'</b>.'
      : 'Kartu terakhir selesai. Tekan <b>Lihat ringkasan</b> untuk menutupnya.';
    const laju=$('#ktLaju'); if(laju) laju.style.width=(selesai/KARTU.length*100)+'%';
    const hit=$('#ktHitung'); if(hit) hit.textContent=selesai+' kartu sudah dilalui · sisa '+sisa;
    bLanjut.focus();
  });

  bLanjut.addEventListener('click',()=>{ if(!bLanjut.disabled) ulang(); });
}

/* --- kuis --- */
let KU=null;
function panelKuis(p){
  const e=eduData(p);
  if(!KU) return `
    <div class="kuis-mulai">
      <span class="ib ib-brand" style="width:52px;height:52px;border-radius:16px">${icon('target')}</span>
      <h3 style="font-family:var(--display);font-weight:800;font-size:1.15rem;margin-top:13px">Uji pemahaman Anda</h3>
      <p style="color:var(--ink-2);font-size:.88rem;line-height:1.65;margin-top:7px;max-width:44ch">
        Sepuluh pertanyaan diambil acak dari ${SOAL.length} soal tentang biologi penyembuhan, perawatan kaki,
        membaca luka, dan cara memakai aplikasi ini. Setiap jawaban langsung dijelaskan, benar maupun salah,
        jadi setiap putaran terasa berbeda.</p>
      <div class="row wrap" style="gap:8px;margin-top:15px;justify-content:center">
        ${e.kuisTerbaik?`<span class="chip chip-ok">${icon('trophy')} Skor terbaik ${e.kuisTerbaik}/${KUIS_N}</span>`:''}
        ${e.kuisMain?`<span class="chip chip-muted">${e.kuisMain}x dimainkan</span>`:''}
      </div>
      <button class="btn btn-primary btn-lg" id="kuMulai" style="margin-top:19px">${icon('play')} Mulai kuis</button>
    </div>`;

  if(KU.i>=KU.set.length){
    const persen=Math.round(KU.benar/KU.set.length*100);
    const pesan = persen>=90?'Pemahaman Anda sangat baik. Pertahankan kebiasaan memeriksa kaki setiap hari.'
      : persen>=70?'Sudah kuat. Baca ulang topik yang jawabannya meleset agar makin mantap.'
      : persen>=40?'Dasarnya sudah ada. Bagian Bacaan berisi penjelasan lengkap untuk yang masih ragu.'
      : 'Tidak apa-apa. Mulailah dari bagian Bacaan, lalu ulangi kuis ini kapan pun.';
    return `
      <div class="kuis-hasil">
        <div class="kuis-cincin" style="--isi:${persen}">
          <span class="tnum">${KU.benar}<i>/${KU.set.length}</i></span></div>
        <h3 style="font-family:var(--display);font-weight:800;font-size:1.2rem;margin-top:15px">${persen}% benar</h3>
        <p style="color:var(--ink-2);font-size:.88rem;line-height:1.65;margin-top:7px;max-width:44ch">${esc(pesan)}</p>
        ${KU.salah.length?`<div class="kuis-ulas">
          <span class="eyebrow">Yang perlu ditengok lagi</span>
          <div class="grid" style="gap:9px;margin-top:9px">${KU.salah.map(n=>`
            <div class="kuis-ulas-i"><b>${esc(SOAL[n].t)}</b><span>${esc(SOAL[n].k)}</span></div>`).join('')}</div>
        </div>`:''}
        <div class="row wrap" style="gap:8px;margin-top:19px;justify-content:center">
          <button class="btn btn-primary" id="kuUlang">${icon('refresh')} Main lagi</button>
          <button class="btn btn-ghost" id="kuKeluar">Kembali</button>
        </div>
      </div>`;
  }

  const s=SOAL[KU.set[KU.i]];
  return `
    <div class="row spread wrap" style="gap:10px;margin-bottom:12px">
      <span class="eyebrow">Pertanyaan ${KU.i+1} dari ${KU.set.length}</span>
      <span class="chip ${KU.benar?'chip-ok':'chip-muted'}">${icon('check')} ${KU.benar} benar</span>
    </div>
    <div class="laju" style="margin-bottom:18px"><i style="width:${KU.i/KU.set.length*100}%"></i></div>
    <h3 style="font-family:var(--display);font-weight:800;font-size:1.08rem;line-height:1.4">${esc(s.t)}</h3>
    <div class="kuis-pil" id="kuPil">${s.p.map((x,n)=>
      `<button class="kuis-p" data-p="${n}"><span class="kh mono">${String.fromCharCode(65+n)}</span><span>${esc(x)}</span></button>`).join('')}</div>
    <div id="kuUlas"></div>`;
}
function pasangKuis(p){
  const ulang=()=>{ $('#eduPanel').innerHTML=panelKuis(p); pasangKuis(p); };
  const m=$('#kuMulai');
  if(m){ m.addEventListener('click',()=>{ KU={i:0,benar:0,salah:[],set:acakSoal()}; D.siapkanAudio(); ulang(); }); return; }
  const u=$('#kuUlang'), kl=$('#kuKeluar');
  if(u){ u.addEventListener('click',()=>{ KU={i:0,benar:0,salah:[],set:acakSoal()}; ulang(); }); }
  if(kl){ kl.addEventListener('click',()=>{ KU=null; ulang(); }); }
  const pil=$('#kuPil'); if(!pil) return;
  $$('.kuis-p',pil).forEach(b=>b.addEventListener('click',()=>{
    if(pil.dataset.kunci) return;
    pil.dataset.kunci='1';
    const n=+b.dataset.p, s=SOAL[KU.set[KU.i]], tepat=n===s.b;
    $$('.kuis-p',pil).forEach(x=>{ x.disabled=true;
      if(+x.dataset.p===s.b) x.classList.add('benar');
      else if(x===b) x.classList.add('salah'); });
    if(tepat){ KU.benar++; D.bunyi('sukses'); } else { KU.salah.push(KU.set[KU.i]); D.bunyi('notif'); }
    $('#kuUlas').innerHTML=`
      <div class="nota ${tepat?'nota-brand':'nota-warn'}" style="margin-top:15px">${icon(tepat?'check':'lamp')}
        <div><b>${tepat?'Tepat.':'Belum tepat.'}</b> ${esc(s.k)}</div></div>
      <button class="btn btn-primary btn-block" id="kuLanjut" style="margin-top:13px">
        ${KU.i===KU.set.length-1?'Lihat hasil':'Pertanyaan berikutnya'} ${icon('right')}</button>`;
    $('#kuLanjut').addEventListener('click',()=>{
      KU.i++;
      if(KU.i>=KU.set.length){
        const e=eduData(p);
        e.kuisMain=(e.kuisMain||0)+1;
        if(KU.benar>(e.kuisTerbaik||0)) e.kuisTerbaik=KU.benar;
        simpanEdu(p,e);
      }
      $('#eduPanel').innerHTML=panelKuis(p); pasangKuis(p);
    });
  }));
}

/* --- peragaan bergerak: animasi yang dibangun di dalam aplikasi --- */
const PERAGA=[
  {id:'foto',judul:'Cara memotret yang benar',tint:'mint',
   ket:'Oval panduan menjaga jarak dan sudut tetap sama dari minggu ke minggu.',
   adegan:['Letakkan kaki pada alas yang sama','Isi oval panduan tanpa memotong tepi luka','Tahan sejenak sampai bingkai berhenti bergoyang','Tekan tombol rana']},
  {id:'ukur',judul:'Cara mengukur dengan dua titik',tint:'sky',
   ket:'Tanda silang digeser ke ujung luka, lalu tombol + menandai titiknya.',
   adegan:['Geser tanda silang ke satu ujung luka','Tekan tombol +','Geser ke ujung seberangnya','Tekan + sekali lagi — panjangnya muncul']},
  {id:'kalibrasi',judul:'Kenapa perlu benda acuan',tint:'apricot',
   ket:'Tanpa acuan, aplikasi hanya tahu proporsi, bukan sentimeter.',
   adegan:['Letakkan uang logam Rp1.000 di samping luka','Tandai kedua tepi uang logam','Aplikasi menghitung skala foto','Angka sentimeter menjadi berarti']},
  {id:'tren',judul:'Dari empat foto menjadi satu tren',tint:'lilac',
   ket:'Satu foto adalah potret sesaat. Empat foto barulah bercerita.',
   adegan:['Minggu 1 tercatat','Minggu 2 dibandingkan dengan minggu 1','Minggu 3 memperjelas arahnya','Minggu 4 menjadi titik evaluasi']}
];
/* panggung peragaan digambar sebagai SVG agar bentuknya jelas,
   sementara perpindahan antaradegan ditangani transisi CSS */
function panggung(id,n){
  const on=(a,b)=>n>=a && (b===undefined||n<=b) ? '1':'0';
  const luka=`<ellipse cx="150" cy="112" rx="26" ry="18" fill="var(--accent)" opacity=".55"/>
    <ellipse cx="150" cy="112" rx="15" ry="10" fill="var(--accent)" opacity=".85"/>`;
  if(id==='foto') return `<svg viewBox="0 0 300 200" class="pp" preserveAspectRatio="xMidYMid meet">
    <rect x="30" y="132" width="240" height="14" rx="7" fill="var(--veil)" opacity="${on(0)}"/>
    <path d="M120 132c0-30 12-52 30-52s30 22 30 52Z" fill="var(--veil)" opacity="${on(0)}"/>
    ${luka}
    <ellipse cx="150" cy="105" rx="${n>=1?78:96}" ry="${n>=1?58:72}" fill="none"
      stroke="${n>=3?'var(--ok)':'var(--brand)'}" stroke-width="3" stroke-dasharray="${n>=2?'0':'7 7'}"
      class="pp-t" opacity="${on(0)}"/>
    <circle cx="150" cy="176" r="14" fill="var(--brand)" opacity="${on(3)}" class="pp-rana"/>
    <text x="150" y="30" text-anchor="middle" font-size="12" fill="var(--ink-2)" opacity="${on(1)}">jarak &amp; sudut sama</text>
  </svg>`;
  if(id==='ukur') return `<svg viewBox="0 0 300 200" class="pp" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="150" cy="100" rx="62" ry="40" fill="var(--accent)" opacity=".38"/>
    <ellipse cx="150" cy="100" rx="40" ry="24" fill="var(--accent)" opacity=".7"/>
    <line x1="96" y1="122" x2="${n>=2?204:96}" y2="${n>=2?78:122}" stroke="var(--brand)" stroke-width="3.5"
      stroke-linecap="round" opacity="${on(2)}" class="pp-t"/>
    <g opacity="${on(1)}" class="pp-t"><circle cx="96" cy="122" r="8" fill="var(--brand)"/>
      <circle cx="96" cy="122" r="3" fill="#fff"/></g>
    <g opacity="${on(3)}" class="pp-t"><circle cx="204" cy="78" r="8" fill="var(--brand)"/>
      <circle cx="204" cy="78" r="3" fill="#fff"/></g>
    <g opacity="${n>=0&&n<3?'1':'0'}" class="pp-t">
      <line x1="${n>=2?204:96}" y1="${n>=2?58:102}" x2="${n>=2?204:96}" y2="${n>=2?98:142}" stroke="var(--ink-2)" stroke-width="1.6"/>
      <line x1="${n>=2?184:76}" y1="${n>=2?78:122}" x2="${n>=2?224:116}" y2="${n>=2?78:122}" stroke="var(--ink-2)" stroke-width="1.6"/></g>
    <text x="150" y="172" text-anchor="middle" font-size="13" font-weight="700" fill="var(--brand)"
      opacity="${on(3)}">3,6 cm</text>
  </svg>`;
  if(id==='kalibrasi') return `<svg viewBox="0 0 300 200" class="pp" preserveAspectRatio="xMidYMid meet">
    ${luka}
    <circle cx="70" cy="112" r="26" fill="var(--butter)" stroke="var(--ink-2)" stroke-width="1.4"
      opacity="${on(0)}" class="pp-t"/>
    <text x="70" y="117" text-anchor="middle" font-size="9" fill="var(--ink-2)" opacity="${on(0)}">Rp1.000</text>
    <g opacity="${on(1)}" class="pp-t">
      <circle cx="44" cy="112" r="5" fill="var(--brand)"/><circle cx="96" cy="112" r="5" fill="var(--brand)"/>
      <line x1="44" y1="112" x2="96" y2="112" stroke="var(--brand)" stroke-width="2" stroke-dasharray="4 4"/></g>
    <text x="70" y="156" text-anchor="middle" font-size="11" fill="var(--ink-2)" opacity="${on(2)}">24,1 mm</text>
    <g opacity="${on(3)}" class="pp-t">
      <line x1="124" y1="112" x2="176" y2="112" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
      <text x="150" y="70" text-anchor="middle" font-size="13" font-weight="700" fill="var(--accent)">2,4 cm</text></g>
  </svg>`;
  return `<svg viewBox="0 0 300 200" class="pp" preserveAspectRatio="xMidYMid meet">
    ${[0,1,2,3].map(i=>{
      const cx=48+i*68, r=[30,25,19,13][i];
      return `<g opacity="${n>=i?'1':'.22'}" class="pp-t">
        <circle cx="${cx}" cy="108" r="${r}" fill="var(--brand)" opacity="${n===i?'.9':'.42'}"/>
        <text x="${cx}" y="160" text-anchor="middle" font-size="10" fill="var(--ink-2)">Minggu ${i+1}</text></g>`;
    }).join('')}
    <path d="M48 78 Q116 62 184 89 T252 95" fill="none" stroke="var(--brand)" stroke-width="2.5"
      stroke-dasharray="260" stroke-dashoffset="${260-(n+1)*65}" class="pp-t" stroke-linecap="round"/>
    <text x="150" y="42" text-anchor="middle" font-size="12" fill="var(--ink-2)"
      opacity="${on(3)}">tren mulai terbaca</text>
  </svg>`;
}
let PG=null, PGtimer=null;
function panelPeraga(){
  if(!PG){
    return `<div class="peraga-grid">${PERAGA.map((x,i)=>`
      <button class="peraga-kartu" data-pg="${x.id}" style="--i:${i};background:var(--tint-${x.tint})">
        <span class="ib" style="background:var(--veil);color:var(--ink-2)">${icon('play')}</span>
        <h4>${esc(x.judul)}</h4><p>${esc(x.ket)}</p>
        <span class="go">Putar peragaan ${icon('right')}</span></button>`).join('')}</div>
      <div class="nota nota-info" style="margin-top:15px">${icon('info')}
        <div>Peragaan ini animasi yang dibangun langsung di dalam aplikasi, bukan berkas video yang diunduh.
          Karena itu tetap berjalan meski Anda sedang tidak terhubung ke internet.</div></div>`;
  }
  const x=PERAGA.find(v=>v.id===PG.id);
  return `
    <button class="btn btn-quiet btn-sm" id="pgKembali" style="margin-bottom:14px">${icon('left')} Semua peragaan</button>
    <div class="peraga-panggung" style="background:var(--tint-${x.tint})">${panggung(x.id,PG.n)}</div>
    <h3 style="font-family:var(--display);font-weight:800;font-size:1.06rem;margin-top:15px">${esc(x.judul)}</h3>
    <ol class="peraga-langkah">${x.adegan.map((a,i)=>
      `<li class="${i===PG.n?'kini':(i<PG.n?'lewat':'')}"><span class="mono">${i+1}</span>${esc(a)}</li>`).join('')}</ol>
    <div class="row" style="gap:8px;margin-top:15px">
      <button class="btn btn-quiet btn-sm" id="pgMundur"${PG.n===0?' disabled':''}>${icon('left')} Sebelumnya</button>
      <button class="btn btn-primary btn-sm" style="flex:1" id="pgMaju">
        ${PG.n>=x.adegan.length-1?'Ulangi dari awal':'Lanjut'} ${icon('right')}</button>
    </div>`;
}
function pasangPeraga(){
  const ulang=()=>{ $('#eduPanel').innerHTML=panelPeraga(); pasangPeraga(); };
  $$('[data-pg]').forEach(b=>b.addEventListener('click',()=>{ PG={id:b.dataset.pg,n:0}; ulang(); }));
  const kb=$('#pgKembali'); if(kb) kb.addEventListener('click',()=>{ PG=null; clearInterval(PGtimer); ulang(); });
  const mj=$('#pgMaju'), md=$('#pgMundur');
  if(mj) mj.addEventListener('click',()=>{
    const x=PERAGA.find(v=>v.id===PG.id);
    PG.n = PG.n>=x.adegan.length-1 ? 0 : PG.n+1; ulang();
  });
  if(md) md.addEventListener('click',()=>{ PG.n=Math.max(0,PG.n-1); ulang(); });
}

const EDU_TAB=[['baca','Bacaan','book'],['kartu','Kartu Obat','cards'],['kuis','Kuis','target'],['peraga','Peragaan','play']];
function panelBaca(){
  const kat={};
  Object.keys(EDU).forEach(k=>{ (kat[EDU[k].kat]=kat[EDU[k].kat]||[]).push([k,EDU[k]]); });
  return Object.keys(kat).map(c=>`
    <div style="margin-bottom:22px">
      <div class="eyebrow" style="margin-bottom:11px">${esc(c)}</div>
      <div class="edu-grid stagger">
        ${kat[c].map((x,i)=>`<div class="edu-card" style="--i:${i};background:var(--tint-${x[1].tint})">
          <span class="ib" style="background:var(--veil);color:var(--ink-2)">${icon(x[1].ic)}</span>
          <h4>${esc(x[1].judul)}</h4>
          <p>${esc(x[1].lead)}</p>
          <button class="go" data-edu="${x[0]}">Baca ${icon('right')}</button>
        </div>`).join('')}
      </div>
    </div>`).join('');
}
function panelEdu(tab,p){
  if(tab==='kartu') return panelKartu(p);
  if(tab==='kuis')  return panelKuis(p);
  if(tab==='peraga')return panelPeraga();
  return panelBaca();
}
function pasangPanel(tab,p){
  if(tab==='kartu') return pasangKartu(p);
  if(tab==='kuis')  return pasangKuis(p);
  if(tab==='peraga')return pasangPeraga();
  $$('[data-edu]').forEach(b=>b.addEventListener('click',()=>eduModal(b.dataset.edu)));
}

route('pat.edu',{auth:true,roles:PAS,render(params){
  const p=D.myPatient(), e=eduData(p);
  const tab=(params&&params.tab)||'baca';
  const sub={baca:Object.keys(EDU).length+' bacaan singkat dengan sumbernya, masing-masing sekitar satu menit',
    kartu:KARTU.length+' kartu pengenalan obat, balutan, dan alat — ketuk untuk membalik',
    kuis:'Sepuluh pertanyaan acak dari '+SOAL.length+' soal, setiap jawaban langsung dijelaskan',
    peraga:'Animasi langkah demi langkah yang berjalan di dalam aplikasi'}[tab];
  const body=`
    ${window.DWpageHead('Edukasi',sub,'')}
    <div class="row spread wrap" style="gap:11px;margin-bottom:17px">
      <div class="segs">${EDU_TAB.map(t=>
        `<button class="seg ${tab===t[0]?'on':''}" data-tab="${t[0]}">${icon(t[2])} ${t[1]}</button>`).join('')}</div>
      <div class="row wrap" style="gap:7px">
        ${e.kartuPaham.length?`<span class="chip chip-brand">${icon('cards')} ${e.kartuPaham.length}/${KARTU.length} kartu</span>`:''}
        ${e.kuisTerbaik?`<span class="chip chip-ok">${icon('trophy')} ${e.kuisTerbaik}/${KUIS_N}</span>`:''}
      </div>
    </div>
    <div class="card" id="eduKotak"><div id="eduPanel">${panelEdu(tab,p)}</div></div>
    ${window.DWdisclaimer}`;
  return shell('pat.edu','Edukasi','Memahami luka Anda dengan bahasa sehari-hari',body);
},mount(params){
  shellMount();
  const tab=(params&&params.tab)||'baca';
  $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.tab!=='kuis') KU=null;
    if(b.dataset.tab!=='peraga') PG=null;
    go('pat.edu',{tab:b.dataset.tab});
  }));
  pasangPanel(tab,D.myPatient());
}});
})();
