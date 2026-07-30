const fs = require('fs');
const path = require('path');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, TABLE_NAME } = require('./db');

async function seed() {
  const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'mock-data.json'), 'utf8'));
  for (const item of items) {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`Seeded: ${item.title}`);
  }
  console.log(`Done — ${items.length} items written to ${TABLE_NAME}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
