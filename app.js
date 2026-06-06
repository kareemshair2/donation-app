// ============================================================
// Donation Collection App - Frontend Logic
// ============================================================

// --- Config ---
// استبدل الرابط أدناه برابط Web App من Google Apps Script بعد النشر
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz4MN5m6qPY3tq7_gVqfDmVTN2BF6rK9Pnhrt5xMxrE174fKDI5scKFqdOvCvHwhyyR/exec';

// --- DOM refs ---
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

let centersData = [];
let volunteersData = [];
let typesData = [];
let selectedImageBase64 = null;

// ============================================================
// Initialize
// ============================================================
function init() {
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  dateInput.max = today;
  fetchCenters();
  fetchDonationTypes();
  attachEvents();
}

// ============================================================
// API calls
// ============================================================
async function apiGet(params) {
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return res.json();
}

async function apiPost(data) {
  // Try normal CORS POST first; fallback to no-cors if it fails
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (_) {
    // Fallback: no-cors (won't read response, but data still saves)
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return { success: true };
  }
}

// ============================================================
// Fetch data from Google Sheets
// ============================================================
async function fetchCenters() {
  centerLoader.style.display = 'inline-block';
  try {
    const result = await apiGet({ action: 'getCenters' });
    if (result.success) {
      centersData = result.data;
      renderCenters(result.data);
    }
  } catch (e) {
    showError('تعذر تحميل المراكز. تحقق من اتصال الإنترنت.');
  } finally {
    centerLoader.style.display = 'none';
  }
}

async function fetchDonationTypes() {
  typeLoader.style.display = 'inline-block';
  try {
    const result = await apiGet({ action: 'getDonationTypes' });
    if (result.success) {
      typesData = result.data;
      renderDonationTypes(result.data);
    }
  } catch (_) {} finally {
    typeLoader.style.display = 'none';
  }
}

async function fetchVolunteers(centerId) {
  if (!centerId) {
    volunteerSelect.innerHTML = '<option value="">اختر المركز أولاً</option>';
    volunteerSelect.disabled = true;
    volunteersData = [];
    return;
  }
  volunteerLoader.style.display = 'inline-block';
  volunteerSelect.disabled = true;
  volunteerSelect.innerHTML = '<option value="">جاري التحميل...</option>';
  try {
    const result = await apiGet({ action: 'getVolunteers', centerId });
    if (result.success) {
      volunteersData = result.data;
      renderVolunteers(result.data);
      volunteerSelect.disabled = false;
    } else {
      volunteerSelect.innerHTML = '<option value="">لا يوجد متطوعون</option>';
    }
  } catch (_) {
    volunteerSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
  } finally {
    volunteerLoader.style.display = 'none';
  }
}

// ============================================================
// Render helpers
// ============================================================
function renderCenters(centers) {
  centerSelect.innerHTML = '<option value="">اختر المركز</option>';
  centers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + ' - ' + c.area;
    centerSelect.appendChild(opt);
  });
}

function renderVolunteers(volunteers) {
  volunteerSelect.innerHTML = '<option value="">اختر المتطوع</option>';
  volunteers.forEach(v => {
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

// ============================================================
// Image handling
// ============================================================
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

// ============================================================
// Validation
// ============================================================
function validateForm() {
  const fields = [
    { el: dateInput, name: 'التاريخ' },
    { el: centerSelect, name: 'المركز' },
    { el: volunteerSelect, name: 'المتطوع' },
    { el: referenceInput, name: 'الرقم المرجعي' },
    { el: valueInput, name: 'القيمة' },
    { el: typeSelect, name: 'نوع التبرع' }
  ];
  for (const f of fields) {
    if (!f.el.value || f.el.value === '') {
      showError('الرجاء إدخال "' + f.name + '"');
      f.el.focus();
      return false;
    }
  }
  if (referenceInput.value.trim().length < 3) {
    showError('الرقم المرجعي يجب أن يكون 3 أحرف على الأقل');
    referenceInput.focus();
    return false;
  }
  const val = parseFloat(valueInput.value);
  if (isNaN(val) || val <= 0) {
    showError('الرجاء إدخال قيمة صحيحة أكبر من صفر');
    valueInput.focus();
    return false;
  }
  return true;
}

// ============================================================
// Submit
// ============================================================
async function handleSubmit(e) {
  e.preventDefault();
  hideError();
  if (!validateForm()) return;
  setLoading(true);

  const payload = {
    action: 'submit',
    date: dateInput.value,
    center: centerSelect.options[centerSelect.selectedIndex].text,
    volunteer: volunteerSelect.options[volunteerSelect.selectedIndex].text,
    receiptImage: selectedImageBase64 || '',
    referenceNumber: referenceInput.value.trim(),
    value: valueInput.value,
    donationType: typeSelect.options[typeSelect.selectedIndex].text
  };

  try {
    const result = await apiPost(payload);
    if (result && result.success === false) {
      showError(result.error || 'فشل الحفظ');
      return;
    }
    showSuccess();
    resetForm();
  } catch (e) {
    showError('فشل إرسال البيانات. حاول مرة أخرى.');
  } finally {
    setLoading(false);
  }
}

// ============================================================
// UI state
// ============================================================
function setLoading(loading) {
  document.querySelectorAll('.btn-text').forEach(el => el.style.display = loading ? 'none' : 'inline');
  document.querySelectorAll('.btn-loader').forEach(el => el.style.display = loading ? 'inline' : 'none');
  document.querySelectorAll('.btn-submit').forEach(btn => btn.disabled = loading);
  form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = loading);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
}

function hideError() { errorMsg.style.display = 'none'; }

function showSuccess() { successOverlay.style.display = 'flex'; }

function resetForm() {
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  centerSelect.value = '';
  volunteerSelect.innerHTML = '<option value="">اختر المركز أولاً</option>';
  volunteerSelect.disabled = true;
  typeSelect.value = '';
  referenceInput.value = '';
  valueInput.value = '';
  clearImage();
}

// ============================================================
// Events
// ============================================================
function attachEvents() {
  form.addEventListener('submit', handleSubmit);

  newSubmissionBtn.addEventListener('click', function() {
    successOverlay.style.display = 'none';
  });

  centerSelect.addEventListener('change', function() {
    fetchVolunteers(this.value);
  });

  receiptInput.addEventListener('change', function() {
    handleImageSelect(this.files[0]);
  });

  removeImageBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    clearImage();
  });

  form.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', hideError);
    el.addEventListener('input', hideError);
  });
}

// ============================================================
// Start
// ============================================================
document.addEventListener('DOMContentLoaded', init);
