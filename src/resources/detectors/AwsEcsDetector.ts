import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';
import * as https from 'https';

/**
 * AwsEcsDetector detects the resources related with AWS ECS (EC2 and Fargate).
 */
 export class AwsEcsDetector implements Detector {

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
        const metadataUriV4 = process.env['ECS_CONTAINER_METADATA_URI_V4'];

        if (!metadataUriV4) {
            return Promise.resolve(Resource.EMPTY);
        }

        // Returns https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint-v4.html#task-metadata-endpoint-v4-response
        return Promise.all([this.getUri(metadataUriV4), this.getUri(`${metadataUriV4}/task`)]).then(responses => {
            const [responseContainer, responseTask] = responses;

            const taskArn: string = responseTask['TaskARN'];

            const baseArn: string = taskArn.substring(0, taskArn.lastIndexOf(':'));
            const cluster: string = responseTask['Cluster'];

            const clusterArn = cluster.indexOf('arn:') == 0 ? cluster : `${baseArn}:cluster/${cluster}`;

            const containerArn: string = responseContainer['ContainerARN'];

            // https://github.com/open-telemetry/opentelemetry-specification/blob/main/semantic_conventions/resource/cloud_provider/aws/ecs.yaml
            return new Resource({
                [SemanticResourceAttributes.AWS_ECS_CONTAINER_ARN]: containerArn,
                [SemanticResourceAttributes.AWS_ECS_CLUSTER_ARN]: clusterArn,
                [SemanticResourceAttributes.AWS_ECS_LAUNCHTYPE]: responseTask['LaunchType'],
                [SemanticResourceAttributes.AWS_ECS_TASK_ARN]: taskArn,
                [SemanticResourceAttributes.AWS_ECS_TASK_FAMILY]: responseTask['Family'],
                [SemanticResourceAttributes.AWS_ECS_TASK_REVISION]: responseTask['Revision']
            });
        });
    }

    async getUri(uri: string): Promise<Object> {
        const responseBody = await new Promise((resolve, reject) => {
            const request = https.get(uri, response => {
                if (response.statusCode >= 400) {
                    reject(`Request to '${uri}' failed with status ${response.statusCode}`);
                }

                /*
                 * Concatenate the response out of chunks:
                 * https://nodejs.org/api/stream.html#stream_event_data
                 */
                let responseBody = '';
                response.on('data', chunk => responseBody += chunk.toString());
                // All the data has been read, resolve the Promise 
                response.on('end', () => resolve(responseBody));
            });
            // Set an aggressive timeout to prevent lock-ups
            request.setTimeout(5, () => {
                request.destroy();
            });
            // Connection error, disconnection, etc.
            request.on('error', reject);
            request.end();
        });

        return JSON.parse(responseBody.toString());
    }

}