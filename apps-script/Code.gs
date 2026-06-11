const SHEET_ID = '1pdSNGPxxAY7LWpe0J8US4GvkQzsi5X1pq63wbjVSB7o';

function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function buildResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

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
      case 'getAllData':
        result = getAllData();
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }
  return buildResponse(result);
}


function uploadImage(base64, fileName) {
  if (!base64) return '';
  try {
    const parts = base64.split(',');
    const mime = parts[0].includes('png') ? 'image/png' : 'image/jpeg';
    const blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mime, fileName);
    const file = getOrCreateFolder('DonationReceipts').createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (_) { return ''; }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'submitBatch' && data.entries) {
      const sheet = getSheet('Submissions');
      const rows = sheet.getDataRange().getValues();
      let nextId = rows.length > 1 ? rows[rows.length - 1][0] + 1 : 1;
      const timestamp = new Date().toISOString();
      var folder = getOrCreateFolder('DonationReceipts');

      data.entries.forEach(function(entry) {
        var imageUrl = '';
        if (entry.receiptImage) {
          try {
            var parts = entry.receiptImage.split(',');
            var mime = parts[0].indexOf('png') > -1 ? 'image/png' : 'image/jpeg';
            var blob = Utilities.newBlob(
              Utilities.base64Decode(parts[1]), mime,
              'receipt_' + entry.referenceNumber + '_' + new Date().getTime()
            );
            var file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            imageUrl = file.getUrl();
          } catch (_) {}
        }

        sheet.appendRow([
          nextId++, timestamp, data.date, data.center,
          entry.volunteer, imageUrl, entry.referenceNumber || '',
          entry.value, entry.donationType, ''
        ]);
      });

      return buildResponse({ success: true, message: 'تم حفظ ' + data.entries.length + ' تبرع بنجاح ✓', count: data.entries.length });
    }
    return buildResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return buildResponse({ success: false, error: err.toString() });
  }
}

function getCenters() {
  const rows = getSheet('Centers').getDataRange().getValues();
  rows.shift();
  return { success: true, data: rows.map(r => ({ id: r[0], name: r[1], area: r[2] })) };
}

function getVolunteers(centerId) {
  const rows = getSheet('Volunteers').getDataRange().getValues();
  rows.shift();
  return {
    success: true,
    data: rows.filter(r => String(r[2]) === String(centerId))
      .map(r => ({ id: r[0], name: r[1], centerId: r[2], phone: r[3] }))
  };
}

function getDonationTypes() {
  const rows = getSheet('DonationTypes').getDataRange().getValues();
  rows.shift();
  return { success: true, data: rows.map(r => ({ id: r[0], name: r[1] })) };
}

function getAllData() {
  return {
    success: true,
    centers: getCenters().data,
    volunteers: getVolunteersAll().data,
    donationTypes: getDonationTypes().data
  };
}

function getVolunteersAll() {
  const rows = getSheet('Volunteers').getDataRange().getValues();
  rows.shift();
  return {
    success: true,
    data: rows.map(r => ({ id: r[0], name: r[1], centerId: r[2], phone: r[3] }))
  };
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}
