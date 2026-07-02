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

      for (let i = 0; i < data.entries.length; i++) {
        const entry = data.entries[i];
        let imageUrl = '';

        if (entry.receiptImage && entry.receiptImage.length > 50) {
          try {
            const centerName = (data.center || 'Unknown').replace(/[\/\\:*?"<>|]/g, '_');
            const centerFolder = getOrCreateSubFolder(parentFolder, centerName);

            const parts = entry.receiptImage.split(',');
            const rawData = parts.length > 1 ? parts[1] : parts[0];
            const mime = entry.receiptImage.indexOf('png') > -1 ? 'image/png' : 'image/jpeg';
            const ext = entry.receiptImage.indexOf('png') > -1 ? 'png' : 'jpg';

            const ref = (entry.referenceNumber || '').replace(/[\/\\:*?"<>|]/g, '_');
            const val = (entry.value || '').replace(/[\/\\:*?"<>|]/g, '_');
            const status = (entry.statusCode || '').replace(/[\/\\:*?"<>|]/g, '_');
            const fileName = status ? ref + '-' + val + '-' + status + '.' + ext : ref + '-' + val + '.' + ext;

            const blob = Utilities.newBlob(Utilities.base64Decode(rawData), mime, fileName);
            const file = centerFolder.createFile(blob);
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
      }

      return buildResponse({ success: true, message: 'تم حفظ ' + data.entries.length + ' تبرع بنجاح ✓', count: data.entries.length });
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
