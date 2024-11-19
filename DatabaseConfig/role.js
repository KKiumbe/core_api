const ROLE_PERMISSIONS = {
    admin: {
      customers: ["create", "read", "update", "delete"],
      users: ["create", "read", "update", "delete"],
      invoices: ["create", "read", "update", "delete"],
      receipts: ["create", "read", "update", "delete"],
      payments: ["create", "read", "update", "delete"],
      sms: ["create", "read", "update", "delete"],
      mpesaTransactions: ["create", "read", "update", "delete"],
    },
    customer_manager: {
      customers: ["create", "read", "update"],
      invoices: ["read"],
    },
    accountant: {
      receipts: ["create", "read"],
      payments: ["create", "read"],
    },
    collector: {
      customers: ["read", "update_collected"], // Custom action for updating 'collected'
    },
  };
   
  module.exports = ROLE_PERMISSIONS;
  