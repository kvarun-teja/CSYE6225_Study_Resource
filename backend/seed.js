'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const docClient = require('./db');
const { RESOURCES_TABLE } = require('./config');

async function seed() {
  const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'mock-data.json'), 'utf8'));
  for (const item of items) {
    await docClient.send(new PutCommand({ TableName: RESOURCES_TABLE, Item: item }));
    console.log(`Seeded: ${item.title}`);
  }
  console.log(`Done — ${items.length} items written to ${RESOURCES_TABLE}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
