// Las alarmas del panel (CA-33). Avisan al tema del backend, que ya cubre la cuenta entera.
//
// Las métricas de la Web Function son escasas: un período sin errores no publica un 0. Por eso la
// falta de datos cuenta como «sin problema».
import { Duration, Stack } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import type { Construct } from 'constructs';
import { BACKEND_ALARM_TOPIC_NAME, ENDPOINT_NAME, FUNCTION_NAME } from './names.ts';

const PERIOD = Duration.minutes(5);
/** Con tres personas, tres errores en cinco minutos ya es un patrón y no una casualidad. */
export const SERVER_ERRORS_THRESHOLD = 3;
/** Cada límite que puede frenar un pedido tiene su métrica; cualquiera de ellos es una señal. */
export const THROTTLE_METRICS = ['EndpointRequestThrottles', 'EndpointActiveEnvironmentThrottles', 'AccountRequestThrottles', 'AccountActiveVCPUArm64Throttles'];

export function createAlarms(scope: Construct): cloudwatch.Alarm[] {
  const stack = Stack.of(scope);
  const topic = sns.Topic.fromTopicArn(scope, 'BackendAlarmTopic', stack.formatArn({ service: 'sns', resource: BACKEND_ALARM_TOPIC_NAME }));
  const dimensionsMap = { FunctionName: FUNCTION_NAME, EndpointName: ENDPOINT_NAME };
  const serverErrors = new cloudwatch.Alarm(scope, 'ServerErrorsAlarm', {
    alarmName: 'aios-admin-5xx',
    alarmDescription: 'El panel del equipo respondió errores 5xx: revisa sus logs (/aws/lambda/web/aios-admin-panel)',
    metric: new cloudwatch.Metric({ namespace: 'AWS/Lambda/Web', metricName: 'HTTPResponseStatusClass5XX', dimensionsMap, statistic: 'Sum', period: PERIOD }),
    threshold: SERVER_ERRORS_THRESHOLD,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
  const usingMetrics = Object.fromEntries(THROTTLE_METRICS.map((metricName, i) => [`m${i}`, new cloudwatch.Metric({
    namespace: 'AWS/Lambda/Web/Usage', metricName, dimensionsMap: { ...dimensionsMap, ExecutionRegion: stack.region }, statistic: 'Sum', period: PERIOD,
  })]));
  const throttles = new cloudwatch.Alarm(scope, 'ThrottlesAlarm', {
    alarmName: 'aios-admin-throttles',
    alarmDescription: 'Lambda frenó pedidos al panel del equipo: llegó a un límite del endpoint o de la cuenta',
    metric: new cloudwatch.MathExpression({ expression: Object.keys(usingMetrics).map((id) => `FILL(${id}, 0)`).join(' + '), usingMetrics, period: PERIOD, label: 'Pedidos frenados' }),
    threshold: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
  for (const alarm of [serverErrors, throttles]) alarm.addAlarmAction(new actions.SnsAction(topic));
  return [serverErrors, throttles];
}
