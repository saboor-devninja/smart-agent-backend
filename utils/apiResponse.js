const config = require("../config/config");

exports.errorResponse = (err, res) => {
  err.status = err.status || "error";
  err.statusCode = err.statusCode || 500;

  if (config.env == "development") {
    res.status(err.statusCode).json({
      code: err.statusCode,
      message: err.message,
      data: null,
      stack_trace: err.stack,
      status: "Error",
    });
  } else {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        code: err.statusCode,
        message: err.message,
        data: null,
        status: "Error",
      });
    } else {
      console.log("err", err);
      res.status(err.statusCode).json({
        code: err.statusCode,
        status: "Error",
        message: "Something Went Wrong Try Again Later",
        data: null,
      });
    }
  }
};

exports.successResponse = (res, data, message, code) => {
  return res.status(code).json({ code, data, message, status: "Success" });
};

