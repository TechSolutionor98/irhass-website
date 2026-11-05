const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'client/src/pages/admin');
const filesToProcess = [
  'ProcessingOrders.jsx',
  'OnHold.jsx',
  'CancelledOrders.jsx',
  'ReadyForShipment.jsx',
  'OnTheWay.jsx',
  'Delivered.jsx'
];

filesToProcess.forEach(file => {
  const filePath = path.join(directoryPath, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // The modal block either starts with { /* Order Details Modal */ } or { /* Comprehensive Order Details Modal */ }
  // We want to replace from this start comment until the end of the file, leaving the trailing closing tags.
  // The end of the file usually looks like:
  //      </div>
  //    </div>
  //  )
  // }
  // export default <Filename>

  const jsxRegex = /\{?\/\*\s*(?:Comprehensive )?Order Details Modal\s*\*\/?\}?[\s\S]*?(?=\s*<\/div>\s*<\/div>\s*\)\s*\})/i;

  const replacementJSX = `
        <AdminOrderDetailsModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => {
            setOrders(orders.map(o => o._id === updatedOrder._id ? updatedOrder : o));
            if (selectedOrder && selectedOrder._id === updatedOrder._id) {
              setSelectedOrder(updatedOrder);
            }
          }}
        />
`;

  if (content.match(jsxRegex)) {
    content = content.replace(jsxRegex, replacementJSX);
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  } else {
    console.log(`Could not find match in ${file}`);
  }
});
