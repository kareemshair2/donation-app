const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz4MN5m6qPY3tq7_gVqfDmVTN2BF6rK9Pnhrt5xMxrE174fKDI5scKFqdOvCvHwhyyR/exec';
const CACHE_KEY = 'donation_data';
const CACHE_DURATION = 10 * 60 * 1000;

const form = document.getElementById('donationForm');
const dateInput = document.getElementById('date');
const centerSelect = document.getElementById('center');
const centerLoader = document.getElementById('centerLoader');
const errorMsg = document.getElementById('errorMessage');
const successOverlay = document.getElementById('successOverlay');
const newSubmissionBtn = document.getElementById('newSubmission');
const entriesContainer = document.getElementById('entriesContainer');
const addEntryBtn = document.getElementById('addEntryBtn');

let allVolunteers = [];
let allTypes = [];
let entryCount = 0;

function init() {
  initTheme();
  dateInput.value = new Date().toISOString().split('T')[0];
  dateInput.max = dateInput.value;
  attachEvents();
  loadData();
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', 'dark');
}

function loadData() {
  const cached = getCache();
  if (cached) { renderAll(cached); fetchFreshData(); }
  else fetchFreshData();
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_DURATION) { localStorage.removeItem(CACHE_KEY); return null; }
    return parsed.data;
  } catch (_) { return null; }
}

function setCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
}

function renderAll(data) {
  if (data.centers) renderCenters(data.centers);
  if (data.donationTypes) allTypes = data.donationTypes;
  if (data.volunteers) allVolunteers = data.volunteers;
}

async function fetchFreshData() {
  centerLoader.style.display = 'inline-block';
  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=getAllData');
    const result = await res.json();
    if (result.success) { setCache(result); renderAll(result); }
  } catch (_) {
    if (!getCache()) showError('تعذر تحميل البيانات');
  } finally { centerLoader.style.display = 'none'; }
}

async function apiPost(data) {
  await fetch(APPS_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { success: true };
}

function renderCenters(centers) {
  centerSelect.innerHTML = '<option value="">اختر المركز</option>';
  centers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + ' - ' + c.area;
    centerSelect.appendChild(opt);
  });
}

// ============ New Volunteer Modal ============

function showNewVolunteerModal(selectEl) {
  const cid = centerSelect.value;
  const centerName = centerSelect.options[centerSelect.selectedIndex].text;

  if (!cid) { showError('اختر المركز أولاً'); return; }

  hideError();
  const overlay = document.createElement('div');
  overlay.className = 'success-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal-card" style="background:var(--white);border-radius:16px;padding:32px 24px;max-width:340px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.15);animation:popIn 0.3s ease-out;border:1px solid var(--border);text-align:right;">
      <h3 style="font-size:1.1rem;margin-bottom:4px;color:var(--text);">متطوع جديد</h3>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:18px;">${centerName}</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);">الاسم الثلاثي *</label>
          <input type="text" id="newVolName" placeholder="مثال: أحمد محمد علي" style="padding:12px;font-size:0.95rem;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-family:var(--font);outline:none;width:100%;">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);">رقم التواصل</label>
          <input type="text" id="newVolPhone" placeholder="مثال: 01000000000" style="padding:12px;font-size:0.95rem;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-family:var(--font);outline:none;width:100%;direction:ltr;text-align:left;">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button type="button" id="cancelNewVol" style="flex:1;padding:12px;font-size:0.9rem;font-weight:600;border:1.5px solid var(--border);border-radius:8px;background:var(--white);color:var(--text);cursor:pointer;font-family:var(--font);">إلغاء</button>
        <button type="button" id="saveNewVol" style="flex:1;padding:12px;font-size:0.9rem;font-weight:700;border:none;border-radius:8px;background:linear-gradient(135deg,var(--orange),var(--orange-light));color:white;cursor:pointer;font-family:var(--font);box-shadow:0 4px 16px var(--orange-glow);">حفظ</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#cancelNewVol').addEventListener('click', function() {
    overlay.remove();
    selectEl.value = '';
  });

  overlay.querySelector('#saveNewVol').addEventListener('click', async function() {
    const name = overlay.querySelector('#newVolName').value.trim();
    const phone = overlay.querySelector('#newVolPhone').value.trim();
    if (!name || name.split(' ').filter(Boolean).length < 2) {
      alert('الرجاء إدخال الاسم الثلاثي على الأقل');
      return;
    }

    this.disabled = true;
    this.textContent = 'جاري الحفظ...';

    try {
      await apiPost({
        action: 'addVolunteer',
        name: name,
        centerId: cid,
        phone: phone
      });

      const newVol = { id: Date.now(), name: name, centerId: cid, phone: phone };
      allVolunteers.push(newVol);
      localStorage.removeItem(CACHE_KEY);

      // Update all volunteer dropdowns in entries
      document.querySelectorAll('.entry-volunteer').forEach(function(sel) {
        const currentCid = centerSelect.value;
        if (String(newVol.centerId) === String(currentCid)) {
          const opt = document.createElement('option');
          opt.value = newVol.id;
          opt.textContent = newVol.name;
          const addOpt = sel.querySelector('option[value="add-new"]');
          if (addOpt) sel.insertBefore(opt, addOpt);
          else sel.appendChild(opt);
        }
      });

      selectEl.value = newVol.id;
      overlay.remove();
    } catch (_) {
      alert('فشل إضافة المتطوع. حاول مرة أخرى.');
      this.disabled = false;
      this.textContent = 'حفظ';
    }
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

// ============ Entries ============

function populateVolunteerDropdown(sel, centerId) {
  sel.innerHTML = '<option value="">اختر المتطوع</option>';
  if (centerId && allVolunteers.length) {
    const filtered = allVolunteers.filter(v => String(v.centerId) === String(centerId));
    filtered.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      sel.appendChild(opt);
    });
    const addOpt = document.createElement('option');
    addOpt.value = 'add-new';
    addOpt.textContent = '➕ متطوع جديد';
    sel.appendChild(addOpt);
    sel.disabled = false;
  } else {
    sel.disabled = true;
  }
}

