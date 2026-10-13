import seedDatabase from '../server/utils/setup/seedDatabase.js';

await seedDatabase();
process.exit(0);
