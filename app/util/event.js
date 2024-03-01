exports.generateRandomSuffix = () => {
  // Generate a random letter (a-z)
  const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));

  // Generate a random number (0-99)
  const randomNumber = Math.floor(Math.random() * 100);

  // Return the combination of random letter and number
  return `${randomChar}${randomNumber}`;
};

