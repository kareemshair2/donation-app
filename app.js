const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz4MN5m6qPY3tq7_gVqfDmVTN2BF6rK9Pnhrt5xMxrE174fKDI5scKFqdOvCvHwhyyR/exec';
const CACHE_KEY = 'donation_data';
const CACHE_DURATION = 10 * 60 * 1000;

const form = document.getElementById('donationForm');
const dateInput = document.getElementById('date');
const centerSelect = document.getElementById('center');
const centerLoader = document.getElementById('centerLoader');
const receiptInput = document.getElementById('receiptImage');
const uploadPreview = document.getElementById('uploadPreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const referenceInput = document.getElementById('referenceNumber');
const errorMsg = document.getElementById('errorMessage');
const successOverlay = document.getElementById('successOverlay');
const newSubmissionBtn = document.getElementById('newSubmission');
const entriesContainer = document.getElementById('entriesContainer');
const addEntryBtn = document.getElementById('addEntryBtn');

let allVolunteers = [];
let allTypes = [];
let selectedImageBase64 = null;
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
  if (data.donationTypes) { allTypes = data.donationTypes; }
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

// ============ Entries management ============

function addEntry(data) {
  entryCount++;
  const id = entryCount;
  const div = document.createElement('div');
  div.className = 'entry-card';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="entry-header">
      <span class="entry-num">#${id}</span>
      <button type="button" class="btn-remove-entry" data-id="${id}">✕</button>
    </div>
    <div class="entry-fields">
      <div class="entry-field">
        <label>المتطوع</label>
        <select class="entry-volunteer" required>
          <option value="">اختر</option>
        </select>
      </div>
      <div class="entry-row">
        <div class="entry-field flex-2">
          <label>القيمة (ج.م)</label>
          <input type="number" class="entry-value" placeholder="0" min="0" step="0.01" required>
        </div>
        <div class="entry-field flex-1">
          <label>النوع</label>
          <select class="entry-type" required>
            <option value="">اختر</option>
          </select>
        </div>
      </div>
      <div class="entry-field">
        <label>النية / البيان</label>
        <input type="text" class="entry-note" placeholder="اختياري">
      </div>
    </div>
  `;

  // Fill volunteer dropdown filtered by current center
  const volSelect = div.querySelector('.entry-volunteer');
  const centerId = centerSelect.value;
  if (centerId && allVolunteers.length) {
    const filtered = allVolunteers.filter(v => String(v.centerId) === String(centerId));
    volSelect.innerHTML = '<option value="">اختر المتطوع</option>';
    filtered.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      volSelect.appendChild(opt);
    });
    volSelect.disabled = false;
  } else {
    volSelect.innerHTML = '<option value="">اختر المركز أولاً</option>';
    volSelect.disabled = true;
  }

  // Fill type dropdown
  const typeSelect = div.querySelector('.entry-type');
  typeSelect.innerHTML = '<option value="">اختر</option>';
  allTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    typeSelect.appendChild(opt);
  });

  // Load data if editing
  if (data) {
    if (data.volunteerId) volSelect.value = data.volunteerId;
    if (data.value) div.querySelector('.entry-value').value = data.value;
    if (data.typeId) typeSelect.value = data.typeId;
    if (data.note) div.querySelector('.entry-note').value = data.note;
  }

  // Remove handler
  div.querySelector('.btn-remove-entry').addEventListener('click', function() {
    div.remove();
  });

  entriesContainer.appendChild(div);
}

function getEntryData() {
  const cards = entriesContainer.querySelectorAll('.entry-card');
  const entries = [];
  cards.forEach(card => {
    const vol = card.querySelector('.entry-volunteer');
    const val = card.querySelector('.entry-value');
    const typ = card.querySelector('.entry-type');
    const note = card.querySelector('.entry-note');
    entries.push({
      volunteer: vol.options[vol.selectedIndex] ? vol.options[vol.selectedIndex].text : '',
      volunteerId: vol.value,
      value: val.value,
      donationType: typ.options[typ.selectedIndex] ? typ.options[typ.selectedIndex].text : '',
      note: note.value
    });
  });
  return entries;
}

// ============ Image ============

function handleImageSelect(file) {
  if (!file) { clearImage(); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    selectedImageBase64 = e.target.result;
    previewImg.src = selectedImageBase64;
    uploadPreview.style.display = 'flex';
    document.querySelector('.upload-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  selectedImageBase64 = null;
  receiptInput.value = '';
  uploadPreview.style.display = 'none';
  document.querySelector('.upload-placeholder').style.display = 'flex';
  previewImg.src = '';
}

// ============ Validation ============

function validateForm() {
  if (!dateInput.value) { showError('الرجاء إدخال التاريخ'); dateInput.focus(); return false; }
  if (!centerSelect.value) { showError('الرجاء اختيار المركز'); centerSelect.focus(); return false; }
  if (referenceInput.value.trim().length < 3) { showError('الرقم المرجعي 3 أحرف على الأقل'); referenceInput.focus(); return false; }

  const entries = getEntryData();
  if (!entries.length) { showError('أضف تبرع واحد على الأقل'); return false; }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.volunteerId) { showError('اختر متطوع في التبرع #' + (i + 1)); return false; }
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

  const entries = getEntryData();

  try {
    await apiPost({
      action: 'submitBatch',
      date: dateInput.value,
      center: centerSelect.options[centerSelect.selectedIndex].text,
      receiptImage: selectedImageBase64 || '',
      referenceNumber: referenceInput.value.trim(),
      entries: entries
    });
    localStorage.removeItem(CACHE_KEY);
    showSuccess();
  } catch (_) {
    showError('فشل إرسال البيانات. حاول مرة أخرى.');
  } finally {
    setLoading(false);
  }
}

// ============ UI ============

function setLoading(loading) {
  document.querySelectorAll('.btn-text').forEach(el => el.style.display = loading ? 'none' : 'inline');
  document.querySelectorAll('.btn-loader').forEach(el => el.style.display = loading ? 'inline' : 'none');
  document.querySelectorAll('.btn-submit').forEach(btn => btn.disabled = loading);
  form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = loading);
}

function showError(msg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
function hideError() { errorMsg.style.display = 'none'; }

function showSuccess() { successOverlay.style.display = 'flex'; }

// ============ Events ============

function attachEvents() {
  form.addEventListener('submit', handleSubmit);

  document.getElementById('stickySubmitBtn').addEventListener('click', function() {
    form.requestSubmit();
  });

  // New submission → reload page
  newSubmissionBtn.addEventListener('click', function() {
    location.reload();
  });

  centerSelect.addEventListener('change', function() {
    // Update all entry volunteer dropdowns with filtered list
    const centerId = this.value;
    entriesContainer.querySelectorAll('.entry-volunteer').forEach(sel => {
      sel.innerHTML = '<option value="">اختر المركز أولاً</option>';
      sel.disabled = true;
      if (centerId && allVolunteers.length) {
        const filtered = allVolunteers.filter(v => String(v.centerId) === String(centerId));
        sel.innerHTML = '<option value="">اختر المتطوع</option>';
        filtered.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = v.name;
          sel.appendChild(opt);
        });
        sel.disabled = false;
      }
    });
  });

  addEntryBtn.addEventListener('click', function() {
    if (!centerSelect.value) { showError('اختر المركز أولاً'); return; }
    addEntry();
  });

  receiptInput.addEventListener('change', function() { handleImageSelect(this.files[0]); });
  removeImageBtn.addEventListener('click', function(e) { e.stopPropagation(); clearImage(); });

  form.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', hideError);
    el.addEventListener('input', hideError);
  });

  // Add first entry on load when center changes
  const centerObserver = new MutationObserver(function() {
    if (centerSelect.options.length > 1 && !entriesContainer.children.length) {
      addEntry();
    }
  });
  centerObserver.observe(centerSelect, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', init);
