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

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'submitBatch' && data.entries) {
      const sheet = getSheet('Submissions');
      const rows = sheet.getDataRange().getValues();
      let nextId = rows.length > 1 ? rows[rows.length - 1][0] + 1 : 1;
      const timestamp = new Date().toISOString();
      const parentFolder = getOrCreateFolder('DonationReceipts');

      // Build set of existing (center + referenceNumber) to detect duplicates
      var existing = {};
      for (var r = 1; r < rows.length; r++) {
        var row = rows[r];
        var key = (row[4] || '') + '|' + (row[10] || '');
        existing[key] = true;
      }

      var saved = 0;
      var skipped = 0;

      for (var i = 0; i < data.entries.length; i++) {
        var entry = data.entries[i];
        var dupKey = (data.center || '') + '|' + (entry.referenceNumber || '');

        if (existing[dupKey]) {
          skipped++;
          continue;
        }
        existing[dupKey] = true;

        var imageUrl = '';

        if (entry.receiptImage && entry.receiptImage.length > 50) {
          try {
            var centerName = (data.center || 'Unknown').replace(/[\/\\:*?"<>|]/g, '_');
            var centerFolder = getOrCreateSubFolder(parentFolder, centerName);

            var parts = entry.receiptImage.split(',');
            var rawData = parts.length > 1 ? parts[1] : parts[0];
            var mime = entry.receiptImage.indexOf('png') > -1 ? 'image/png' : 'image/jpeg';
            var ext = entry.receiptImage.indexOf('png') > -1 ? 'png' : 'jpg';

            var ref = (entry.referenceNumber || '').replace(/[\/\\:*?"<>|]/g, '_');
            var val = (entry.value || '').replace(/[\/\\:*?"<>|]/g, '_');
            var status = (entry.statusCode || '').replace(/[\/\\:*?"<>|]/g, '_');
            var fileName = status ? ref + '-' + val + '-' + status + '.' + ext : ref + '-' + val + '.' + ext;

            var blob = Utilities.newBlob(Utilities.base64Decode(rawData), mime, fileName);
            var file = centerFolder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            imageUrl = file.getUrl();
          } catch (e) {
            imageUrl = 'ERROR: ' + e.toString().substring(0, 100);
          }
        }

        sheet.appendRow([
          nextId++, timestamp, data.date, data.campaign || '', data.center,
          entry.volunteer, entry.phone || '', entry.donationType || '',
          entry.receiptType || '', entry.receiptDate || '',
          entry.referenceNumber || '', entry.value || '',
          imageUrl, entry.statusCode || '', ''
        ]);
        saved++;
      }

      var msg = saved > 0 ? 'تم حفظ ' + saved + ' تبرع بنجاح ✓' : 'لم يتم حفظ أي تبرع';
      if (skipped > 0) msg += ' (' + skipped + ' مكرر تم تخطيه)';
      return buildResponse({ success: saved > 0, message: msg, count: saved, skipped: skipped });
    }

    return buildResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return buildResponse({ success: false, error: err.toString() });
  }
}

function getAllData() {
  return {
    success: true,
    campaigns: getCampaigns().data,
    centers: getCenters().data,
    volunteers: getVolunteersAll().data,
    donationTypes: getDonationTypes().data,
    receiptTypes: getReceiptTypes().data
  };
}

function getCampaigns() {
  const sheet = getSheet('Campaigns');
  if (!sheet) return { success: true, data: [] };
  const rows = sheet.getDataRange().getValues();
  rows.shift();
  return { success: true, data: rows.map(r => ({ id: r[0], name: r[1] })) };
}

function getCenters() {
  const rows = getSheet('Centers').getDataRange().getValues();
  rows.shift();
  return { success: true, data: rows.map(r => ({ id: r[0], name: r[1], area: r[2] })) };
}

function getVolunteersAll() {
  const rows = getSheet('Volunteers').getDataRange().getValues();
  rows.shift();
  return {
    success: true,
    data: rows.map(r => ({ id: r[0], name: r[1], centerId: r[2], phone: r[3] || '' }))
  };
}

function getDonationTypes() {
  const rows = getSheet('DonationTypes').getDataRange().getValues();
  rows.shift();
  return { success: true, data: rows.map(r => ({ id: r[0], name: r[1] })) };
}

function getReceiptTypes() {
  const sheet = getSheet('ReceiptTypes');
  if (!sheet) return { success: true, data: [] };
  const rows = sheet.getDataRange().getValues();
  rows.shift();
  return { success: true, data: rows.map(r => ({ id: r[0], name: r[1] })) };
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function getOrCreateSubFolder(parent, name) {
  const folders = parent.getFolders();
  while (folders.hasNext()) {
    const f = folders.next();
    if (f.getName() === name) return f;
  }
  return parent.createFolder(name);
}
