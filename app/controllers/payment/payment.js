exports.paymentCallback = async (req, res) => {
  try {
    console.log(req);

    return res.status(200).json({ message: "hello world!" });
  } catch (error) {
    console.log("Payment Callback Error", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};
exports.paymentReturn = async (req, res) => {
  try {
    console.log(req);
  } catch (error) {
    console.log("Payment Return Error", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};
