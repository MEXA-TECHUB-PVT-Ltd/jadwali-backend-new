exports.sendJsonResponse = async (res, statusCode, status, message, result = null) => {
  const response = {
    status,
    message,
  };

  // Include result in the response if provided
  if (result) {
    response.result = result;
  }

  return res.status(statusCode).json(response);
}
