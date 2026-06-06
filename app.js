const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz4MN5m6qPY3tq7_gVqfDmVTN2BF6rK9Pnhrt5xMxrE174fKDI5scKFqdOvCvHwhyyR/exec';
const CACHE_KEY = 'donation_data';
const CACHE_DURATION = 10 * 60 * 1000; // 10 دقايق

const form = document.getElementById('donationForm');
const dateInput = document.getElementById('date');
const centerSelect = document.getElementById('center');
const centerLoader = document.getElementById('centerLoader');
const volunteerSelect = document.getElementById('volunteer');
const volunteerLoader = document.getElementById('volunteerLoader');
const receiptInput = document.getElementById('receiptImage');
const uploadPreview = document.getElementById('uploadPreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const referenceInput = document.getElementById('referenceNumber');
const valueInput = document.getElementById('value');
const typeSelect = document.getElementById('donationType');
const typeLoader = document.getElementById('typeLoader');
const errorMsg = document.getElementById('errorMessage');
const successOverlay = document.getElementById('successOverlay');
const newSubmissionBtn = document.getElementById('newSubmission');

let allVolunteers = [];
let selectedImageBase64 = null;

function init() {
  initTheme();
  dateInput.value = new Date().toISOString().split('T')[0];
  dateInput.max = dateInput.value;
  attachEvents();
  loadData();
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function loadData() {
  const cached = getCache();
  if (cached) {
    renderAll(cached);
    fetchFreshData();
  } else {
    fetchFreshData();
  }
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch (_) { return null; }
}

function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

function renderAll(data) {
  if (data.centers) renderCenters(data.centers);
  if (data.donationTypes) renderDonationTypes(data.donationTypes);
  if (data.volunteers) allVolunteers = data.volunteers;
}

async function fetchFreshData() {
  centerLoader.style.display = 'inline-block';
  typeLoader.style.display = 'inline-block';
  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=getAllData');
    const result = await res.json();
    if (result.success) {
      setCache(result);
      renderAll(result);
    }
  } catch (_) {
    if (!getCache()) showError('تعذر تحميل البيانات. تأكد من اتصال الإنترنت.');
  } finally {
    centerLoader.style.display = 'none';
    typeLoader.style.display = 'none';
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

function renderCenters(centers) {
  centerSelect.innerHTML = '<option value="">اختر المركز</option>';
  centers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + ' - ' + c.area;
    centerSelect.appendChild(opt);
  });
}

function renderVolunteers(list) {
  volunteerSelect.innerHTML = '<option value="">اختر المتطوع</option>';
  list.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name + (v.phone ? ' (' + v.phone + ')' : '');
    volunteerSelect.appendChild(opt);
  });
}

function renderDonationTypes(types) {
  typeSelect.innerHTML = '<option value="">اختر النوع</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    typeSelect.appendChild(opt);
  });
}

function filterVolunteers(centerId) {
  if (!centerId || !allVolunteers.length) {
    volunteerSelect.innerHTML = '<option value="">اختر المركز أولاً</option>';
    volunteerSelect.disabled = true;
    return;
  }
  const filtered = allVolunteers.filter(v => String(v.centerId) === String(centerId));
  renderVolunteers(filtered);
  volunteerSelect.disabled = false;
}

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

function validateForm() {
  const checks = [
    { el: dateInput, name: 'التاريخ' },
    { el: centerSelect, name: 'المركز' },
    { el: volunteerSelect, name: 'المتطوع' },
    { el: referenceInput, name: 'الرقم المرجعي' },
    { el: valueInput, name: 'القيمة' },
    { el: typeSelect, name: 'نوع التبرع' }
  ];
  for (const c of checks) {
    if (!c.el.value) { showError('الرجاء إدخال "' + c.name + '"'); c.el.focus(); return false; }
  }
  if (referenceInput.value.trim().length < 3) {
    showError('الرقم المرجعي يجب أن يكون 3 أحرف على الأقل'); referenceInput.focus(); return false;
  }
  if (parseFloat(valueInput.value) <= 0) {
    showError('الرجاء إدخال قيمة صحيحة أكبر من صفر'); valueInput.focus(); return false;
  }
  return true;
}

async function handleSubmit(e) {
  e.preventDefault();
  hideError();
  if (!validateForm()) return;
  setLoading(true);
  try {
    await apiPost({
      action: 'submit',
      date: dateInput.value,
      center: centerSelect.options[centerSelect.selectedIndex].text,
      volunteer: volunteerSelect.options[volunteerSelect.selectedIndex].text,
      receiptImage: selectedImageBase64 || '',
      referenceNumber: referenceInput.value.trim(),
      value: valueInput.value,
      donationType: typeSelect.options[typeSelect.selectedIndex].text
    });
    localStorage.removeItem(CACHE_KEY);
    showSuccess();
    resetForm();
  } catch (_) {
    showError('فشل إرسال البيانات. حاول مرة أخرى.');
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  document.querySelectorAll('.btn-text').forEach(el => el.style.display = loading ? 'none' : 'inline');
  document.querySelectorAll('.btn-loader').forEach(el => el.style.display = loading ? 'inline' : 'none');
  document.querySelectorAll('.btn-submit').forEach(btn => btn.disabled = loading);
  form.querySelectorAll('input, select').forEach(el => el.disabled = loading);
}

function showError(msg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
function hideError() { errorMsg.style.display = 'none'; }
function showSuccess() { successOverlay.style.display = 'flex'; }

function resetForm() {
  dateInput.value = new Date().toISOString().split('T')[0];
  centerSelect.value = '';
  volunteerSelect.innerHTML = '<option value="">اختر المركز أولاً</option>';
  volunteerSelect.disabled = true;
  typeSelect.value = '';
  referenceInput.value = '';
  valueInput.value = '';
  clearImage();
}

function attachEvents() {
  form.addEventListener('submit', handleSubmit);
  document.getElementById('stickySubmitBtn').addEventListener('click', function() {
    form.requestSubmit();
  });
  newSubmissionBtn.addEventListener('click', function() { successOverlay.style.display = 'none'; });
  centerSelect.addEventListener('change', function() { filterVolunteers(this.value); });
  receiptInput.addEventListener('change', function() { handleImageSelect(this.files[0]); });
  removeImageBtn.addEventListener('click', function(e) { e.stopPropagation(); clearImage(); });
  form.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', hideError);
    el.addEventListener('input', hideError);
  });
}

document.addEventListener('DOMContentLoaded', init);
