/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * CANINANA COLETOR - GOOGLE APPS SCRIPT BACKEND
 * Integração com a Planilha Oficial da Caninana Auto Vidros.
 * 
 * INSTRUÇÕES DE IMPLANTAÇÃO:
 * 1. Abra sua Planilha Google: https://docs.google.com/spreadsheets/d/10nUmSSw_OIVKlm7vAZ-fK4LF_vx4CZKLQDH9kTxhLFE/edit
 * 2. Vá no menu: Extensões > Apps Script.
 * 3. Apague todo o código existente lá e cole este código completo.
 * 4. Clique em "Salvar" (ícone de disquete).
 * 5. Clique em "Implantar" > "Gerenciar implantações" (ou "Nova implantação").
 * 6. Se criar uma Nova implantação:
 *    - Selecione o tipo: "App da Web" (ícone de engrenagem).
 *    - Descrição: "Caninana Coletor API"
 *    - Executar como: "Eu" (sua conta Google).
 *    - Quem tem acesso: "Qualquer pessoa" (ATENÇÃO: Deve ser 'Qualquer pessoa' para o coletor conseguir sincronizar!).
 * 7. Clique em "Implantar", autorize o acesso da sua conta Google e COPIE a "URL do app da Web" gerada.
 * 8. Cole essa URL no Caninana Coletor na aba "Sinc." do aplicativo!
 */

