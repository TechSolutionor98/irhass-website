const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'client/src/pages/admin');
const filesToProcess = [
  'NewOrders.jsx',
  'OnHold.jsx',
  'OnHoldOrders.jsx',
  'ProcessingOrders.jsx',
  'ConfirmedOrders.jsx',
  'CriticalOrders.jsx',
  'CancelledOrders.jsx',
  'DeletedOrders.jsx',
  'Delivered.jsx',
  'OnlineOrders.jsx',
  'OnTheWay.jsx',
  'ReadyForShipment.jsx'
];

filesToProcess.forEach(file => {
  const filePath = path.join(directoryPath, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Skip commented out files
  if (content.includes('// const handleViewOrder') || content.includes('//   const handleViewOrder')) {
    console.log(`Skipping ${file} because it appears to be commented out.`);
    return;
  }

  // Add import if not exists
  if (!content.includes('AdminOrderDetailsModal')) {
    content = content.replace(
      'import AdminSidebar',
      'import AdminOrderDetailsModal from "../../components/admin/AdminOrderDetailsModal"\nimport AdminSidebar'
    );
  }

  // Remove InvoiceComponent forwardRef completely
  const invoiceRegex = /\/\/ Invoice Component for Printing[\s\S]*?const InvoiceComponent = forwardRef\(\(\{ order \}, ref\) => \{[\s\S]*?\}\)[\s\S]*?(?=const \w+ = \(\) => \{)/;
  content = content.replace(invoiceRegex, '');
  
  const invoiceRegex2 = /const InvoiceComponent = forwardRef\(\(\{ order \}, ref\) => \{[\s\S]*?\}\)[\s\S]*?(?=const \w+ = \(\) => \{)/;
  content = content.replace(invoiceRegex2, '');
  
  // If commented out invoice component exists
  const invoiceRegex3 = /\/\/ const InvoiceComponent = forwardRef\(\(\{ order \}, ref\) => \{[\s\S]*?\}\)[\s\S]*?(?=const \w+ = \(\) => \{)/;
  content = content.replace(invoiceRegex3, '');

  // Remove state variables
  const stateVarsToRemove = [
    /const \[orderNotes, setOrderNotes\] = useState\(""\)\n?/g,
    /const \[trackingId, setTrackingId\] = useState\(""\)\n?/g,
    /const \[estimatedDelivery, setEstimatedDelivery\] = useState\(""\)\n?/g,
    /const \[sellerComments, setSellerComments\] = useState\(""\)\n?/g,
    /const \[sellerMessage, setSellerMessage\] = useState\(""\)\n?/g,
    /const \[showNotificationModal, setShowNotificationModal\] = useState\(false\)\n?/g,
    /const \[notificationMessage, setNotificationMessage\] = useState\(""\)\n?/g,
    /const \[notificationOrderId, setNotificationOrderId\] = useState\(null\)\n?/g,
    /const printComponentRef = useRef\(null\)\n?/g,
  ];
  stateVarsToRemove.forEach(regex => {
    content = content.replace(regex, '');
  });
  
  // Remove unused options (if any) that AdminOrderDetailsModal handles
  // Wait, let's leave orderStatusOptions, formatPrice etc if they are used elsewhere in the file.
  
  // Simplify handleViewOrder (only if uncommented)
  const handleViewOrderRegex = /\n  const handleViewOrder = \(order\) => \{[\s\S]*?setSelectedOrder\(order\)\n[\s\S]*?\}/g;
  content = content.replace(handleViewOrderRegex, '\n  const handleViewOrder = (order) => {\n    setSelectedOrder(order)\n  }');

  // Remove handleCloseModal (only if uncommented)
  const handleCloseModalRegex = /\n  const handleCloseModal = \(\) => \{[\s\S]*?\}\n/g;
  content = content.replace(handleCloseModalRegex, '');

  const safeHandlersToRemove = [
    /\n  const handlePrint = useReactToPrint\(\{[\s\S]*?\}\)\n/g,
    /\n  const handleSaveOrderDetails = async \(\) => \{[\s\S]*?catch \(error\) \{[\s\S]*?\}\n  \}\n/g,
    /\n  const handleConfirmSendNotification = async \(\) => \{[\s\S]*?catch \(error\) \{[\s\S]*?\}\n  \}\n/g,
  ];
  safeHandlersToRemove.forEach(regex => {
    content = content.replace(regex, '');
  });

  // Now replace the modal JSX
  // We need to replace from `{/* Comprehensive Order Details Modal */}` OR `{/* Order Details Modal */}` down to the end of the notification modal.
  // We can look for the start of the modal, and the end by looking for the last `</div>` before the outer closing `</div>` `</div>` `)` `}`
  // Since JSX matching via regex is hard, let's match from `{/\* (?:Comprehensive )?Order Details Modal \*/}` to `{/\* Notification Modal \*/}[\s\S]*?\}\)\n\s*\}\n\s*<\/div>\n\s*<\/div>\n\s*\)\n\}/;
  
  // Actually, we can just replace everything from the Modal start comment to the end of the main div
  const jsxRegex = /\{?\/\*\s*(?:Comprehensive )?Order Details Modal\s*\*\/?\}?[\s\S]*?(?=\s*<\/div>\s*<\/div>\s*\)\s*\}\s*export default)/;
  
  // Wait, the end is:
  //      </div>
  //    </div>
  //  )
  // }
  // export default NewOrders

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
  content = content.replace(jsxRegex, replacementJSX);
  
  fs.writeFileSync(filePath, content);
  console.log(`Processed ${file}`);
});
