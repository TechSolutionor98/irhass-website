const fs = require('fs');

function replaceLines(filePath, startComment, endPattern, newCode) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startComment)) {
      startIndex = i;
      break;
    }
  }
  
  if (startIndex === -1) {
    console.log('Start comment not found in ' + filePath);
    return;
  }
  
  let exportIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes(endPattern)) {
      exportIndex = i;
      break;
    }
  }
  
  if (exportIndex === -1) {
    console.log('Export line not found in ' + filePath);
    return;
  }
  
  let endIndex = exportIndex - 1;
  while (endIndex > startIndex && (lines[endIndex].trim() === '' || lines[endIndex].trim() === '}' || lines[endIndex].trim() === ')' || lines[endIndex].trim() === '</div>' || lines[endIndex].trim() === '</>')) {
    endIndex--;
  }
  
  const newLines = [
    ...lines.slice(0, startIndex),
    newCode,
    ...lines.slice(endIndex + 1)
  ];
  
  fs.writeFileSync(filePath, newLines.join('\n'));
  console.log('Fixed ' + filePath);
}

const basePath = '/Users/mr-fahad-03/Downloads/Projects/Irhaas  Final Website/Irhaas/irhaas-offic/client/src/pages/admin/';

const newCode = `        <AdminOrderDetailsModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => {
            setOrders(orders.map(o => o._id === updatedOrder._id ? updatedOrder : o));
            if (selectedOrder && selectedOrder._id === updatedOrder._id) {
              setSelectedOrder(updatedOrder);
            }
          }}
        />`;

replaceLines(basePath + 'ProcessingOrders.jsx', 'Comprehensive Order Details Modal', 'export default ProcessingOrders', newCode);
replaceLines(basePath + 'OnHold.jsx', 'Order Details Modal', 'export default OnHold', newCode);
replaceLines(basePath + 'CancelledOrders.jsx', 'Comprehensive Order Details Modal', 'export default CancelledOrders', newCode);
replaceLines(basePath + 'ReadyForShipment.jsx', 'Comprehensive Order Details Modal', 'export default ReadyForShipment', newCode);
replaceLines(basePath + 'OnTheWay.jsx', 'Comprehensive Order Details Modal', 'export default OnTheWay', newCode);
replaceLines(basePath + 'Delivered.jsx', 'Comprehensive Order Details Modal', 'export default Delivered', newCode);
