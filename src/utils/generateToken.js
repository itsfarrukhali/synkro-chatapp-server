import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "14d",
  });

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("synkroKey", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    path: "/",
    domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
  });

  return token;
};

export const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
};
