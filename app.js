const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz4MN5m6qPY3tq7_gVqfDmVTN2BF6rK9Pnhrt5xMxrE174fKDI5scKFqdOvCvHwhyyR/exec';
const CACHE_KEY = 'donation_data';
const CACHE_DURATION = 10 * 60 * 1000;

const form = document.getElementById('donationForm');
const dateInput = document.getElementById('date');
const campaignSelect = document.getElementById('campaign');
const campaignLoader = document.getElementById('campaignLoader');
const centerSelect = document.getElementById('center');
const centerLoader = document.getElementById('centerLoader');
const errorMsg = document.getElementById('errorMessage');
const successOverlay = document.getElementById('successOverlay');
const newSubmissionBtn = document.getElementById('newSubmission');
const entriesContainer = document.getElementById('entriesContainer');
const addEntryBtn = document.getElementById('addEntryBtn');

let allCampaigns = [];
let allCenters = [];
let allVolunteers = [];
let allDonationTypes = [];
let allReceiptTypes = [];
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
  if (data.campaigns) allCampaigns = data.campaigns;
  if (data.centers) allCenters = data.centers;
  if (data.volunteers) allVolunteers = data.volunteers;
  if (data.donationTypes) allDonationTypes = data.donationTypes;
  if (data.receiptTypes) allReceiptTypes = data.receiptTypes;
  renderCampaigns(allCampaigns);
  renderCenters(allCenters);
}

async function fetchFreshData() {
  campaignLoader.style.display = 'inline-block';
  centerLoader.style.display = 'inline-block';
  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=getAllData');
    const result = await res.json();
    if (result.success) { setCache(result); renderAll(result); }
  } catch (_) {
    if (!getCache()) showError('تعذر تحميل البيانات');
  } finally {
    campaignLoader.style.display = 'none';
    centerLoader.style.display = 'none';
  }
}

async function apiPost(data) {
  await fetch(APPS_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { success: true };
}

function renderCampaigns(campaigns) {
  campaignSelect.innerHTML = '<option value="">اختر الحملة</option>';
  campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    campaignSelect.appendChild(opt);
  });
}

function renderCenters(centers) {
  centerSelect.innerHTML = '<option value="">اختر المركز</option>';
  centers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    centerSelect.appendChild(opt);
  });
}

// ============ Volunteer Search & Dropdown ============

