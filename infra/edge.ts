// La entrada del panel: CloudFront delante de la Web Function y de los estáticos (plan §5.2, CA-33).
//
// - Los estáticos (`/assets/*`) salen de un bucket privado, con OAC y caché de un año: sus nombres
//   llevan hash y no cambian nunca.
// - Todo lo demás va a la Web Function sin caché. CloudFront firma cada pedido con OAC
//   (`always-amz-auth`, el único que aceptan las Web Functions) y reenvía todo menos el `Host`:
//   con el `Host` del navegador, el endpoint responde 404.
// - Sin web ACL y con pago por uso hasta M4 (decisión D).
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { FUNCTION_NAME, PUBLIC_ORIGINS_PARAMETER } from './names.ts';
import { UPLOAD_MEMORY_MB, type PanelFunction } from './web-function.ts';

/** La subida adivina el tipo por la extensión y no conoce `.woff2`: sin decírselo, las tipografías salen como `binary/octet-stream`. */
export const FONT_FILES = '*.woff2';
export const FONT_CONTENT_TYPE = 'font/woff2';

/**
 * El bucket de los estáticos y sus dos subidas: las tipografías con su tipo, y todo lo demás. Ninguna
 * poda: un navegador con el HTML anterior pide los archivos anteriores, y cada una borraría los de la otra.
 */
export function createStaticSite(scope: Construct, staticAssetPath: string) {
  const bucket = new s3.Bucket(scope, 'StaticBucket', {
    encryption: s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    removalPolicy: RemovalPolicy.RETAIN,
  });
  const upload = {
    sources: [s3deploy.Source.asset(staticAssetPath)],
    destinationBucket: bucket,
    prune: false,
    cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
    memoryLimit: UPLOAD_MEMORY_MB,
  };
  const uploads = [
    new s3deploy.BucketDeployment(scope, 'StaticUpload', { ...upload, exclude: [FONT_FILES] }),
    new s3deploy.BucketDeployment(scope, 'FontUpload', { ...upload, exclude: ['*'], include: [FONT_FILES], contentType: FONT_CONTENT_TYPE }),
  ];
  return { bucket, uploads };
}

/** La firma de CloudFront hacia la Web Function. */
function createLambdaOac(scope: Construct): cloudfront.CfnOriginAccessControl {
  return new cloudfront.CfnOriginAccessControl(scope, 'PanelOac', {
    originAccessControlConfig: {
      name: `${FUNCTION_NAME}-oac`,
      originAccessControlOriginType: 'lambda',
      signingBehavior: 'always-amz-auth',
      signingProtocol: 'sigv4',
    },
  });
}

/** Que solo esta distribución pueda llamar al endpoint (`IamAuth`). */
function allowDistribution(scope: Construct, panel: PanelFunction, distribution: cloudfront.Distribution): void {
  const distributionArn = Stack.of(scope).formatArn({ service: 'cloudfront', region: '', resource: 'distribution', resourceName: distribution.distributionId });
  new lambda.CfnResourcePolicy(scope, 'CloudFrontMayInvoke', {
    resourceArn: panel.webFunction.attrFunctionArn,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Sid: 'AllowThisDistributionOnly',
        Effect: 'Allow',
        Principal: { Service: 'cloudfront.amazonaws.com' },
        Action: 'lambda:InvokeWebFunctionEndpoint',
        Resource: panel.endpoint.attrEndpointArn,
        Condition: { ArnLike: { 'aws:SourceArn': distributionArn } },
      }],
    },
  });
}

/** La distribución, el permiso para que llame al endpoint, y el origen público que lee el servidor al arrancar. */
export function createDistribution(scope: Construct, panel: PanelFunction, staticBucket: s3.Bucket): cloudfront.Distribution {
  const oac = createLambdaOac(scope);
  const distribution = new cloudfront.Distribution(scope, 'Distribution', {
    comment: 'Panel del equipo ENSO (aios-admin)',
    httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    defaultBehavior: {
      origin: new origins.HttpOrigin(panel.endpoint.attrDomainName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        originAccessControlId: oac.attrId,
      }),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    },
    additionalBehaviors: {
      '/assets/*': {
        origin: origins.S3BucketOrigin.withOriginAccessControl(staticBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    },
  });
  allowDistribution(scope, panel, distribution);
  new ssm.StringParameter(scope, 'PublicOriginsParameter', {
    parameterName: PUBLIC_ORIGINS_PARAMETER,
    stringValue: `https://${distribution.distributionDomainName}`,
    description: 'Los orígenes públicos del panel (PUBLIC_ORIGINS), separados por coma',
  });
  return distribution;
}
