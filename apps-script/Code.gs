// ============================================================
// Google Apps Script - Donation Collection System
// ============================================================

const SHEET_ID = '1pdSNGPxxAY7LWpe0J8US4GvkQzsi5X1pq63wbjVSB7o';

function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

// ============================================================
// CORS headers for GitHub Pages frontend
// ============================================================
function addCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// ============================================================
// GET handler - fetch data
// ============================================================
function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch (action) {
      case 'getCenters':
        result = getCenters();
        break;
      case 'getVolunteers':
        result = getVolunteers(e.parameter.centerId);
        break;
      case 'getDonationTypes':
        result = getDonationTypes();
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  const response = ContentService.createTextOutput(JSON.stringify(result));
  response.setMimeType(ContentService.MimeType.JSON);
  return addCorsHeaders(response);
}

// ============================================================
// POST handler - submit donation + upload image
// ============================================================
function doPost(e) {
  const response = ContentService.createTextOutput();
  response.setMimeType(ContentService.MimeType.JSON);
  addCorsHeaders(response);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'submit') {
      // Upload image to Drive if present
      let imageUrl = '';
      if (data.receiptImage) {
        const imageBlob = Utilities.newBlob(
          Utilities.base64Decode(data.receiptImage.split(',')[1]),
          data.receiptImage.includes('image/png') ? 'image/png' : 'image/jpeg',
          'receipt_' + data.referenceNumber + '_' + new Date().getTime()
        );
        const folder = getOrCreateFolder('DonationReceipts');
        const file = folder.createFile(imageBlob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = file.getUrl();
      }

      // Save submission to sheet
      const sheet = getSheet('Submissions');
      const submissions = sheet.getDataRange().getValues();
      const newId = submissions.length > 1 ? submissions[submissions.length - 1][0] + 1 : 1;

      sheet.appendRow([
        newId,
        new Date().toISOString(),
        data.date,
        data.center,
        data.volunteer,
        imageUrl,
        data.referenceNumber,
        data.value,
        data.donationType
      ]);

      response.setContent(JSON.stringify({
        success: true,
        message: 'تم حفظ التبرع بنجاح ✓',
        id: newId
      }));
    } else {
      response.setContent(JSON.stringify({
        success: false,
        error: 'Unknown action'
      }));
    }
  } catch (err) {
    response.setContent(JSON.stringify({
      success: false,
      error: err.toString()
    }));
  }

  return response;
}

// ============================================================
// Handle OPTIONS for CORS preflight
// ============================================================
function doOptions() {
  const response = ContentService.createTextOutput('');
  response.setMimeType(ContentService.MimeType.JSON);
  return addCorsHeaders(response);
}

// ============================================================
// Data fetching functions
// ============================================================

function getCenters() {
  const sheet = getSheet('Centers');
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  return {
    success: true,
    data: rows.map(r => ({ id: r[0], name: r[1], area: r[2] }))
  };
}

function getVolunteers(centerId) {
  const sheet = getSheet('Volunteers');
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const filtered = rows.filter(r => String(r[2]) === String(centerId));
  return {
    success: true,
    data: filtered.map(r => ({ id: r[0], name: r[1], centerId: r[2], phone: r[3] }))
  };
}

function getDonationTypes() {
  const sheet = getSheet('DonationTypes');
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  return {
    success: true,
    data: rows.map(r => ({ id: r[0], name: r[1] }))
  };
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}
