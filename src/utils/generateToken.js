import jwt from "jsonwebtoken";

export const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
};

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "14d",
  });

  const refreshToken = generateRefreshToken(userId);

  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };

  res.cookie("synkroKey", token, {
    ...cookieOpts,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOpts,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return token;
};
