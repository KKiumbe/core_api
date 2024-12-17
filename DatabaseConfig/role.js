const ROLE_PERMISSIONS = {
    admin: {
      customer: ["create", "read", "update", "delete"],
      user: ["create", "read", "update", "delete"],
      invoice: ["create", "read", "update", "delete"],
      receipt: ["create", "read", "update", "delete"],
      payment: ["create", "read", "update", "delete"],
      sms: ["create", "read", "update", "delete"],
      mpesaTransaction: ["create", "read", "update", "delete"],
    },
    customer_manager: {
      customer: ["create", "read", "update"],
      invoice: ["read"],
    },
    accountant: {
      receipt: ["create", "read"],
      payment: ["create", "read"],
    },
    collector: {
      customer: ["read", "update_collected"], // Custom action for updating 'collected'
    },
    default:{

    
    }
  };
   
  module.exports = ROLE_PERMISSIONS;
  