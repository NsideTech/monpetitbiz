import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class MonPetitBizStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const lean = (this.node.tryGetContext('lean') as string) === 'true';
    const externalDbUrl = this.node.tryGetContext('databaseUrl') as string | undefined;
    const memoryMb = Number(this.node.tryGetContext('memoryMb') ?? 1024);

    // S3 bucket for files (optional but cheap)
    const filesBucket = new s3.Bucket(this, 'FilesBucket', {
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    if (lean) {
      // Lean MVP: no VPC, no NAT, no RDS/Proxy. Use external Postgres (e.g., Neon/Supabase)
      if (!externalDbUrl) {
        throw new Error('Context "databaseUrl" is required when "lean" is true. Pass: -c databaseUrl=postgresql://...');
      }

      const fn = new lambda.Function(this, 'ApiLambda', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'dist/lambda.handler',
        code: lambda.Code.fromAsset('../..'),
        memorySize: memoryMb,
        timeout: Duration.seconds(29),
        environment: {
          NODE_ENV: 'production',
          FILES_BUCKET: filesBucket.bucketName,
          DATABASE_URL: externalDbUrl,
        },
      });

      filesBucket.grantReadWrite(fn);

      const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
        apiName: `${this.stackName}-api`,
      });
      const integration = new apigwv2Integrations.HttpLambdaIntegration('LambdaIntegration', fn);
      httpApi.addRoutes({ path: '/{proxy+}', methods: [apigwv2.HttpMethod.ANY], integration });

      new CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint });
      new CfnOutput(this, 'FilesBucketName', { value: filesBucket.bucketName });
      return;
    }

    // Standard stack: VPC + RDS + Proxy
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    const dbSg = new ec2.SecurityGroup(this, 'DbSg', { vpc, allowAllOutbound: false });
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', { vpc, allowAllOutbound: true });
    dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), 'Lambda to DB');

    const dbName = 'monpetitbiz';
    const dbUser = 'appuser';
    const dbCredentials = new rds.DatabaseSecret(this, 'DbSecret', {
      username: dbUser,
      secretName: `${this.stackName}/db-credentials`,
      excludePunctuation: true,
    });

    const dbInstance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.V16 }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbCredentials),
      allocatedStorage: 20,
      multiAz: false,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: dbName,
    });

    const dbProxy = new rds.DatabaseProxy(this, 'DbProxy', {
      proxyTarget: rds.ProxyTarget.fromInstance(dbInstance),
      secrets: [dbCredentials],
      vpc,
      securityGroups: [dbSg],
      requireTLS: true,
      idleClientTimeout: Duration.minutes(30),
      maxConnectionsPercent: 90,
    });

    const fn = new lambda.Function(this, 'ApiLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dist/lambda.handler',
      code: lambda.Code.fromAsset('../..'),
      memorySize: memoryMb,
      timeout: Duration.seconds(29),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        NODE_ENV: 'production',
        FILES_BUCKET: filesBucket.bucketName,
        DATABASE_URL: `postgresql://${dbUser}:${dbCredentials.secretValueFromJson('password').unsafeUnwrap()}@${dbProxy.endpoint}:5432/${dbName}`,
      },
    });

    dbCredentials.grantRead(fn);
    filesBucket.grantReadWrite(fn);
    dbProxy.grantConnect(fn, dbUser);

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `${this.stackName}-api`,
    });
    const integration = new apigwv2Integrations.HttpLambdaIntegration('LambdaIntegration', fn);
    httpApi.addRoutes({ path: '/{proxy+}', methods: [apigwv2.HttpMethod.ANY], integration });

    new CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'DbProxyEndpoint', { value: dbProxy.endpoint });
    new CfnOutput(this, 'FilesBucketName', { value: filesBucket.bucketName });
  }
}