function doPost(e) {
  try {
    var rawContents = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var requestData = JSON.parse(rawContents);
    var action = requestData.action || "fetch";
    var result;

    if (action === "fetch") {
      result = fetchAllData();
    } else if (action === "sync") {
      result = syncData(requestData.payload || {});
    } else {
      throw new Error("Ação inválida: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var result = fetchAllData();
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Retorna todos os dados da planilha organizados em objetos JSON
function fetchAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  return {
    products: getProductsFromSheet(getSheetHelper(ss, ["CADASTRO PRODUTOS", "PRODUTOS", "ESTOQUE", "CADASTRO"])),
    movements: getMovementsFromSheet(ss),
    inventory: getInventoryFromSheet(getSheetHelper(ss, ["INVENTÁRIO GERAL", "INVENTARIO GERAL", "INVENTARIO", "INVENTÁRIO"])),
    users: getSheetAsJson(getSheetHelper(ss, ["Usuários", "Usuarios", "Operadores"])) || [],
    logs: getSheetAsJson(getSheetHelper(ss, ["Logs", "Auditoria"])) || []
  };
}

// Helper para encontrar abas mesmo com acentuação ou caixa diferente
function getSheetHelper(ss, possibleNames) {
  for (var i = 0; i < possibleNames.length; i++) {
    var sheet = ss.getSheetByName(possibleNames[i]);
    if (sheet) return sheet;
  }
  // Tentar busca insensível a maiúsculas
  var allSheets = ss.getSheets();
  for (var j = 0; j < allSheets.length; j++) {
    var sheetName = allSheets[j].getName().trim().toLowerCase();
    for (var k = 0; k < possibleNames.length; k++) {
      if (sheetName === possibleNames[k].toLowerCase()) {
        return allSheets[j];
      }
    }
  }
  return null;
}

// Lê os produtos da aba de cadastro
function getProductsFromSheet(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return []; // Linha 4 é normalmente o cabeçalho
  
  var numCols = Math.min(sheet.getLastColumn(), 17);
  var data = sheet.getRange(5, 1, lastRow - 4, numCols).getValues();
  var products = [];
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var barcode = String(row[0] || '').trim();
    if (!barcode) continue;
    
    // Procura colunas com valores sensatos
    var description = String(row[1] || '');
    var category = String(row[2] || '');
    var application = String(row[3] || '');
    var location = String(row[4] || '');
    var stock = Number(row[12] !== undefined && row[12] !== '' ? row[12] : (row[5] || 0));
    var minStock = Number(row[6] || 3);
    
    products.push({
      barcode: barcode,
      description: description,
      category: category,
      application: application,
      location: location,
      stock: isNaN(stock) ? 0 : stock,
      minStock: isNaN(minStock) ? 3 : minStock
    });
  }
  return products;
}

// Lê o histórico de movimentações (Entradas + Saídas)
function getMovementsFromSheet(ss) {
  var movements = [];
  
  // Entradas
  var sheetEntradas = getSheetHelper(ss, ["ENTRADAS NF", "ENTRADAS", "ENTRADA"]);
  if (sheetEntradas && sheetEntradas.getLastRow() >= 5) {
    var dataEntradas = sheetEntradas.getRange(5, 1, sheetEntradas.getLastRow() - 4, Math.min(sheetEntradas.getLastColumn(), 11)).getValues();
    for (var i = 0; i < dataEntradas.length; i++) {
      var row = dataEntradas[i];
      var barcode = String(row[2] || row[1] || '').trim();
      if (!barcode) continue;
      
      movements.push({
        id: "ent_" + i + "_" + barcode,
        barcode: barcode,
        type: "Entrada",
        quantity: Number(row[5] || row[3] || 1),
        date: formatDate(row[0]),
        user: String(row[9] || 'Sistema'),
        synced: true
      });
    }
  }
  
  // Saídas
  var sheetSaidas = getSheetHelper(ss, ["SAÍDAS DIÁRIAS", "SAIDAS DIARIAS", "SAIDAS", "SAÍDAS"]);
  if (sheetSaidas && sheetSaidas.getLastRow() >= 5) {
    var dataSaidas = sheetSaidas.getRange(5, 1, sheetSaidas.getLastRow() - 4, Math.min(sheetSaidas.getLastColumn(), 10)).getValues();
    for (var j = 0; j < dataSaidas.length; j++) {
      var rowS = dataSaidas[j];
      var barcodeS = String(rowS[1] || rowS[2] || '').trim();
      if (!barcodeS) continue;
      
      movements.push({
        id: "sai_" + j + "_" + barcodeS,
        barcode: barcodeS,
        type: "Saída",
        quantity: Number(rowS[3] || 1),
        date: formatDate(rowS[0]),
        user: String(rowS[8] || 'Sistema'),
        synced: true
      });
    }
  }
  
  return movements;
}

// Lê a contagem de inventário físico
function getInventoryFromSheet(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return [];
  
  var data = sheet.getRange(5, 1, lastRow - 4, Math.min(sheet.getLastColumn(), 10)).getValues();
  var inventory = [];
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var barcode = String(row[1] || '').trim();
    var countedQty = row[5];
    if (!barcode || countedQty === "") continue;
    
    inventory.push({
      barcode: barcode,
      countedQuantity: Number(countedQty),
      date: formatDate(row[0]),
      user: String(row[8] || 'Sistema'),
      synced: true
    });
  }
  return inventory;
}

// Converte os dados de uma aba padrão para JSON
function getSheetAsJson(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var jsonArray = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    var emptyRow = true;
    for (var j = 0; j < headers.length; j++) {
      var cellVal = row[j];
      obj[headers[j]] = cellVal;
      if (cellVal !== "") emptyRow = false;
    }
    if (!emptyRow) {
      jsonArray.push(obj);
    }
  }
  return jsonArray;
}

