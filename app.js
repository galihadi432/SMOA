/* SMOA — frontend Metode 2 (GitHub Pages). Hak cipta Galih Adi Prasetyo. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const simpan = {
    ambil(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    tulis(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* abaikan */ } },
  };
  const fmt = n => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const hariIni = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const awalBulan = () => hariIni().slice(0, 8) + '01';
  const bulanIni = () => hariIni().slice(0, 7);

  let token = simpan.ambil('smoa_token'), user = null;
  const ref = {}; // cache tabel rujukan (karyawan, kode)

  // ------------------------------------------------------------ API
  async function api(aksi, data) {
    const url = window.SMOA_API_URL;
    if (!url || url.indexOf('GANTI_') === 0) throw new Error('URL API belum diisi di config.js.');
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ aksi, token }, data || {})) });
    } catch (e) { throw new Error('Tidak bisa terhubung ke server. Periksa internet dan URL API.'); }
    const j = await res.json();
    if (!j.ok) {
      if (j.kode === 'SESI') { keluarLokal(); }
      throw new Error(j.pesan || 'Terjadi kesalahan.');
    }
    return j.data;
  }

  let timerToast;
  function toast(pesan, salah) {
    const t = $('#toast'); t.textContent = pesan; t.className = 'toast tampil' + (salah ? ' salah' : '');
    clearTimeout(timerToast); timerToast = setTimeout(() => { t.className = 'toast'; }, 3200);
  }
  async function pakaiTombol(btn, fn) {
    btn.disabled = true;
    try { return await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
  }

  // ------------------------------------------------------------ definisi modul
  const KODE = { ref: 'KodeKehadiran', nilai: 'kode', label: r => r.kode + ' — ' + r.arti };
  const MODUL = {
    beranda: { judul: 'Beranda' },
    karyawan: { judul: 'Karyawan', tabel: 'Karyawan', kolom: ['nik', 'nama', 'tipe_pekerja', 'status'], form: [
      { k: 'nik', l: 'NIK', w: 1 }, { k: 'nama', l: 'Nama', w: 1 },
      { k: 'tipe_pekerja', l: 'Tipe pekerja', t: 'pilih', opsi: ['SKU-H', 'SKU-B', 'BHL', 'PKWT', 'KHT'] },
      { k: 'status', l: 'Status', t: 'pilih', opsi: ['aktif', 'nonaktif'], awal: 'aktif' }] },
    absensi: { judul: 'Absensi', tabel: 'Absensi', tanggal: true, kolom: ['tanggal', 'nik', 'nama', 'kode', 'hk', 'sumber', 'keterangan'], num: ['hk'], form: [
      { k: 'tanggal', l: 'Tanggal', t: 'date', w: 1 }, { k: 'nik', l: 'Karyawan', t: 'ref', ref: 'Karyawan', nilai: 'nik', label: r => r.nik + ' — ' + r.nama, w: 1 },
      Object.assign({ k: 'kode', l: 'Kode kehadiran', t: 'ref', w: 1 }, KODE), { k: 'keterangan', l: 'Keterangan' }], khusus: 'kalender' },
    rekap: { judul: 'Rekap Absensi' },
    panen: { judul: 'Panen', tabel: 'Panen', tanggal: true, kolom: ['tanggal', 'blok', 'janjang', 'brondolan_kg', 'keterangan'], num: ['janjang', 'brondolan_kg'], form: [
      { k: 'tanggal', l: 'Tanggal', t: 'date', w: 1, awal: 'hari' }, { k: 'blok', l: 'Blok', w: 1 }, { k: 'janjang', l: 'Janjang', t: 'number', w: 1 },
      { k: 'brondolan_kg', l: 'Brondolan (kg)', t: 'number' }, { k: 'keterangan', l: 'Keterangan' }] },
    pengiriman: { judul: 'Pengiriman TBS', tabel: 'Pengiriman', tanggal: true, kolom: ['tanggal', 'no_tiket', 'kendaraan', 'janjang', 'berat_kg', 'berat_pks_kg', 'selisih'], num: ['janjang', 'berat_kg', 'berat_pks_kg', 'selisih'], form: [
      { k: 'tanggal', l: 'Tanggal', t: 'date', w: 1, awal: 'hari' }, { k: 'no_tiket', l: 'No. tiket' }, { k: 'kendaraan', l: 'Kendaraan' },
      { k: 'janjang', l: 'Janjang', t: 'number', w: 1 }, { k: 'berat_kg', l: 'Berat kebun (kg)', t: 'number' }, { k: 'berat_pks_kg', l: 'Berat timbangan PKS (kg)', t: 'number' }] },
    bkm: { judul: 'BKM', tabel: 'Bkm', tanggal: true, kolom: ['tanggal', 'no_bkm', 'jenis', 'mandor', 'pelaksana', 'blok', 'hk', 'hasil', 'satuan', 'status'], num: ['hk', 'hasil'], form: [
      { k: 'tanggal', l: 'Tanggal', t: 'date', w: 1, awal: 'hari' }, { k: 'no_bkm', l: 'No. BKM' }, { k: 'jenis', l: 'Jenis pekerjaan', w: 1 },
      { k: 'mandor', l: 'Mandor' }, { k: 'pelaksana', l: 'Pelaksana (karyawan atau borongan/pihak luar)' }, { k: 'blok', l: 'Blok', w: 1 },
      { k: 'hk', l: 'HK', t: 'number' }, { k: 'hasil', l: 'Hasil', t: 'number' }, { k: 'satuan', l: 'Satuan' },
      { k: 'status', l: 'Status', t: 'pilih', opsi: ['draft', 'tervalidasi', 'dibatalkan'], awal: 'draft' }] },
    libur: { judul: 'Hari Libur', tabel: 'HariLibur', kolom: ['tanggal', 'nama', 'jenis'], form: [
      { k: 'tanggal', l: 'Tanggal', t: 'date', w: 1 }, { k: 'nama', l: 'Nama', w: 1 }, { k: 'jenis', l: 'Jenis', t: 'pilih', opsi: ['Libur Nasional', 'Cuti Bersama'], w: 1 }] },
    kode: { judul: 'Kode Kehadiran', tabel: 'KodeKehadiran', kolom: ['kode', 'arti', 'nilai_hk'], num: ['nilai_hk'], form: [
      { k: 'kode', l: 'Kode', w: 1 }, { k: 'arti', l: 'Arti', w: 1 }, { k: 'nilai_hk', l: 'Nilai HK', t: 'number', w: 1 }] },
  };
  const LABEL = { nik: 'NIK', nama: 'Nama', tipe_pekerja: 'Tipe', hk: 'HK', no_tiket: 'No. tiket', berat_kg: 'Berat kebun (kg)', berat_pks_kg: 'Timbangan PKS (kg)', brondolan_kg: 'Brondolan (kg)', no_bkm: 'No. BKM', nilai_hk: 'Nilai HK' };
  const judulKolom = k => LABEL[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');

  // ------------------------------------------------------------ kerangka
  function tampilkan(id) { ['masuk', 'aplikasi'].forEach(x => { $('#' + x).hidden = x !== id; }); }
  function bangunMenu() {
    $('#menu').innerHTML = Object.keys(MODUL).map(k => `<a data-m="${k}" href="#${k}">${esc(MODUL[k].judul)}</a>`).join('');
  }
  function keluarLokal() { token = null; user = null; simpan.tulis('smoa_token', null); tampilkan('masuk'); }

  async function buka(modul) {
    if (!MODUL[modul]) modul = 'beranda';
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('aktif', a.dataset.m === modul));
    $('#judul').textContent = MODUL[modul].judul;
    $('#sisi').classList.remove('buka');
    const h = $('#halaman');
    h.innerHTML = '<p class="muted">Memuat…</p>';
    try {
      if (modul === 'beranda') await Beranda(h);
      else if (modul === 'rekap') await Rekap(h);
      else await Tabel(h, modul);
    } catch (e) { h.innerHTML = `<div class="kartu galat">${esc(e.message)}</div>`; }
    h.style.animation = 'none'; void h.offsetWidth; h.style.animation = '';
  }

  // ------------------------------------------------------------ beranda
  async function Beranda(h) {
    const d = await api('beranda');
    const max = Math.max(1, ...d.seri.flatMap(s => [s.panen, s.kirim]));
    const kartu = (j, v, s) => `<div class="kartu"><div class="muted">${j}</div><div class="angka">${v}</div><div class="muted">${s || ''}</div></div>`;
    h.innerHTML = `<div class="kisi">
      ${kartu('Hadir hari ini', fmt(d.hadirHariIni), 'dari ' + fmt(d.karyawanAktif) + ' karyawan aktif')}
      ${kartu('Panen hari ini', fmt(d.panenHariIni) + ' jjg', 'bulan ini ' + fmt(d.panenBulanIni) + ' jjg')}
      ${kartu('Pengiriman hari ini', fmt(d.kirimHariIni) + ' kg', 'bulan ini ' + fmt(d.kirimBulanIni) + ' kg')}
      ${kartu('BKM hari ini', fmt(d.bkmHariIni), 'dokumen')}</div>
      <div class="kartu"><strong>Panen 7 hari terakhir</strong> <span class="muted">(janjang)</span>
      <div class="grafik">${d.seri.map(s => `<div title="${esc(s.tanggal)}: panen ${s.panen} jjg">${fmt(s.panen)}<span style="height:${Math.max(2, s.panen / max * 100)}%"></span>${esc(s.tanggal.slice(8))}</div>`).join('')}</div></div>`;
  }

  // ------------------------------------------------------------ tabel generik
  async function muatRef(nama) { if (!ref[nama]) ref[nama] = await api('daftar', { tabel: nama }); return ref[nama]; }

  async function Tabel(h, modul) {
    const m = MODUL[modul];
    const saring = { dari: awalBulan(), sampai: hariIni() };
    h.innerHTML = `<div class="bar">
      ${m.tanggal ? `<label>Dari<input type="date" id="fDari" value="${saring.dari}"></label><label>Sampai<input type="date" id="fSampai" value="${saring.sampai}"></label><button class="btn" id="fMuat" type="button">Tampilkan</button>` : ''}
      <span class="spasi"></span>${m.khusus ? '<button class="btn" id="fKalender" type="button">Isi kalender (HB/HM)</button>' : ''}
      <button class="btn utama" id="fTambah" type="button">+ Tambah</button></div>
      <div class="kartu tabel-bungkus" id="tbl"></div>`;
    let data = [];
    async function muat() {
      if (m.tanggal) { saring.dari = $('#fDari').value; saring.sampai = $('#fSampai').value; }
      data = await api('daftar', { tabel: m.tabel, dari: saring.dari, sampai: saring.sampai });
      if (m.tabel === 'Pengiriman') data.forEach(r => { r.selisih = r.berat_pks_kg !== '' && r.berat_kg !== '' ? Number(r.berat_pks_kg) - Number(r.berat_kg) : ''; });
      gambar();
    }
    function gambar() {
      const num = m.num || [];
      $('#tbl').innerHTML = data.length ? `<table><thead><tr>${m.kolom.map(k => `<th class="${num.includes(k) ? 'num' : ''}">${esc(judulKolom(k))}</th>`).join('')}<th></th></tr></thead><tbody>${data.map(r =>
        `<tr>${m.kolom.map(k => `<td class="${num.includes(k) ? 'num' : ''}">${num.includes(k) ? (r[k] === '' ? '' : fmt(r[k])) : (k === 'kode' ? `<span class="pil">${esc(r[k])}</span>` : esc(r[k]))}</td>`).join('')}<td><button class="btn tipis" data-u="${esc(r.id)}">Ubah</button> ${user && user.peran === 'admin' ? `<button class="btn tipis bahaya" data-h="${esc(r.id)}">Hapus</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="kosong">Belum ada data.</div>';
    }
    h.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'fMuat') return pakaiTombol(b, muat);
      if (b.id === 'fTambah') return formulir(m, null, muat);
      if (b.id === 'fKalender') return dialogKalender(muat);
      if (b.dataset.u) return formulir(m, data.find(r => r.id === b.dataset.u), muat);
      if (b.dataset.h && confirm('Hapus data ini?')) pakaiTombol(b, async () => { await api('hapus', { tabel: m.tabel, id: b.dataset.h }); toast('Data dihapus.'); await muat(); });
    };
    await muat();
  }

  async function formulir(m, baris, sesudah) {
    for (const f of m.form) if (f.t === 'ref') await muatRef(f.ref);
    const nilai = f => baris ? baris[f.k] : (f.awal === 'hari' ? hariIni() : (f.awal || ''));
    const kolom = f => {
      const v = nilai(f), w = f.w ? 'required' : '';
      if (f.t === 'pilih') return `<select name="${f.k}" ${w}>${f.opsi.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      if (f.t === 'ref') return `<select name="${f.k}" ${w}><option value="">— pilih —</option>${ref[f.ref].map(r => `<option value="${esc(r[f.nilai])}" ${String(r[f.nilai]) === String(v) ? 'selected' : ''}>${esc(f.label(r))}</option>`).join('')}</select>`;
      return `<input name="${f.k}" type="${f.t || 'text'}" ${f.t === 'number' ? 'step="any" min="0" inputmode="decimal"' : ''} value="${esc(v)}" ${w}>`;
    };
    const md = $('#modal');
    md.hidden = false;
    md.innerHTML = `<form class="kartu"><h2>${baris ? 'Ubah' : 'Tambah'} ${esc(m.judul)}</h2><br>${m.form.map(f => `<label>${esc(f.l)}${f.w ? ' *' : ''}${kolom(f)}</label>`).join('')}
      <p class="galat" id="galatForm" role="alert"></p><div class="aksi"><button class="btn" type="button" id="batal">Batal</button><button class="btn utama" type="submit">Simpan</button></div></form>`;
    $('#batal').onclick = () => { md.hidden = true; };
    md.onclick = e => { if (e.target === md) md.hidden = true; };
    const form = $('form', md); const first = form.querySelector('input,select'); if (first) first.focus();
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      const isi = {}; new FormData(form).forEach((v, k) => { isi[k] = v; });
      if (baris) isi.id = baris.id;
      btn.disabled = true;
      try {
        await api('simpan', { tabel: m.tabel, baris: isi });
        if (m.tabel === 'Karyawan') delete ref.Karyawan;
        if (m.tabel === 'KodeKehadiran') delete ref.KodeKehadiran;
        md.hidden = true; toast('Tersimpan.'); await sesudah();
      } catch (er) { $('#galatForm').textContent = er.message; } finally { btn.disabled = false; }
    };
  }

  function dialogKalender(sesudah) {
    const md = $('#modal'); md.hidden = false;
    md.innerHTML = `<form class="kartu"><h2>Isi kalender libur</h2><p class="muted">Mengisi HB pada libur nasional dan HM pada hari Minggu. SKU-H/SKU-B pada libur nasional yang bukan hari Minggu dihitung hadir (K). Cuti bersama tidak dihitung. Data fingerscan atau koreksi tidak ditimpa.</p>
      <label>Dari<input type="date" name="dari" value="${awalBulan()}" required></label><label>Sampai<input type="date" name="sampai" value="${hariIni()}" required></label>
      <p class="galat" id="galatForm"></p><div class="aksi"><button class="btn" type="button" id="batal">Batal</button><button class="btn utama" type="submit">Jalankan</button></div></form>`;
    $('#batal').onclick = () => { md.hidden = true; };
    $('form', md).onsubmit = async e => {
      e.preventDefault(); const f = e.target, btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try { const r = await api('isiKalender', { dari: f.dari.value, sampai: f.sampai.value }); md.hidden = true; toast(`Selesai: ${r.dibuat} baris dibuat, ${r.diubah} diperbarui.`); await sesudah(); }
      catch (er) { $('#galatForm').textContent = er.message; } finally { btn.disabled = false; }
    };
  }

  // ------------------------------------------------------------ rekap
  async function Rekap(h) {
    h.innerHTML = `<div class="bar"><label>Bulan<input type="month" id="rBulan" value="${bulanIni()}"></label><button class="btn" id="rMuat" type="button">Tampilkan</button></div><div class="kartu tabel-bungkus" id="tbl"></div>`;
    const kodeRef = await muatRef('KodeKehadiran');
    const muat = async () => {
      const d = await api('rekapAbsensi', { bulan: $('#rBulan').value });
      const kd = kodeRef.map(k => k.kode);
      $('#tbl').innerHTML = d.length ? `<table><thead><tr><th>NIK</th><th>Nama</th>${kd.map(k => `<th class="num">${esc(k)}</th>`).join('')}<th class="num">Total HK</th></tr></thead><tbody>${d.map(r =>
        `<tr><td>${esc(r.nik)}</td><td>${esc(r.nama)}</td>${kd.map(k => `<td class="num">${r.kode[k] || ''}</td>`).join('')}<td class="num"><strong>${fmt(r.hk)}</strong></td></tr>`).join('')}</tbody></table>` : '<div class="kosong">Belum ada absensi pada bulan ini.</div>';
    };
    $('#rMuat').onclick = e => pakaiTombol(e.target, muat);
    await muat();
  }

  // ------------------------------------------------------------ mulai
  function mulai() {
    const tema = simpan.ambil('smoa_tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const setTema = t => { document.documentElement.dataset.theme = t; $('#tema').textContent = t === 'dark' ? 'Tema terang' : 'Tema gelap'; simpan.tulis('smoa_tema', t); };
    setTema(tema);
    $('#tema').onclick = () => setTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    $('#buka').onclick = () => $('#sisi').classList.toggle('buka');
    bangunMenu();
    window.addEventListener('hashchange', () => { if (user) buka(location.hash.slice(1)); });
    $('#keluar').onclick = async () => { try { await api('keluar'); } catch (e) { /* abaikan */ } keluarLokal(); };
    $('#formMasuk').onsubmit = async e => {
      e.preventDefault(); const f = e.target, btn = f.querySelector('button'); $('#galatMasuk').textContent = ''; btn.disabled = true;
      try { const r = await api('login', { username: f.username.value, sandi: f.sandi.value }); token = r.token; user = r.user; simpan.tulis('smoa_token', token); f.sandi.value = ''; masukApp(); }
      catch (er) { $('#galatMasuk').textContent = er.message; } finally { btn.disabled = false; }
    };
    if (token) api('saya').then(u => { user = u; masukApp(); }).catch(() => tampilkan('masuk')); else tampilkan('masuk');
  }
  function masukApp() { $('#pengguna').textContent = user.nama; tampilkan('aplikasi'); buka(location.hash.slice(1) || 'beranda'); }
  mulai();
})();
