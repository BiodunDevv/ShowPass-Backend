const paystackAPI = require("../config/paystack");
const { generateReference } = require("./helpers");

// Initialize payment with Paystack
const initializePayment = async (email, amount, metadata = {}) => {
  try {
    const reference = generateReference("SP_PAY");

    const response = await paystackAPI.post("/transaction/initialize", {
      email,
      amount: amount * 100, // Convert to kobo (Paystack uses kobo)
      reference,
      currency: "NGN",
      metadata: {
        ...metadata,
        platform: "ShowPass",
      },
      callback_url: `${process.env.BASE_URL}/payment/callback`,
      channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
    });

    return {
      success: true,
      data: response.data.data,
      reference,
    };
  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: error.response?.data?.message || "Payment initialization failed",
    };
  }
};

// Verify payment with Paystack
const verifyPayment = async (reference) => {
  try {
    const response = await paystackAPI.get(`/transaction/verify/${reference}`);

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error(
      "Paystack verification error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: error.response?.data?.message || "Payment verification failed",
    };
  }
};

// List transactions
const listTransactions = async (page = 1, perPage = 50) => {
  try {
    const response = await paystackAPI.get("/transaction", {
      params: {
        page,
        perPage,
      },
    });

    return {
      success: true,
      data: response.data.data,
      meta: response.data.meta,
    };
  } catch (error) {
    console.error(
      "Paystack list transactions error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch transactions",
    };
  }
};

// Initiate refund
const initiateRefund = async (
  transactionReference,
  amount,
  merchantNote = ""
) => {
  try {
    const response = await paystackAPI.post("/refund", {
      transaction: transactionReference,
      amount: amount * 100, // Convert to kobo
      currency: "NGN",
      customer_note: merchantNote,
      merchant_note: `ShowPass refund: ${merchantNote}`,
    });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error(
      "Paystack refund error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: error.response?.data?.message || "Refund initiation failed",
    };
  }
};

// Get refund details
const getRefundDetails = async (refundId) => {
  try {
    const response = await paystackAPI.get(`/refund/${refundId}`);

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error(
      "Paystack refund details error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message:
        error.response?.data?.message || "Failed to fetch refund details",
    };
  }
};

// List refunds
const listRefunds = async (page = 1, perPage = 50) => {
  try {
    const response = await paystackAPI.get("/refund", {
      params: {
        page,
        perPage,
      },
    });

    return {
      success: true,
      data: response.data.data,
      meta: response.data.meta,
    };
  } catch (error) {
    console.error(
      "Paystack list refunds error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch refunds",
    };
  }
};

// Create customer
const createCustomer = async (email, firstName, lastName, phone = "") => {
  try {
    const response = await paystackAPI.post("/customer", {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
    });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error(
      "Paystack create customer error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message: error.response?.data?.message || "Customer creation failed",
    };
  }
};

// Get transaction timeline
const getTransactionTimeline = async (transactionId) => {
  try {
    const response = await paystackAPI.get(
      `/transaction/timeline/${transactionId}`
    );

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error(
      "Paystack timeline error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message:
        error.response?.data?.message || "Failed to fetch transaction timeline",
    };
  }
};

// Validate webhook signature
const validateWebhookSignature = (payload, signature) => {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(payload))
    .digest("hex");

  return hash === signature;
};

module.exports = {
  initializePayment,
  verifyPayment,
  listTransactions,
  initiateRefund,
  getRefundDetails,
  listRefunds,
  createCustomer,
  getTransactionTimeline,
  validateWebhookSignature,
};