// Sincroniza coletas recebidas do coletor nas abas da planilha
function syncData(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // 1. Inserir Movimentações
  if (payload.movements && payload.movements.length > 0) {
    var sheetEntradas = getSheetHelper(ss, ["ENTRADAS NF", "ENTRADAS"]);
    var sheetSaidas = getSheetHelper(ss, ["SAÍDAS DIÁRIAS", "SAIDAS DIARIAS", "SAIDAS"]);
    
    for (var i = 0; i < payload.movements.length; i++) {
      var mov = payload.movements[i];
      var barcodeStr = String(mov.barcode);
      var description = getProductDescription(ss, barcodeStr);
      
      if (mov.type === "Entrada" && sheetEntradas) {
        sheetEntradas.appendRow([
          mov.date ? mov.date.split("T")[0] : dateStr,
          "",
          barcodeStr,
          description,
          "",
          Number(mov.quantity),
          0,
          "",
          "",
          mov.user,
          "Sincronizado via Smartphone"
        ]);
      } else if (mov.type === "Saída" && sheetSaidas) {
        var dateFormatted = "";
        try {
          var d = mov.date ? new Date(mov.date) : new Date();
          dateFormatted = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
        } catch(e) {
          dateFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
        }
        sheetSaidas.appendRow([
          dateFormatted,
          barcodeStr,
          description,
          Number(mov.quantity || 1),
          "",
          mov.orderNumber || "",
          mov.requester || "",
          mov.destination || "Oficina",
          mov.user || "Sistema",
          mov.notes || "Sincronizado via Smartphone"
        ]);
      }
    }
  }
  
  // 2. Inserir Contagens de Inventário
  if (payload.inventory && payload.inventory.length > 0) {
    var sheetInv = getSheetHelper(ss, ["INVENTÁRIO GERAL", "INVENTARIO GERAL", "INVENTARIO"]);
    if (sheetInv) {
      var dataInv = sheetInv.getDataRange().getValues();
      
      for (var j = 0; j < payload.inventory.length; j++) {
        var inv = payload.inventory[j];
        var barcodeStr = String(inv.barcode);
        var found = false;
        
        for (var rowIdx = 4; rowIdx < dataInv.length; rowIdx++) {
          if (String(dataInv[rowIdx][1] || '').trim() === barcodeStr) {
            sheetInv.getRange(rowIdx + 1, 6).setValue(Number(inv.countedQuantity));
            sheetInv.getRange(rowIdx + 1, 1).setValue(inv.date ? inv.date.split("T")[0] : dateStr);
            sheetInv.getRange(rowIdx + 1, 9).setValue(inv.user);
            found = true;
            break;
          }
        }
        
        if (!found) {
          var desc = getProductDescription(ss, barcodeStr);
          sheetInv.appendRow([
            inv.date ? inv.date.split("T")[0] : dateStr,
            barcodeStr,
            desc,
            "Geral",
            0,
            Number(inv.countedQuantity),
            "",
            "",
            inv.user,
            "Item novo inventariado via Smartphone"
          ]);
        }
      }
    }
  }

  // 3. Registrar Logs
  if (payload.logs && payload.logs.length > 0) {
    var sheetLogs = getSheetHelper(ss, ["Logs"]);
    if (!sheetLogs) {
      sheetLogs = ss.insertSheet("Logs");
      sheetLogs.appendRow(["id", "timestamp", "message", "type", "user"]);
    }
    var existingLogIds = getColumnValues(sheetLogs, 1);
    for (var k = 0; k < payload.logs.length; k++) {
      var log = payload.logs[k];
      if (existingLogIds.indexOf(log.id) === -1) {
        sheetLogs.appendRow([
          log.id,
          log.timestamp,
          log.message,
          log.type,
          log.user
        ]);
      }
    }
  }

  // 4. Novos produtos cadastrados no Coletor
  if (payload.newProducts && payload.newProducts.length > 0) {
    var sheetProd = getSheetHelper(ss, ["CADASTRO PRODUTOS", "PRODUTOS"]);
    if (sheetProd) {
      var existingBarcodes = getColumnValues(sheetProd, 1);
      for (var p = 0; p < payload.newProducts.length; p++) {
        var prod = payload.newProducts[p];
        var barcodeStr = String(prod.barcode);
        if (existingBarcodes.indexOf(barcodeStr) === -1) {
          sheetProd.appendRow([
            barcodeStr,
            prod.description,
            prod.category,
            prod.application,
            prod.location || "Geral",
            "UN",
            Number(prod.minStock),
            0,
            "Sim",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
          ]);
        }
      }
    }
  }

  return {
    syncedMovements: payload.movements ? payload.movements.length : 0,
    syncedInventory: payload.inventory ? payload.inventory.length : 0,
    timestamp: new Date().toISOString()
  };
}

function getProductDescription(ss, barcode) {
  var sheet = getSheetHelper(ss, ["CADASTRO PRODUTOS", "PRODUTOS"]);
  if (!sheet) return "";
  var data = sheet.getDataRange().getValues();
  var barcodeStr = String(barcode).trim();
  for (var i = 4; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === barcodeStr) {
      return String(data[i][1] || '');
    }
  }
  return "";
}

function getColumnValues(sheet, colNum) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  var values = sheet.getRange(1, colNum, lastRow, 1).getValues();
  return values.map(function(row) { return String(row[0]); });
}

function formatDate(dateObj) {
  if (!dateObj) return "";
  if (dateObj instanceof Date) {
    return dateObj.toISOString();
  }
  return String(dateObj);
}
`;
