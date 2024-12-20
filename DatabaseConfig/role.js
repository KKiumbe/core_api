const ROLE_PERMISSIONS = {
  admin: {
    Customer: ["create", "read", "update", "delete"],
    User: ["create", "read", "update", "delete"],
    Invoice: ["create", "read", "update", "delete"],
    Receipt: ["create", "read", "update", "delete"],
    Payment: ["create", "read", "update", "delete"],
    Sms: ["create", "read", "update", "delete"],
    MpesaTransaction: ["create", "read", "update", "delete"],
    TrashBagTask: ["create", "read", "update", "delete"],
  },
  customer_manager: {
    Customer: ["create", "read"],
    Invoice: ["create", "read"],
    Receipt: ["create", "read"],
    Payment: ["create", "read"],
    Sms: ["create", "read"],
    MpesaTransaction: ["create", "read"],
    TrashBagTask: ["create", "read"],
  },
  accountant: {
    Receipt: ["create", "read"],
    Payment: ["create", "read"],
  },
  collector: {
    Customer: ["read", "update"],
  },
  default: {},
};

module.exports = ROLE_PERMISSIONS;
