/*
  This module was created by Chat GPT using the following prompts:
  Write me a function in JS, that takes two strings, and does a fuzzy match to see if the first string contains the second string, this way if the second string has a typo or misspelling in it we still get a partial match. Make it return a score between 0 and 10 that indicates the strength of the match, with a perfect 10 being a perfect match, and a 0 being no characters match with the threashold greater than 3. Give  a higher score if the match is towards the beginning of the first string.
*/

export const fuzzyMatch = (str1, str2) => {
  const levenshteinDistance = (s1, s2) => {
      const m = s1.length;
      const n = s2.length;
      const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

      for (let i = 0; i <= m; i++) {
          for (let j = 0; j <= n; j++) {
              if (i === 0) dp[i][j] = j;
              else if (j === 0) dp[i][j] = i;
              else dp[i][j] = Math.min(
                  dp[i - 1][j - 1] + (s1.charAt(i - 1) === s2.charAt(j - 1) ? 0 : 1),
                  dp[i][j - 1] + 1,
                  dp[i - 1][j] + 1
              );
          }
      }

      return dp[m][n];
  };

  const fuzzyThreshold = 3;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  
  if (distance === 0) {
      return 10; // Perfect match
  }

  const score = Math.max(0, 10 - distance / fuzzyThreshold);
  
  const positionScore = Math.min((str1.length - distance) / str1.length, 1);
  
  return Math.round(score * 5 + positionScore * 5); // Scale to 0-10
};

/*
  Chat GPT Prompt
  Can you write another function that takes an array of strings, and a string, creates a score based on how well the second string matches each of the function you created above. Then find the average non-zero match of the second string to the items in the array
*/
export const fuzzyMatchArray = (array, targetString) => {
  const nonZeroScores = array
      .map(currentString => fuzzyMatch(currentString, targetString))
      .filter(score => score !== 0);
  if (nonZeroScores.length === 0) {
      return 0; // Return 0 if there are no non-zero scores
  }
  const averageScore = nonZeroScores.reduce((sum, score) => sum + score, 0) / nonZeroScores.length;
  return averageScore;
};