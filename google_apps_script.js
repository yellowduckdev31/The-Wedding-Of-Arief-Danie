/**
 * GOOGLE APPS SCRIPT CODE (Untuk Buku Tamu & RSVP Nikah Arief & Wardani)
 * 
 * CARA PASANG:
 * 1. Buka https://sheets.google.com dan buat Spreadsheet baru (misal: "Buku Tamu Arief & Wardani").
 * 2. Beri nama kolom di Baris 1:
 *    Kolom A: Timestamp
 *    Kolom B: Nama Tamu
 *    Kolom C: Status Kehadiran
 *    Kolom D: Untaian Doa & Ucapan
 *    Kolom E: ID
 * 3. Di menu atas, klik Extensions (Ekstensi) > Apps Script.
 * 4. Hapus kode yang ada, lalu Paste kode di bawah ini.
 * 5. Klik Deploy > New deployment > Select type: Web app.
 * 6. Pada "Who has access", pilih: "Anyone" (Siapa saja).
 * 7. Klik Deploy, lalu salin URL Web App yang didapat.
 * 8. Tempelkan URL tersebut ke index.html sebelum <script src="game.js">:
 *    <script>window.GS_ENDPOINT = "URL_WEB_APP_ANDA";</script>
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Jika aksi hapus (Admin)
    if (data.action === 'delete') {
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][4]) === String(data.id)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Simpan pesan baru
    var timestamp = new Date();
    var name = data.name || 'Tamu Undangan';
    var status = data.status || 'Hadir';
    var message = data.text || '';
    var id = data.id || String(Date.now());
    
    sheet.appendRow([timestamp, name, status, message, id]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var rows = sheet.getDataRange().getValues();
    var wishes = [];
    
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1]) {
        wishes.unshift({
          timestamp: rows[i][0],
          name: rows[i][1],
          status: rows[i][2],
          text: rows[i][3],
          id: String(rows[i][4] || i)
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: wishes }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
