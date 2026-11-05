const fs = require('fs');

const filesToFix = [
  'ProcessingOrders.jsx',
  'OnHold.jsx',
  'CancelledOrders.jsx',
  'ReadyForShipment.jsx',
  'OnTheWay.jsx',
  'Delivered.jsx'
];

const basePath = '/Users/mr-fahad-03/Downloads/Projects/Irhaas  Final Website/Irhaas/irhaas-offic/client/src/pages/admin/';

filesToFix.forEach(file => {
  const filePath = basePath + file;
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('AdminOrderDetailsModal')) {
    console.log(`${file} doesn't even use the component?! Skipping.`);
    return;
  }
  
  if (!content.includes('import AdminOrderDetailsModal')) {
    // find the first import statement and add it after
    const lines = content.split('\n');
    let importIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        importIndex = i;
        break;
      }
    }
    
    if (importIndex !== -1) {
      lines.splice(importIndex + 1, 0, 'import AdminOrderDetailsModal from "../../components/admin/AdminOrderDetailsModal";');
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`Added import to ${file}`);
    } else {
      console.log(`Could not find where to add import in ${file}`);
    }
  } else {
    console.log(`${file} already has import.`);
  }
});
