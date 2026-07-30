'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { AWS_REGION } = require('./config');

// Region only — credentials are provided by the EC2 instance's IAM role at
// runtime. Never pass accessKeyId / secretAccessKey here.
const client = new DynamoDBClient({ region: AWS_REGION });

const docClient = DynamoDBDocumentClient.from(client);

module.exports = docClient;