function addEntry(data) {
  entryCount++;
  const id = entryCount;
  const div = document.createElement('div');
  div.className = 'entry-card';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="entry-header">
      <span class="entry-num">تبرع #${id}</span>
      <button type="button" class="btn-remove-entry">✕</button>
    </div>
    <div class="entry-fields">
      <div class="entry-field">
        <label>المتطوع *</label>
        <select class="entry-volunteer" required></select>
      </div>
      <div class="entry-field">
        <label>صورة الإيصال *</label>
        <div class="entry-image-upload">
          <input type="file" class="entry-receipt" accept="image/*" capture="environment" required>
          <div class="entry-img-placeholder">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>تصوير</span>
          </div>
          <div class="entry-img-preview" style="display:none;">
            <img class="entry-preview-img" alt="">
            <button type="button" class="entry-remove-img">✕</button>
          </div>
        </div>
      </div>
      <div class="entry-field">
        <label>الرقم المرجعي *</label>
        <input type="text" class="entry-ref" placeholder="مثال: REF-001" required>
      </div>
      <div class="entry-row">
        <div class="entry-field flex-2">
          <label>القيمة (ج.م) *</label>
          <input type="number" class="entry-value" placeholder="0" min="0" step="0.01" required>
        </div>
        <div class="entry-field flex-1">
          <label>النوع / النية *</label>
          <select class="entry-type" required>
            <option value="">اختر</option>
          </select>
        </div>
      </div>
    </div>
  `;

  const volSelect = div.querySelector('.entry-volunteer');
  populateVolunteerDropdown(volSelect, centerSelect.value);

  // Handle "➕ متطوع جديد" selection
  volSelect.addEventListener('change', function() {
    if (this.value === 'add-new') {
      showNewVolunteerModal(this);
    }
  });

  const typeSelect = div.querySelector('.entry-type');
  typeSelect.innerHTML = '<option value="">اختر</option>';
  allTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    typeSelect.appendChild(opt);
  });

  if (data && data.typeId) typeSelect.value = data.typeId;

  // Image handling
  let imageBase64 = null;
  const fileInput = div.querySelector('.entry-receipt');
  const imgPreview = div.querySelector('.entry-img-preview');
  const previewImg = div.querySelector('.entry-preview-img');
  const placeholder = div.querySelector('.entry-img-placeholder');
  const removeBtn = div.querySelector('.entry-remove-img');

  fileInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      imageBase64 = e.target.result;
      previewImg.src = imageBase64;
      imgPreview.style.display = 'flex';
      placeholder.style.display = 'none';
      fileInput.removeAttribute('required');
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    imageBase64 = null;
    fileInput.value = '';
    imgPreview.style.display = 'none';
    placeholder.style.display = 'flex';
    fileInput.setAttribute('required', '');
  });

  div.querySelector('.btn-remove-entry').addEventListener('click', function() { div.remove(); });
  div._getImage = function() { return imageBase64; };

  entriesContainer.appendChild(div);
}

function getEntryData() {
  const entries = [];
  entriesContainer.querySelectorAll('.entry-card').forEach(card => {
    if (!card._getImage) return;
    const vol = card.querySelector('.entry-volunteer');
    const ref = card.querySelector('.entry-ref');
    const val = card.querySelector('.entry-value');
    const typ = card.querySelector('.entry-type');
    entries.push({
      volunteer: vol.options[vol.selectedIndex] ? vol.options[vol.selectedIndex].text : '',
      volunteerId: vol.value,
      receiptImage: card._getImage() || '',
      referenceNumber: ref ? ref.value.trim() : '',
      value: val ? val.value : '',
      donationType: typ.options[typ.selectedIndex] ? typ.options[typ.selectedIndex].text : ''
    });
  });
  return entries;
}

// ============ Validation ============

function validateForm() {
  if (!dateInput.value) { showError('الرجاء إدخال التاريخ'); return false; }
  if (!centerSelect.value) { showError('الرجاء اختيار المركز'); return false; }
  const entries = getEntryData();
  if (!entries.length) { showError('أضف تبرع واحد على الأقل'); return false; }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.volunteerId || e.volunteerId === 'add-new') { showError('اختر متطوع في التبرع #' + (i + 1)); return false; }
    if (!e.receiptImage) { showError('صورة الإيصال مطلوبة في التبرع #' + (i + 1)); return false; }
    if (!e.referenceNumber || e.referenceNumber.length < 3) { showError('الرقم المرجعي 3 أحرف في التبرع #' + (i + 1)); return false; }
    if (!e.value || parseFloat(e.value) <= 0) { showError('أدخل قيمة صحيحة في التبرع #' + (i + 1)); return false; }
    if (!e.donationType) { showError('اختر نوع التبرع #' + (i + 1)); return false; }
  }
  return true;
}

// ============ Submit ============

async function handleSubmit(e) {
  e.preventDefault();
  hideError();
  if (!validateForm()) return;
  setLoading(true);
  try {
    await apiPost({
      action: 'submitBatch',
      date: dateInput.value,
      center: centerSelect.options[centerSelect.selectedIndex].text,
      entries: getEntryData()
    });
    localStorage.removeItem(CACHE_KEY);
    showSuccess();
  } catch (_) {
    showError('فشل إرسال البيانات. حاول مرة أخرى.');
  } finally { setLoading(false); }
}

// ============ UI ============

function setLoading(loading) {
  document.querySelectorAll('.btn-text').forEach(el => el.style.display = loading ? 'none' : 'inline');
  document.querySelectorAll('.btn-loader').forEach(el => el.style.display = loading ? 'inline' : 'none');
  document.querySelectorAll('.btn-submit').forEach(btn => btn.disabled = loading);
  form.querySelectorAll('input, select').forEach(el => el.disabled = loading);
}

function showError(msg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
function hideError() { errorMsg.style.display = 'none'; }
function showSuccess() { successOverlay.style.display = 'flex'; }

// ============ Events ============

function attachEvents() {
  form.addEventListener('submit', handleSubmit);
  document.getElementById('stickySubmitBtn').addEventListener('click', function() { form.requestSubmit(); });
  newSubmissionBtn.addEventListener('click', function() { location.reload(); });

  centerSelect.addEventListener('change', function() {
    const cid = this.value;
    document.querySelectorAll('.entry-volunteer').forEach(function(sel) {
      populateVolunteerDropdown(sel, cid);
    });
  });

  addEntryBtn.addEventListener('click', function() {
    if (!centerSelect.value) { showError('اختر المركز أولاً'); return; }
    addEntry();
  });

  form.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', hideError);
    el.addEventListener('input', hideError);
  });

  const observer = new MutationObserver(function() {
    if (centerSelect.options.length > 1 && !entriesContainer.children.length) addEntry();
  });
  observer.observe(centerSelect, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', init);
