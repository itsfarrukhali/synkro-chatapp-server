// Validation patterns
export const validators = {
  email:
    /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,

  username: /^[a-zA-Z][a-zA-Z0-9_]{2,15}$/,

  fullName: /^[a-zA-Z\s]{2,50}$/,

  password:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
};

// Validation functions
export const validateEmail = (email) => {
  if (!email) return { isValid: false, message: "Email is required" };
  if (!validators.email.test(email)) {
    return { isValid: false, message: "Please enter a valid email address" };
  }
  return { isValid: true };
};

export const validateUsername = (username) => {
  if (!username) return { isValid: false, message: "Username is required" };
  if (!validators.username.test(username)) {
    return {
      isValid: false,
      message:
        "Username must start with a letter and contain only letters, numbers, and underscores. Length: 3-16 characters",
    };
  }
  return { isValid: true };
};

export const validateFullName = (fullName) => {
  if (!fullName) return { isValid: false, message: "Full name is required" };
  if (!validators.fullName.test(fullName)) {
    return {
      isValid: false,
      message:
        "Full name must contain only letters and spaces (2-50 characters)",
    };
  }
  return { isValid: true };
};

export const validatePassword = (password) => {
  if (!password) return { isValid: false, message: "Password is required" };
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }
  if (!validators.password.test(password)) {
    return {
      isValid: false,
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)",
    };
  }
  return { isValid: true };
};

// Check username availability
export const checkUsernameAvailability = async (username, UserModel) => {
  const existingUser = await UserModel.findOne({
    userName: username.toLowerCase(),
  });
  if (existingUser) {
    return {
      isAvailable: false,
      suggestions: await generateUsernameSuggestions(username, UserModel),
    };
  }
  return { isAvailable: true, suggestions: [] };
};

// Generate username suggestions
const generateUsernameSuggestions = async (baseUsername, UserModel) => {
  const suggestions = [];
  const suffixes = ["", "1", "2", "3", "_", "_123", "_dev", "_chat"];

  for (const suffix of suffixes) {
    const suggestion = `${baseUsername}${suffix}`.toLowerCase();
    const exists = await UserModel.findOne({ userName: suggestion });
    if (!exists && suggestion.length <= 16 && suggestion.length >= 3) {
      suggestions.push(suggestion);
      if (suggestions.length === 3) break;
    }
  }

  return suggestions;
};
