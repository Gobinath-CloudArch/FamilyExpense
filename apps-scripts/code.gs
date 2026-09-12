function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions');
    
    if (data.action === 'addTransaction') {
      // Append row: [Date, Amount, Category, Scope, Description, Family Split]
      sheet.appendRow([
        new Date(),
        data.amount,
        data.category,
        data.scope,
        data.description,
        data.familySplit // Always an empty string
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Existing edit/delete logic remains here
    if (data.action === 'editTransaction') {
       // ... existing code ...
    }
    if (data.action === 'deleteTransaction') {
       // ... existing code ...
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}