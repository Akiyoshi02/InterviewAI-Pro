/**
 * Name Generator Utility
 * Generates random names for AI interviewers based on gender
 */

const FEMALE_FIRST_NAMES = [
  'Alexis', 'Amanda', 'Andrea', 'Ashley', 'Brittany', 'Brooke', 'Caitlin', 'Cassandra',
  'Chloe', 'Christina', 'Claire', 'Diana', 'Emily', 'Emma', 'Grace', 'Hannah',
  'Isabella', 'Jessica', 'Julia', 'Katherine', 'Lauren', 'Madison', 'Maya', 'Megan',
  'Michelle', 'Nicole', 'Olivia', 'Rachel', 'Rebecca', 'Samantha', 'Sarah', 'Sophia',
  'Stephanie', 'Taylor', 'Victoria', 'Zoe', 'Aria', 'Elena', 'Nina', 'Luna'
];

const MALE_FIRST_NAMES = [
  'Alexander', 'Andrew', 'Benjamin', 'Brandon', 'Cameron', 'Christopher', 'Daniel',
  'David', 'Ethan', 'James', 'Jason', 'Jonathan', 'Jordan', 'Joshua', 'Justin',
  'Kevin', 'Kyle', 'Logan', 'Matthew', 'Michael', 'Nathan', 'Nicholas', 'Noah',
  'Ryan', 'Samuel', 'Sean', 'Thomas', 'Tyler', 'William', 'Zachary', 'Marcus',
  'Lucas', 'Oliver', 'Henry', 'Jack', 'Leo', 'Owen', 'Mason', 'Aiden'
];

const LAST_NAMES = [
  'Anderson', 'Brown', 'Chen', 'Clark', 'Davis', 'Garcia', 'Harris', 'Jackson',
  'Johnson', 'Jones', 'Kim', 'Lee', 'Lewis', 'Martinez', 'Miller', 'Moore',
  'Patel', 'Rodriguez', 'Smith', 'Taylor', 'Thomas', 'Thompson', 'Walker', 'White',
  'Williams', 'Wilson', 'Wong', 'Wright', 'Young', 'Zhang', 'Adams', 'Baker',
  'Campbell', 'Carter', 'Cooper', 'Evans', 'Green', 'Hall', 'Hill', 'King',
  'Mitchell', 'Murphy', 'Parker', 'Phillips', 'Roberts', 'Robinson', 'Scott', 'Stewart'
];

/**
 * Generate a random name based on gender
 * @param {string} gender - 'male' or 'female'
 * @returns {string} - Full name (First Last)
 */
export function generateRandomName(gender = 'female') {
  const isFemale = gender.toLowerCase() === 'female';
  const firstNames = isFemale ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  
  const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  
  return `${randomFirstName} ${randomLastName}`;
}

/**
 * Generate multiple random names
 * @param {string} gender - 'male' or 'female'
 * @param {number} count - Number of names to generate
 * @returns {Array<string>} - Array of full names
 */
export function generateRandomNames(gender = 'female', count = 5) {
  const names = [];
  const seen = new Set();
  
  while (names.length < count) {
    const name = generateRandomName(gender);
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  
  return names;
}

/**
 * Detect the gender of a name based on the first name
 * @param {string} fullName - Full name (First Last)
 * @returns {string|null} - 'male', 'female', or null if cannot determine
 */
export function detectNameGender(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return null;
  }
  
  const firstName = fullName.trim().split(' ')[0];
  
  if (FEMALE_FIRST_NAMES.includes(firstName)) {
    return 'female';
  }
  
  if (MALE_FIRST_NAMES.includes(firstName)) {
    return 'male';
  }
  
  return null;
}

