#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { MonPetitBizStack } from '../lib/monpetitbiz-stack';

const app = new App();

new MonPetitBizStack(app, 'MonPetitBizStack', {
  env: {
    // Set your preferred account/region via environment variables or profiles
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ca-central-1',
  },
});