function getFilteredVolunteers(centerId, query) {
  let list = allVolunteers;
  if (centerId) list = list.filter(v => String(v.centerId) === String(centerId));
  if (query) {
    const q = query.trim().toLowerCase();
    list = list.filter(v => v.name.toLowerCase().includes(q));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

// ============ Entries ============

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
        <input type="text" class="entry-vol-search" placeholder="ابحث بالاسم..." autocomplete="off">
      </div>
      <div class="entry-vol-results" style="display:none;"></div>
      <div class="entry-field">
        <label>رقم التليفون</label>
        <input type="text" class="entry-phone" readonly dir="ltr" placeholder="يظهر تلقائي">
      </div>
      <div class="entry-row">
        <div class="entry-field flex-1">
          <label>النية *</label>
          <select class="entry-type" required>
            <option value="">اختر</option>
          </select>
        </div>
        <div class="entry-field flex-1">
          <label>نوع الوصل *</label>
          <select class="entry-receipt-type" required>
            <option value="">اختر</option>
          </select>
        </div>
      </div>
      <div class="entry-row">
        <div class="entry-field flex-1">
          <label>تاريخ الإيصال *</label>
          <input type="date" class="entry-receipt-date" required>
        </div>
        <div class="entry-field flex-1">
          <label>الرقم المرجعي *</label>
          <input type="text" class="entry-ref" placeholder="REF-001" required>
        </div>
      </div>
      <div class="entry-row">
        <div class="entry-field flex-2">
          <label>المبلغ (ج.م) *</label>
          <input type="number" class="entry-value" placeholder="0" min="0" step="0.01" inputmode="numeric" required>
        </div>
        <div class="entry-field flex-1">
          <label>كود الحالة</label>
          <input type="text" class="entry-status" placeholder="اختياري">
        </div>
      </div>
      <div class="entry-field">
        <label>صورة الإيصال *</label>
        <div class="entry-image-upload">
          <input type="file" class="entry-receipt" accept="image/*" required>
          <div class="entry-img-placeholder">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>اختر صورة</span>
          </div>
          <div class="entry-img-preview" style="display:none;">
            <img class="entry-preview-img" alt="">
            <button type="button" class="entry-remove-img">✕</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const volSearch = div.querySelector('.entry-vol-search');
  const phoneInput = div.querySelector('.entry-phone');
  const resultsBox = div.querySelector('.entry-vol-results');

  // Populate dropdowns
  populateDonationTypes(div);
  populateReceiptTypes(div);

  // Set default receipt date
  const recDate = div.querySelector('.entry-receipt-date');
  recDate.value = new Date().toISOString().split('T')[0];

  // Volunteer search: filter dropdown and show results box
  volSearch.addEventListener('input', function() {
    const q = this.value;
    const cid = centerSelect.value;
    const filtered = getFilteredVolunteers(cid, q);

    if (q.length > 0 && filtered.length > 0) {
      resultsBox.style.display = 'block';
      resultsBox.innerHTML = '';
      filtered.slice(0, 20).forEach(v => {
        const item = document.createElement('div');
        item.className = 'vol-result-item';
        item.textContent = v.name;
        item.addEventListener('click', function() {
          volSearch.value = v.name;
          volSearch.dataset.volId = v.id;
          phoneInput.value = v.phone || '';
          resultsBox.style.display = 'none';
        });
        resultsBox.appendChild(item);
      });
    } else {
      resultsBox.style.display = 'none';
    }
  });

  volSearch.addEventListener('blur', function() {
    setTimeout(function() { resultsBox.style.display = 'none'; }, 200);
  });

  volSearch.addEventListener('focus', function() {
    const q = this.value;
    const cid = centerSelect.value;
    const filtered = getFilteredVolunteers(cid, q);
    if (filtered.length > 0) {
      resultsBox.style.display = 'block';
    }
  });

  // If data pre-filled
  if (data && data.volId) {
    const v = allVolunteers.find(x => String(x.id) === String(data.volId));
    if (v) {
      volSearch.value = v.name;
      volSearch.dataset.volId = v.id;
      phoneInput.value = v.phone || '';
    }
  }

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

function populateDonationTypes(div) {
  const sel = div.querySelector('.entry-type');
  sel.innerHTML = '<option value="">اختر</option>';
  allDonationTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

function populateReceiptTypes(div) {
  const sel = div.querySelector('.entry-receipt-type');
  sel.innerHTML = '<option value="">اختر</option>';
  allReceiptTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

function getEntryData() {
  const entries = [];
  entriesContainer.querySelectorAll('.entry-card').forEach(card => {
    if (!card._getImage) return;
    const volSearch = card.querySelector('.entry-vol-search');
    const phoneInput = card.querySelector('.entry-phone');
    const typ = card.querySelector('.entry-type');
    const recType = card.querySelector('.entry-receipt-type');
    const recDate = card.querySelector('.entry-receipt-date');
    const ref = card.querySelector('.entry-ref');
    const val = card.querySelector('.entry-value');
    const status = card.querySelector('.entry-status');
    entries.push({
      volunteer: volSearch ? volSearch.value.trim() : '',
      volunteerId: volSearch ? volSearch.dataset.volId || '' : '',
      phone: phoneInput ? phoneInput.value.trim() : '',
      donationType: typ && typ.selectedIndex > 0 ? typ.options[typ.selectedIndex].text : '',
      receiptType: recType && recType.selectedIndex > 0 ? recType.options[recType.selectedIndex].text : '',
      receiptDate: recDate ? recDate.value : '',
      referenceNumber: ref ? ref.value.trim() : '',
      value: val ? val.value : '',
      receiptImage: card._getImage() || '',
      statusCode: status ? status.value.trim() : ''
    });
  });
  return entries;
}

// ============ Validation ============

function validateForm() {
  if (!dateInput.value) { showError('الرجاء إدخال التاريخ'); return false; }
  if (!campaignSelect.value) { showError('الرجاء اختيار الحملة'); return false; }
  if (!centerSelect.value) { showError('الرجاء اختيار المركز'); return false; }
  const entries = getEntryData();
  if (!entries.length) { showError('أضف تبرع واحد على الأقل'); return false; }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.volunteerId) { showError('اختر متطوع في التبرع #' + (i + 1)); return false; }
    if (!e.donationType) { showError('اختر النية في التبرع #' + (i + 1)); return false; }
    if (!e.receiptType) { showError('اختر نوع الوصل في التبرع #' + (i + 1)); return false; }
    if (!e.receiptDate) { showError('أدخل تاريخ الإيصال في التبرع #' + (i + 1)); return false; }
    if (!e.referenceNumber || e.referenceNumber.length < 3) { showError('الرقم المرجعي 3 أحرف في التبرع #' + (i + 1)); return false; }
    if (!e.value || parseFloat(e.value) <= 0) { showError('أدخل مبلغ صحيح في التبرع #' + (i + 1)); return false; }
    if (!e.receiptImage) { showError('صورة الإيصال مطلوبة في التبرع #' + (i + 1)); return false; }
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
      campaign: campaignSelect.options[campaignSelect.selectedIndex].text,
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
    document.querySelectorAll('.entry-vol-search').forEach(function(inp) {
      inp.value = '';
      delete inp.dataset.volId;
    });
    document.querySelectorAll('.entry-phone').forEach(function(inp) { inp.value = ''; });
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

// Hide logo on scroll
window.addEventListener('scroll', function() {
  const header = document.querySelector('.app-header');
  if (!header) return;
  if (window.scrollY > 30) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}, { passive: true });
